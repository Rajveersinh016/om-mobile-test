import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { orderController } from './order.controller.js';
import { authenticate, optionalAuthenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export async function orderRoutes(app: FastifyInstance) {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Customer Order Endpoints
  app.get('/orders/track/:id', orderController.trackOrder.bind(orderController));
  app.get('/orders/track', orderController.trackOrder.bind(orderController));
  app.get('/orders/my', { preHandler: [optionalAuthenticate] }, orderController.getMyOrders.bind(orderController));
  app.get('/orders/my-orders', { preHandler: [optionalAuthenticate] }, orderController.getMyOrders.bind(orderController));
  app.get('/orders/my/:id', { preHandler: [optionalAuthenticate] }, orderController.getMyOrderById.bind(orderController));
  app.post('/orders', { preHandler: [optionalAuthenticate] }, orderController.createOrder.bind(orderController));

  // Order Management Endpoints
  app.get('/orders', { preHandler: [authenticate] }, orderController.getOrders.bind(orderController));
  app.get('/orders/dashboard', adminAuth, orderController.getDashboardMetrics.bind(orderController));
  app.get('/orders/export-csv', adminAuth, orderController.exportCsv.bind(orderController));
  app.get('/orders/:id', adminAuth, orderController.getOrderById.bind(orderController));
  app.patch('/orders/:id/status', adminAuth, orderController.updateStatus.bind(orderController));
  app.patch('/orders/:id/payment-status', adminAuth, orderController.updatePaymentStatus.bind(orderController));
  app.patch('/orders/:id/fulfillment-status', adminAuth, orderController.updateFulfillmentStatus.bind(orderController));
  app.post('/orders/:id/notes', adminAuth, orderController.addNote.bind(orderController));
  app.post('/orders/bulk-status', adminAuth, orderController.bulkUpdateStatus.bind(orderController));
  app.get('/orders/:id/packing-slip', adminAuth, orderController.getPackingSlip.bind(orderController));

  // Legacy route aliases for backward compatibility
  app.get('/admin/orders', adminAuth, orderController.getOrders.bind(orderController));
  app.put('/admin/orders/:id', adminAuth, orderController.updateStatus.bind(orderController));
}
