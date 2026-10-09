import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';

describe('Wishlist Module Integration Tests', () => {
  let app: any;

  const customerEmail = 'wishlist_customer@example.com';
  const otherCustomerEmail = 'wishlist_other@example.com';
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
    await prisma.wishlistItem.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    
    // Clean up created products/categories
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'WISHLIST_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'WISHLIST_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'WISHLIST_TEST_CAT' } });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Re-create testing users and retrieve fresh tokens
    const emails = [customerEmail, otherCustomerEmail];
    await prisma.wishlistItem.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // Clean up created products/categories
    await prisma.productVariant.deleteMany({ where: { product: { category: { name: 'WISHLIST_TEST_CAT' } } } });
    await prisma.product.deleteMany({ where: { category: { name: 'WISHLIST_TEST_CAT' } } });
    await prisma.category.deleteMany({ where: { name: 'WISHLIST_TEST_CAT' } });

    // Setup base catalog entities
    const cat = await prisma.category.create({
      data: { name: 'WISHLIST_TEST_CAT', slug: 'wishlist-test-cat' },
    });
    catId = cat.id;

    const prod = await prisma.product.create({
      data: {
        name: 'Wishlist Product',
        slug: 'wishlist-product',
        description: 'Wishlist product description',
        price: 100,
        originalPrice: 100,
        image: '/img/thumbnail.png',
        categoryId: catId,
        variants: {
          create: {
            sku: 'WISH-VAR-1',
            finish: 'Matte',
            material: 'Carbon',
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

  describe('Wishlist CRUD Operations', () => {
    it('should add a valid product variant to wishlist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          productId: prodId,
          productVariantId: variantId,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.productId).toBe(prodId);
      expect(data.productVariantId).toBe(variantId);

      // Verify log activity
      const activity = await prisma.accountActivity.findFirst({
        where: { userId: customerId, action: 'WISHLIST_ADD' },
      });
      expect(activity).not.toBeNull();
    });

    it('should prevent duplicate wishlist entries', async () => {
      // First addition
      await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });

      // Second addition
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      expect(res.statusCode).toBe(409); // ConflictError
    });

    it('should list wishlist items and return correct count', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });

      // Get count
      const countRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist/count',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(countRes.statusCode).toBe(200);
      expect(JSON.parse(countRes.payload).data.count).toBe(1);

      // List wishlist
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const items = JSON.parse(listRes.payload).data;
      expect(items.length).toBe(1);
      expect(items[0].status).toBe('AVAILABLE');
      expect(items[0].product.name).toBe('Wishlist Product');
      expect(items[0].variant.sku).toBe('WISH-VAR-1');
    });

    it('should delete item from wishlist', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/wishlist/${itemId}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(delRes.statusCode).toBe(200);

      // Verify count is 0
      const countRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist/count',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(JSON.parse(countRes.payload).data.count).toBe(0);
    });

    it('should prevent IDOR (cannot delete other user wishlist item)', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      // Try deleting it with other customer's token
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/wishlist/${itemId}`,
        headers: { authorization: `Bearer ${otherCustomerToken}` },
      });
      expect(delRes.statusCode).toBe(404); // Not found
    });

    it('should reject unauthorized access without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Wishlist Availability Checks', () => {
    it('should reject adding soft-deleted products', async () => {
      // Soft-delete the product
      await prisma.product.update({
        where: { id: prodId },
        data: { deletedAt: new Date() },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      expect(res.statusCode).toBe(400); // ValidationError
    });

    it('should reject adding unpublished products', async () => {
      // Unpublish product
      await prisma.product.update({
        where: { id: prodId },
        data: { isPublished: false },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject adding invalid variant IDs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          productId: prodId,
          productVariantId: '00000000-0000-0000-0000-000000000000', // random UUID
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return OUT_OF_STOCK status for wishlisted items when stock falls to 0', async () => {
      // Add first
      await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });

      // Update variant stock to 0
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: 0 },
      });

      // List wishlist and verify status
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const items = JSON.parse(res.payload).data;
      expect(items[0].status).toBe('OUT_OF_STOCK');
    });
  });

  describe('Move Wishlist Item to Cart', () => {
    it('should validate, delete from wishlist, and return cart details for move-to-cart request', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/wishlist/${itemId}/move-to-cart`,
        headers: { authorization: `Bearer ${customerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload).data;
      expect(data.productId).toBe(prodId);
      expect(data.productVariantId).toBe(variantId);

      // Verify it was removed from wishlist
      const countRes = await app.inject({
        method: 'GET',
        url: '/api/v1/wishlist/count',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(JSON.parse(countRes.payload).data.count).toBe(0);

      // Verify activity logs
      const activity = await prisma.accountActivity.findFirst({
        where: { userId: customerId, action: 'WISHLIST_MOVE_TO_CART' },
      });
      expect(activity).not.toBeNull();
    });

    it('should reject move-to-cart if item is out of stock', async () => {
      const addRes = await app.inject({
        method: 'POST',
        url: '/api/v1/wishlist',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { productId: prodId, productVariantId: variantId },
      });
      const itemId = JSON.parse(addRes.payload).data.id;

      // Make it out of stock
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: 0 },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/wishlist/${itemId}/move-to-cart`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(400); // Out of stock items cannot be moved to cart
    });
  });
});
