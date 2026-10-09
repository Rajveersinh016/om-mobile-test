import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import argon2 from 'argon2';
import crypto from 'crypto';
import { PasswordResetTokenRepository } from './repositories/passwordResetTokenRepository.js';

describe('Production-Ready Forgot Password & Reset Password Suite', () => {
  let app: FastifyInstance;
  const testEmail = 'reset_user_test@ommobileart.com';
  const initialPassword = 'InitialOldPassword123!';
  const updatedPassword = 'BrandNewSecurePassword99!';
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Clean up previous test user if exists
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
      await prisma.userSession.deleteMany({ where: { userId: existing.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // Create test user
    const passwordHash = await argon2.hash(initialPassword);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: 'Reset Tester',
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });
    userId = user.id;
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

  it('1. should return identical message for existing user (enumeration protection)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: testEmail },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('If an account exists, a password reset email has been sent.');

    // Verify token record was created in database with SHA-256 hash
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId, usedAt: null },
    });
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord?.hashedToken).toBeDefined();
  });

  it('2. should return identical message for non-existing email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'non_existent_email_12345@example.com' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('If an account exists, a password reset email has been sent.');
  });

  it('3. should reject an expired token', async () => {
    const rawToken = 'expired_raw_token_123456';
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago

    await prisma.passwordResetToken.create({
      data: {
        userId,
        hashedToken,
        expiresAt: pastDate,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: rawToken,
        password: updatedPassword,
        confirmPassword: updatedPassword,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message || String(body.error);
    expect(errorMsg).toContain('Invalid or expired password reset token');
  });

  it('4. should reject an already used token', async () => {
    const rawToken = 'used_raw_token_123456';
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId,
        hashedToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: rawToken,
        password: updatedPassword,
        confirmPassword: updatedPassword,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message || String(body.error);
    expect(errorMsg).toContain('Invalid or expired password reset token');
  });

  it('5. should successfully reset password with valid token and invalidate token & sessions', async () => {
    // Generate valid raw token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetTokenRepository.createResetToken(userId, hashedToken, expiresAt);

    // Create an active user session to test session revocation
    const session = await prisma.userSession.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: rawToken,
        password: updatedPassword,
        confirmPassword: updatedPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Password reset successfully');

    // Check token is now marked as used
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { hashedToken },
    });
    expect(tokenRecord?.usedAt).not.toBeNull();

    // Check session was revoked
    const updatedSession = await prisma.userSession.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.isRevoked).toBe(true);
  });

  it('6. should reject login with old password and succeed with new password', async () => {
    // Attempt login with old password -> MUST FAIL
    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: initialPassword,
      },
    });
    expect(oldLoginRes.statusCode).toBe(401);

    // Attempt login with new password -> MUST SUCCEED
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: updatedPassword,
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
    const body = JSON.parse(newLoginRes.body);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

});
