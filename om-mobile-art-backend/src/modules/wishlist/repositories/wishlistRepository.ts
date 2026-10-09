import { prisma } from '../../../database/client.js';
import { WishlistItem } from '@prisma/client';

export class WishlistRepository {
  async findById(id: string, userId: string): Promise<WishlistItem | null> {
    return prisma.wishlistItem.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  async findByUserAndVariant(
    userId: string,
    productVariantId: string
  ): Promise<WishlistItem | null> {
    return prisma.wishlistItem.findFirst({
      where: {
        userId,
        productVariantId,
      },
    });
  }

  async findAllByUserId(userId: string): Promise<any[]> {
    return prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: true,
        variant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    productId: string,
    productVariantId: string
  ): Promise<WishlistItem> {
    return prisma.wishlistItem.create({
      data: {
        userId,
        productId,
        productVariantId,
      },
    });
  }

  async delete(id: string, userId: string): Promise<WishlistItem> {
    return prisma.wishlistItem.delete({
      where: {
        id,
        userId, // Enforces owner-only delete in where clause or we check first
      },
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.wishlistItem.count({
      where: { userId },
    });
  }
}

export const wishlistRepository = new WishlistRepository();
