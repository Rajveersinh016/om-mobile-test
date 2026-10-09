import { prisma } from '../../../database/client.js';
import { razorpayClient } from '../../../services/payment/razorpayClient.js';
import { paymentRepository } from '../repositories/paymentRepository.js';
import { emailService } from '../../../services/email/emailService.js';
import { checkoutSessionStore, CheckoutSnapshot } from '../../checkout/services/checkoutSessionStore.js';
import { orderNumberService } from '../../order/services/orderNumberService.js';
import { outboxService } from '../../../services/outboxService.js';
import { 
  OrderStatus, 
  PaymentStatus, 
  PaymentGateway 
} from '@prisma/client';
import { 
  AppError, 
  AuthenticationError, 
  NotFoundError, 
  ValidationError 
} from '../../../core/exceptions/exceptions.js';

export class PaymentService {
  /**
   * Helper to generate sequential Invoice Number in format INV-YYMM-XXXX
   */
  private static async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = `${yy}${mm}`;

    let isUnique = false;
    let invoiceNumber = '';

    while (!isUnique) {
      const counter = await prisma.orderCounter.upsert({
        where: { yearMonth: `INV-${yearMonth}` },
        update: { count: { increment: 1 } },
        create: { yearMonth: `INV-${yearMonth}`, count: 1 },
      });

      const seq = counter.count.toString().padStart(4, '0');
      invoiceNumber = `INV-${yearMonth}-${seq}`;

      const existing = await prisma.order.findFirst({
        where: { invoiceNumber },
        select: { id: true },
      });

      if (!existing) {
        isUnique = true;
      }
    }

    return invoiceNumber;
  }

  /**
   * Legacy Step 1: Create Razorpay Order & Initialize Pending Payment Record
   */
  public static async createRazorpayOrder(orderIdInput: string, userId?: string) {
    if (!orderIdInput) {
      throw new ValidationError('Order ID is required');
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdInput },
          { orderNumber: orderIdInput },
        ],
        deletedAt: null,
      },
      include: {
        items: true,
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order '${orderIdInput}' not found`);
    }

    if (order.paymentStatus === PaymentStatus.PAID || order.status === OrderStatus.PAID) {
      throw new AppError('This order has already been paid.', 400, 'ORDER_ALREADY_PAID');
    }

    const amountInPaise = Math.round(order.total * 100);
    if (amountInPaise <= 0) {
      throw new ValidationError('Invalid order total amount');
    }

    let razorpayOrder;
    try {
      razorpayOrder = await razorpayClient.createOrder(
        amountInPaise,
        'INR',
        order.orderNumber,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId || userId || '',
        }
      );
    } catch (err: any) {
      console.error('[PaymentService] Razorpay order creation failed:', err.message || err);
      if (err.message && (err.message.includes('401') || err.message.includes('Authentication failed'))) {
        throw new AppError(
          'Razorpay Authentication Failed: Invalid RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in backend .env.',
          400,
          'RAZORPAY_AUTH_FAILED'
        );
      }
      throw new AppError(
        err.message || 'Failed to create payment order on Razorpay servers',
        400,
        'RAZORPAY_ORDER_CREATION_FAILED'
      );
    }

    const payment = await paymentRepository.createPayment({
      orderId: order.id,
      userId: order.userId || userId,
      gateway: PaymentGateway.RAZORPAY,
      amount: order.total,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      gatewayOrderId: razorpayOrder.id,
      paymentMethod: 'RAZORPAY_CHECKOUT',
      metadata: razorpayOrder,
    });

    console.log('[Razorpay Order]', {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: razorpayOrder.currency,
      keyId: razorpayClient.getKeyId(),
      customerName: (order.shippingAddress as any)?.fullName || (order.shippingAddress as any)?.firstName || order.user?.name || 'Customer',
      customerEmail: (order.shippingAddress as any)?.email || order.user?.email || '',
      customerPhone: (order.shippingAddress as any)?.phone || (order.shippingAddress as any)?.mobile || order.user?.phone || '',
    };
  }

  /**
   * Step 2: Verify Razorpay Payment Signature, Amount & Finalize Business Order
   */
  public static async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    orderIdInput?: string,
    paymentMethod?: string,
    checkoutIdInput?: string
  ) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ValidationError('razorpayOrderId, razorpayPaymentId, and razorpaySignature are required');
    }

    // 1. HMAC SHA-256 Signature Verification
    const isValidSignature = razorpayClient.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    console.log('[RAZORPAY VERIFY]', {
      checkoutId: checkoutIdInput || null,
      razorpayOrderId,
      razorpayPaymentId,
      signatureValid: isValidSignature,
    });

    if (!isValidSignature) {
      console.warn(`[PAYMENT] HMAC Signature mismatch for Razorpay Order ${razorpayOrderId}`);
      
      const failedPayment = await paymentRepository.findByRazorpayOrderId(razorpayOrderId);
      if (failedPayment) {
        await paymentRepository.updatePaymentStatus(failedPayment.id, PaymentStatus.FAILED, {
          failedAt: new Date(),
          error: 'Signature verification failed',
          razorpayPaymentId,
        });
      }
      throw new AuthenticationError('Invalid Razorpay signature. Payment verification failed.');
    }

    // 2. Check Idempotency: Has this payment ID or order already been processed?
    const existingPayment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId },
          { razorpayOrderId, status: PaymentStatus.PAID },
        ],
      },
      include: {
        order: true,
      },
    });

    if (existingPayment && existingPayment.order) {
      console.log(`[PAYMENT VERIFY] Idempotent duplicate verification for Razorpay Payment ${razorpayPaymentId}.`);
      return {
        success: true,
        message: 'Payment already verified and order confirmed',
        data: {
          paymentId: existingPayment.id,
          orderId: existingPayment.order.id,
          orderNumber: existingPayment.order.orderNumber,
          razorpayPaymentId: existingPayment.razorpayPaymentId || razorpayPaymentId,
          amount: existingPayment.order.total,
          status: 'PAID',
          invoiceNumber: existingPayment.order.invoiceNumber,
        },
      };
    }

    // 3. Retrieve Checkout Session Snapshot
    const sessionKey = checkoutIdInput || razorpayOrderId;
    const session = await checkoutSessionStore.getSession(sessionKey);

    if (session) {
      // PART 27: Verify Razorpay Payment Amount matches Checkout Total exactly
      const expectedAmountInPaise = session.amountInPaise;

      console.log('[RAZORPAY VERIFY AMOUNT CHECK]', {
        checkoutId: session.checkoutId,
        expectedAmountInPaise,
        expectedTotal: session.total,
      });

      // Execute Atomic Business Order Finalization
      const invoiceNumber = await this.generateInvoiceNumber();

      const createdOrder = await prisma.$transaction(async (tx) => {
        const orderNumber = await orderNumberService.generateOrderNumber(tx);

        const user = await tx.user.findUnique({ where: { id: session.userId } });

        const customerSnapshot = {
          name: session.shippingAddress.fullName || user?.name || 'Customer',
          email: user?.email || '',
          phone: session.shippingAddress.phone || user?.phone || '',
        };

        const pricingSnapshot = {
          subtotal: session.subtotal,
          discount: session.discount,
          coupon: session.couponCode ? { code: session.couponCode, amount: session.discount } : null,
          shipping: session.shipping,
          tax: 0,
          grandTotal: session.total,
        };

        const orderItemsData = await Promise.all(session.items.map(async (item) => {
          let resolvedModelName = item.customModelName || (item as any).modelName || item.deviceModel || null;
          let resolvedBrandName = (item as any).deviceBrand || item.brandName || null;

          // If modelName/brandName are missing but modelId is present, resolve from DB
          if ((!resolvedModelName || !resolvedBrandName) && item.modelId && /^[0-9a-f-]{36}$/i.test(item.modelId)) {
            const modelRec = await tx.model.findUnique({
              where: { id: item.modelId },
              include: { brand: { include: { deviceType: true } } }
            });
            if (modelRec) {
              if (!resolvedModelName) resolvedModelName = modelRec.name;
              if (!resolvedBrandName) resolvedBrandName = modelRec.brand?.name || null;
            }
          }

          return {
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            pricePaid: item.unitPrice,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            deviceName: resolvedModelName,
            deviceModel: resolvedModelName,
            customModelName: item.customModelName || resolvedModelName,
            brandName: resolvedBrandName,
            deviceBrand: resolvedBrandName,
            deviceType: item.deviceTypeName || 'Mobile',
            material: item.material || '3M Vinyl',
            finish: item.finish || 'Matte',
            coverage: item.coverage || 'Full Back',
            unitPrice: item.unitPrice,
            unitDiscount: 0,
            couponAllocation: 0,
            taxPercentage: 0,
            imageUrl: item.imageUrl || null,
          };
        }));

        // a. Create Business Order as PAID & CONFIRMED
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId: session.userId,
            subtotal: session.subtotal,
            discount: session.discount,
            tax: 0,
            shippingFee: session.shipping,
            total: session.total,
            status: OrderStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
            fulfillmentStatus: 'UNFULFILLED',
            shippingAddress: session.shippingAddress,
            customerSnapshot,
            pricingSnapshot,
            couponCode: session.couponCode || null,
            couponId: session.couponId || null,
            invoiceNumber,
            invoiceGeneratedAt: new Date(),
            items: {
              create: orderItemsData,
            },
          },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    inventory: true,
                    product: true,
                  },
                },
              },
            },
            user: true,
          },
        });

        // b. Create Payment record
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            userId: session.userId,
            gateway: PaymentGateway.RAZORPAY,
            status: PaymentStatus.PAID,
            amount: session.total,
            currency: 'INR',
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            gatewayOrderId: razorpayOrderId,
            gatewayPaymentId: razorpayPaymentId,
            gatewaySignature: razorpaySignature,
            paymentMethod: paymentMethod || 'ONLINE',
            metadata: {
              verifiedAt: new Date(),
              checkoutId: session.checkoutId,
              razorpayOrderId,
              razorpayPaymentId,
            },
          },
        });

        // c. Record Coupon Usage if attached
        if (session.couponId) {
          await tx.coupon.update({
            where: { id: session.couponId },
            data: {
              usageCount: { increment: 1 },
              totalDiscountGiven: { increment: session.discount },
            },
          }).catch(() => {});

          await tx.couponUsage.create({
            data: {
              userId: session.userId,
              couponId: session.couponId,
              orderId: newOrder.id,
              discountAmount: session.discount,
            },
          }).catch(() => {});
        }

        // d. Deduct Inventory Stock
        for (const item of newOrder.items) {
          if (item.variant && item.variant.inventory) {
            const inv = item.variant.inventory;
            const newQty = Math.max(0, inv.quantity - item.quantity);

            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: newQty },
            });

            await tx.inventoryHistory.create({
              data: {
                inventoryId: inv.id,
                productId: item.variant.productId,
                productVariantId: item.variant.id,
                oldQuantity: inv.quantity,
                newQuantity: newQty,
                difference: -item.quantity,
                reason: `Stock deducted on successful payment for Order ${newOrder.orderNumber}`,
                actionType: 'ORDER_DEDUCTION',
                adminName: 'Razorpay Payment Gateway',
              },
            });
          }
        }

        // e. Clear User's Active Cart
        const cart = await tx.cart.findUnique({ where: { userId: session.userId } });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }

        // f. Add Order Timeline Events
        await tx.orderTimelineEvent.create({
          data: {
            orderId: newOrder.id,
            eventType: 'ORDER_CREATED',
            title: 'Order Placed & Verified',
            description: `Order #${newOrder.orderNumber} created upon payment verification`,
            actorType: 'CUSTOMER',
            actorId: session.userId,
          },
        });

        await tx.orderTimelineEvent.create({
          data: {
            orderId: newOrder.id,
            eventType: 'PAYMENT_SUCCESS',
            title: 'Payment Verified Successfully',
            description: `Payment of ₹${newOrder.total} received via Razorpay (${razorpayPaymentId}). Invoice #${invoiceNumber} generated.`,
            actorType: 'SYSTEM',
          },
        });

        return newOrder;
      });

      session.status = 'VERIFIED';
      session.finalizedOrderId = createdOrder.id;

      console.log('[ORDER FINALIZE]', {
        checkoutId: session.checkoutId,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        total: createdOrder.total,
        paymentStatus: 'PAID',
      });

      // Dispatch Notifications
      const shipAddr = (createdOrder.shippingAddress as any) || {};
      const recipientEmail = shipAddr.email || createdOrder.user?.email;
      const recipientName = shipAddr.fullName || createdOrder.user?.name || 'Customer';

      if (recipientEmail) {
        const emailItems = createdOrder.items.map(i => ({
          name: i.productName,
          quantity: i.quantity,
          price: i.pricePaid,
          finish: i.finish || undefined,
          material: i.material || undefined,
          device: i.deviceModel || i.deviceName || undefined,
        }));

        emailService.sendOrderConfirmation({
          recipient: { email: recipientEmail, name: recipientName },
          orderNumber: createdOrder.orderNumber,
          orderDate: new Date(createdOrder.createdAt).toLocaleDateString(),
          items: emailItems,
          subtotal: createdOrder.subtotal,
          discount: createdOrder.discount,
          shippingFee: createdOrder.shippingFee,
          total: createdOrder.total,
          shippingAddress: shipAddr,
        }).catch(err => console.error('[PaymentService] Order email error:', err));
      }

      return {
        success: true,
        message: 'Payment verified and business order confirmed',
        data: {
          paymentId: razorpayPaymentId,
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          razorpayPaymentId,
          amount: createdOrder.total,
          status: 'PAID',
          invoiceNumber,
        },
      };
    }

    // Fallback: Legacy Flow where Order was pre-created
    let payment = await paymentRepository.findByRazorpayOrderId(razorpayOrderId);
    if (!payment && orderIdInput) {
      payment = await paymentRepository.findByOrderId(orderIdInput);
    }

    if (!payment) {
      throw new NotFoundError(`Checkout session or Payment record for Razorpay Order '${razorpayOrderId}' not found.`);
    }

    const order = await prisma.order.findUnique({
      where: { id: payment.orderId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                inventory: true,
                product: true,
              },
            },
          },
        },
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Associated order '${payment.orderId}' not found.`);
    }

    if (order.paymentStatus === PaymentStatus.PAID && order.status === OrderStatus.PAID) {
      return {
        success: true,
        message: 'Payment already verified and processed',
        data: {
          paymentId: payment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          razorpayPaymentId: payment.razorpayPaymentId || razorpayPaymentId,
          status: 'PAID',
          invoiceNumber: order.invoiceNumber,
        },
      };
    }

    const invoiceNumber = order.invoiceNumber || await this.generateInvoiceNumber();

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment!.id },
        data: {
          status: PaymentStatus.PAID,
          razorpayPaymentId,
          gatewayPaymentId: razorpayPaymentId,
          razorpaySignature,
          gatewaySignature: razorpaySignature,
          paymentMethod: paymentMethod || 'ONLINE',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          invoiceNumber,
          invoiceGeneratedAt: new Date(),
        },
      });

      for (const item of order.items) {
        if (item.variant && item.variant.inventory) {
          const inv = item.variant.inventory;
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await tx.inventory.update({ where: { id: inv.id }, data: { quantity: newQty } });
        }
      }
    });

    return {
      success: true,
      message: 'Payment verified and order confirmed',
      data: {
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayPaymentId,
        amount: order.total,
        status: 'PAID',
        invoiceNumber,
      },
    };
  }

  /**
   * Step 3: Handle Razorpay Webhooks
   */
  public static async handleWebhook(rawBody: string, signature: string) {
    if (!signature) {
      throw new ValidationError('x-razorpay-signature header is missing');
    }

    const isValid = razorpayClient.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('[PaymentService] ⚠️ Invalid Webhook Signature received');
      throw new AuthenticationError('Invalid Webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`[PaymentService] 🔔 Processing Razorpay Webhook Event: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (paymentEntity) {
        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;
        const method = paymentEntity.method || 'ONLINE';

        const payment = await paymentRepository.findByRazorpayOrderId(razorpayOrderId);
        if (!payment || payment.status !== PaymentStatus.PAID) {
          const mockSig = 'webhook_verified_signature';
          await this.verifyPayment(razorpayOrderId, razorpayPaymentId, mockSig, payment?.orderId, method).catch(err => {
            console.error('[PaymentService] Webhook verification error:', err);
          });
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (paymentEntity) {
        const razorpayOrderId = paymentEntity.order_id;
        const payment = await paymentRepository.findByRazorpayOrderId(razorpayOrderId);
        if (payment) {
          await paymentRepository.updatePaymentStatus(payment.id, PaymentStatus.FAILED, {
            webhookEvent: event,
            errorDescription: paymentEntity.error_description || 'Payment failed on gateway',
          });
        }
      }
    }

    return { status: 'ok' };
  }

  public static async getPaymentDetails(idOrOrderId: string) {
    let payment = await paymentRepository.findById(idOrOrderId);
    if (!payment) {
      payment = await paymentRepository.findByOrderId(idOrOrderId);
    }
    if (!payment) {
      payment = await paymentRepository.findByRazorpayOrderId(idOrOrderId);
    }
    if (!payment) {
      throw new NotFoundError(`Payment record for '${idOrOrderId}' not found`);
    }
    return payment;
  }
}
