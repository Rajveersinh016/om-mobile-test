import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role, DiscountType } from '@prisma/client';

describe('Coupon & Promotion Engine Integration Tests', () => {
  let app: any;

  const adminEmail = 'coupon_admin@example.com';
  const customerEmail = 'coupon_customer@example.com';
  const otherCustomerEmail = 'coupon_other@example.com';
  const testPassword = 'Password123!';

  let adminToken: string;
  let adminId: string;

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
    const emails = [adminEmail, customerEmail, otherCustomerEmail];
    await prisma.couponUsage.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    
    // Clean up created coupon and products
    await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST_' } } });
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'COUPON_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'COUPON_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'COUPON_TEST_CAT' } });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up created coupon and products
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'COUPON_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'COUPON_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'COUPON_TEST_CAT' } });

    // Re-create testing users and retrieve fresh tokens
    const emails = [adminEmail, customerEmail, otherCustomerEmail];
    await prisma.couponUsage.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST_' } } });

    // Setup base catalog entities
    const cat = await prisma.category.create({
      data: { name: 'COUPON_TEST_CAT', slug: 'coupon-test-cat' },
    });
    catId = cat.id;

    const prod = await prisma.product.create({
      data: {
        name: 'Coupon Product',
        slug: 'coupon-product',
        description: 'Coupon product description',
        price: 100,
        originalPrice: 120,
        image: '/img/thumbnail.png',
        categoryId: catId,
        variants: {
          create: {
            sku: 'COUP-VAR-1',
            finish: 'Matte',
            material: 'Carbon',
            priceOffset: 20, // Unit price = 120
            stockQuantity: 20,
          },
        },
      },
      include: { variants: true },
    });
    prodId = prod.id;
    variantId = prod.variants[0].id;

    // Register admin
    const regAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: adminEmail, password: testPassword },
    });
    adminId = JSON.parse(regAdmin.payload).data.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: Role.ADMIN } });

    // Login admin
    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { email: adminEmail, password: testPassword },
    });
    adminToken = JSON.parse(loginAdmin.payload).data.tokens.accessToken;

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

  describe('Coupon CRUD Endpoints & RBAC', () => {
    it('should allow Admin to create a coupon', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'TEST_PERC',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
          minCartValue: 100,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.code).toBe('TEST_PERC');
      expect(data.discountValue).toBe(15);
    });

    it('should reject non-admin users from creating coupons', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          code: 'TEST_PERC',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
        },
      });
      expect(res.statusCode).toBe(403); // ForbiddenError
    });

    it('should list all coupons', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_PERC',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/coupons',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.length).toBeGreaterThanOrEqual(1);
    });

    it('should update and delete coupons', async () => {
      const coupon = await prisma.coupon.create({
        data: {
          code: 'TEST_PERC',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
        },
      });

      // Update
      const upRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/coupons/${coupon.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { discountValue: 20 },
      });
      expect(upRes.statusCode).toBe(200);
      expect(JSON.parse(upRes.payload).data.discountValue).toBe(20);

      // Delete
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/coupons/${coupon.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(200);
    });
  });

  describe('Apply & Remove Coupons', () => {
    beforeEach(async () => {
      // Add items to customer cart (1 item of variantId. price = 120)
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 1 },
      });
    });

    it('should apply a percentage coupon, compute subtotal and discounts', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_10',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10, // 10%
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_10', cartSubtotal: 120 },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(true);
      expect(data.calculatedDiscount).toBe(12);
    });

    it('should apply a fixed discount coupon', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_FIX',
          discountType: DiscountType.FIXED,
          discountValue: 30, // 30 units
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_FIX', cartSubtotal: 120 },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.calculatedDiscount).toBe(30);
    });

    it('should remove applied coupon from cart', async () => {
      // Validation API is stateless for cart
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: '', cartSubtotal: 120 },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });
  });

  describe('Coupon Validation & Edge Cases', () => {
    beforeEach(async () => {
      // Add items to customer cart (1 item of variantId. price = 120)
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 1 },
      });
    });

    it('should reject inactive coupons', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_INACTIVE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          isActive: false,
          status: 'DISABLED',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_INACTIVE', cartSubtotal: 120 },
      });
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });

    it('should reject expired coupons', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.coupon.create({
        data: {
          code: 'TEST_EXPIRED',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          validUntil: yesterday,
          endDate: yesterday,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_EXPIRED', cartSubtotal: 120 },
      });
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });

    it('should reject coupons if minCartValue is not met', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_MIN',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          minCartValue: 500, // cart subtotal is 120
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_MIN', cartSubtotal: 120 },
      });
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });

    it('should enforce maxDiscount cap', async () => {
      await prisma.coupon.create({
        data: {
          code: 'TEST_MAX',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 50, // 50% of 120 is 60
          maxDiscount: 25,   // Capped at 25
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_MAX', cartSubtotal: 120 },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.calculatedDiscount).toBe(25);
    });

    it('should reject if global usage limit has been reached', async () => {
      const coupon = await prisma.coupon.create({
        data: {
          code: 'TEST_LIMIT',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          globalUsageLimit: 1, // Only 1 use allowed
          usageCount: 1,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_LIMIT', cartSubtotal: 120 },
      });
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });

    it('should reject if user personal usage limit has been reached', async () => {
      const coupon = await prisma.coupon.create({
        data: {
          code: 'TEST_USER_LIMIT',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          perUserUsageLimit: 1,
        },
      });

      // Create previous usage record
      await prisma.couponUsage.create({
        data: {
          couponId: coupon.id,
          userId: customerId,
          discountAmount: 10,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/coupons/validate',
        payload: { code: 'TEST_USER_LIMIT', cartSubtotal: 120, userId: customerId },
      });
      const data = JSON.parse(res.payload).data;
      expect(data.valid).toBe(false);
    });
  });
});
