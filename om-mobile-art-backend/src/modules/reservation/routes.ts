import { FastifyInstance } from 'fastify';
import { reservationController } from './controllers/reservationController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';

export async function reservationRoutes(app: FastifyInstance) {
  app.post('/reservations', { preHandler: [authenticate] }, reservationController.createReservation);
  app.get('/reservations/current', { preHandler: [authenticate] }, reservationController.getCurrentReservation);
  app.delete('/reservations/current', { preHandler: [authenticate] }, reservationController.cancelCurrentReservation);
  app.post('/reservations/:id/commit', { preHandler: [authenticate] }, reservationController.commitReservation);
  app.post('/reservations/:id/cancel', { preHandler: [authenticate] }, reservationController.cancelReservation);
}
