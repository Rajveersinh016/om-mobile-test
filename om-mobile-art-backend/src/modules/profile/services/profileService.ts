import { prisma } from '../../../database/client.js';
import { User, UserSettings, NotificationPreferences, UserAvatar, UserSession } from '@prisma/client';
import { NotFoundError, ValidationError, AuthenticationError } from '../../../core/exceptions/exceptions.js';
import { uploadService } from '../../catalog/services/uploadService.js';
import { imageUrlGenerator } from '../../catalog/services/imageUrlGenerator.js';
import path from 'path';
import fs from 'fs';

export class ProfileService {
  async logActivity(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    details?: string
  ): Promise<void> {
    await prisma.accountActivity.create({
      data: {
        userId,
        action,
        ipAddress,
        userAgent,
        details,
      },
    });
  }

  async getProfile(userId: string): Promise<any> {
    // Retrieve user and relations
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        settings: true,
        notificationPreferences: true,
        avatars: {
          where: { isActive: true, deletedAt: null },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Lazy initialization of settings
    let settings = user.settings;
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          language: 'en',
          currency: 'INR',
          timezone: 'UTC',
        },
      });
    }

    // Lazy initialization of notification preferences
    let notificationPreferences = user.notificationPreferences;
    if (!notificationPreferences) {
      notificationPreferences = await prisma.notificationPreferences.create({
        data: {
          userId,
          marketingEmails: true,
          smsNotifications: true,
          whatsAppNotifications: false,
          pushNotifications: false,
          orderUpdates: true,
          deliveryUpdates: true,
          offers: false,
        },
      });
    }

    const activeAvatar = user.avatars[0] || null;
    const avatarUrl = activeAvatar ? imageUrlGenerator.generateUrl(activeAvatar.url) : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      avatarUrl,
      settings: {
        language: settings.language,
        currency: settings.currency,
        timezone: settings.timezone,
      },
      notificationPreferences: {
        marketingEmails: notificationPreferences.marketingEmails,
        smsNotifications: notificationPreferences.smsNotifications,
        whatsAppNotifications: notificationPreferences.whatsAppNotifications,
        pushNotifications: notificationPreferences.pushNotifications,
        orderUpdates: notificationPreferences.orderUpdates,
        deliveryUpdates: notificationPreferences.deliveryUpdates,
        offers: notificationPreferences.offers,
      },
    };
  }

  async updateProfile(
    userId: string,
    data: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update User fields
    const userUpdate: any = {};
    if (data.name !== undefined) userUpdate.name = data.name;
    if (data.phone !== undefined) userUpdate.phone = data.phone;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    // Update Settings fields
    if (data.settings) {
      await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...data.settings,
        },
        update: data.settings,
      });
    }

    // Update Notification Preferences fields
    if (data.notificationPreferences) {
      await prisma.notificationPreferences.upsert({
        where: { userId },
        create: {
          userId,
          ...data.notificationPreferences,
        },
        update: data.notificationPreferences,
      });
    }

    await this.logActivity(
      userId,
      'PROFILE_UPDATE',
      ipAddress,
      userAgent,
      'Updated profile details/preferences'
    );

    // Return refreshed profile
    return this.getProfile(userId);
  }

  async uploadAvatar(
    userId: string,
    filename: string,
    content: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ avatarUrl: string }> {
    // Reuses the hardened uploadService
    const uploadResult = await uploadService.upload(content, filename);
    const fileKey = uploadResult.key;

    await prisma.$transaction(async (tx) => {
      // Mark all previous avatars as inactive
      await tx.userAvatar.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      // Create new avatar history record
      await tx.userAvatar.create({
        data: {
          userId,
          url: fileKey,
          storageProvider: 'LOCAL',
          isActive: true,
        },
      });
    });

    await this.logActivity(
      userId,
      'AVATAR_CHANGE',
      ipAddress,
      userAgent,
      `Uploaded new avatar: ${fileKey}`
    );

    return {
      avatarUrl: imageUrlGenerator.generateUrl(fileKey),
    };
  }

  async deleteAvatar(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const activeAvatar = await prisma.userAvatar.findFirst({
      where: { userId, isActive: true, deletedAt: null },
    });

    if (!activeAvatar) {
      throw new NotFoundError('No active avatar found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.userAvatar.update({
        where: { id: activeAvatar.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    });

    // Delete physical file locally to save space
    const filePath = path.join(process.cwd(), 'public', 'uploads', activeAvatar.url);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // Log error silently
      }
    }

    await this.logActivity(
      userId,
      'AVATAR_DELETE',
      ipAddress,
      userAgent,
      'Deleted profile avatar'
    );
  }

  async listSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      deviceType: s.deviceType,
      location: s.location,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const session = await prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    await prisma.userSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    await this.logActivity(
      userId,
      'SESSION_REVOKE',
      ipAddress,
      userAgent,
      `Revoked session ${sessionId}`
    );
  }

  async revokeAllSessions(
    userId: string,
    currentSessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.userSession.updateMany({
      where: {
        userId,
        id: currentSessionId ? { not: currentSessionId } : undefined,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      data: { isRevoked: true },
    });

    await this.logActivity(
      userId,
      'SESSION_REVOKE_ALL',
      ipAddress,
      userAgent,
      'Revoked all other active sessions'
    );
  }

  async deactivateAccount(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Soft delete user row
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      // Revoke all active sessions
      await tx.userSession.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    await this.logActivity(
      userId,
      'ACCOUNT_DEACTIVATE',
      ipAddress,
      userAgent,
      'Self-deactivated account'
    );
  }

  async restoreAccount(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Admin only action - can restore any deactivated user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.deletedAt) {
      throw new ValidationError('User account is already active');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });

    await this.logActivity(
      userId,
      'ACCOUNT_RESTORE',
      ipAddress,
      userAgent,
      `Admin restored deactivated user account`
    );
  }

  async listActivities(userId: string): Promise<any[]> {
    return prisma.accountActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // limit to last 50 activities for performance
    });
  }
}

export const profileService = new ProfileService();
