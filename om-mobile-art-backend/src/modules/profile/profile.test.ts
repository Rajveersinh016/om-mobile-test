import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';
import path from 'path';
import fs from 'fs';

describe('Customer Profile & Address Book Integration Tests', () => {
  let app: any;
  
  const customerEmail = 'customer_profile@example.com';
  const otherCustomerEmail = 'other_customer@example.com';
  const adminEmail = 'admin_profile@example.com';
  const testPassword = 'Password123!';

  let customerToken: string;
  let customerSessionId: string;
  let customerId: string;

  let otherCustomerToken: string;
  let otherCustomerId: string;

  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Delete all testing data
    const emails = [customerEmail, otherCustomerEmail, adminEmail];
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userAvatar.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSettings.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.notificationPreferences.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Re-create testing users and retrieve fresh tokens
    const emails = [customerEmail, otherCustomerEmail, adminEmail];
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userAvatar.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSettings.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.notificationPreferences.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Register customer
    const regCust = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: customerEmail, password: testPassword, role: Role.CUSTOMER },
    });
    customerId = JSON.parse(regCust.payload).data.id;

    // Login customer
    const loginCust = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: customerEmail, password: testPassword },
    });
    const parsedCust = JSON.parse(loginCust.payload);
    customerToken = parsedCust.data.tokens.accessToken;
    
    // Find customer session ID
    const session = await prisma.userSession.findFirst({ where: { userId: customerId } });
    customerSessionId = session!.id;

    // Register other customer
    const regOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: otherCustomerEmail, password: testPassword, role: Role.CUSTOMER },
    });
    otherCustomerId = JSON.parse(regOther.payload).data.id;

    // Login other customer
    const loginOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: otherCustomerEmail, password: testPassword },
    });
    otherCustomerToken = JSON.parse(loginOther.payload).data.tokens.accessToken;

    // Register admin
    const regAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: adminEmail, password: testPassword },
    });
    adminId = JSON.parse(regAdmin.payload).data.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: Role.ADMIN } });

    // Login admin
    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { email: adminEmail, password: testPassword },
    });
    adminToken = JSON.parse(loginAdmin.payload).data.tokens.accessToken;
  });

  describe('Customer Profile Integration Tests', () => {
    it('should retrieve a new customer profile and lazy initialize settings/preferences', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.email).toBe(customerEmail);
      expect(data.settings.language).toBe('en');
      expect(data.settings.currency).toBe('INR');
      expect(data.notificationPreferences.marketingEmails).toBe(true);
    });

    it('should update name, phone, settings, and notification preferences', async () => {
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          name: 'Jane Doe',
          phone: '9876543210',
          settings: { language: 'fr', currency: 'EUR', timezone: 'CET' },
          notificationPreferences: { marketingEmails: false, smsNotifications: false },
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const data = JSON.parse(updateRes.payload).data;
      expect(data.name).toBe('Jane Doe');
      expect(data.phone).toBe('9876543210');
      expect(data.settings.language).toBe('fr');
      expect(data.settings.currency).toBe('EUR');
      expect(data.notificationPreferences.marketingEmails).toBe(false);
      expect(data.notificationPreferences.smsNotifications).toBe(false);
    });

    it('should upload a profile avatar through uploadService and record active status', async () => {
      const base64Content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 png
      
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/profile/avatar',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          filename: 'avatar.png',
          content: base64Content,
        },
      });

      expect(uploadRes.statusCode).toBe(200);
      const url = JSON.parse(uploadRes.payload).data.avatarUrl;
      expect(url).toContain('/uploads/');

      // Verify that UserAvatar has been created and is active
      const avatarRecord = await prisma.userAvatar.findFirst({
        where: { userId: customerId, isActive: true },
      });
      expect(avatarRecord).not.toBeNull();

      // Retrieve list of avatars and verify old one gets deactivated if upload new one
      const uploadRes2 = await app.inject({
        method: 'POST',
        url: '/api/v1/profile/avatar',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          filename: 'avatar2.png',
          content: base64Content,
        },
      });
      expect(uploadRes2.statusCode).toBe(200);

      const oldRecord = await prisma.userAvatar.findUnique({
        where: { id: avatarRecord!.id },
      });
      expect(oldRecord?.isActive).toBe(false);

      // Clean up uploads
      const cleanPath1 = path.join(process.cwd(), 'public', 'uploads', avatarRecord!.url);
      const cleanPath2 = path.join(process.cwd(), 'public', 'uploads', JSON.parse(uploadRes2.payload).data.avatarUrl.split('/uploads/')[1]);
      if (fs.existsSync(cleanPath1)) fs.unlinkSync(cleanPath1);
      if (fs.existsSync(cleanPath2)) fs.unlinkSync(cleanPath2);
    });

    it('should delete own active avatar', async () => {
      const base64Content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 png
      
      await app.inject({
        method: 'POST',
        url: '/api/v1/profile/avatar',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { filename: 'avatar.png', content: base64Content },
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/profile/avatar',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(delRes.statusCode).toBe(200);

      const activeRecord = await prisma.userAvatar.findFirst({
        where: { userId: customerId, isActive: true },
      });
      expect(activeRecord).toBeNull();
    });

    it('should fetch list of user activities', async () => {
      const actRes = await app.inject({
        method: 'GET',
        url: '/api/v1/profile/activity',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(actRes.statusCode).toBe(200);
      const activities = JSON.parse(actRes.payload).data;
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].action).toBe('LOGIN');
    });
  });

  describe('Address Book Integration Tests', () => {
    it('should create, list, update, and delete customer addresses', async () => {
      // Create first address (Home)
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/profile/addresses',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          fullName: 'John Doe',
          phone: '9999999999',
          alternativePhone: '8888888888',
          companyName: 'B2B Org',
          gstNumber: '29ABCDE1234F1Z5',
          addressLine1: 'Flat 101, Sunny Enclave',
          addressLine2: 'Sector 55',
          landmark: 'Opp Park',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          pincode: '560001',
          type: 'HOME',
        },
      });

      expect(res1.statusCode).toBe(201);
      const addr1 = JSON.parse(res1.payload).data;
      expect(addr1.fullName).toBe('John Doe');
      // Verify first address is automatically promoted to default shipping and billing
      expect(addr1.isDefaultShipping).toBe(true);
      expect(addr1.isDefaultBilling).toBe(true);
      expect(addr1.gstNumber).toBe('29ABCDE1234F1Z5');

      // Create second address (Office)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/profile/addresses',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          fullName: 'John Doe Office',
          phone: '7777777777',
          addressLine1: 'Tower B, Tech Park',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          pincode: '560103',
          type: 'OFFICE',
          isDefaultShipping: true, // switch default shipping
        },
      });

      expect(res2.statusCode).toBe(201);
      const addr2 = JSON.parse(res2.payload).data;
      expect(addr2.isDefaultShipping).toBe(true);
      expect(addr2.isDefaultBilling).toBe(false);

      // Verify first address is no longer default shipping but remains default billing
      const checkAddr1 = await prisma.address.findUnique({ where: { id: addr1.id } });
      expect(checkAddr1?.isDefaultShipping).toBe(false);
      expect(checkAddr1?.isDefaultBilling).toBe(true);

      // Update address
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/profile/addresses/${addr2.id}`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { companyName: 'New Corporate Ltd' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).data.companyName).toBe('New Corporate Ltd');

      // Switch default billing to second address
      const defRes = await app.inject({
        method: 'POST',
        url: `/api/v1/profile/addresses/${addr2.id}/default`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { isDefaultBilling: true },
      });
      expect(defRes.statusCode).toBe(200);

      const checkAddr2 = await prisma.address.findUnique({ where: { id: addr2.id } });
      expect(checkAddr2?.isDefaultBilling).toBe(true);
      const checkAddr1Again = await prisma.address.findUnique({ where: { id: addr1.id } });
      expect(checkAddr1Again?.isDefaultBilling).toBe(false);

      // Delete the default address (addr2) and verify addr1 gets promoted back to default shipping & billing
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/profile/addresses/${addr2.id}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(delRes.statusCode).toBe(200);

      const promotedAddr1 = await prisma.address.findUnique({ where: { id: addr1.id } });
      expect(promotedAddr1?.isDefaultShipping).toBe(true);
      expect(promotedAddr1?.isDefaultBilling).toBe(true);
    });

    it('should prevent IDOR (customer cannot read/modify other customer address)', async () => {
      // Create address under customer 1
      const addr = await prisma.address.create({
        data: {
          userId: customerId,
          fullName: 'Secret Owner',
          phone: '1234567890',
          addressLine1: 'Confidential Rd',
          city: 'MUM',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
          type: 'HOME',
        },
      });

      // Try to read it using otherCustomerToken
      const readRes = await app.inject({
        method: 'GET',
        url: `/api/v1/profile/addresses/${addr.id}`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
      });
      expect(readRes.statusCode).toBe(404); // returns 404/NotFoundError instead of leaking existance or data

      // Try to update it using otherCustomerToken
      const writeRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/profile/addresses/${addr.id}`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
        payload: { fullName: 'Hacker' },
      });
      expect(writeRes.statusCode).toBe(404);
    });
  });

  describe('Customer Session & Device Integration Tests', () => {
    it('should list active logged in device sessions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profile/devices',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const devices = JSON.parse(res.payload).data;
      expect(devices.length).toBe(1);
      expect(devices[0].isCurrent).toBe(true);
    });

    it('should log out from all other devices', async () => {
      // Create a secondary dummy session for the customer
      const secondarySession = await prisma.userSession.create({
        data: {
          userId: customerId,
          userAgent: 'Mozilla (iPhone)',
          expiresAt: new Date(Date.now() + 1000000),
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/profile/devices',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(200);

      // Verify secondary session gets revoked, but current remains active
      const sec = await prisma.userSession.findUnique({ where: { id: secondarySession.id } });
      expect(sec?.isRevoked).toBe(true);

      const cur = await prisma.userSession.findUnique({ where: { id: customerSessionId } });
      expect(cur?.isRevoked).toBe(false);
    });

    it('should log out / revoke a specific device session', async () => {
      const secondarySession = await prisma.userSession.create({
        data: {
          userId: customerId,
          userAgent: 'Tablet App',
          expiresAt: new Date(Date.now() + 1000000),
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/profile/devices/${secondarySession.id}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(200);

      const sec = await prisma.userSession.findUnique({ where: { id: secondarySession.id } });
      expect(sec?.isRevoked).toBe(true);
    });
  });

  describe('Soft Delete & Restore Account Integration Tests', () => {
    it('should self-deactivate own account and reject subsequent logins', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/profile/deactivate',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(200);

      // Try to call profile using current token (should fail because session gets revoked)
      const testReq = await app.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(testReq.statusCode).toBe(401);

      // Try to log in again (should fail because user is soft-deleted)
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: customerEmail, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(401);
    });

    it('should restore a soft-deleted customer account (restricted to ADMIN)', async () => {
      // First, deactivate the customer
      await app.inject({
        method: 'POST',
        url: '/api/v1/profile/deactivate',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      // Try to restore as customer itself (unauthorized)
      const resCustomer = await app.inject({
        method: 'POST',
        url: `/api/v1/profile/${customerId}/restore`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
      });
      expect(resCustomer.statusCode).toBe(403);

      // Restore as Admin
      const resAdmin = await app.inject({
        method: 'POST',
        url: `/api/v1/profile/${customerId}/restore`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resAdmin.statusCode).toBe(200);

      // Login customer again (should succeed now!)
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: customerEmail, password: testPassword },
      });
      expect(loginRes.statusCode).toBe(200);
    });
  });
});
