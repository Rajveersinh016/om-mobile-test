import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/paymentService.js';
import { z } from 'zod';
import { ValidationError } from '../../../core/exceptions/exceptions.js';

const createPaymentOrderSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, { message: 'razorpayOrderId is required' }),
  razorpayPaymentId: z.string().min(1, { message: 'razorpayPaymentId is required' }),
  razorpaySignature: z.string().min(1, { message: 'razorpaySignature is required' }),
  checkoutId: z.string().optional(),
  orderId: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export class PaymentController {
  async createOrder(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createPaymentOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const userId = (request.user as any)?.id;
    const result = await PaymentService.createRazorpayOrder(parseResult.data.orderId, userId);
    return reply.status(200).send({
      success: true,
      message: 'Razorpay order created successfully',
      data: result,
    });
  }

  async verifyPayment(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = verifyPaymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, paymentMethod, checkoutId } = parseResult.data;
    const result = await PaymentService.verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderId,
      paymentMethod,
      checkoutId
    );

    return reply.status(200).send({
      success: true,
      message: result.message,
      data: result.data,
    });
  }

  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = (request.headers['x-razorpay-signature'] as string) || '';
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const result = await PaymentService.handleWebhook(rawBody, signature);
    return reply.status(200).send(result);
  }

  async getPayment(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const payment = await PaymentService.getPaymentDetails(id);
    return reply.status(200).send({
      success: true,
      data: payment,
    });
  }
}

export const paymentController = new PaymentController();
