import { FastifyInstance } from 'fastify';
import { cartController } from './controllers/cartController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';

export async function cartRoutes(app: FastifyInstance) {
  app.get('/cart', { preHandler: [authenticate] }, cartController.getCart);
  app.post('/cart', { preHandler: [authenticate] }, cartController.addToCart);
  app.patch('/cart/:id', { preHandler: [authenticate] }, cartController.updateCartItemQuantity);
  app.delete('/cart/:id', { preHandler: [authenticate] }, cartController.removeFromCart);
  app.delete('/cart', { preHandler: [authenticate] }, cartController.clearCart);
  app.get('/cart/summary', { preHandler: [authenticate] }, cartController.getCartSummary);
}
