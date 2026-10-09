import { FastifyInstance } from 'fastify';
import { profileController } from './controllers/profileController.js';
import { addressController } from './controllers/addressController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';
import { Role } from '@prisma/client';

export async function profileRoutes(app: FastifyInstance) {
  // Profile CRUD & Activity
  app.get('/profile', { preHandler: [authenticate] }, profileController.getProfile);
  app.put('/profile', { preHandler: [authenticate] }, profileController.updateProfile);
  app.post('/profile/deactivate', { preHandler: [authenticate] }, profileController.deactivateAccount);
  app.post('/profile/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, profileController.restoreAccount);
  app.get('/profile/activity', { preHandler: [authenticate] }, profileController.listActivities);

  // Avatar Management
  app.post('/profile/avatar', { preHandler: [authenticate] }, profileController.uploadAvatar);
  app.delete('/profile/avatar', { preHandler: [authenticate] }, profileController.deleteAvatar);

  // Session / Device Management
  app.get('/profile/devices', { preHandler: [authenticate] }, profileController.listSessions);
  app.delete('/profile/devices', { preHandler: [authenticate] }, profileController.revokeAllSessions);
  app.delete('/profile/devices/:id', { preHandler: [authenticate] }, profileController.revokeSession);

  // Address Management
  app.get('/profile/addresses', { preHandler: [authenticate] }, addressController.listAddresses);
  app.post('/profile/addresses', { preHandler: [authenticate] }, addressController.createAddress);
  app.get('/profile/addresses/:id', { preHandler: [authenticate] }, addressController.getAddress);
  app.put('/profile/addresses/:id', { preHandler: [authenticate] }, addressController.updateAddress);
  app.delete('/profile/addresses/:id', { preHandler: [authenticate] }, addressController.deleteAddress);
  app.post('/profile/addresses/:id/default', { preHandler: [authenticate] }, addressController.setDefaultAddress);
}
