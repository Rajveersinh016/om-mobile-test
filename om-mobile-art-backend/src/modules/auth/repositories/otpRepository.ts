import { prisma } from '../../../database/client.js';
import { Otp, OtpPurpose } from '@prisma/client';

export class OtpRepository {
  async deleteExistingOtps(identifier: { email?: string; phone?: string }, purpose: OtpPurpose): Promise<void> {
    if (identifier.email) {
      await prisma.otp.deleteMany({
        where: {
          email: identifier.email.toLowerCase().trim(),
          purpose,
        },
      });
    } else if (identifier.phone) {
      await prisma.otp.deleteMany({
        where: {
          phone: identifier.phone.trim(),
          purpose,
        },
      });
    }
  }

  async createOtp(data: {
    userId?: string;
    email?: string;
    phone?: string;
    purpose: OtpPurpose;
    otpHash: string;
    expiresAt: Date;
  }): Promise<Otp> {
    const email = data.email ? data.email.toLowerCase().trim() : undefined;
    const phone = data.phone ? data.phone.trim() : undefined;

    // Remove any previous active OTPs for the same target & purpose
    await this.deleteExistingOtps({ email, phone }, data.purpose);

    return prisma.otp.create({
      data: {
        userId: data.userId,
        email,
        phone,
        purpose: data.purpose,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        attempts: 0,
        resendCount: 0,
        lastResendAt: new Date(),
      },
    });
  }

  async findActiveOtp(identifier: { email?: string; phone?: string }, purpose: OtpPurpose): Promise<Otp | null> {
    if (identifier.email) {
      return prisma.otp.findFirst({
        where: {
          email: identifier.email.toLowerCase().trim(),
          purpose,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (identifier.phone) {
      return prisma.otp.findFirst({
        where: {
          phone: identifier.phone.trim(),
          purpose,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return null;
  }

  async incrementAttempts(id: string): Promise<Otp> {
    return prisma.otp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async updateOtpResend(id: string, newOtpHash: string, newExpiresAt: Date): Promise<Otp> {
    return prisma.otp.update({
      where: { id },
      data: {
        otpHash: newOtpHash,
        expiresAt: newExpiresAt,
        attempts: 0,
        resendCount: { increment: 1 },
        lastResendAt: new Date(),
      },
    });
  }

  async deleteOtp(id: string): Promise<void> {
    await prisma.otp.delete({
      where: { id },
    }).catch(() => {});
  }
}

export const otpRepository = new OtpRepository();
