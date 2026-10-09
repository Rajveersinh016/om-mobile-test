import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { customerController } from './customer.controller.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export async function customerRoutes(app: FastifyInstance) {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Admin Customer Management Endpoints
  app.get('/customers', adminAuth, customerController.getCustomers.bind(customerController));
  app.get('/customers/stats', adminAuth, customerController.getStats.bind(customerController));
  app.get('/customers/export-csv', adminAuth, customerController.exportCsv.bind(customerController));
  app.get('/customers/:id', adminAuth, customerController.getCustomerById.bind(customerController));
  app.put('/customers/:id', adminAuth, customerController.updateProfile.bind(customerController));
  app.patch('/customers/:id/status', adminAuth, customerController.updateStatus.bind(customerController));
  app.post('/customers/:id/notes', adminAuth, customerController.addNote.bind(customerController));
  app.delete('/customers/notes/:noteId', adminAuth, customerController.deleteNote.bind(customerController));
  app.post('/customers/:id/addresses', adminAuth, customerController.manageAddress.bind(customerController));
}
