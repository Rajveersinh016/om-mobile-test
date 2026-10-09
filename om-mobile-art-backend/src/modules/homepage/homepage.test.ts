import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Homepage CMS Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let customerToken: string;

  const adminEmail = 'homepage_admin@example.com';
  const customerEmail = 'homepage_customer@example.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();

    // Clean up old test users
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
    // Clean up test data
    const emails = [adminEmail, customerEmail];
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/homepage/layout', () => {
    it('should return public homepage layout with sections sorted by position', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/layout',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      // Verify layout positions are sorted ascending
      let lastPos = -1;
      for (const section of body.data) {
        expect(section.position).toBeGreaterThanOrEqual(lastPos);
        lastPos = section.position;
      }
    });
  });

  describe('GET /api/v1/homepage/sections', () => {
    it('should reject requests from unauthenticated users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/sections',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject requests from non-admin users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/sections',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow admin users to list all sections', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/sections',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/v1/homepage/sections/:id', () => {
    it('should allow admin to edit section settings and toggles', async () => {
      const sectionsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/sections',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const sections = JSON.parse(sectionsRes.payload).data;
      const targetSec = sections.find((s: any) => s.sectionKey === 'newsletter');
      expect(targetSec).toBeDefined();

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/homepage/sections/${targetSec.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          isActive: false,
          settings: {
            title: 'Test Subscription Title',
            description: 'Updated newsletter content',
            buttonText: 'Subscribe Now'
          }
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const updated = JSON.parse(updateRes.payload).data;
      expect(updated.isActive).toBe(false);
      expect(updated.settings.title).toBe('Test Subscription Title');

      // Reset section back to active
      await app.inject({
        method: 'PUT',
        url: `/api/v1/homepage/sections/${targetSec.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: true },
      });
    });
  });

  describe('Banner CRUD Operations', () => {
    let testBannerId: string;

    it('should allow admin to create a banner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homepage/banners',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Test Promo Banner',
          subtitle: 'Exclusive discounts this weekend',
          imageUrl: 'https://example.com/desktop.png',
          mobileImageUrl: 'https://example.com/mobile.png',
          ctaText: 'Shop Sale',
          linkUrl: 'shop.html',
          isActive: true,
          position: 10,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.title).toBe('Test Promo Banner');
      expect(data.id).toBeDefined();
      testBannerId = data.id;
    });

    it('should return active banners for public', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/banners',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.some((b: any) => b.id === testBannerId)).toBe(true);
    });

    it('should allow admin to update the banner', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/homepage/banners/${testBannerId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Updated Promo Banner Title',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.title).toBe('Updated Promo Banner Title');
    });

    it('should allow admin to delete the banner', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/homepage/banners/${testBannerId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);

      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/v1/homepage/banners',
      });
      const body = JSON.parse(checkRes.payload);
      expect(body.data.some((b: any) => b.id === testBannerId)).toBe(false);
    });
  });

  describe('Announcement Bar Operations', () => {
    it('should create and update announcement bar', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homepage/announcements',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          text: 'TEST Free Shipping on all orders',
          bgColor: '#03045E',
          textColor: '#FFFFFF',
          isScrolling: true,
        },
      });
      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.payload).data;
      expect(item.text).toBe('TEST Free Shipping on all orders');

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/homepage/announcements/${item.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { text: 'TEST Free Shipping Updated' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).data.text).toBe('TEST Free Shipping Updated');

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/homepage/announcements/${item.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
    });
  });
});
