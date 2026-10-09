import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { cartService } from '../services/cartService.js';
import { ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import { addToCartSchema, updateCartItemSchema } from '../validators/cartValidator.js';

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

export class CartController {
  async getCart(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const cart = await cartService.getCart(user.id);
    return reply.status(200).send({
      success: true,
      data: cart,
    });
  }

  async addToCart(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const body = validateBody(addToCartSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const item = await cartService.addToCart(
      user.id,
      body.productId,
      body.productVariantId,
      body.quantity,
      ip,
      ua,
      body.deviceTypeId,
      body.modelId,
      body.customModelName
    );
    return reply.status(201).send({
      success: true,
      data: item,
    });
  }

  async updateCartItemQuantity(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const body = validateBody(updateCartItemSchema, request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    const item = await cartService.updateCartItemQuantity(id, user.id, body.quantity, ip, ua);
    return reply.status(200).send({
      success: true,
      data: item,
    });
  }

  async removeFromCart(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id } = request.params as { id: string };
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await cartService.removeFromCart(id, user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Item removed from cart successfully',
    });
  }

  async clearCart(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const ip = request.ip;
    const ua = request.headers['user-agent'] || '';

    await cartService.clearCart(user.id, ip, ua);
    return reply.status(200).send({
      success: true,
      message: 'Cart cleared successfully',
    });
  }

  async getCartSummary(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const summary = await cartService.getCartSummary(user.id);
    return reply.status(200).send({
      success: true,
      data: summary,
    });
  }
}

export const cartController = new CartController();
