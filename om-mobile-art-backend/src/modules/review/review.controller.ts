import { FastifyRequest, FastifyReply } from 'fastify';
import { ReviewService } from './review.service.js';
import { GoogleReviewsService } from './googleReviews.service.js';

export class ReviewController {
  public static async getGoogleReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await GoogleReviewsService.getGoogleReviews();
      return reply.status(200).send({ success: true, data });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        message: 'Google Reviews are temporarily unavailable. Please visit our Google Business profile to read customer reviews.'
      });
    }
  }

  public static async getProductReviews(request: FastifyRequest<{ Params: { productId: string } }>, reply: FastifyReply) {
    try {
      const { productId } = request.params;
      const data = await ReviewService.getProductReviews(productId);
      return reply.status(200).send({ success: true, data });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ success: false, message: err.message });
    }
  }

  public static async disablePublicReviewCreation(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(403).send({
      success: false,
      message: 'Direct product review submission on website has been disabled. Please review us directly on Google Business Profile.'
    });
  }

  public static async deleteReview(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = request.params;
      const data = await ReviewService.deleteReview(user.id, isAdmin, id);
      return reply.status(200).send({ success: true, data });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ success: false, message: err.message });
    }
  }

  public static async getAdminReviews(request: FastifyRequest<{
    Querystring: {
      rating?: string;
      productId?: string;
      userId?: string;
      search?: string;
    }
  }>, reply: FastifyReply) {
    try {
      const { rating, productId, userId, search } = request.query;
      const options = {
        ...(rating ? { rating: parseInt(rating) } : {}),
        ...(productId ? { productId } : {}),
        ...(userId ? { userId } : {}),
        ...(search ? { search } : {})
      };
      const result = await ReviewService.getAdminReviews(options);
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ success: false, message: err.message });
    }
  }
}
