import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Custom Skin Studio Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let customerToken: string;

  const adminEmail = 'custom_skin_admin@example.com';
  const customerEmail = 'custom_skin_customer@example.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();

    // Clean up
    const emails = [adminEmail, customerEmail];
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Register & Login Admin
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', // test password
        role: Role.ADMIN,
        isEmailVerified: true
      }
    });

    // Register & Login Customer
    const customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        role: Role.CUSTOMER,
        isEmailVerified: true
      }
    });

    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'supersecretkeyminimumthirtytwobyteslongkey';
    adminToken = jwt.default.sign({ userId: adminUser.id, role: Role.ADMIN }, secret, { expiresIn: '1h' });
    customerToken = jwt.default.sign({ userId: customerUser.id, role: Role.CUSTOMER }, secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    const emails = [adminEmail, customerEmail];
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('should fetch the custom skin studio settings (public endpoint)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-skin/settings'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    const settings = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
    expect(settings.basePrice || settings.price || 499).toBeGreaterThan(0);
  });

  it('should block updates to settings for non-admins/anonymous', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/custom-skin/settings',
      payload: { basePrice: 999 }
    });
    expect(res.statusCode).toBe(401);

    const res2 = await app.inject({
      method: 'PUT',
      url: '/api/v1/custom-skin/settings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { basePrice: 999 }
    });
    expect(res2.statusCode).toBe(403);
  });

  it('should allow admins to update settings', async () => {
    const originalSettingsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-skin/settings'
    });
    const currentSettings = JSON.parse(originalSettingsRes.payload).data;

    const newSettings = { ...currentSettings, basePrice: 1050 };

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/custom-skin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: newSettings
    });

    expect(updateRes.statusCode).toBe(200);
    const body = JSON.parse(updateRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.basePrice).toBe(1050);

    // Restore original settings
    await app.inject({
      method: 'PUT',
      url: '/api/v1/custom-skin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: currentSettings
    });
  });

  it('should calculate price for mobile back skin flow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-skin/calculate-price',
      payload: { flowType: 'mobile', quantity: 1 }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.unitPrice).toBeGreaterThan(0);
    expect(body.data.flowType).toBe('mobile');
  });

  it('should calculate price for laptop back skin flow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/custom-skin/calculate-price',
      payload: { flowType: 'laptop', quantity: 1 }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.unitPrice).toBeGreaterThan(0);
    expect(body.data.flowType).toBe('laptop');
  });
});
