import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { productTypeService } from '../services/productTypeService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import { createProductTypeSchema, updateProductTypeSchema } from '../validators/catalogValidator.js';

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

export class ProductTypeController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const isAdmin = request.user?.role === 'ADMIN';
    const productTypes = await productTypeService.getAllProductTypes(isAdmin);
    return reply.status(200).send({
      success: true,
      data: productTypes,
    });
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const productType = await productTypeService.getProductTypeById(id);
    return reply.status(200).send({
      success: true,
      data: productType,
    });
  }

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const productType = await productTypeService.getProductTypeBySlug(slug);
    return reply.status(200).send({
      success: true,
      data: productType,
    });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createProductTypeSchema, request.body);
    const productType = await productTypeService.createProductType(body);
    return reply.status(201).send({
      success: true,
      data: productType,
    });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateProductTypeSchema, request.body);
    const productType = await productTypeService.updateProductType(id, body);
    return reply.status(200).send({
      success: true,
      data: productType,
    });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const productType = await productTypeService.deleteProductType(id);
    return reply.status(200).send({
      success: true,
      message: `Product type '${productType.name}' deleted successfully`,
    });
  }
}

export const productTypeController = new ProductTypeController();
