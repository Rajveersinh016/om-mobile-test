import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { collectionService } from '../services/collectionService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import { createCollectionSchema, updateCollectionSchema } from '../validators/catalogValidator.js';

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

export class CollectionController {
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const isAdmin = request.user?.role === 'ADMIN';
      const { includeDeleted } = (request.query || {}) as { includeDeleted?: string };
      const collections = await collectionService.getAllCollections(isAdmin, includeDeleted === 'true');
      return reply.status(200).send({
        success: true,
        data: collections,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: err.message || 'Failed to fetch collections',
        data: [],
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const collection = await collectionService.getCollectionById(id);
    return reply.status(200).send({
      success: true,
      data: collection,
    });
  }

  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const collection = await collectionService.getCollectionBySlug(slug);
    return reply.status(200).send({
      success: true,
      data: collection,
    });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createCollectionSchema, request.body);
    const collection = await collectionService.createCollection(body);
    return reply.status(201).send({
      success: true,
      data: collection,
    });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateCollectionSchema, request.body);
    const collection = await collectionService.updateCollection(id, body);
    return reply.status(200).send({
      success: true,
      data: collection,
    });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const collection = await collectionService.deleteCollection(id);
    return reply.status(200).send({
      success: true,
      message: `Collection '${collection.name}' soft-deleted successfully`,
    });
  }

  async restore(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const collection = await collectionService.restoreCollection(id);
    return reply.status(200).send({
      success: true,
      data: collection,
      message: `Collection '${collection.name}' restored successfully`,
    });
  }

  async permanentDelete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await collectionService.permanentDeleteCollection(id);
    return reply.status(200).send({
      success: true,
      message: 'Collection permanently deleted',
    });
  }

  async duplicate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const collection = await collectionService.duplicateCollection(id);
    return reply.status(201).send({
      success: true,
      data: collection,
    });
  }
}

export const collectionController = new CollectionController();
