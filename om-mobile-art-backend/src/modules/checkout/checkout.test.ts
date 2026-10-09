import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role, PaymentStatus, OrderStatus } from '@prisma/client';
import { eventBus } from '../../core/event/eventBus.js';

describe('Checkout Engine & Payment Backbone Integration Tests', () => {
  let app: any;

  const customerEmail = 'checkout_cust@example.com';
  const otherCustomerEmail = 'checkout_other@example.com';
  const testPassword = 'Password123!';

  let customerToken: string;
  let customerId: string;

  let otherCustomerToken: string;
  let otherCustomerId: string;

  let catId: string;
  let prodId: string;
  let variantId: string;
  let addressId: string;

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Delete all testing data
    const emails = [customerEmail, otherCustomerEmail];
    
    await prisma.processedWebhook.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.couponUsage.deleteMany();
    await prisma.coupon.deleteMany({ where: { OR: [{ code: { startsWith: 'TEST' } }, { code: 'HOOK_TEST50' }] } });
    await prisma.orderTimelineEvent.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.orderCounter.deleteMany();
    await prisma.idempotencyKey.deleteMany();

    await prisma.reservationItem.deleteMany({
      where: { reservation: { user: { email: { in: emails } } } },
    });
    await prisma.inventoryReservation.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Clean up created products/categories
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'CHECKOUT_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'CHECKOUT_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'CHECKOUT_TEST_CAT' } });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const emails = [customerEmail, otherCustomerEmail];
    
    await prisma.processedWebhook.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.couponUsage.deleteMany();
    await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST' } } });
    await prisma.orderTimelineEvent.deleteMany();
    await prisma.paymentAttempt.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.orderCounter.deleteMany();
    await prisma.idempotencyKey.deleteMany();

    await prisma.reservationItem.deleteMany({
      where: { reservation: { user: { email: { in: emails } } } },
    });
    await prisma.inventoryReservation.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'CHECKOUT_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'CHECKOUT_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'CHECKOUT_TEST_CAT' } });

    // Setup catalog entities
    const cat = await prisma.category.create({
      data: { name: 'CHECKOUT_TEST_CAT', slug: 'checkout-test-cat' },
    });
    catId = cat.id;

    const prod = await prisma.product.create({
      data: {
        name: 'Checkout Product',
        slug: 'checkout-product',
        description: 'Checkout product description',
        price: 200,
        originalPrice: 200,
        image: '/img/checkout-thumbnail.png',
        categoryId: catId,
        variants: {
          create: {
            sku: 'CHECKOUT-VAR-1',
            finish: 'Glossy',
            material: 'Leather',
            stockQuantity: 10,
          },
        },
      },
      include: { variants: true },
    });
    prodId = prod.id;
    variantId = prod.variants[0].id;

    // Register customer
    const regCust = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: customerEmail, password: testPassword, role: Role.CUSTOMER },
    });
    customerId = JSON.parse(regCust.payload).data.id;

    // Set name directly in DB since registration service doesn't persist name
    await prisma.user.update({
      where: { id: customerId },
      data: { name: 'Checkout Cust' },
    });

    // Login customer
    const loginCust = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: customerEmail, password: testPassword },
    });
    customerToken = JSON.parse(loginCust.payload).data.tokens.accessToken;

    // Create address for customer
    const address = await prisma.address.create({
      data: {
        userId: customerId,
        fullName: 'Checkout Cust',
        phone: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400001',
        isDefaultShipping: true,
      },
    });
    addressId = address.id;

    // Register other customer
    const regOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: otherCustomerEmail, password: testPassword, role: Role.CUSTOMER },
    });
    otherCustomerId = JSON.parse(regOther.payload).data.id;

    // Login other customer
    const loginOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: otherCustomerEmail, password: testPassword },
    });
    otherCustomerToken = JSON.parse(loginOther.payload).data.tokens.accessToken;
  });

  describe('POST /api/v1/checkout - Checkout Order Creation', () => {
    it('should fail if Idempotency-Key header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { addressId },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.message).toContain('Idempotency-Key');
    });

    it('should fail if addressId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': 'test-key-1',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.message).toContain('addressId');
    });

    it('should fail if there is no active reservation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': 'test-key-1',
        },
        payload: { addressId },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.message).toContain('active inventory reservation');
    });

    it('should create order successfully and enforce idempotency key protections', async () => {
      // 1. Add item to cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      // 2. Reserve inventory
      await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { durationMinutes: 10 },
      });

      const idempotencyKey = 'unique-checkout-key';

      // 3. Place order (first time)
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: { addressId },
      });

      expect(res1.statusCode).toBe(201);
      const payload1 = JSON.parse(res1.payload);
      expect(payload1.success).toBe(true);
      expect(payload1.data.orderNumber).toBeDefined();
      expect(payload1.data.status).toBe('PENDING_PAYMENT');
      expect(payload1.data.payment.status).toBe('PENDING');

      // Verify snapshots
      expect(payload1.data.customerSnapshot.name).toBe('Checkout Cust');
      expect(payload1.data.pricingSnapshot.grandTotal).toBeGreaterThan(0);
      expect(payload1.data.items[0].productName).toBe('Checkout Product');
      expect(payload1.data.items[0].sku).toBe('CHECKOUT-VAR-1');

      // Verify outbox events log
      const outboxEvents = await prisma.outboxEvent.findMany();
      expect(outboxEvents.length).toBe(2);
      expect(outboxEvents.map((e) => e.name)).toContain('OrderCreated');
      expect(outboxEvents.map((e) => e.name)).toContain('PaymentRequested');

      // Verify order timeline log
      const timelineEvents = await prisma.orderTimelineEvent.findMany({
        where: { orderId: payload1.data.id },
      });
      expect(timelineEvents.length).toBe(1);
      expect(timelineEvents[0].eventType).toBe('ORDER_CREATED');

      // 4. Place order (second time - exact same key and payload) -> returns cached response
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: { addressId },
      });

      expect(res2.statusCode).toBe(201);
      const payload2 = JSON.parse(res2.payload);
      expect(payload2.data.id).toBe(payload1.data.id);
      expect(payload2.data.orderNumber).toBe(payload1.data.orderNumber);

      // 5. Place order (third time - same key but modified payload/addressId) -> returns validation error
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': idempotencyKey,
        },
        payload: { addressId: '00000000-0000-0000-0000-000000000000' },
      });

      expect(res3.statusCode).toBe(400);
      expect(JSON.parse(res3.payload).error.message).toContain('payload');
    });
  });

  describe('POST /api/v1/checkout/webhook - Webhook Simulation & Deduplication', () => {
    it('should process payment capture webhook, complete reservation, redeem coupon, erase cart, and deduplicate callbacks', async () => {
      // Setup coupon
      const coupon = await prisma.coupon.create({
        data: {
          code: 'HOOK_TEST50',
          discountType: 'FIXED',
          discountValue: 50,
          isActive: true,
        },
      });

      // 1. Add item to cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      // Apply coupon to cart
      await prisma.cart.update({
        where: { userId: customerId },
        data: { couponId: coupon.id },
      });

      // 2. Reserve inventory
      await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { durationMinutes: 10 },
      });

      // Verify inventory reservation is ACTIVE
      const activeResBefore = await prisma.inventoryReservation.findFirst({
        where: { userId: customerId, status: 'ACTIVE' },
      });
      expect(activeResBefore).toBeDefined();

      // 3. Create checkout order
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        headers: {
          authorization: `Bearer ${customerToken}`,
          'idempotency-key': 'webhook-test-key',
        },
        payload: { addressId },
      });

      const orderData = JSON.parse(checkoutRes.payload).data;
      const gatewayOrderId = orderData.payment.gatewayOrderId;

      // Reset outbox events logs to track webhook events
      await prisma.outboxEvent.deleteMany();

      // 4. Send payment gateway webhook callback (first time)
      const webhookPayload = {
        id: 'evt_test_webhook_123',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              order_id: gatewayOrderId,
              id: 'pay_capture_123',
              amount: orderData.total,
            },
          },
        },
      };

      const webhookRes1 = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout/webhook',
        payload: webhookPayload,
      });

      expect(webhookRes1.statusCode).toBe(200);
      expect(JSON.parse(webhookRes1.payload).message).toContain('processed successfully');

      // Verify database updates
      const updatedOrder = await prisma.order.findUnique({ where: { id: orderData.id } });
      expect(updatedOrder?.status).toBe('PAID');

      const updatedPayment = await prisma.payment.findUnique({ where: { id: orderData.payment.id } });
      expect(updatedPayment?.status).toBe('CAPTURED');
      expect(updatedPayment?.gatewayPaymentId).toBe('pay_capture_123');

      // Verify reservation is COMPLETED
      const completedRes = await prisma.inventoryReservation.findUnique({
        where: { id: activeResBefore?.id },
      });
      expect(completedRes?.status).toBe('COMPLETED');

      // Verify coupon usage was written
      const usage = await prisma.couponUsage.findFirst({
        where: { userId: customerId, couponId: coupon.id },
      });
      expect(usage).toBeDefined();

      // Verify cart was cleared
      const cartItemsCount = await prisma.cartItem.count({
        where: { cart: { userId: customerId } },
      });
      expect(cartItemsCount).toBe(0);

      // Verify webhook processed logs
      const processedWebhook = await prisma.processedWebhook.findUnique({
        where: { provider_eventId: { provider: 'RAZORPAY', eventId: 'evt_test_webhook_123' } },
      });
      expect(processedWebhook).toBeDefined();
      expect(processedWebhook?.processedAt).toBeDefined();

      // Verify outbox logged events
      const webhookOutbox = await prisma.outboxEvent.findMany();
      console.log("WEBHOOK OUTBOX EVENTS:", webhookOutbox.map((e) => e.name));
      expect(webhookOutbox.map((e) => e.name)).toContain('PaymentSucceeded');
      expect(webhookOutbox.map((e) => e.name)).toContain('ReservationCommitted');
      expect(webhookOutbox.map((e) => e.name)).toContain('InventoryCommitted');
      expect(webhookOutbox.map((e) => e.name)).toContain('CouponRedeemed');
      expect(webhookOutbox.map((e) => e.name)).toContain('OrderConfirmed');

      // Verify order timeline contains payment captured
      const timelineEvents = await prisma.orderTimelineEvent.findMany({
        where: { orderId: orderData.id, eventType: 'PAYMENT_CAPTURED' },
      });
      expect(timelineEvents.length).toBe(1);

      // 5. Send webhook again (callback replay) -> returns deduplication success
      const webhookRes2 = await app.inject({
        method: 'POST',
        url: '/api/v1/checkout/webhook',
        payload: webhookPayload,
      });

      expect(webhookRes2.statusCode).toBe(200);
      expect(JSON.parse(webhookRes2.payload).message).toContain('deduplicated');
    });
  });
});
