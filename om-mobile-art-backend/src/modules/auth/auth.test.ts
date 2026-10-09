import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'crypto';

describe('Authentication & Authorization Integration Tests', () => {
  let app: any;
  const testEmail = 'auth_integration_test@example.com';
  const testPassword = 'Password123!';
  
  const adminEmail = 'admin_integration_test@example.com';
  const adminPassword = 'AdminPassword123!';

  async function cleanUserRecords() {
    const emails = [testEmail, adminEmail];
    await prisma.pendingRegistration.deleteMany({ where: { email: { in: emails } } });
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    for (const u of users) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: u.id } });
      await prisma.userSession.deleteMany({ where: { userId: u.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: u.id } });
      await prisma.adminActivityLog.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  async function createVerifiedUser(email: string, pass: string, role = Role.CUSTOMER) {
    const hash = await argon2.hash(pass);
    return prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role,
        isEmailVerified: true,
      },
    });
  }

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();
    await cleanUserRecords();
  });

  afterAll(async () => {
    await cleanUserRecords();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await cleanUserRecords();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new customer user successfully returning pending state', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.pending).toBe(true);
      expect(body.data.email).toBe(testEmail);
    });

    it('should fail registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testEmail,
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully for verified user and return access and refresh tokens', async () => {
      await createVerifiedUser(testEmail, testPassword);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      expect(body.data.user.email).toBe(testEmail);
    });

    it('should fail to login with wrong password', async () => {
      await createVerifiedUser(testEmail, testPassword);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should retrieve profile with valid bearer token', async () => {
      await createVerifiedUser(testEmail, testPassword);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      const { accessToken } = JSON.parse(loginResponse.payload).data.tokens;

      const profileResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(profileResponse.statusCode).toBe(200);
      const body = JSON.parse(profileResponse.payload);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(testEmail);
    });

    it('should reject profile request without bearer token', async () => {
      const profileResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(profileResponse.statusCode).toBe(401);
      const body = JSON.parse(profileResponse.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Token Refresh and Rotation', () => {
    it('should successfully rotate tokens using refresh token', async () => {
      await createVerifiedUser(testEmail, testPassword);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      const { refreshToken } = JSON.parse(loginResponse.payload).data.tokens;

      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      expect(refreshResponse.statusCode).toBe(200);
      const body = JSON.parse(refreshResponse.payload);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should deny access to admin endpoint for a CUSTOMER user', async () => {
      await createVerifiedUser(testEmail, testPassword, Role.CUSTOMER);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      const { accessToken } = JSON.parse(loginResponse.payload).data.tokens;

      const adminTestResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/admin/test',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(adminTestResponse.statusCode).toBe(403);
      const body = JSON.parse(adminTestResponse.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow access to admin endpoint for an ADMIN user', async () => {
      await createVerifiedUser(adminEmail, adminPassword, Role.ADMIN);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: adminEmail,
          password: adminPassword,
        },
      });

      const { accessToken } = JSON.parse(loginResponse.payload).data.tokens;

      const adminTestResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/admin/test',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(adminTestResponse.statusCode).toBe(200);
      const body = JSON.parse(adminTestResponse.payload);
      expect(body.success).toBe(true);
    });
  });
});
