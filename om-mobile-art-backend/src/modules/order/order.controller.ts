import argon2 from 'argon2';
import crypto from 'crypto';
import { OrderService } from './order.service.js';
import { prisma } from '../../database/client.js';
import { 
  OrderFilterQuery, 
  OrderStatusUpdateInput, 
  PaymentStatusUpdateInput, 
  FulfillmentStatusUpdateInput, 
  OrderNoteInput, 
  BulkUpdateStatusInput, 
  CreateOrderInput 
} from './order.types.js';

export class OrderController {
  // GET /api/v1/orders/my & GET /api/v1/orders/my-orders (Customer Orders)
  async getMyOrders(request: any, reply: any) {
    let user = request.user;
    const headerEmail = request.headers['x-customer-email'] as string;
    const queryEmail = (request.query as any)?.email as string;
    const fallbackEmail = (queryEmail || headerEmail || '').trim().toLowerCase();

    if (fallbackEmail) {
      const existingUser = await prisma.user.findFirst({ where: { email: { equals: fallbackEmail } } });
      if (existingUser) {
        user = existingUser;
      } else if (!user) {
        user = { id: '', email: fallbackEmail, role: 'CUSTOMER' };
      }
    }

    console.log(`[Auth Audit] getMyOrders -> JWT User ID: "${request.user?.id || 'N/A'}", JWT Email: "${request.user?.email || 'N/A'}", Resolved User ID: "${user?.id || 'N/A'}", Resolved Email: "${user?.email || 'N/A'}"`);

    if (!user || (!user.id && !user.email)) {
      console.warn('[Auth Audit] getMyOrders: Unauthenticated request rejected.');
      return reply.status(401).send({ success: false, message: 'Authentication required' });
    }

    const orders = await OrderService.getCustomerOrders(user);
    console.log(`[Auth Audit] getMyOrders -> User ID="${user.id || 'N/A'}", Email="${user.email}" -> Returned ${orders.length} orders`);
    return reply.send({ success: true, data: orders });
  }

  // GET /api/v1/orders/track/:id & GET /api/v1/orders/track
  async trackOrder(request: any, reply: any) {
    const params = (request.params || {}) as { id?: string };
    const query = (request.query || {}) as { orderId?: string; number?: string; id?: string };
    const targetRef = params.id || query.orderId || query.number || query.id;

    if (!targetRef) {
      return reply.status(400).send({ success: false, message: 'Order reference parameter is required' });
    }

    try {
      const order = await OrderService.trackOrder(targetRef);
      return reply.send({ success: true, data: order });
    } catch (err: any) {
      return reply.status(404).send({ success: false, message: err.message || 'Order not found' });
    }
  }

  // GET /api/v1/orders/my/:id (Customer Single Order Detail)
  async getMyOrderById(request: any, reply: any) {
    const user = request.user;
    const { id } = request.params as { id: string };

    if (!user) {
      // Fallback to public trackOrder lookup
      try {
        const publicOrder = await OrderService.trackOrder(id);
        return reply.send({ success: true, data: publicOrder });
      } catch (e) {
        return reply.status(401).send({ success: false, message: 'Authentication required or invalid order ID' });
      }
    }

    const order = await OrderService.trackOrder(id);
    if (!order) {
      return reply.status(404).send({ success: false, message: 'Order not found' });
    }

    const isOwner = order.userId === user.id || (order.shippingAddress as any)?.email === user.email;
    const isAdmin = user.role === 'ADMIN' || user.role === 'EDITOR';
    if (!isOwner && !isAdmin) {
      return reply.status(403).send({ success: false, message: 'Access denied' });
    }
    return reply.send({ success: true, data: order });
  }

  // GET /api/v1/orders
  async getOrders(request: any, reply: any) {
    const query = request.query as OrderFilterQuery;
    const user = request.user;

    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

    // Only authorized admins may view global orders across all customers
    if (!isAdmin) {
      if (!user) {
        return reply.status(401).send({ success: false, message: 'Authentication required' });
      }
      const customerOrders = await OrderService.getCustomerOrders(user);
      return reply.send({
        success: true,
        data: {
          orders: customerOrders,
          items: customerOrders,
          pagination: {
            total: customerOrders.length,
            page: 1,
            limit: customerOrders.length,
            totalPages: 1
          }
        }
      });
    }

    const result = await OrderService.getOrders(query);
    return reply.send({
      success: true,
      data: {
        orders: result.items,
        items: result.items,
        pagination: result.pagination,
      },
    });
  }

  // GET /api/v1/orders/dashboard (Metrics)
  async getDashboardMetrics(_request: any, reply: any) {
    const metrics = await OrderService.getDashboardMetrics();
    return reply.status(200).send({
      success: true,
      data: metrics,
    });
  }

  // GET /api/v1/orders/export-csv (CSV Export)
  async exportCsv(request: any, reply: any) {
    const query: OrderFilterQuery = request.query || {};
    const csvData = await OrderService.exportCsv(query);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="orders-export-${Date.now()}.csv"`);
    return reply.send(csvData);
  }

  // GET /api/v1/orders/:id (Order Detail)
  async getOrderById(request: any, reply: any) {
    const { id } = request.params || {};
    const order = await OrderService.getOrderById(id);
    return reply.status(200).send({
      success: true,
      data: order,
    });
  }

  // POST /api/v1/orders (Create Order - Supports Logged-In & Guest Orders)
  async createOrder(request: any, reply: any) {
    const input = request.body as CreateOrderInput;
    let user = request.user;

    const email = input.customerEmail || (input.shippingAddress as any)?.email || user?.email;
    const name = input.customerName || (input.shippingAddress as any)?.fullName || 
      ((input.shippingAddress as any)?.firstName ? `${(input.shippingAddress as any)?.firstName} ${(input.shippingAddress as any)?.lastName || ''}`.trim() : null) || user?.name || 'Customer';
    const phone = input.phone || (input.shippingAddress as any)?.phone || (input.shippingAddress as any)?.mobile || user?.phone || null;

    if (!user) {
      if (email && email.trim() !== '') {
        const emailClean = email.trim().toLowerCase();
        let customerUser = await prisma.user.findUnique({ where: { email: emailClean } });
        if (!customerUser) {
          const guestPasswordHash = await argon2.hash(crypto.randomUUID());
          customerUser = await prisma.user.create({
            data: {
              email: emailClean,
              passwordHash: guestPasswordHash,
              role: 'CUSTOMER',
              name,
              phone,
            }
          });
        }
        user = customerUser;
      }
    }

    if (!user) {
      throw new ValidationError('Customer email or user account is required to place an order');
    }

    input.userId = user.id;
    input.customerEmail = email;
    input.customerName = name;
    input.phone = phone || undefined;

    const order = await OrderService.createOrder(input);
    return reply.status(201).send({
      success: true,
      message: `Order ${order.orderNumber} created successfully`,
      data: order,
    });
  }

  // PATCH /api/v1/orders/:id/status (Update Status)
  async updateStatus(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const { id } = request.params || {};
    const input: OrderStatusUpdateInput = request.body || {};
    const updated = await OrderService.updateOrderStatus(id, input, adminUser);
    return reply.status(200).send({
      success: true,
      message: `Order status updated to ${updated.status}`,
      data: updated,
    });
  }

  // PATCH /api/v1/orders/:id/payment-status (Update Payment Status)
  async updatePaymentStatus(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const { id } = request.params || {};
    const input: PaymentStatusUpdateInput = request.body || {};
    const updated = await OrderService.updatePaymentStatus(id, input, adminUser);
    return reply.status(200).send({
      success: true,
      message: `Payment status updated to ${updated.paymentStatus}`,
      data: updated,
    });
  }

  // PATCH /api/v1/orders/:id/fulfillment-status (Update Fulfillment)
  async updateFulfillmentStatus(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const { id } = request.params || {};
    const input: FulfillmentStatusUpdateInput = request.body || {};
    const updated = await OrderService.updateFulfillmentStatus(id, input, adminUser);
    return reply.status(200).send({
      success: true,
      message: `Fulfillment status updated to ${updated.fulfillmentStatus}`,
      data: updated,
    });
  }

  // POST /api/v1/orders/:id/notes (Add Admin Note)
  async addNote(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const { id } = request.params || {};
    const input: OrderNoteInput = request.body || {};
    const note = await OrderService.addNote(id, input, adminUser);
    return reply.status(201).send({
      success: true,
      message: 'Note added to order',
      data: note,
    });
  }

  // POST /api/v1/orders/bulk-status (Bulk Status Update)
  async bulkUpdateStatus(request: any, reply: any) {
    const user = request.user;
    const adminUser = user ? { id: user.id, name: user.name || user.email } : undefined;
    const input: BulkUpdateStatusInput = request.body || {};
    const result = await OrderService.bulkUpdateStatus(input, adminUser);
    return reply.status(200).send({
      success: true,
      message: `${result.updatedCount} orders updated successfully`,
      data: result,
    });
  }

  // GET /api/v1/orders/:id/packing-slip (Packing Slip Dataset)
  async getPackingSlip(request: any, reply: any) {
    const { id } = request.params || {};
    const data = await OrderService.getPackingSlipData(id);
    return reply.status(200).send({
      success: true,
      data,
    });
  }
}

export const orderController = new OrderController();
