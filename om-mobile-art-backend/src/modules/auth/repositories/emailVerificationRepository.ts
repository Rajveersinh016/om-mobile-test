import { prisma } from '../../../database/client.js';
import { EmailVerificationOTP } from '@prisma/client';

export class EmailVerificationRepository {
  /**
   * Creates a new OTP record for user, invalidating any previous unverified OTPs.
   */
  static async createOTP(
    userId: string,
    otpHash: string,
    expiresAt: Date,
    resendCount: number = 0
  ): Promise<EmailVerificationOTP> {
    // Delete/invalidate existing unverified OTPs for this user
    await prisma.emailVerificationOTP.deleteMany({
      where: { userId },
    });

    return prisma.emailVerificationOTP.create({
      data: {
        userId,
        otpHash,
        expiresAt,
        resendCount,
      },
    });
  }

  /**
   * Finds the latest OTP record for a user.
   */
  static async findLatestOTP(userId: string): Promise<EmailVerificationOTP | null> {
    return prisma.emailVerificationOTP.findFirst({
      where: { userId, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Increments the attempt counter for an OTP.
   */
  static async incrementAttempts(id: string): Promise<EmailVerificationOTP> {
    return prisma.emailVerificationOTP.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Marks OTP as verified.
   */
  static async markAsVerified(id: string): Promise<EmailVerificationOTP> {
    return prisma.emailVerificationOTP.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Deletes all OTP records for a user.
   */
  static async deleteForUser(userId: string): Promise<void> {
    await prisma.emailVerificationOTP.deleteMany({
      where: { userId },
    });
  }
}
