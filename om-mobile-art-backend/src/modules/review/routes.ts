import { FastifyInstance } from 'fastify';
import { ReviewController } from './review.controller.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';
import { Role } from '@prisma/client';

export async function reviewRoutes(app: FastifyInstance) {
  // Public Google Reviews Endpoint
  app.get('/google-reviews', ReviewController.getGoogleReviews);

  // Disabled website review creation endpoints (Requirement 2)
  app.post('/reviews', ReviewController.disablePublicReviewCreation);
  app.put('/reviews/:id', ReviewController.disablePublicReviewCreation);

  // Admin Panel Only
  app.get('/admin/reviews', { preHandler: [authenticate, authorize(Role.ADMIN)] }, ReviewController.getAdminReviews);
  app.delete('/admin/reviews/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, ReviewController.deleteReview);
}
