import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Inventory Reservation Module Integration Tests', () => {
  let app: any;

  const customerEmail = 'reserve_cust@example.com';
  const otherCustomerEmail = 'reserve_other@example.com';
  const testPassword = 'Password123!';

  let customerToken: string;
  let customerId: string;

  let otherCustomerToken: string;
  let otherCustomerId: string;

  let catId: string;
  let prodId: string;
  let variantId: string;

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Delete all testing data
    const emails = [customerEmail, otherCustomerEmail];
    await prisma.reservationItem.deleteMany({
      where: { reservation: { user: { email: { in: emails } } } },
    });
    await prisma.inventoryReservation.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Clean up created products/categories
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'RES_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'RES_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'RES_TEST_CAT' } });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Re-create testing users and retrieve fresh tokens
    const emails = [customerEmail, otherCustomerEmail];
    await prisma.reservationItem.deleteMany({
      where: { reservation: { user: { email: { in: emails } } } },
    });
    await prisma.inventoryReservation.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'RES_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'RES_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'RES_TEST_CAT' } });

    // Setup base catalog entities
    const cat = await prisma.category.create({
      data: { name: 'RES_TEST_CAT', slug: 'res-test-cat' },
    });
    catId = cat.id;

    const prod = await prisma.product.create({
      data: {
        name: 'Reservation Product',
        slug: 'res-product',
        description: 'Reservation product description',
        price: 150,
        originalPrice: 150,
        image: '/img/thumbnail.png',
        categoryId: catId,
        variants: {
          create: {
            sku: 'RES-VAR-1',
            finish: 'Matte',
            material: 'Carbon',
            stockQuantity: 15,
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

    // Login customer
    const loginCust = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: customerEmail, password: testPassword },
    });
    customerToken = JSON.parse(loginCust.payload).data.tokens.accessToken;

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

  describe('Inventory Reservation Lifecycle', () => {
    it('should successfully reserve stock from cart and decrement stock quantity', async () => {
      // 1. Add to Cart (qty: 3)
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });

      // 2. Reserve Stock
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { durationMinutes: 10 },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.status).toBe('ACTIVE');
      expect(data.items.length).toBe(1);
      expect(data.items[0].quantity).toBe(3);

      // Verify stock was reduced from 15 to 12
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      expect(dbVariant?.stockQuantity).toBe(12);

      // Verify activity logs
      const act = await prisma.accountActivity.findFirst({
        where: { userId: customerId, action: 'RESERVATION_CREATE' },
      });
      expect(act).not.toBeNull();
    });

    it('should cancel active reservation and restore inventory stock', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const reservationId = JSON.parse(res.payload).data.id;

      // Cancel
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/reservations/current',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(cancelRes.statusCode).toBe(200);

      // Verify stock restored to 15
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      expect(dbVariant?.stockQuantity).toBe(15);
    });

    it('should commit active reservation and keep stock decremented', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const reservationId = JSON.parse(res.payload).data.id;

      // Commit
      const commitRes = await app.inject({
        method: 'POST',
        url: `/api/v1/reservations/${reservationId}/commit`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(commitRes.statusCode).toBe(200);

      // Verify stock stays at 12
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      expect(dbVariant?.stockQuantity).toBe(12);

      // Verify reservation is completed
      const dbRes = await prisma.inventoryReservation.findUnique({
        where: { id: reservationId },
      });
      expect(dbRes?.status).toBe('COMPLETED');
    });

    it('should prevent duplicate reservations for the same cart', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });

      // First reservation
      await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      // Second reservation
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(409); // ConflictError
    });

    it('should reject reservation if inventory is insufficient', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        // Try to add 16 units when stock is 15
        // Wait, cart service stock check rejects adding it to cart in the first place!
        // So we bypass cart checks by inserting directly in CartItem to test reservation validation
      });

      const cart = await prisma.cart.create({
        data: {
          userId: customerId,
          items: {
            create: {
              productVariantId: variantId,
              quantity: 20, // Exceeds stock of 15
            },
          },
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(400); // ValidationError
    });

    it('should lazily release expired active reservations and restore stock', async () => {
      // 1. Add and reserve
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 5 },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const reservationId = JSON.parse(res.payload).data.id;

      // 2. Set expiresAt to a past date in the DB
      const past = new Date();
      past.setMinutes(past.getMinutes() - 20);
      await prisma.inventoryReservation.update({
        where: { id: reservationId },
        data: { expiresAt: past },
      });

      // 3. Query current reservation (which lazily triggers expiration cleanup)
      const currentRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reservations/current',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(currentRes.statusCode).toBe(200);
      expect(JSON.parse(currentRes.payload).data).toBeNull(); // expired and released

      // Verify stock restored to 15
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      expect(dbVariant?.stockQuantity).toBe(15);
    });
  });

  describe('IDOR & Security Boundary Checks', () => {
    it('should prevent IDOR (cannot cancel other customer reservation)', async () => {
      // Customer 1 creates a reservation
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const reservationId = JSON.parse(res.payload).data.id;

      // Customer 2 attempts to cancel Customer 1's reservation
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/reservations/${reservationId}/cancel`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
      });
      expect(cancelRes.statusCode).toBe(404); // Returns 404/NotFoundError
    });

    it('should reject unauthorized request without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reservations/current',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Concurrent Locking Races', () => {
    it('should handle concurrent reservation races sequentially without overselling', async () => {
      // Set variant stock quantity to exactly 5
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: 5 },
      });

      // Customer 1 adds 4 to cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 4 },
      });

      // Customer 2 adds 4 to cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${otherCustomerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 4 },
      });

      // Fire concurrent requests to reserve
      const promise1 = app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      const promise2 = app.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: { authorization: `Bearer ${otherCustomerToken}` },
      });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      // Exactly one must succeed (201) and one must fail (400)
      const statuses = [res1.statusCode, res2.statusCode];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Verify stock stays non-negative (specifically, 1 unit remaining)
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      expect(dbVariant?.stockQuantity).toBe(1);
    });
  });
});
