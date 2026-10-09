import { FastifyRequest, FastifyReply } from 'fastify';
import { ShippingService } from '../services/shippingService.js';
import { z } from 'zod';
import { ValidationError } from '../../../core/exceptions/exceptions.js';

const generateShipmentSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
});

const dispatchSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
});

const updateStatusSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
  status: z.string().min(1, { message: 'status is required' }),
  comment: z.string().optional(),
});

const cancelOrderSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
  reason: z.string().optional(),
});

export class ShippingController {
  async generateShipment(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = generateShipmentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const result = await ShippingService.generateShipment(parseResult.data.orderId);
    return reply.status(200).send(result);
  }

  async dispatchShipment(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = dispatchSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const result = await ShippingService.dispatchShipment(parseResult.data.orderId);
    return reply.status(200).send(result);
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = updateStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const { orderId, status, comment } = parseResult.data;
    const result = await ShippingService.updateStatus(orderId, status, comment);
    return reply.status(200).send(result);
  }

  async cancelOrder(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = cancelOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.errors.map(e => ({ field: e.path.join('.'), issue: e.message })));
    }

    const { orderId, reason } = parseResult.data;
    const result = await ShippingService.cancelOrderAndRestoreInventory(orderId, reason);
    return reply.status(200).send(result);
  }

  async getTrackingDetails(request: FastifyRequest<{ Params: { identifier: string } }>, reply: FastifyReply) {
    const { identifier } = request.params;
    const result = await ShippingService.getTrackingDetails(identifier);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async getShippingLabel(request: FastifyRequest<{ Params: { shipmentId: string } }>, reply: FastifyReply) {
    const { shipmentId } = request.params;
    const html = await ShippingService.generateShippingLabel(shipmentId);
    return reply.type('text/html').send(html);
  }

  async getAdminMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await ShippingService.getAdminDashboardMetrics();
    return reply.status(200).send({
      success: true,
      data: metrics,
    });
  }
}

export const shippingController = new ShippingController();
