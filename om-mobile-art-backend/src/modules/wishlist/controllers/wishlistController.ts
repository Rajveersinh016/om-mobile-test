import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { wishlistService } from '../services/wishlistService.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import { addToWishlistSchema } from '../validators/wishlistValidator.js';

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

export class WishlistController {
  async listWishlist(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const items = await wishlistService.listWishlist(user.id);
    return reply.status(200).send({
      success: true,
      data: items,
    });
  }

  async addToWishlist(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(addToWishlistSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const item = await wishlistService.addToWishlist(
      user.id,
      body.productId,
      body.productVariantId,
      ip,
      ua
    );
    return reply.status(201).send({
      success: true,
      data: item,
    });
  }

  async removeFromWishlist(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await wishlistService.removeFromWishlist(id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Item removed from wishlist successfully',
    });
  }

  async getWishlistCount(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const count = await wishlistService.getWishlistCount(user.id);
    return reply.status(200).send({
      success: true,
      data: { count },
    });
  }

  async moveToCart(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const result = await wishlistService.moveToCart(id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const wishlistController = new WishlistController();
