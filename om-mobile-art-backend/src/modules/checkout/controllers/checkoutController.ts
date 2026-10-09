import { FastifyRequest, FastifyReply } from 'fastify';
import { checkoutService } from '../services/checkoutService.js';
import { webhookService } from '../services/webhookService.js';
import { idempotencyService } from '../../../services/idempotencyService.js';
import { cartService } from '../../cart/services/cartService.js';
import { AuthenticationError, ValidationError } from '../../../core/exceptions/exceptions.js';
import { PaymentGateway } from '@prisma/client';

export class CheckoutController {
  async getCheckoutState(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const state = await checkoutService.getCheckoutState(user.id);
    return reply.status(200).send({
      success: true,
      data: state,
    });
  }

  async getCheckoutSummary(request: FastifyRequest, reply: FastifyReply) {
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

  /**
   * POST /api/v1/checkout/prepare - Single Backend Authoritative Checkout Preparation
   */
  async prepareCheckout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const body = (request.body || {}) as {
      addressId?: string;
      shippingAddress?: any;
      couponCode?: string;
      gateway?: PaymentGateway;
      paymentMethod?: string;
      cartItems?: any[];
    };

    if (body.paymentMethod === 'COD') {
      const codOrder = await checkoutService.createCodOrder(
        user.id,
        body.addressId,
        body.shippingAddress,
        body.couponCode,
        body.cartItems
      );
      return reply.status(201).send({
        success: true,
        data: codOrder,
      });
    }

    const snapshot = await checkoutService.prepareCheckout(
      user.id,
      body.addressId,
      body.shippingAddress,
      body.couponCode,
      body.gateway || 'RAZORPAY',
      body.cartItems
    );

    return reply.status(200).send({
      success: true,
      data: snapshot,
    });
  }

  /**
   * Legacy POST /api/v1/checkout alias -> prepareCheckout or COD execution
   */
  async createCheckoutOrder(request: FastifyRequest, reply: FastifyReply) {
    return this.prepareCheckout(request, reply);
  }

  async handleRazorpayWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = (request.headers['x-razorpay-signature'] as string) || '';
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const result = await webhookService.processRazorpayWebhook(
      rawBody,
      signature,
      request.body
    );

    return reply.status(200).send(result);
  }
}

export const checkoutController = new CheckoutController();
