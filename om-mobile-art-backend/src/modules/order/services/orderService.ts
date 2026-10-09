import { prisma } from '../../../database/client.js';
import { NotFoundError, ForbiddenError } from '../../../core/exceptions/exceptions.js';

export class OrderService {
  async getOrderByNumber(orderNumber: string, userId: string): Promise<any> {
    const order = await prisma.order.findFirst({
      where: { orderNumber },
      include: {
        items: true,
        payments: {
          include: {
            attempts: true,
          },
        },
        timelineEvents: {
          orderBy: {
            createdAt: 'asc'
          }
        },
      },
    });

    if (!order) {
      throw new NotFoundError(`Order with number ${orderNumber} not found`);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role !== 'ADMIN' && order.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view this order');
    }

    return order;
  }

  async listOrders(userId: string, query: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
    };

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      let statusMap = query.status.toUpperCase();
      if (statusMap === 'PENDING') statusMap = 'PENDING_PAYMENT';
      where.status = statusMap;
    }

    if (query.search) {
      const search = query.search.trim().toLowerCase();
      where.OR = [
        { orderNumber: { contains: search } },
        {
          items: {
            some: {
              OR: [
                { productName: { contains: search } },
                { deviceName: { contains: search } }
              ]
            }
          }
        }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          timelineEvents: {
            orderBy: {
              createdAt: 'asc'
            }
          },
          payments: true
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listAllOrdersAdmin(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status && query.status.toUpperCase() !== 'ALL') {
      let statusMap = query.status.toUpperCase();
      if (statusMap === 'PENDING') statusMap = 'PENDING_PAYMENT';
      where.status = statusMap;
    }
    if (query.search) {
      const search = query.search.trim().toLowerCase();
      where.OR = [
        { orderNumber: { contains: search } },
        { customerSnapshot: { path: ['email'], string_contains: search } },
        { customerSnapshot: { path: ['name'], string_contains: search } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          timelineEvents: {
            orderBy: {
              createdAt: 'asc'
            }
          },
          payments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateOrderAdmin(id: string, data: any) {
    const updateData: any = {};
    if (data.status) {
      let statusMap = data.status.toUpperCase();
      if (statusMap === 'PENDING') statusMap = 'PENDING_PAYMENT';
      updateData.status = statusMap;
    }
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
    if (data.courierName !== undefined) updateData.courierName = data.courierName;
    if (data.courierLink !== undefined) updateData.courierLink = data.courierLink;
    if (data.estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = data.estimatedDelivery ? new Date(data.estimatedDelivery) : null;
    }
    if (data.invoiceUrl !== undefined) updateData.invoiceUrl = data.invoiceUrl;
    if (data.customerNotes !== undefined) updateData.customerNotes = data.customerNotes;

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          timelineEvents: true,
          payments: true
        }
      });

      if (data.timelineEvent) {
        await tx.orderTimelineEvent.create({
          data: {
            orderId: id,
            eventType: data.timelineEvent.eventType,
            title: data.timelineEvent.title,
            description: data.timelineEvent.description || null,
            actorType: 'ADMIN'
          }
        });
      } else if (data.status) {
        await tx.orderTimelineEvent.create({
          data: {
            orderId: id,
            eventType: `STATUS_UPDATED_${data.status.toUpperCase()}`,
            title: `Order Status: ${data.status}`,
            description: `Order status changed to ${data.status}`,
            actorType: 'ADMIN'
          }
        });
      }

      return updated;
    });

    return order;
  }
}

export const orderService = new OrderService();
