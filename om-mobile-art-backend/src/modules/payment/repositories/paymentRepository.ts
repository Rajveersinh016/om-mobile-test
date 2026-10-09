import { prisma } from '../../../database/client.js';
import { Payment, PaymentGateway, PaymentStatus, Prisma } from '@prisma/client';

export class PaymentRepository {
  async createPayment(data: {
    orderId: string;
    userId?: string;
    gateway?: PaymentGateway;
    amount: number;
    currency?: string;
    razorpayOrderId?: string;
    gatewayOrderId?: string;
    paymentMethod?: string;
    metadata?: any;
  }): Promise<Payment> {
    return prisma.payment.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        gateway: data.gateway || PaymentGateway.RAZORPAY,
        status: PaymentStatus.PENDING,
        amount: data.amount,
        currency: data.currency || 'INR',
        razorpayOrderId: data.razorpayOrderId,
        gatewayOrderId: data.gatewayOrderId || data.razorpayOrderId,
        paymentMethod: data.paymentMethod,
        metadata: data.metadata || {},
      },
    });
  }

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayOrderId },
          { gatewayOrderId: razorpayOrderId },
        ],
      },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
        refunds: true,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
        refunds: true,
      },
    });
  }

  async findById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
        refunds: true,
      },
    });
  }

  async updatePaymentSuccess(
    paymentId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    paymentMethod?: string,
    metadata?: any
  ): Promise<Payment> {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        razorpayPaymentId,
        gatewayPaymentId: razorpayPaymentId,
        razorpaySignature,
        gatewaySignature: razorpaySignature,
        paymentMethod: paymentMethod || 'ONLINE',
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: any
  ): Promise<Payment> {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async createRefund(
    paymentId: string,
    amount: number,
    reason: string,
    gatewayRefundId: string
  ) {
    return prisma.refund.create({
      data: {
        paymentId,
        amount,
        reason,
        gatewayRefundId,
      },
    });
  }
}

export const paymentRepository = new PaymentRepository();
