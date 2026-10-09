import { prisma } from '../../../database/client.js';
import { PendingRegistration } from '@prisma/client';

export class PendingRegistrationRepository {
  /**
   * Upserts a pending registration record for an email address.
   * If a pending registration already exists for this email, replaces it with new OTP & password hash.
   */
  static async upsertPendingRegistration(
    email: string,
    passwordHash: string,
    otpHash: string,
    expiresAt: Date,
    name?: string
  ): Promise<PendingRegistration> {
    const normalizedEmail = email.trim().toLowerCase();

    return prisma.pendingRegistration.upsert({
      where: { email: normalizedEmail },
      update: {
        name: name || null,
        passwordHash,
        otpHash,
        expiresAt,
        attempts: 0,
        resendCount: 0,
        lastResendAt: new Date(),
      },
      create: {
        email: normalizedEmail,
        name: name || null,
        passwordHash,
        otpHash,
        expiresAt,
        attempts: 0,
        resendCount: 0,
        lastResendAt: new Date(),
      },
    });
  }

  /**
   * Finds pending registration by normalized email address.
   */
  static async findByEmail(email: string): Promise<PendingRegistration | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Increments failed verify attempts counter for a pending registration.
   */
  static async incrementAttempts(id: string): Promise<PendingRegistration> {
    return prisma.pendingRegistration.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Updates OTP hash and resend counter for pending registration.
   */
  static async updateOTPForResend(
    id: string,
    otpHash: string,
    expiresAt: Date,
    resendCount: number
  ): Promise<PendingRegistration> {
    return prisma.pendingRegistration.update({
      where: { id },
      data: {
        otpHash,
        expiresAt,
        attempts: 0,
        resendCount,
        lastResendAt: new Date(),
      },
    });
  }

  /**
   * Deletes a pending registration record upon successful verification.
   */
  static async deleteByEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await prisma.pendingRegistration.deleteMany({
      where: { email: normalizedEmail },
    });
  }
}
