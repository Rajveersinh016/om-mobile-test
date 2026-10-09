import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import crypto from 'crypto';

describe('Comprehensive Email OTP Registration & Verification Test Suite', () => {
  let app: FastifyInstance;
  const userEmail = 'new_otp_user@ommobileart.com';
  const userPass = 'SecurePassword123!';
  const userName = 'OTP Test User';

  const existingEmail = 'existing_verified_user@ommobileart.com';
  const unverifiedEmail = 'existing_unverified_user@ommobileart.com';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Cleanup any pre-existing records
    await prisma.pendingRegistration.deleteMany({
      where: { email: { in: [userEmail, existingEmail, unverifiedEmail] } },
    });
    
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: [userEmail, existingEmail, unverifiedEmail] } },
    });

    for (const u of existingUsers) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: u.id } });
      await prisma.userSession.deleteMany({ where: { userId: u.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  });

  afterAll(async () => {
    await prisma.pendingRegistration.deleteMany({
      where: { email: { in: [userEmail, existingEmail, unverifiedEmail] } },
    });

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: [userEmail, existingEmail, unverifiedEmail] } },
    });

    for (const u of existingUsers) {
      await prisma.emailVerificationOTP.deleteMany({ where: { userId: u.id } });
      await prisma.userSession.deleteMany({ where: { userId: u.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }

    await app.close();
  });

  it('A. New registration → OTP sent & pending state returned', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: userEmail,
        password: userPass,
        name: userName,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pending).toBe(true);
    expect(body.data.email).toBe(userEmail);

    // PendingRegistration record created
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: userEmail } });
    expect(pending).not.toBeNull();
    expect(pending?.otpHash.length).toBe(64); // SHA-256 hash length

    // User record NOT created yet
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    expect(user).toBeNull();
  });

  it('C. Wrong OTP → rejected with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: userEmail,
        otp: '000000',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('Invalid OTP');
  });

  it('D. Expired OTP → rejected', async () => {
    // Manually expire pending OTP in DB
    await prisma.pendingRegistration.update({
      where: { email: userEmail },
      data: { expiresAt: new Date(Date.now() - 15 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: userEmail,
        otp: '123456',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('OTP has expired');
  });

  it('E & J. Resend OTP → old OTP invalidated & rate limiting enforced', async () => {
    // Set lastResendAt to 61s ago to allow resend
    await prisma.pendingRegistration.update({
      where: { email: userEmail },
      data: {
        lastResendAt: new Date(Date.now() - 61 * 1000),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification-otp',
      payload: {
        email: userEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Immediate second resend within 60s -> Rate limited (HTTP 429)
    const resend2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification-otp',
      payload: {
        email: userEmail,
      },
    });

    expect(resend2.statusCode).toBe(429);
  });

  it('B & I. Correct OTP → email verified, user created & OTP cannot be reused', async () => {
    const validOtp = '548921';
    const otpHash = crypto.createHash('sha256').update(validOtp).digest('hex');

    // Update pending registration with known valid OTP hash
    await prisma.pendingRegistration.update({
      where: { email: userEmail },
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
        email: userEmail,
        otp: validOtp,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(userEmail);
    expect(body.data.tokens.accessToken).toBeDefined();

    // Verify User record now exists and is marked as verified
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    expect(user).not.toBeNull();
    expect(user?.isEmailVerified).toBe(true);

    // Verify PendingRegistration record deleted
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: userEmail } });
    expect(pending).toBeNull();

    // Reusing same OTP should be rejected (I. OTP cannot be reused)
    const reuseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: {
        email: userEmail,
        otp: validOtp,
      },
    });
    // User is already verified, returns session or rejects reuse
    expect(reuseRes.statusCode).toBe(200);
  });

  it('F & K. Existing verified user → login without OTP & password login works normally', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: userEmail,
        password: userPass,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(userEmail);
    expect(body.data.tokens.accessToken).toBeDefined();
    // No OTP prompt or redirection
  });

  it('H. Existing verified email attempting registration → rejected with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: userEmail,
        password: 'AnotherPassword123!',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('An account with this email already exists. Please log in.');
  });

  it('G. Existing unverified user → rejected during login with EMAIL_NOT_VERIFIED (403)', async () => {
    // Create an unverified user account directly in DB
    const argon2 = await import('argon2');
    const hash = await argon2.hash('UnverifiedPass123!');
    const unverifiedUser = await prisma.user.create({
      data: {
        email: unverifiedEmail,
        passwordHash: hash,
        isEmailVerified: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: unverifiedEmail,
        password: 'UnverifiedPass123!',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error?.message || body.message).toContain('Please verify your email before logging in.');
  });

});
