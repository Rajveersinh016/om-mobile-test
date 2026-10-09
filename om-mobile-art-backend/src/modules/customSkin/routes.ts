import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { customSkinController } from './controllers/customSkinController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export const customSkinRoutes = async (app: FastifyInstance) => {
  // Public Storefront Endpoints
  app.get('/custom-skin/settings', customSkinController.getSettings);
  app.get('/custom-skin/config', customSkinController.getConfig);
  app.post('/custom-skin/upload', customSkinController.uploadImage);
  app.post('/custom-skin/calculate-price', customSkinController.calculatePrice);

  app.get('/custom-skin/materials', customSkinController.getMaterials);
  app.get('/custom-skin/finishes', customSkinController.getFinishes);
  app.get('/custom-skin/coverage', customSkinController.getCoverage);
  app.get('/custom-skin/faqs', customSkinController.getFaqs);
  app.get('/custom-skin/fonts', customSkinController.getFonts);

  // Administrative Configuration Management
  app.put('/custom-skin/settings', { preHandler: [authenticate, authorize(Role.ADMIN)] }, customSkinController.updateSettings);
  app.post('/admin/custom-skin/config', { preHandler: [authenticate, authorize(Role.ADMIN)] }, customSkinController.updateConfig);
};
