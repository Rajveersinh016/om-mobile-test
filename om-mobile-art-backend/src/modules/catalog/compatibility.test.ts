import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role, CompatibilityStatus } from '@prisma/client';

describe('Compatibility Module Integration Tests', () => {
  let app: any;
  let adminToken: string;
  const adminEmail = 'compat_admin@example.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();

    // Cleanup old test admin
    const emails = [adminEmail];
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
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { email: adminEmail, password: testPassword },
    });
    adminToken = JSON.parse(loginRes.payload).data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.adminActivityLog.deleteMany({
      where: { user: { email: adminEmail } },
    });
    await prisma.model.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.brand.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.deviceType.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.user.deleteMany({
      where: { email: adminEmail },
    });
    await prisma.$disconnect();
  });

  describe('Device Type Endpoints', () => {
    it('should create, list, and soft-delete device types', async () => {
      // 1. Create
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/device-types',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Laptop', icon: 'laptop', slug: 'test-laptop' }
      });
      expect(res1.statusCode).toBe(201);
      const dt = JSON.parse(res1.payload).data;
      expect(dt.name).toBe('TEST_Laptop');

      // 2. List
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/device-types'
      });
      expect(res2.statusCode).toBe(200);
      const list = JSON.parse(res2.payload).data;
      expect(list.some((item: any) => item.id === dt.id)).toBe(true);

      // 3. Delete (Soft)
      const res3 = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/device-types/${dt.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res3.statusCode).toBe(200);

      // 4. Restore
      const res4 = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/device-types/${dt.id}/restore`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res4.statusCode).toBe(200);
      expect(JSON.parse(res4.payload).data.deletedAt).toBeNull();
    });
  });

  describe('Brand Endpoints', () => {
    it('should support brand CRUD and CSV import', async () => {
      // Create a device type
      const dt = await prisma.deviceType.create({
        data: { name: 'TEST_Mobile', icon: 'smartphone', slug: 'test-mobile' }
      });

      // 1. Create Brand
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/brands',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Pear', deviceTypeId: dt.id, slug: 'test-pear', status: CompatibilityStatus.PUBLISHED }
      });
      expect(res1.statusCode).toBe(201);
      const brand = JSON.parse(res1.payload).data;
      expect(brand.slug).toBe('test-pear');

      // 2. CSV Import
      const csvData = `TEST_Peach,,test-peach,Peach brand,PUBLISHED,TEST_Mobile`;
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/brands/import-csv',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { csvText: csvData }
      });
      expect(res2.statusCode).toBe(200);
      const importRes = JSON.parse(res2.payload);
      expect(importRes.success).toBe(true);
      expect(importRes.imported).toBe(1);
    });
  });

  describe('Model Endpoints', () => {
    it('should support model CRUD and CSV import', async () => {
      // Create brand
      const dt = await prisma.deviceType.create({ data: { name: 'TEST_Tablet', icon: 'tablet', slug: 'test-tablet' } });
      const brand = await prisma.brand.create({ data: { name: 'TEST_Orange', deviceTypeId: dt.id, slug: 'test-orange' } });

      // 1. Create Model
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Orange Pad 1', brandId: brand.id, slug: 'test-orange-pad-1', releaseYear: 2026, status: CompatibilityStatus.PUBLISHED }
      });
      expect(res1.statusCode).toBe(201);
      const model = JSON.parse(res1.payload).data;
      expect(model.releaseYear).toBe(2026);

      // 2. CSV Import
      const csvData = `TEST_Orange Pad Pro,test-orange-pad-pro,2026,0,PUBLISHED,TEST_Orange`;
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models/import-csv',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { csvText: csvData }
      });
      expect(res2.statusCode).toBe(200);
      const importRes = JSON.parse(res2.payload);
      expect(importRes.success).toBe(true);
      expect(importRes.imported).toBe(1);
    });
  });
});
