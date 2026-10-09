import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import crypto from 'crypto';

describe('Strict Zero-Trust Pending Registration & Verification Suite', () => {
  let app: FastifyInstance;
  const validEmail = 'pending_user_test@ommobileart.com';
  const testPass = 'SuperSecretOtpPass123!';
  let createdUserId: string | null = null;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Clean up test data
    await prisma.pendingRegistration.deleteMany({ where: { email: validEmail } });
    const existingUser = await prisma.user.findUnique({ where: { email: validEmail } });
    if (existingUser) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: existingUser.id } });
      await prisma.userSession.deleteMany({ where: { userId: existingUser.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
    }
  });

  afterAll(async () => {
    await prisma.pendingRegistration.deleteMany({ where: { email: validEmail } });
    if (createdUserId) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: createdUserId } });
      await prisma.userSession.deleteMany({ where: { userId: createdUserId } });
      await prisma.accountActivity.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } });
    }
    await app.close();
  });

  it('1. Invalid Email Formats MUST FAIL with HTTP 400 before DB insert', async () => {
    const invalidEmails = [
      'abc',
      'gmail.com',
      'abc@',
      'abc@gmail',
      'abc@@gmail.com',
      'hello@localhost',
    ];

    for (const email of invalidEmails) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: testPass,
          name: 'Invalid Tester',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);

      // Verify no pending registration was created
      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending).toBeNull();

      // Verify no user record was created
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    }
  });

  it('2. Registration with Valid Email -> Creates PendingRegistration BUT NO User record yet', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: validEmail,
        password: testPass,
        name: 'Zero Trust Tester',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pending).toBe(true);
    expect(body.message).toContain('Verification code sent to your email.');

    // 1. Verify PendingRegistration record IS created
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: validEmail } });
    expect(pending).not.toBeNull();
    expect(pending?.otpHash.length).toBe(64); // SHA-256 hash length

    // 2. CRITICAL: Verify NO User record exists in PostgreSQL database yet!
    const user = await prisma.user.findUnique({ where: { email: validEmail } });
    expect(user).toBeNull();
  });

  it('3. Existing Registered Email MUST return HTTP 409 Conflict', async () => {
    // Clean up if left from previous test run
    const existing = await prisma.user.findUnique({ where: { email: 'already_existing_user@ommobileart.com' } });
    if (existing) {
      await prisma.userSession.deleteMany({ where: { userId: existing.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // Create an existing registered user
    const dummyUser = await prisma.user.create({
      data: {
        email: 'already_existing_user@ommobileart.com',
        passwordHash: 'dummyhash123',
        isEmailVerified: true,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'already_existing_user@ommobileart.com',
        password: testPass,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('already exists');

    // Cleanup dummy user
    await prisma.user.delete({ where: { id: dummyUser.id } });
  });

  it('4. Submit WRONG OTP -> Rejected with "Invalid OTP"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: validEmail,
        otp: '000000',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message;
    expect(errorMsg).toContain('Invalid OTP');

    // Still no user created
    const user = await prisma.user.findUnique({ where: { email: validEmail } });
    expect(user).toBeNull();
  });

  it('5. Submit EXPIRED OTP -> Rejected with "OTP has expired"', async () => {
    // Expire the pending registration OTP in DB
    await prisma.pendingRegistration.update({
      where: { email: validEmail },
      data: { expiresAt: new Date(Date.now() - 15 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: validEmail,
        otp: '123456',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message;
    expect(errorMsg).toContain('OTP has expired');
  });

  it('6. Resend OTP -> Enforces 60s cooldown & updates PendingRegistration', async () => {
    // Set lastResendAt to 61s ago
    await prisma.pendingRegistration.update({
      where: { email: validEmail },
      data: {
        lastResendAt: new Date(Date.now() - 61 * 1000),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: {
        email: validEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Immediate second resend within 60s -> Rate limited with HTTP 429
    const resend2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: {
        email: validEmail,
      },
    });

    expect(resend2.statusCode).toBe(429);
  });

  it('7. Submit CORRECT OTP -> Creates User Account in PostgreSQL & Deletes PendingRegistration', async () => {
    const validOtp = '548921';
    const otpHash = crypto.createHash('sha256').update(validOtp).digest('hex');

    // Update pending record with known OTP hash
    await prisma.pendingRegistration.update({
      where: { email: validEmail },
      data: {
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: validEmail,
        otp: validOtp,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Email verified successfully. Account created!');
    expect(body.data.tokens.accessToken).toBeDefined();

    // 1. Verify User record is now created in PostgreSQL with isEmailVerified = true
    const user = await prisma.user.findUnique({ where: { email: validEmail } });
    expect(user).not.toBeNull();
    expect(user?.isEmailVerified).toBe(true);
    createdUserId = user!.id;

    // 2. Verify PendingRegistration record is deleted
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: validEmail } });
    expect(pending).toBeNull();
  });

  it('8. User Login AFTER Verification -> SUCCEEDS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: validEmail,
        password: testPass,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(validEmail);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

});
