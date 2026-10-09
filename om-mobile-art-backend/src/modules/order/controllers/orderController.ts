import { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../services/orderService.js';
import { AuthenticationError } from '../../../core/exceptions/exceptions.js';

export class OrderController {
  async getOrderByNumber(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { orderNumber } = request.params as { orderNumber: string };
    const order = await orderService.getOrderByNumber(orderNumber, user.id);

    return reply.status(200).send({
      success: true,
      data: order,
    });
  }

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const query = request.query as { search?: string; status?: string; page?: string; limit?: string };
    const result = await orderService.listOrders(user.id, {
      search: query.search,
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async listAllOrdersAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user || user.role !== 'ADMIN') {
      throw new AuthenticationError('User not authorized as Admin');
    }

    const query = request.query as any;
    const result = await orderService.listAllOrdersAdmin(query);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async updateOrderAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user || user.role !== 'ADMIN') {
      throw new AuthenticationError('User not authorized as Admin');
    }

    const { id } = request.params as { id: string };
    const body = request.body as any;
    const order = await orderService.updateOrderAdmin(id, body);

    return reply.status(200).send({
      success: true,
      data: order,
    });
  }
}

export const orderController = new OrderController();
