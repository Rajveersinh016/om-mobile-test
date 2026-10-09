import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../config/env.js';
import { userRepository } from '../auth/repositories/userRepository.js';
import { TokenPayload } from '../auth/services/authService.js';
import { productController } from './controllers/productController.js';
import { categoryController } from './controllers/categoryController.js';
import { collectionController } from './controllers/collectionController.js';
import { deviceController } from './controllers/deviceController.js';
import { brandController } from './controllers/brandController.js';
import { productTypeController } from './controllers/productTypeController.js';
import { deviceTypeController } from './controllers/deviceTypeController.js';
import { modelController } from './controllers/modelController.js';
import { materialController } from './controllers/materialController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

// Optional authentication hook for routes that behave differently for Admins vs Customers
const optionalAuthenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      const user = await userRepository.findById(decoded.userId);
      if (user) {
        request.user = user;
      }
    } catch (error) {
      // Quietly consume errors so request is processed as a public/customer request
    }
  }
};

export const catalogRoutes = async (app: FastifyInstance) => {
  // --- Category Routes ---
  app.get('/categories', categoryController.getAll);
  app.get('/categories/:id', categoryController.getById);
  app.get('/categories/slug/:slug', categoryController.getBySlug);
  
  app.post('/categories', { preHandler: [authenticate, authorize(Role.ADMIN)] }, categoryController.create);
  app.put('/categories/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, categoryController.update);
  app.delete('/categories/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, categoryController.delete);

  // --- Product Type Routes ---
  app.get('/product-types', { preHandler: [optionalAuthenticate] }, productTypeController.getAll);
  app.get('/product-types/:id', productTypeController.getById);
  app.get('/product-types/slug/:slug', productTypeController.getBySlug);
  
  app.post('/product-types', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productTypeController.create);
  app.put('/product-types/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productTypeController.update);
  app.delete('/product-types/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productTypeController.delete);

  // --- Collection Routes ---
  app.get('/collections', { preHandler: [optionalAuthenticate] }, collectionController.getAll);
  app.get('/collections/:id', collectionController.getById);
  app.get('/collections/slug/:slug', collectionController.getBySlug);
  
  app.post('/collections', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.create);
  app.put('/collections/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.update);
  app.delete('/collections/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.delete);
  app.post('/collections/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.restore);
  app.delete('/collections/:id/permanent', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.permanentDelete);
  app.post('/collections/:id/duplicate', { preHandler: [authenticate, authorize(Role.ADMIN)] }, collectionController.duplicate);

  // --- Device Routes ---
  app.get('/devices', deviceController.getAll);
  app.get('/devices/:id', deviceController.getById);
  
  app.post('/devices', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceController.create);
  app.put('/devices/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceController.update);
  app.delete('/devices/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceController.delete);

  // --- Product Routes ---
  // Customer Reading Routes
  app.get('/products', { preHandler: [optionalAuthenticate] }, productController.getAll);
  app.get('/products/slug/:slug', { preHandler: [optionalAuthenticate] }, productController.getBySlug);
  app.get('/products/:id', { preHandler: [optionalAuthenticate] }, productController.getById);
  app.get('/products/:id/related', productController.getRelated);
  app.get('/products/featured', productController.getFeatured);
  app.get('/products/newest', productController.getNewest);

  // Admin Management Routes
  app.post('/products', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.create);
  app.put('/products/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.update);
  app.delete('/products/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.delete);
  app.delete('/products/:id/permanent', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.permanentDelete);
  app.post('/products/bulk-delete', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.bulkDelete);
  app.post('/products/:id/duplicate', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.duplicate);
  app.post('/products/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.restore);
  app.post('/products/:id/publish', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.publish);
  app.post('/products/:id/unpublish', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.unpublish);
  
  // Inventory Updates & Uploads
  app.put('/products/variants/:variantId/inventory', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.updateInventory);
  app.post('/products/upload-image', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.uploadImage);

  // --- Brand, Series, Model Routes ---
  app.get('/brands', { preHandler: [optionalAuthenticate] }, brandController.getBrands);
  app.get('/brands/:id/series', { preHandler: [optionalAuthenticate] }, brandController.getSeries);
  app.get('/series/:id/models', { preHandler: [optionalAuthenticate] }, brandController.getModels);
  app.get('/brands/:id/models', { preHandler: [optionalAuthenticate] }, brandController.getBrandModels);

  // Admin Brand, Series, Model Management
  app.post('/admin/brands', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.createBrand);
  app.put('/admin/brands/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.updateBrand);
  app.delete('/admin/brands/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.deleteBrand);
  app.post('/admin/brands/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.restoreBrand);
  app.delete('/admin/brands/:id/permanent', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.permanentDeleteBrand);
  app.post('/admin/brands/bulk', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.bulkAction);
  app.post('/admin/brands/import-csv', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.importCSV);

  app.post('/admin/series', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.createSeries);
  app.put('/admin/series/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.updateSeries);
  app.delete('/admin/series/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.deleteSeries);

  app.post('/admin/products/:id/models', { preHandler: [authenticate, authorize(Role.ADMIN)] }, brandController.mapProductModels);

  // --- Device Types Routes ---
  app.get('/device-types', { preHandler: [optionalAuthenticate] }, deviceTypeController.getDeviceTypes);
  app.get('/device-types/:id/brands', { preHandler: [optionalAuthenticate] }, deviceTypeController.getBrandsByDeviceType);
  app.post('/admin/device-types', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.createDeviceType);
  app.put('/admin/device-types/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.updateDeviceType);
  app.delete('/admin/device-types/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.deleteDeviceType);
  app.post('/admin/device-types/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.restoreDeviceType);
  app.delete('/admin/device-types/:id/permanent', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.permanentDeleteDeviceType);
  app.post('/admin/device-types/bulk', { preHandler: [authenticate, authorize(Role.ADMIN)] }, deviceTypeController.bulkAction);

  // --- Models Standard Search & Admin Routes ---
  app.get('/models', { preHandler: [optionalAuthenticate] }, modelController.getModels);
  app.post('/admin/models', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.createModel);
  app.put('/admin/models/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.updateModel);
  app.delete('/admin/models/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.deleteModel);
  app.post('/admin/models/:id/restore', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.restoreModel);
  app.delete('/admin/models/:id/permanent', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.permanentDeleteModel);
  app.post('/admin/models/bulk', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.bulkAction);
  app.post('/admin/models/import-csv', { preHandler: [authenticate, authorize(Role.ADMIN)] }, modelController.importCSV);

  // --- Materials & Finishes Routes ---
  app.get('/materials', { preHandler: [optionalAuthenticate] }, materialController.getMaterials);
  app.get('/finishes', { preHandler: [optionalAuthenticate] }, materialController.getFinishes);
  app.post('/admin/materials', { preHandler: [authenticate, authorize(Role.ADMIN)] }, materialController.createMaterial);
  app.put('/admin/materials/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, materialController.updateMaterial);
  app.delete('/admin/materials/:id', { preHandler: [authenticate, authorize(Role.ADMIN)] }, materialController.deleteMaterial);

  // --- Device Preview Images Routes ---
  app.get('/products/:id/previews', { preHandler: [optionalAuthenticate] }, productController.getPreviews);
  app.post('/admin/products/:id/previews', { preHandler: [authenticate, authorize(Role.ADMIN)] }, productController.setPreview);
};
