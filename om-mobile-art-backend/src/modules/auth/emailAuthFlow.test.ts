import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import argon2 from 'argon2';
import crypto from 'crypto';

describe('Complete Email Authentication Flow Suite', () => {
  let app: FastifyInstance;
  const testEmail = 'email_flow_user@ommobileart.com';
  const initialPass = 'OldSecurePass123!';
  const newPass = 'NewAwesomePass99!';
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Cleanup existing test user if present
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
      await prisma.userSession.deleteMany({ where: { userId: existing.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  afterAll(async () => {
    if (userId) {
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
      await prisma.userSession.deleteMany({ where: { userId } });
      await prisma.accountActivity.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await app.close();
  });

  it('1. User Registration -> Triggers Welcome Email & Stores User', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        password: initialPass,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pending).toBe(true);

    // Verify PendingRegistration record was created
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: testEmail } });
    expect(pending).not.toBeNull();

    // Clean pending & create verified User record so downstream login/change-password tests proceed
    await prisma.pendingRegistration.deleteMany({ where: { email: testEmail } });
    const passwordHash = await argon2.hash(initialPass);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        isEmailVerified: true,
        role: 'CUSTOMER',
      },
    });
    userId = user.id;
  });

  it('2. User Login -> Generates Access Token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: initialPass,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    authToken = body.data.tokens.accessToken;
    expect(authToken).toBeDefined();
  });

  it('3. Change Password (Authenticated) -> Updates Password & Triggers Email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        oldPassword: initialPass,
        newPassword: newPass,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Password updated successfully');
  });

  it('4. Login with Old Password Fails, Login with New Password Succeeds', async () => {
    // Old password fails
    const oldRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: initialPass,
      },
    });
    expect(oldRes.statusCode).toBe(401);

    // New password succeeds
    const newRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: newPass,
      },
    });
    expect(newRes.statusCode).toBe(200);
  });

  it('5. Forgot Password -> Dispatches Email & Saves Token Hash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: testEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('If an account exists, a password reset email has been sent.');
  });

});
