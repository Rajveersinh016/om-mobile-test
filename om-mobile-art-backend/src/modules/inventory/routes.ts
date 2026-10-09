import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { InventoryController } from './inventory.controller.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export async function inventoryRoutes(app: FastifyInstance) {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Admin Dashboard & Inventory List
  app.get('/inventory/dashboard', adminAuth, InventoryController.getDashboardStats);
  app.get('/inventory', adminAuth, InventoryController.getInventoryList);

  // Public/Storefront availability check endpoint (optional filter for shop product cards)
  app.get('/inventory/public-stock', InventoryController.getInventoryList);

  // Stock Operations & Adjustments
  app.post('/inventory/adjust', adminAuth, InventoryController.adjustStock);

  // History Log
  app.get('/inventory/history', adminAuth, InventoryController.getHistory);
  app.get('/inventory/history/:variantId', adminAuth, InventoryController.getHistory);

  // Bulk Operations
  app.post('/inventory/bulk-update', adminAuth, InventoryController.bulkUpdate);
  app.post('/inventory/import-csv', adminAuth, InventoryController.importCsv);
  app.get('/inventory/export-csv', adminAuth, InventoryController.exportCsv);

  // SKU Management
  app.post('/inventory/generate-skus', adminAuth, InventoryController.bulkGenerateSkus);
}
