import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import crypto from 'crypto';

describe('Mandatory Email Verification & OTP Suite', () => {
  let app: FastifyInstance;
  const testEmail = 'verify_otp_test@ommobileart.com';
  const testPass = 'SuperSecretOtpPass123!';
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Clean up existing user if present
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: existing.id } });
      await prisma.userSession.deleteMany({ where: { userId: existing.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  afterAll(async () => {
    if (userId) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId } });
      await prisma.userSession.deleteMany({ where: { userId } });
      await prisma.accountActivity.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await app.close();
  });

  it('1. User Registration -> creates user with isEmailVerified = false and stores HASHED OTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        password: testPass,
        name: 'OTP Tester',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pending).toBe(true);

    const pending = await prisma.pendingRegistration.findUnique({ where: { email: testEmail } });
    expect(pending).toBeDefined();
    expect(pending?.otpHash).toBeDefined();
    expect(pending?.otpHash.length).toBe(64);
  });

  it('2. Login Attempt BEFORE Verification -> BLOCKED with 404/403 (No verified user)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPass,
      },
    });

    expect([401, 403, 404]).toContain(res.statusCode);
  });

  it('3. Submit WRONG OTP -> Rejected with Invalid OTP message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: testEmail,
        otp: '000000', // Invalid OTP
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message || String(body.error);
    expect(errorMsg).toContain('Invalid OTP');
  });

  it('4. Submit EXPIRED OTP -> Rejected with Expired code message', async () => {
    // Force OTP expiration in DB
    await prisma.pendingRegistration.updateMany({
      where: { email: testEmail },
      data: { expiresAt: new Date(Date.now() - 15 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: testEmail,
        otp: '123456',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message || String(body.error);
    expect(errorMsg).toContain('OTP has expired');
  });

  it('5. Resend OTP -> Generates new OTP & enforces rate limiting', async () => {
    // Age the initial OTP created during registration so the 60s cooldown passes
    await prisma.pendingRegistration.updateMany({
      where: { email: testEmail },
      data: { lastResendAt: new Date(Date.now() - 61 * 1000) },
    });

    // Resend 1 -> Succeeds
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: {
        email: testEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('A new verification code has been sent');

    // Immediate second resend within 60s -> Rate limited
    const resend2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: {
        email: testEmail,
      },
    });
    expect(resend2.statusCode).toBe(429);
  });

  it('6. Submit CORRECT OTP -> Creates user, updates isEmailVerified = true, logs in user', async () => {
    // Generate known OTP for test
    const validOtp = '548921';
    const otpHash = crypto.createHash('sha256').update(validOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Overwrite OTP in PendingRegistration with valid hash
    await prisma.pendingRegistration.updateMany({
      where: { email: testEmail },
      data: {
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: testEmail,
        otp: validOtp,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBeDefined();

    // Check user is verified in DB
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.isEmailVerified).toBe(true);
  });

  it('7. Login AFTER Verification -> SUCCEEDS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPass,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

});
