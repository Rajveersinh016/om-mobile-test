import { FastifyInstance } from 'fastify';
import { checkoutController } from './controllers/checkoutController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';

export async function checkoutRoutes(app: FastifyInstance) {
  app.get('/checkout', { preHandler: [authenticate] }, checkoutController.getCheckoutState);
  app.get('/checkout/summary', { preHandler: [authenticate] }, checkoutController.getCheckoutSummary);
  app.post('/checkout/prepare', { preHandler: [authenticate] }, checkoutController.prepareCheckout);
  app.post('/checkout', { preHandler: [authenticate] }, checkoutController.createCheckoutOrder);
  app.post('/checkout/webhook', checkoutController.handleRazorpayWebhook);
}
