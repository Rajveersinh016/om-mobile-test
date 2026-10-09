import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { settingsController } from './controllers/settingsController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

import { mockupController } from './controllers/mockupController.js';

export const settingsRoutes = async (app: FastifyInstance) => {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Public Storefront Endpoints
  app.get('/settings', settingsController.getPublicSettings);
  app.get('/settings/public', settingsController.getPublicSettings);
  app.get('/legal-pages', settingsController.getLegalPages);
  app.get('/legal-pages/:slug', settingsController.getLegalPageBySlug);
  app.get('/mockups', mockupController.getGlobalMockup);

  // Administrative Settings Management
  app.get('/admin/mockups', adminAuth, mockupController.getGlobalMockup);
  app.put('/admin/mockups', adminAuth, mockupController.updateGlobalMockup);

  // Administrative Settings Management
  app.get('/admin/settings', adminAuth, settingsController.getAdminSettings);
  app.put('/admin/settings/store', adminAuth, settingsController.updateStoreSettings);
  app.put('/admin/settings/brand', adminAuth, settingsController.updateBrandConfig);
  app.put('/admin/settings/announcement', adminAuth, settingsController.updateAnnouncementBar);
  app.put('/admin/settings/contact', adminAuth, settingsController.updateContactInfo);
  app.put('/admin/settings/seo', adminAuth, settingsController.updateSeoConfig);
  app.put('/admin/settings/footer', adminAuth, settingsController.updateFooterConfig);
  app.put('/admin/settings/smtp', adminAuth, settingsController.updateEmailSmtpConfig);
  app.put('/admin/settings/maintenance', adminAuth, settingsController.updateMaintenanceConfig);
  app.put('/admin/settings/features', adminAuth, settingsController.updateFeatureToggles);
  app.put('/admin/settings/security', adminAuth, settingsController.updateSecurityPolicy);
  app.put('/admin/settings/backup', adminAuth, settingsController.updateBackupConfig);

  // Social Links
  app.post('/admin/settings/social-links', adminAuth, settingsController.createSocialLink);
  app.put('/admin/settings/social-links/:id', adminAuth, settingsController.updateSocialLink);
  app.delete('/admin/settings/social-links/:id', adminAuth, settingsController.deleteSocialLink);

  // Legal Pages
  app.post('/admin/legal-pages', adminAuth, settingsController.upsertLegalPage);
  app.delete('/admin/legal-pages/:id', adminAuth, settingsController.deleteLegalPage);
};
