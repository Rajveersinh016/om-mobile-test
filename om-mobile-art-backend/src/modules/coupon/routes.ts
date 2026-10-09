import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { couponController } from './controllers/couponController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export async function couponRoutes(app: FastifyInstance) {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Admin Coupon Management Endpoints
  app.get('/coupons', adminAuth, couponController.listCoupons.bind(couponController));
  app.get('/coupons/stats', adminAuth, couponController.getStats.bind(couponController));
  app.get('/coupons/:id', adminAuth, couponController.getCouponById.bind(couponController));
  app.post('/coupons', adminAuth, couponController.createCoupon.bind(couponController));
  app.put('/coupons/:id', adminAuth, couponController.updateCoupon.bind(couponController));
  app.post('/coupons/:id/duplicate', adminAuth, couponController.duplicateCoupon.bind(couponController));
  app.patch('/coupons/:id/status', adminAuth, couponController.toggleStatus.bind(couponController));
  app.delete('/coupons/:id', adminAuth, couponController.deleteCoupon.bind(couponController));

  // Checkout Ready API Endpoint (Public / Authenticated customer use)
  app.post('/coupons/validate', couponController.validateCoupon.bind(couponController));
}
