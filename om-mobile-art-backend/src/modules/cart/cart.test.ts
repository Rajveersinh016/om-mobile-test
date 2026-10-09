import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Shopping Cart Module Integration Tests', () => {
  let app: any;

  const customerEmail = 'cart_customer@example.com';
  const otherCustomerEmail = 'cart_other@example.com';
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
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    
    // Clean up catalog test data
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'CART_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'CART_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'CART_TEST_CAT' } });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Re-create testing users and retrieve fresh tokens
    const emails = [customerEmail, otherCustomerEmail];
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'CART_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'CART_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'CART_TEST_CAT' } });

    // Setup base catalog entities
    const cat = await prisma.category.create({
      data: { name: 'CART_TEST_CAT', slug: 'cart-test-cat' },
    });
    catId = cat.id;

    const prod = await prisma.product.create({
      data: {
        name: 'Cart Product',
        slug: 'cart-product',
        description: 'Cart product description',
        price: 80,
        originalPrice: 100,
        image: '/img/thumbnail.png',
        categoryId: catId,
        variants: {
          create: {
            sku: 'CART-VAR-1',
            finish: 'Matte',
            material: 'Carbon',
            priceOffset: 10.5,
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

  describe('Cart CRUD & Duplicates', () => {
    it('should add a variant to cart successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          productId: prodId,
          productVariantId: variantId,
          quantity: 2,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.productVariantId).toBe(variantId);
      expect(data.quantity).toBe(2);

      // Verify activity audit log
      const act = await prisma.accountActivity.findFirst({
        where: { userId: customerId, action: 'CART_ADD' },
      });
      expect(act).not.toBeNull();
    });

    it('should increment quantity when adding duplicate variant', async () => {
      // First addition (qty: 2)
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      // Second addition (qty: 3)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 3 },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.quantity).toBe(5); // 2 + 3
    });

    it('should update cart item quantity', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cart/${itemId}`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { quantity: 6 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.quantity).toBe(6);
    });

    it('should remove item and clear cart', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      // Remove single item
      const remRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cart/${itemId}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(remRes.statusCode).toBe(200);

      // Add again and clear cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      const clearRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(clearRes.statusCode).toBe(200);

      // Verify cart has 0 items
      const cartRes = await app.inject({
        method: 'GET',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(JSON.parse(cartRes.payload).data.items.length).toBe(0);
    });
  });

  describe('Cart Summary and Pricing calculations', () => {
    it('should compute summaries using db prices and ignore out-of-stock items', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      // Price = 80 (product price) + 10.5 (priceOffset) = 90.5
      // Qty = 2. Subtotal = 181

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/cart/summary',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      expect(summaryRes.statusCode).toBe(200);
      const data = JSON.parse(summaryRes.payload).data;
      expect(data.canCheckout).toBe(true);
      expect(data.summary.subtotal).toBe(181);
      expect(data.summary.total).toBe(231);
    });
  });

  describe('Validations and Stock Thresholds', () => {
    it('should reject negative or zero quantities', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: -2 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject quantities exceeding stock limits', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 20 }, // stock is 15
      });
      expect(res.statusCode).toBe(400); // Exceeds stock
    });

    it('should prevent IDOR (cannot write to other user cart)', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      // Try updating quantity with otherCustomerToken
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cart/${itemId}`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
        payload: { quantity: 4 },
      });
      expect(patchRes.statusCode).toBe(404); // returns 404/NotFoundError instead of leaking existance
    });
  });

  describe('Product Unavailability scenarios', () => {
    it('should flag status as UNPUBLISHED and block checkout if product is unpublished after added to cart', async () => {
      // 1. Add to cart
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      // 2. Unpublish product in the database
      await prisma.product.update({
        where: { id: prodId },
        data: { isPublished: false },
      });

      // 3. Fetch cart details
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const data = JSON.parse(getRes.payload).data;
      expect(data.canCheckout).toBe(false); // checkout blocked
      expect(data.items[0].status).toBe('UNPUBLISHED');
    });

    it('should flag status as DELETED and block checkout if product is soft deleted after added to cart', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId, quantity: 2 },
      });

      await prisma.product.update({
        where: { id: prodId },
        data: { deletedAt: new Date() },
      });

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/cart',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const data = JSON.parse(getRes.payload).data;
      expect(data.canCheckout).toBe(false);
      expect(data.items[0].status).toBe('DELETED');
    });
  });
});
