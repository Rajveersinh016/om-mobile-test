import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { productService } from '../services/productService.js';
import { uploadService } from '../services/uploadService.js';
import { imageUrlGenerator } from '../services/imageUrlGenerator.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import {
  createProductSchema,
  updateProductSchema,
  updateInventorySchema,
  uploadImageSchema,
  getProductsQuerySchema,
} from '../validators/catalogValidator.js';
import { prisma } from '../../../database/client.js';

function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      issue: err.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}

export class ProductController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const query = validateBody(getProductsQuerySchema, request.query);
    const isAdmin = request.user?.role === 'ADMIN';

    const result = await productService.getProducts({
      ...query,
      isAdmin,
    });

    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const isAdmin = request.user?.role === 'ADMIN';
    const product = await productService.getProductById(id, isAdmin);
    return reply.status(200).send({
      success: true,
      data: product,
    });
  }

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const isAdmin = request.user?.role === 'ADMIN';
    const product = await productService.getProductById(slug, isAdmin);
    return reply.status(200).send({
      success: true,
      data: product,
    });
  }

  async getRelated(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const products = await productService.getRelatedProducts(id);
    return reply.status(200).send({
      success: true,
      data: products,
    });
  }

  async getPreviews(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { modelId } = request.query as { modelId?: string };
    const where: any = { productId: id };
    if (modelId) where.modelId = modelId;

    const previews = await prisma.devicePreviewImage.findMany({
      where,
      include: { model: true }
    });

    return reply.status(200).send({
      success: true,
      data: previews
    });
  }

  async setPreview(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { modelId, imageUrl } = request.body as { modelId: string; imageUrl: string };

    const preview = await prisma.devicePreviewImage.upsert({
      where: {
        productId_modelId: {
          productId: id,
          modelId
        }
      },
      update: { imageUrl },
      create: {
        productId: id,
        modelId,
        imageUrl
      }
    });

    return reply.status(200).send({ success: true, data: preview });
  }

  async getFeatured(request: FastifyRequest, reply: FastifyReply) {
    const result = await productService.getProducts({
      isBestSeller: true,
      limit: 8,
      isAdmin: false,
    });
    return reply.status(200).send({
      success: true,
      data: result.products,
    });
  }

  async getNewest(request: FastifyRequest, reply: FastifyReply) {
    const result = await productService.getProducts({
      sortBy: 'created_at',
      limit: 8,
      isAdmin: false,
    });
    return reply.status(200).send({
      success: true,
      data: result.products,
    });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const body = validateBody(createProductSchema, request.body);
    const product = await productService.createProduct(user.id, body);
    return reply.status(201).send({
      success: true,
      data: product,
    });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const body = validateBody(updateProductSchema, request.body);
    const product = await productService.updateProduct(user.id, id, body);
    return reply.status(200).send({
      success: true,
      data: product,
    });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const res = await productService.softDeleteProduct(user.id, id);
    return reply.status(200).send({
      success: true,
      action: res.action,
      message: res.message,
    });
  }

  async permanentDelete(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const res = await productService.permanentDeleteProduct(user.id, id);
    return reply.status(200).send({
      success: true,
      action: res.action,
      message: res.message,
    });
  }

  async bulkDelete(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { ids } = request.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'No product IDs provided' });
    }

    const res = await productService.bulkDeleteProducts(user.id, ids);
    return reply.status(200).send({
      success: true,
      data: res,
      message: res.message,
    });
  }

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const duplicatedProduct = await productService.duplicateProduct(user.id, id);
    return reply.status(201).send({
      success: true,
      data: duplicatedProduct,
      message: `Product duplicated successfully`,
    });
  }

  async restore(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const product = await productService.restoreProduct(user.id, id);
    return reply.status(200).send({
      success: true,
      message: `Product '${product.name}' restored successfully`,
    });
  }

  async publish(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const product = await productService.publishProduct(user.id, id);
    return reply.status(200).send({
      success: true,
      message: `Product '${product.name}' published successfully`,
    });
  }

  async unpublish(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { id } = request.params as { id: string };
    const product = await productService.unpublishProduct(user.id, id);
    return reply.status(200).send({
      success: true,
      message: `Product '${product.name}' unpublished successfully`,
    });
  }

  async updateInventory(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { variantId } = request.params as { variantId: string };
    const body = validateBody(updateInventorySchema, request.body);
    const updatedVariant = await productService.updateInventory(user.id, variantId, body.stockQuantity);
    return reply.status(200).send({
      success: true,
      data: updatedVariant,
    });
  }

  async uploadImage(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(uploadImageSchema, request.body);
    const result = await uploadService.upload(body.content, body.filename);
    const url = imageUrlGenerator.generateUrl(result.key);
    return reply.status(200).send({
      success: true,
      data: { url },
    });
  }
}

export const productController = new ProductController();
