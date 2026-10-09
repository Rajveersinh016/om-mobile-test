import { prisma } from '../../../database/client.js';
import { PasswordResetToken } from '@prisma/client';

export class PasswordResetTokenRepository {
  /**
   * Invalidates any active tokens for the given user and creates a new hashed reset token.
   */
  static async createResetToken(
    userId: string,
    hashedToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PasswordResetToken> {
    // Single active token policy: invalidate all existing unused tokens for user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return prisma.passwordResetToken.create({
      data: {
        userId,
        hashedToken,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Finds an unexpired, unused token by its SHA-256 hash.
   */
  static async findValidToken(hashedToken: string): Promise<PasswordResetToken | null> {
    const token = await prisma.passwordResetToken.findUnique({
      where: { hashedToken },
      include: { user: true },
    });

    if (!token) return null;
    if (token.usedAt !== null) return null;
    if (token.expiresAt < new Date()) return null;

    return token;
  }

  /**
   * Marks a token as used.
   */
  static async markAsUsed(id: string): Promise<PasswordResetToken> {
    return prisma.passwordResetToken.update({
      where: { id },
      data: {
        usedAt: new Date(),
      },
    });
  }

  /**
   * Invalidates all open tokens for a user.
   */
  static async invalidateAllForUser(userId: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }
}
