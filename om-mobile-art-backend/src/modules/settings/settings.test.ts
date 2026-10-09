import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Website Settings Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let customerToken: string;

  const adminEmail = 'settings_admin@example.com';
  const customerEmail = 'settings_customer@example.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();

    // Cleanup old test users
    const emails = [adminEmail, customerEmail];
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Register & Login Admin
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: adminEmail, password: testPassword },
    });
    await prisma.user.update({ where: { email: adminEmail }, data: { role: Role.ADMIN } });
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { email: adminEmail, password: testPassword },
    });
    adminToken = JSON.parse(adminLoginRes.payload).data.tokens.accessToken;

    // Register & Login Customer
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: customerEmail, password: testPassword },
    });
    const customerLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: customerEmail, password: testPassword },
    });
    customerToken = JSON.parse(customerLoginRes.payload).data.tokens.accessToken;
  });

  afterAll(async () => {
    // Restore default store settings & disable maintenance mode after tests run
    await prisma.maintenanceConfig.updateMany({
      data: { isActive: false, message: "We are currently upgrading our store to bring you better skins. We'll be back shortly!" }
    });
    await prisma.storeSetting.updateMany({
      data: { storeName: 'OM Mobile Art', storeTagline: 'Precision-Fit Vinyl Skins & Device Protection' }
    });

    const emails = [adminEmail, customerEmail];
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/settings/public', () => {
    it('should return public settings bundle without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/public',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.store).toBeDefined();
      expect(body.data.brand).toBeDefined();
      expect(body.data.contact).toBeDefined();
      expect(body.data.seo).toBeDefined();
    });
  });

  describe('GET /api/v1/admin/settings', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject non-admin requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return full settings bundle for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.smtp).toBeDefined();
      expect(body.data.security).toBeDefined();
    });
  });

  describe('Store Settings & Configuration Updates', () => {
    it('should update general store settings', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings/store',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          storeName: 'TEST OM Mobile Art',
          storeTagline: 'TEST Precision Skins',
          shippingFreeThreshold: 1299,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.storeName).toBe('TEST OM Mobile Art');

      // Verify public endpoint reflects change
      const pubRes = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/public',
      });
      expect(JSON.parse(pubRes.payload).data.store.storeName).toBe('TEST OM Mobile Art');
    });

    it('should update brand configuration', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings/brand',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          primaryLogoUrl: 'https://example.com/logo.png',
          faviconUrl: 'https://example.com/favicon.png',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.primaryLogoUrl).toBe('https://example.com/logo.png');
    });

    it('should update maintenance mode configuration', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings/maintenance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          isActive: true,
          message: 'TEST Upgrading store servers',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.isActive).toBe(true);
    });

    it('should update feature toggles', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings/features',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          toggles: {
            WISHLIST: false,
            COUPONS: true,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const pubRes = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/public',
      });
      expect(JSON.parse(pubRes.payload).data.features.WISHLIST).toBe(false);
    });
  });

  describe('Legal Pages Endpoints', () => {
    it('should upsert and retrieve legal pages', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/legal-pages',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          slug: 'privacy-policy',
          title: 'Updated Privacy Policy',
          content: '<p>TEST Privacy policy content details.</p>',
          isPublished: true,
        },
      });

      expect(createRes.statusCode).toBe(200);
      expect(JSON.parse(createRes.payload).data.title).toBe('Updated Privacy Policy');

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/legal-pages/privacy-policy',
      });
      expect(getRes.statusCode).toBe(200);
      expect(JSON.parse(getRes.payload).data.content).toContain('TEST Privacy policy');
    });
  });
});
