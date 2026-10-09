import { FastifyInstance } from 'fastify';
import { wishlistController } from './controllers/wishlistController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';

export async function wishlistRoutes(app: FastifyInstance) {
  app.get('/wishlist', { preHandler: [authenticate] }, wishlistController.listWishlist);
  app.post('/wishlist', { preHandler: [authenticate] }, wishlistController.addToWishlist);
  app.delete('/wishlist/:id', { preHandler: [authenticate] }, wishlistController.removeFromWishlist);
  app.get('/wishlist/count', { preHandler: [authenticate] }, wishlistController.getWishlistCount);
  app.post('/wishlist/:id/move-to-cart', { preHandler: [authenticate] }, wishlistController.moveToCart);
}
