import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReviewRepository {
  public static async findById(id: string) {
    return prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, image: true } },
        order: { select: { id: true, orderNumber: true, status: true } }
      }
    });
  }

  public static async findByProduct(productId: string) {
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const stats = await this.calculateProductRating(productId);
    return { reviews, stats };
  }

  public static async calculateProductRating(productId: string) {
    const aggregate = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true }
    });

    const totalReviews = aggregate._count.id || 0;
    const averageRating = totalReviews > 0 ? Number((aggregate._avg.rating || 0).toFixed(1)) : 0;

    return { totalReviews, averageRating };
  }

  public static async findUserDeliveredOrdersForProduct(userId: string, productId: string) {
    // Find all DELIVERED or COMPLETED orders for user containing product variant of product
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        items: {
          some: {
            productVariant: {
              productId
            }
          }
        }
      },
      include: {
        items: {
          include: {
            productVariant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return orders;
  }

  public static async findExistingReview(userId: string, productId: string, orderId: string) {
    return prisma.review.findFirst({
      where: {
        userId,
        productId,
        orderId
      }
    });
  }

  public static async create(data: {
    userId: string;
    productId: string;
    orderId: string;
    rating: number;
    title?: string;
    comment: string;
    images?: string[];
  }) {
    return prisma.review.create({
      data: {
        userId: data.userId,
        productId: data.productId,
        orderId: data.orderId,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment,
        images: data.images ? data.images : [],
        verifiedPurchase: true
      },
      include: {
        user: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } }
      }
    });
  }

  public static async update(id: string, data: {
    rating?: number;
    title?: string;
    comment?: string;
    images?: string[];
  }) {
    return prisma.review.update({
      where: { id },
      data: {
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
        ...(data.images !== undefined ? { images: data.images } : {})
      },
      include: {
        user: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } }
      }
    });
  }

  public static async delete(id: string) {
    return prisma.review.delete({
      where: { id }
    });
  }

  public static async findPendingReviewsForUser(userId: string) {
    // 1. Get all DELIVERED/COMPLETED orders for user
    const deliveredOrders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: ['DELIVERED', 'COMPLETED'] }
      },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    // 2. Get all existing reviews by user
    const existingReviews = await prisma.review.findMany({
      where: { userId },
      select: { productId: true, orderId: true }
    });

    const reviewedKeys = new Set(
      existingReviews.map(r => `${r.orderId}_${r.productId}`)
    );

    const pendingItems: Array<{
      orderId: string;
      orderNumber: string;
      deliveredAt: Date | null;
      product: {
        id: string;
        name: string;
        image: string;
        price: number;
      };
    }> = [];

    for (const order of deliveredOrders) {
      const uniqueProductsInOrder = new Map<string, any>();
      for (const item of order.items) {
        if (item.productVariant?.product) {
          uniqueProductsInOrder.set(item.productVariant.product.id, item.productVariant.product);
        }
      }

      for (const [productId, product] of uniqueProductsInOrder.entries()) {
        const key = `${order.id}_${productId}`;
        if (!reviewedKeys.has(key)) {
          pendingItems.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            deliveredAt: order.updatedAt,
            product: {
              id: product.id,
              name: product.name,
              image: product.image,
              price: product.price
            }
          });
        }
      }
    }

    return pendingItems;
  }

  public static async findAllForAdmin(options: {
    rating?: number;
    productId?: string;
    userId?: string;
    search?: string;
  }) {
    const where: any = {};

    if (options.rating) where.rating = options.rating;
    if (options.productId) where.productId = options.productId;
    if (options.userId) where.userId = options.userId;
    if (options.search) {
      where.OR = [
        { comment: { contains: options.search } },
        { title: { contains: options.search } },
        { user: { name: { contains: options.search } } },
        { user: { email: { contains: options.search } } },
        { product: { name: { contains: options.search } } }
      ];
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, image: true } },
        order: { select: { id: true, orderNumber: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalCount = await prisma.review.count();
    const avgAggregate = await prisma.review.aggregate({
      _avg: { rating: true }
    });

    return {
      reviews,
      stats: {
        totalReviews: totalCount,
        averageRating: totalCount > 0 ? Number((avgAggregate._avg.rating || 0).toFixed(1)) : 0
      }
    };
  }
}
