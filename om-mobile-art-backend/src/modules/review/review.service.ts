import { ReviewRepository } from './review.repository.js';

export class ReviewService {
  public static async getProductReviews(productId: string) {
    return ReviewRepository.findByProduct(productId);
  }

  public static async checkReviewEligibility(userId: string, productId: string) {
    const deliveredOrders = await ReviewRepository.findUserDeliveredOrdersForProduct(userId, productId);

    if (deliveredOrders.length === 0) {
      return {
        isEligible: false,
        reason: 'Reviews are available only for verified purchases. You can submit a review after your order has been delivered.',
        eligibleOrders: []
      };
    }

    // Filter out orders for which the user has already submitted a review for this product
    const eligibleOrders = [];
    for (const order of deliveredOrders) {
      const existing = await ReviewRepository.findExistingReview(userId, productId, order.id);
      if (!existing) {
        eligibleOrders.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          deliveredAt: order.updatedAt
        });
      }
    }

    if (eligibleOrders.length === 0) {
      return {
        isEligible: false,
        reason: 'You have already submitted a review for all your delivered orders of this product.',
        eligibleOrders: []
      };
    }

    return {
      isEligible: true,
      eligibleOrders
    };
  }

  public static async createReview(userId: string, data: {
    productId: string;
    orderId: string;
    rating: number;
    title?: string;
    comment: string;
    images?: string[];
  }) {
    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    if (!data.comment || !data.comment.trim()) {
      throw new Error('Comment is required');
    }

    // Enforce Rule 4 & 15: Must have delivered order containing product
    const deliveredOrders = await ReviewRepository.findUserDeliveredOrdersForProduct(userId, data.productId);
    const matchingOrder = deliveredOrders.find(o => o.id === data.orderId);

    if (!matchingOrder) {
      const error: any = new Error('Reviews are available only for verified purchases. You can submit a review after your order has been delivered.');
      error.statusCode = 403;
      throw error;
    }

    // Check if already reviewed for this order
    const existing = await ReviewRepository.findExistingReview(userId, data.productId, data.orderId);
    if (existing) {
      const error: any = new Error('You have already submitted a review for this delivered order.');
      error.statusCode = 400;
      throw error;
    }

    const review = await ReviewRepository.create({
      userId,
      productId: data.productId,
      orderId: data.orderId,
      rating: data.rating,
      title: data.title,
      comment: data.comment.trim(),
      images: data.images
    });

    const stats = await ReviewRepository.calculateProductRating(data.productId);
    return { review, stats };
  }

  public static async updateReview(userId: string, reviewId: string, data: {
    rating?: number;
    title?: string;
    comment?: string;
    images?: string[];
  }) {
    const existing = await ReviewRepository.findById(reviewId);
    if (!existing) {
      const error: any = new Error('Review not found');
      error.statusCode = 444;
      throw error;
    }

    if (existing.userId !== userId) {
      const error: any = new Error('You can only edit your own review');
      error.statusCode = 403;
      throw error;
    }

    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const review = await ReviewRepository.update(reviewId, data);
    const stats = await ReviewRepository.calculateProductRating(existing.productId);
    return { review, stats };
  }

  public static async deleteReview(userId: string, isAdmin: boolean, reviewId: string) {
    const existing = await ReviewRepository.findById(reviewId);
    if (!existing) {
      const error: any = new Error('Review not found');
      error.statusCode = 404;
      throw error;
    }

    if (!isAdmin && existing.userId !== userId) {
      const error: any = new Error('You can only delete your own review');
      error.statusCode = 403;
      throw error;
    }

    await ReviewRepository.delete(reviewId);
    const stats = await ReviewRepository.calculateProductRating(existing.productId);
    return { success: true, stats };
  }

  public static async getPendingReviews(userId: string) {
    return ReviewRepository.findPendingReviewsForUser(userId);
  }

  public static async getAdminReviews(options: {
    rating?: number;
    productId?: string;
    userId?: string;
    search?: string;
  }) {
    return ReviewRepository.findAllForAdmin(options);
  }
}
