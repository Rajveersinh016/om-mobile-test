import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import argon2 from 'argon2';
import crypto from 'crypto';
import { OtpPurpose } from '@prisma/client';

describe('Complete OTP Login System Integration Test Suite', () => {
  let app: FastifyInstance;

  const emailUser = 'otplogin_email@ommobileart.com';
  const unverifiedEmailUser = 'otplogin_unverified@ommobileart.com';
  const mobilePhone = '+919876543210';
  const userPassword = 'SecurePassword123!';

  let emailUserId: string;
  let unverifiedEmailUserId: string;
  let mobileUserId: string;

  const cleanupUser = async (userId: string) => {
    if (!userId) return;
    await prisma.otp.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.passwordResetToken.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.emailVerificationOTP.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.userSession.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.accountActivity.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.customerNote.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.wishlistItem.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.cart.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.order.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Cleanup existing users & OTP records by identifier
    await prisma.otp.deleteMany({
      where: {
        OR: [
          { email: emailUser },
          { email: unverifiedEmailUser },
          { phone: mobilePhone },
        ],
      },
    });

    const existingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: emailUser },
          { email: unverifiedEmailUser },
          { phone: mobilePhone },
        ],
      },
    });

    for (const u of existingUsers) {
      await cleanupUser(u.id);
    }

    const passHash = await argon2.hash(userPassword);

    // 1. Create Verified Email User
    const eUser = await prisma.user.create({
      data: {
        email: emailUser,
        passwordHash: passHash,
        isEmailVerified: true,
        role: 'CUSTOMER',
        name: 'Email OTP User',
      },
    });
    emailUserId = eUser.id;

    // 2. Create Unverified Email User
    const unvUser = await prisma.user.create({
      data: {
        email: unverifiedEmailUser,
        passwordHash: passHash,
        isEmailVerified: false,
        role: 'CUSTOMER',
        name: 'Unverified OTP User',
      },
    });
    unverifiedEmailUserId = unvUser.id;

    // 3. Create Mobile User
    const mUser = await prisma.user.create({
      data: {
        email: 'mobileuser@ommobileart.com',
        phone: mobilePhone,
        passwordHash: passHash,
        isEmailVerified: true,
        role: 'CUSTOMER',
        name: 'Mobile OTP User',
      },
    });
    mobileUserId = mUser.id;
  });

  afterAll(async () => {
    for (const uId of [emailUserId, unverifiedEmailUserId, mobileUserId]) {
      if (uId) {
        await cleanupUser(uId);
      }
    }
    await app.close();
  });

  it('1. User Not Found -> Returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/send',
      payload: { identifier: 'nonexistent_user_xyz@ommobileart.com' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('User not found');
  });

  it('2. Unverified Email -> Fails OTP Send with HTTP 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/send',
      payload: { identifier: unverifiedEmailUser },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('verify your email');
  });

  it('3. Email OTP Send -> Generates Hashed OTP in DB & Sends via Email Channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/send',
      payload: { identifier: emailUser },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.channel).toBe('email');
    expect(body.data.target).toBe(emailUser);

    // Verify hashed OTP stored in DB
    const storedOtp = await prisma.otp.findFirst({
      where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP },
    });
    expect(storedOtp).not.toBeNull();
    expect(storedOtp?.otpHash.length).toBe(64);
    expect(storedOtp?.attempts).toBe(0);
  });

  it('4. Resend Cooldown -> Requesting OTP within 60s Returns HTTP 429 Rate Limit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/send',
      payload: { identifier: emailUser },
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    const errorMsg = body.error?.message || body.message;
    expect(errorMsg.includes('Please wait') || errorMsg.includes('Too many requests')).toBe(true);
  });

  it('5. Wrong OTP -> Returns HTTP 401 & Increments Attempt Counter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { identifier: emailUser, otp: '000000' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('Invalid OTP');

    // Check attempts count in DB
    const storedOtp = await prisma.otp.findFirst({
      where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP },
    });
    expect(storedOtp?.attempts).toBe(1);
  });

  it('6. Expired OTP -> Returns Error on Verification', async () => {
    // Expire OTP in DB
    await prisma.otp.updateMany({
      where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP },
      data: { expiresAt: new Date(Date.now() - 15 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { identifier: emailUser, otp: '123456' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('expired');
  });

  it('7. Too Many Attempts (>5 attempts) -> Rejects Verification', async () => {
    // Re-create OTP with 5 attempts already recorded
    const rawOtp = '123456';
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    await prisma.otp.deleteMany({ where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP } });
    await prisma.otp.create({
      data: {
        userId: emailUserId,
        email: emailUser,
        purpose: OtpPurpose.LOGIN_OTP,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 5,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { identifier: emailUser, otp: rawOtp },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('Too many failed attempts');
  });

  it('8. Email OTP Successful Login -> Verifies OTP, Deletes OTP, Returns JWT & Session', async () => {
    const rawOtp = '654321';
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    await prisma.otp.deleteMany({ where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP } });
    await prisma.otp.create({
      data: {
        userId: emailUserId,
        email: emailUser,
        purpose: OtpPurpose.LOGIN_OTP,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { identifier: emailUser, otp: rawOtp },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(emailUser);
    expect(body.data.tokens.accessToken).toBeDefined();

    // Verify OTP record deleted after successful verification
    const deletedOtp = await prisma.otp.findFirst({
      where: { email: emailUser, purpose: OtpPurpose.LOGIN_OTP },
    });
    expect(deletedOtp).toBeNull();
  });

  it('9. Mobile OTP Login (Mock SMS Provider) -> Complete Send & Verify Flow', async () => {
    // 1. Send OTP to Mobile
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/send',
      payload: { identifier: mobilePhone },
    });

    expect(sendRes.statusCode).toBe(200);
    const sendBody = JSON.parse(sendRes.body);
    expect(sendBody.success).toBe(true);
    expect(sendBody.data.channel).toBe('sms');

    // 2. Set known OTP for testing verification
    const mobileOtp = '778899';
    const mobileOtpHash = crypto.createHash('sha256').update(mobileOtp).digest('hex');
    await prisma.otp.updateMany({
      where: { phone: mobilePhone, purpose: OtpPurpose.LOGIN_OTP },
      data: { otpHash: mobileOtpHash, attempts: 0 },
    });

    // 3. Verify OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { identifier: mobilePhone, otp: mobileOtp },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.user.phone).toBe(mobilePhone);
    expect(verifyBody.data.tokens.accessToken).toBeDefined();

    // Verify OTP record deleted
    const deletedOtp = await prisma.otp.findFirst({
      where: { phone: mobilePhone, purpose: OtpPurpose.LOGIN_OTP },
    });
    expect(deletedOtp).toBeNull();
  });
});
