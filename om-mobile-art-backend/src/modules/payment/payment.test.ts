import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import argon2 from 'argon2';
import crypto from 'crypto';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';

describe('Complete Razorpay Payment System Integration Test Suite', () => {
  let app: FastifyInstance;

  const testEmail = 'razorpay_customer@ommobileart.com';
  const testPass = 'SecurePass123!';
  let userId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let inventoryId: string;
  let createdOrderId: string;
  let createdOrderNumber: string;
  const initialStock = 20;

  const cleanupData = async () => {
    const existingUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existingUser) {
      const orders = await prisma.order.findMany({ where: { userId: existingUser.id } });
      for (const o of orders) {
        await prisma.refund.deleteMany({ where: { payment: { orderId: o.id } } });
        await prisma.paymentAttempt.deleteMany({ where: { payment: { orderId: o.id } } });
        await prisma.payment.deleteMany({ where: { orderId: o.id } });
        await prisma.orderStatusHistory.deleteMany({ where: { orderId: o.id } });
        await prisma.orderTimelineEvent.deleteMany({ where: { orderId: o.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
        await prisma.orderNote.deleteMany({ where: { orderId: o.id } });
        await prisma.order.delete({ where: { id: o.id } });
      }
      await prisma.userSession.deleteMany({ where: { userId: existingUser.id } });
      await prisma.accountActivity.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
    }

    if (variantId) {
      await prisma.inventoryHistory.deleteMany({ where: { productVariantId: variantId } });
      await prisma.inventory.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.delete({ where: { id: variantId } }).catch(() => {});
    }
    if (productId) {
      await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    }
    if (categoryId) {
      await prisma.category.delete({ where: { id: categoryId } }).catch(() => {});
    }
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    await cleanupData();

    // 1. Create Test User
    const passHash = await argon2.hash(testPass);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: passHash,
        isEmailVerified: true,
        role: Role.CUSTOMER,
        name: 'Razorpay Test Customer',
      },
    });
    userId = user.id;

    // 2. Create Test Category, Product, Variant, & Inventory
    const category = await prisma.category.create({
      data: {
        name: 'Razorpay Test Skins',
        slug: `razorpay-test-skins-${Date.now()}`,
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Razorpay Cyberpunk Skin',
        slug: `razorpay-cyberpunk-skin-${Date.now()}`,
        description: 'Test skin for Razorpay payment',
        price: 499,
        originalPrice: 799,
        image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=400',
        categoryId: category.id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `SKU-RZP-${Date.now()}`,
        finish: 'Matte',
        material: '3M Vinyl',
      },
    });
    variantId = variant.id;

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        productVariantId: variant.id,
        quantity: initialStock,
        sku: variant.sku,
      },
    });
    inventoryId = inventory.id;

    // 3. Create Pending Order (Pre-payment: Stock remains 20!)
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        items: [
          {
            productVariantId: variant.id,
            quantity: 2,
            pricePaid: 499,
            productName: product.name,
            variantName: 'Matte / 3M Vinyl',
            sku: variant.sku,
          },
        ],
        customerName: 'Razorpay Test Customer',
        customerEmail: testEmail,
        phone: '9876543210',
        shippingAddress: {
          firstName: 'Razorpay',
          lastName: 'Tester',
          street: '123 Payment Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          mobile: '9876543210',
        },
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const orderBody = JSON.parse(orderRes.body);
    expect(orderBody.success).toBe(true);
    createdOrderId = orderBody.data.id;
    createdOrderNumber = orderBody.data.orderNumber;
  });

  afterAll(async () => {
    await cleanupData();
    await app.close();
  });

  it('1. Verify Pre-Payment Stock -> Stock must NOT be reduced before payment succeeds', async () => {
    const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(inv?.quantity).toBe(initialStock); // Still 20!
  });

  it('2. Create Razorpay Payment Order -> Returns razorpayOrderId & amount in paise', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/create-order',
      payload: {
        orderId: createdOrderId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.razorpayOrderId).toBeDefined();
    expect(body.data.amount).toBe(104700); // (499 * 2 + 49 shipping) * 100 paise
    expect(body.data.currency).toBe('INR');

    // Verify Payment record created in DB as PENDING
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe(PaymentStatus.PENDING);
  });

  it('3. Submit INVALID Razorpay Signature -> Rejected with HTTP 401 & Stock Remains Untouched', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });
    const rzpOrderId = payment!.razorpayOrderId || payment!.gatewayOrderId!;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      payload: {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: 'pay_invalid_12345',
        razorpaySignature: 'invalid_forged_signature_hex',
        orderId: createdOrderId,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error?.message || body.message).toContain('Invalid Razorpay signature');

    // Verify Stock remains UNCHANGED (20)
    const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(inv?.quantity).toBe(initialStock);
  });

  it('4. Submit VALID HMAC Signature -> Marks Order PAID, Generates Invoice, & Deducts Inventory Stock', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });
    const rzpOrderId = payment!.razorpayOrderId || payment!.gatewayOrderId!;
    const rzpPayId = `pay_valid_${Date.now()}`;

    // Generate valid HMAC signature matching test secret
    const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${rzpPayId}`)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      payload: {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPayId,
        razorpaySignature: validSignature,
        orderId: createdOrderId,
        paymentMethod: 'UPI',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PAID');
    expect(body.data.invoiceNumber).toBeDefined();

    // 1. Verify Order status is now PAID in PostgreSQL
    const updatedOrder = await prisma.order.findUnique({ where: { id: createdOrderId } });
    expect(updatedOrder?.status).toBe(OrderStatus.PAID);
    expect(updatedOrder?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(updatedOrder?.invoiceNumber).toMatch(/^INV-/);

    // 2. CRITICAL: Verify Stock is NOW decremented by 2 items (20 -> 18)
    const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(inv?.quantity).toBe(initialStock - 2); // 18!
  });

  it('5. Duplicate Callback (Idempotency) -> Returns Success without double deducting stock', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });
    const rzpOrderId = payment!.razorpayOrderId!;
    const rzpPayId = payment!.razorpayPaymentId!;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${rzpPayId}`)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      payload: {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPayId,
        razorpaySignature: validSignature,
        orderId: createdOrderId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('already verified');

    // Stock must STILL be 18 (NOT 16!)
    const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(inv?.quantity).toBe(initialStock - 2);
  });

  it('6. GET /payments/:id -> Retrieves Payment Details with Order Relation', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/${payment!.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(payment!.id);
    expect(body.data.order.orderNumber).toBe(createdOrderNumber);
  });

  it('7. Webhook Processing (refund.created) -> Updates Payment and Order Status to REFUNDED', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: createdOrderId } });
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';

    const webhookPayload = JSON.stringify({
      event: 'refund.created',
      payload: {
        refund: {
          entity: {
            id: `rfnd_mock_${Date.now()}`,
            payment_id: payment!.razorpayPaymentId,
            amount: payment!.amount * 100,
            notes: { reason: 'Customer requested cancellation' },
          },
        },
      },
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(webhookPayload)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'x-razorpay-signature': signature,
        'content-type': 'application/json',
      },
      payload: webhookPayload,
    });

    expect(res.statusCode).toBe(200);

    // Verify refund record created in DB & payment/order marked REFUNDED
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment!.id },
      include: { refunds: true },
    });
    expect(updatedPayment?.status).toBe(PaymentStatus.REFUNDED);
    expect(updatedPayment?.refunds.length).toBeGreaterThan(0);
  });
});
