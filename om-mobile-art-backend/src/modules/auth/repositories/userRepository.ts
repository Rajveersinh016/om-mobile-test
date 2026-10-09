import { prisma } from '../../../database/client.js';
import { Prisma, User, Role } from '@prisma/client';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    const rawPhone = phone.trim();
    const digitsOnly = rawPhone.replace(/\D/g, '');
    
    // Search by raw phone, digits only, or +91 prefix
    return prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone: rawPhone },
          { phone: digitsOnly },
          { phone: `+91${digitsOnly}` },
          { phone: digitsOnly.length === 10 ? digitsOnly : undefined },
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
    });
  }

  async findByIdentifier(identifier: string): Promise<{ user: User | null; type: 'email' | 'phone' }> {
    const trimmed = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    
    if (isEmail) {
      const user = await this.findByEmail(trimmed);
      return { user, type: 'email' };
    } else {
      const user = await this.findByPhone(trimmed);
      return { user, type: 'phone' };
    }
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async logActivity(
    userId: string,
    action: string,
    targetId?: string,
    details?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.adminActivityLog.create({
      data: {
        userId,
        action,
        targetId,
        details,
        ipAddress,
        userAgent,
      },
    });
  }
}

export const userRepository = new UserRepository();
