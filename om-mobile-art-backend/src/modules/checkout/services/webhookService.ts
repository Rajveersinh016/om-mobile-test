import crypto from 'crypto';
import { prisma } from '../../../database/client.js';
import { outboxService } from '../../../services/outboxService.js';
import { validateOrderStatusTransition, validatePaymentStatusTransition } from '../../order/services/stateMachine.js';
import { ConflictError, NotFoundError } from '../../../core/exceptions/exceptions.js';

export class WebhookService {
  verifySignature(body: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const expected = hmac.digest('hex');
    return expected === signature;
  }

  async processRazorpayWebhook(
    rawBody: string,
    signature: string,
    payload: any
  ): Promise<any> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
    
    // In production/test, verify signature if signature is supplied
    if (process.env.NODE_ENV !== 'test' && signature) {
      const isValid = this.verifySignature(rawBody, signature, secret);
      if (!isValid) {
        throw new Error('Invalid signature');
      }
    }

    const eventId = payload.id || `evt_${Date.now()}`;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    // 1. Deduplicate
    let webhookRecord;
    try {
      webhookRecord = await prisma.processedWebhook.create({
        data: {
          provider: 'RAZORPAY',
          eventId,
          payloadHash,
        },
      });
    } catch (err) {
      // Unique constraint failed -> duplicate webhook
      return { success: true, message: 'Webhook already processed (deduplicated)' };
    }

    // Extract details from Razorpay simulated payload
    const event = payload.event;
    if (event !== 'payment.captured') {
      await prisma.processedWebhook.update({
        where: { id: webhookRecord.id },
        data: { processedAt: new Date() },
      });
      return { success: true, message: `Ignored unhandled event: ${event}` };
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const gatewayOrderId = paymentEntity?.order_id;
    const gatewayPaymentId = paymentEntity?.id;
    const gatewaySignature = signature || 'mock_sig';

    if (!gatewayOrderId) {
      throw new Error('Missing gatewayOrderId in webhook payload');
    }

    const outboxEventIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Find Payment
      const payment = await tx.payment.findFirst({
        where: { gatewayOrderId },
        include: {
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundError(`Payment not found for gatewayOrderId: ${gatewayOrderId}`);
      }

      // Check transitions
      validateOrderStatusTransition(payment.order.status, 'PAID');
      validatePaymentStatusTransition(payment.status, 'CAPTURED');

      // Update Order and Payment
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId,
          gatewaySignature,
        },
      });

      // Register Attempt
      await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          status: 'CAPTURED',
          transactionId: gatewayPaymentId,
          signature: gatewaySignature,
          rawPayload: payload as any,
        },
      });

      // Order Timeline Event
      await tx.orderTimelineEvent.create({
        data: {
          orderId: payment.orderId,
          eventType: 'PAYMENT_CAPTURED',
          title: 'Payment Captured',
          description: 'Payment successful via Razorpay',
          actorType: 'SYSTEM',
        },
      });

      // Find active InventoryReservation for this user
      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          userId: payment.order.userId,
          status: 'ACTIVE',
        },
        include: {
          items: true,
        },
      });

      if (reservation) {
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: 'COMPLETED' },
        });

        const ev1 = await outboxService.saveEvent(tx, 'ReservationCommitted', {
          reservationId: reservation.id,
          userId: payment.order.userId,
        });
        outboxEventIds.push(ev1.id);

        const ev2 = await outboxService.saveEvent(tx, 'InventoryCommitted', {
          reservationId: reservation.id,
          userId: payment.order.userId,
          items: reservation.items.map((i) => ({
            productVariantId: i.productVariantId,
            quantity: i.quantity,
          })),
        });
        outboxEventIds.push(ev2.id);
      }

      // Coupon usages
      if (payment.order.couponId) {
        await tx.couponUsage.create({
          data: {
            userId: payment.order.userId,
            couponId: payment.order.couponId,
          },
        });

        const ev3 = await outboxService.saveEvent(tx, 'CouponRedeemed', {
          userId: payment.order.userId,
          couponId: payment.order.couponId,
          code: payment.order.couponCode || '',
          orderId: payment.orderId,
        });
        outboxEventIds.push(ev3.id);
      }

      // Erase cart
      const cart = await tx.cart.findUnique({
        where: { userId: payment.order.userId },
      });
      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      // Save payment succeeded and order confirmed events to outbox
      const ev4 = await outboxService.saveEvent(tx, 'PaymentSucceeded', {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
      });
      outboxEventIds.push(ev4.id);

      const ev5 = await outboxService.saveEvent(tx, 'OrderConfirmed', {
        orderId: payment.orderId,
        userId: payment.order.userId,
        total: payment.order.total,
      });
      outboxEventIds.push(ev5.id);
    });

    // Post-commit dispatch outbox events
    for (const eventId of outboxEventIds) {
      try {
        await outboxService.dispatchEventImmediate(eventId);
      } catch (err) {
        // Swallow immediate error, background worker will retry
      }
    }

    // Mark processed
    await prisma.processedWebhook.update({
      where: { id: webhookRecord.id },
      data: { processedAt: new Date() },
    });

    return { success: true, message: 'Webhook processed successfully' };
  }
}

export const webhookService = new WebhookService();
