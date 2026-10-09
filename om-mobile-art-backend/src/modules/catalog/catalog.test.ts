import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { prisma } from '../../database/client.js';
import { Role } from '@prisma/client';
import { productRepository } from './repositories/productRepository.js';

describe('Product & Catalog Management Integration Tests', () => {
  let app: any;
  
  let adminToken: string;
  let customerToken: string;

  const adminEmail = 'catalog_admin@example.com';
  const customerEmail = 'catalog_customer@example.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    app = await buildApp();
    await prisma.$connect();

    // 1. Clean up potential old test users & orders
    const emails = [adminEmail, customerEmail];
    await prisma.orderItem.deleteMany({ where: { order: { user: { email: { in: emails } } } } });
    await prisma.order.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.userSession.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.accountActivity.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.adminActivityLog.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    // 2. Register & Login Admin
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: adminEmail, password: testPassword },
    });
    await prisma.user.update({ where: { email: adminEmail }, data: { role: Role.ADMIN } });
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      payload: { email: adminEmail, password: testPassword },
    });
    adminToken = JSON.parse(adminLoginRes.payload).data.tokens.accessToken;

    // 3. Register & Login Customer
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: customerEmail, password: testPassword },
    });
    const customerLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: customerEmail, password: testPassword },
    });
    customerToken = JSON.parse(customerLoginRes.payload).data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.adminActivityLog.deleteMany({
      where: { user: { email: { in: [adminEmail, customerEmail] } } },
    });
    await prisma.orderItem.deleteMany({
      where: { productName: { startsWith: 'TEST_' } },
    });
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: 'ORD-TEST-' } },
    });
    await prisma.productVariant.deleteMany({
      where: { product: { name: { startsWith: 'TEST_' } } },
    });
    await prisma.productImage.deleteMany({
      where: { product: { name: { startsWith: 'TEST_' } } },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.collection.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.device.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });

    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, customerEmail] } },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset test catalog data
    await prisma.orderItem.deleteMany({
      where: { productName: { startsWith: 'TEST_' } },
    });
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: 'ORD-TEST-' } },
    });
    await prisma.productVariant.deleteMany({
      where: { product: { name: { startsWith: 'TEST_' } } },
    });
    await prisma.productImage.deleteMany({
      where: { product: { name: { startsWith: 'TEST_' } } },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.collection.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
    await prisma.device.deleteMany({
      where: { name: { startsWith: 'TEST_' } },
    });
  });

  describe('Category CRUD', () => {
    it('should allow ADMIN to manage categories', async () => {
      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Category', slug: 'test-category' },
      });
      expect(createRes.statusCode).toBe(201);
      const cat = JSON.parse(createRes.payload).data;
      expect(cat.name).toBe('TEST_Category');

      // Update
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/categories/${cat.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Category_Updated', slug: 'test-category-updated' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).data.name).toBe('TEST_Category_Updated');

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/categories/${cat.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);
    });

    it('should deny CUSTOMER from creating categories', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/categories',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { name: 'TEST_Forbidden', slug: 'test-forbidden' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Collection CRUD', () => {
    it('should allow ADMIN to manage collections, duplicate, soft delete, restore, and permanently delete', async () => {
      // 1. Create Collection with all advanced parameters
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/collections',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'TEST_Collection_Advanced',
          slug: 'test-collection-advanced',
          description: 'Advanced testing description',
          shortDescription: 'Short advanced desc',
          status: 'PUBLISHED',
          isFeatured: true,
          isHomepage: true,
          isTrending: false,
          isSeasonal: true,
          seoTitle: 'SEO Advanced Title',
          seoDescription: 'SEO Advanced Description',
          seoKeywords: 'test, advanced, collection',
          sortOrder: 5,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const col = JSON.parse(createRes.payload).data;
      expect(col.name).toBe('TEST_Collection_Advanced');
      expect(col.status).toBe('PUBLISHED');
      expect(col.isFeatured).toBe(true);

      // 2. Duplicate Collection
      const dupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/collections/${col.id}/duplicate`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(dupRes.statusCode).toBe(201);
      const duplicated = JSON.parse(dupRes.payload).data;
      expect(duplicated.name).toBe('TEST_Collection_Advanced (Copy)');
      expect(duplicated.slug).toContain('test-collection-advanced-copy');

      // 3. Soft Delete Duplicated Collection
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/collections/${duplicated.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);

      // Verify it is soft deleted (not visible to public)
      const getPublicRes = await app.inject({
        method: 'GET',
        url: '/api/v1/collections',
      });
      const publicCols = JSON.parse(getPublicRes.payload).data;
      const foundDupPublic = publicCols.find((c: any) => c.id === duplicated.id);
      expect(foundDupPublic).toBeUndefined();

      // Verify it is visible to admin when includeDeleted is true
      const getAdminRes = await app.inject({
        method: 'GET',
        url: '/api/v1/collections?includeDeleted=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const adminCols = JSON.parse(getAdminRes.payload).data;
      const foundDupAdmin = adminCols.find((c: any) => c.id === duplicated.id);
      expect(foundDupAdmin).toBeDefined();
      expect(foundDupAdmin.deletedAt).not.toBeNull();

      // 4. Restore Duplicated Collection
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/collections/${duplicated.id}/restore`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(restoreRes.statusCode).toBe(200);
      const restored = JSON.parse(restoreRes.payload).data;
      expect(restored.deletedAt).toBeNull();

      // 5. Permanently Delete restored copy
      const permRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/collections/${duplicated.id}/permanent`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(permRes.statusCode).toBe(200);

      // Clean up primary collection
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/collections/${col.id}/permanent`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
    });
  });

  describe('Device CRUD', () => {
    it('should allow ADMIN to manage devices', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/devices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'TEST_Device', brand: 'TEST_Brand' },
      });
      expect(createRes.statusCode).toBe(201);
      const dev = JSON.parse(createRes.payload).data;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/devices/${dev.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);
    });
  });

  describe('Product CRUD and Workflows', () => {
    let catId: string;
    let devId: string;
    let colId: string;

    beforeEach(async () => {
      // Setup prerequisites
      const cat = await prisma.category.create({ data: { name: 'TEST_Cat', slug: 'test-cat' } });
      const dev = await prisma.device.create({ data: { name: 'TEST_Dev', brand: 'TEST_Brand' } });
      const col = await prisma.collection.create({ data: { name: 'TEST_Col', slug: 'test-col' } });
      catId = cat.id;
      devId = dev.id;
      colId = col.id;
    });

    it('should allow ADMIN to create, update, publish, unpublish, soft-delete, and restore a product', async () => {
      // 1. Create Product
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'TEST_Product',
          description: 'A premium test product',
          price: 49.99,
          originalPrice: 59.99,
          image: '/images/test-thumbnail.png',
          categoryId: catId,
          deviceId: devId,
          collectionId: colId,
          variants: [
            { sku: 'TEST-SKU-1', finish: 'Matte', material: 'Carbon', priceOffset: 0, stockQuantity: 100 },
            { sku: 'TEST-SKU-2', finish: 'Glossy', material: 'Leather', priceOffset: 5.0, stockQuantity: 50 },
          ],
          images: [
            { url: '/images/detail1.png', position: 0 },
          ],
        },
      });

      expect(createRes.statusCode).toBe(201);
      const product = JSON.parse(createRes.payload).data;
      expect(product.name).toBe('TEST_Product');

      // 2. Prevent Duplicate SKU
      const duplicateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'TEST_Product_2',
          description: 'Another product',
          price: 19.99,
          originalPrice: 19.99,
          image: '/images/test.png',
          categoryId: catId,
          variants: [
            { sku: 'TEST-SKU-1', finish: 'Matte', material: 'Carbon' }, // duplicate SKU
          ],
        },
      });
      expect(duplicateRes.statusCode).toBe(409); // Conflict

      // 3. Get Details (Admin)
      const detailsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(detailsRes.statusCode).toBe(200);
      const details = JSON.parse(detailsRes.payload).data;
      expect(details.variants.length).toBe(2);
      expect(details.images.length).toBe(1);

      // 4. Update Inventory
      const variantId = details.variants[0].id;
      const invRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/products/variants/${variantId}/inventory`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { stockQuantity: 75 },
      });
      expect(invRes.statusCode).toBe(200);
      expect(JSON.parse(invRes.payload).data.stockQuantity).toBe(75);

      // 5. Unpublish Product
      const unpubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${product.id}/unpublish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(unpubRes.statusCode).toBe(200);

      // Verify customer cannot see unpublished
      const custGetRes = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(custGetRes.statusCode).toBe(404); // Hidden for customers

      // 6. Publish Product
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${product.id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(pubRes.statusCode).toBe(200);

      // Verify customer can see published
      const custGetRes2 = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      // Attach historic order item to force soft-delete / archival instead of permanent cascade
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      await prisma.orderItem.create({
        data: {
          order: {
            create: {
              orderNumber: `ORD-TEST-${Date.now()}`,
              userId: adminUser!.id,
              subtotal: 100,
              total: 100,
              shippingAddress: {},
              customerSnapshot: {},
              pricingSnapshot: {},
            }
          },
          variant: { connect: { id: details.variants[0].id } },
          quantity: 1,
          pricePaid: 100,
          productName: 'TEST_Product',
          variantName: 'Matte',
          sku: 'TEST-SKU-1',
          unitPrice: 100,
        }
      });

      // 7. Soft Delete Product
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${product.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);

      // Verify customer cannot see soft-deleted product
      const custGetRes3 = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
      });
      expect(custGetRes3.statusCode).toBe(404);

      // 8. Restore Product
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${product.id}/restore`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(restoreRes.statusCode).toBe(200);

      // Verify customer can see restored product again
      const custGetRes4 = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
      });
      expect(custGetRes4.statusCode).toBe(200);
    });

    it('should validate query inputs, pagination, and sorting', async () => {
      // Seed 2 products
      await prisma.product.create({
        data: {
          name: 'TEST_Product_A',
          description: 'Product A description',
          price: 10.0,
          originalPrice: 15.0,
          image: '/img/a.png',
          categoryId: catId,
          isPublished: true,
          variants: { create: { sku: 'TEST-SKU-A', finish: 'Matte', material: 'Carbon' } },
        },
      });

      await prisma.product.create({
        data: {
          name: 'TEST_Product_B',
          description: 'Product B description',
          price: 20.0,
          originalPrice: 25.0,
          image: '/img/b.png',
          categoryId: catId,
          isPublished: true,
          variants: { create: { sku: 'TEST-SKU-B', finish: 'Matte', material: 'Carbon' } },
        },
      });

      // Filter and Sort by price asc
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/products?limit=5&sortBy=price_asc&search=TEST_Product',
      });
      expect(getRes.statusCode).toBe(200);
      const body = JSON.parse(getRes.payload);
      expect(body.products.length).toBe(2);
      expect(body.products[0].name).toBe('TEST_Product_A'); // 10.0 < 20.0
      expect(body.products[1].name).toBe('TEST_Product_B');
    });

    it('should allow image uploading via base64 encoding', async () => {
      const base64Content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 png
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/products/upload-image',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          filename: 'test-upload.png',
          content: base64Content,
        },
      });

      expect(uploadRes.statusCode).toBe(200);
      const url = JSON.parse(uploadRes.payload).data.url;
      expect(url).toContain('/uploads/');

      // Retrieve file through server static serving route
      const fileRes = await app.inject({
        method: 'GET',
        url,
      });
      expect(fileRes.statusCode).toBe(200);
      expect(fileRes.headers['content-type']).toBe('image/png');
      
      // Clean up the created physical file
      const physicalPath = path.join(process.cwd(), 'public', url);
      if (fs.existsSync(physicalPath)) {
        fs.unlinkSync(physicalPath);
      }
    });

    describe('Hardening Pass security & correctness', () => {
      it('should reject non-image MIME types and fake signatures (e.g., SVG or executable disguised as PNG)', async () => {
        const base64Content = Buffer.from('invalid content').toString('base64');
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: 'test-fake.png',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(400);
        expect(JSON.parse(uploadRes.payload).error.message).toContain('signature');
      });

      it('should reject SVG uploads even if renamed to PNG', async () => {
        const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
        const base64Content = Buffer.from(svgContent).toString('base64');
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: 'fake-svg.png',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(400);
        expect(JSON.parse(uploadRes.payload).error.message).toContain('SVG');
      });

      it('should reject executable files', async () => {
        const exeContent = Buffer.from([0x4D, 0x5A, 0x00, 0x00]);
        const base64Content = exeContent.toString('base64');
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: 'fake-exe.png',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(400);
        expect(JSON.parse(uploadRes.payload).error.message).toContain('Executable');
      });

      it('should reject oversized image uploads (>10MB)', async () => {
        const hugeBuffer = Buffer.alloc(11 * 1024 * 1024);
        const base64Content = hugeBuffer.toString('base64');
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: 'test-huge.png',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(400);
        expect(JSON.parse(uploadRes.payload).error.message).toContain('exceeds maximum limit');
      });

      it('should block directory traversal attempts in file uploads', async () => {
        const base64Content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: '../../etc/passwd',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(400);
        expect(JSON.parse(uploadRes.payload).error.message).toContain('Invalid filename structure');
      });

      it('should auto-generate slugs and handle sequential slug collisions across products', async () => {
        const cat = await prisma.category.create({ data: { name: 'TEST_Slug_Cat', slug: 'test-slug-cat' } });
        
        const res1 = await app.inject({
          method: 'POST',
          url: '/api/v1/products',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'TEST Product Hardened',
            description: 'First hardened product',
            price: 100,
            originalPrice: 100,
            image: '/img/thumbnail.png',
            categoryId: cat.id,
            variants: [{ sku: 'HARD-SKU-1', finish: 'Matte', material: 'Carbon' }]
          }
        });
        expect(res1.statusCode).toBe(201);
        const prod1 = JSON.parse(res1.payload).data;
        expect(prod1.slug).toBe('test-product-hardened');

        const res2 = await app.inject({
          method: 'POST',
          url: '/api/v1/products',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'TEST Product Hardened',
            description: 'Second hardened product',
            price: 120,
            originalPrice: 120,
            image: '/img/thumbnail.png',
            categoryId: cat.id,
            variants: [{ sku: 'HARD-SKU-2', finish: 'Glossy', material: 'Leather' }]
          }
        });
        expect(res2.statusCode).toBe(201);
        const prod2 = JSON.parse(res2.payload).data;
        expect(prod2.slug).toBe('test-product-hardened-2');

        const res3 = await app.inject({
          method: 'POST',
          url: '/api/v1/products',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            name: 'TEST Product Hardened',
            description: 'Third hardened product',
            price: 130,
            originalPrice: 130,
            image: '/img/thumbnail.png',
            categoryId: cat.id,
            variants: [{ sku: 'HARD-SKU-3', finish: 'Matte', material: 'Wood' }]
          }
        });
        expect(res3.statusCode).toBe(201);
        const prod3 = JSON.parse(res3.payload).data;
        expect(prod3.slug).toBe('test-product-hardened-3');
      });

      it('should prevent negative inventory levels', async () => {
        const cat = await prisma.category.create({ data: { name: 'TEST_Inv_Cat', slug: 'test-inv-cat' } });
        const prod = await prisma.product.create({
          data: {
            name: 'TEST_Inv_Prod',
            slug: 'test-inv-prod',
            description: 'Product for inventory testing',
            price: 10,
            originalPrice: 10,
            image: '/img/thumbnail.png',
            categoryId: cat.id,
            variants: {
              create: { sku: 'TEST-INV-SKU', finish: 'Matte', material: 'Steel', stockQuantity: 10 }
            }
          },
          include: { variants: true }
        });
        const variantId = prod.variants[0].id;

        const res = await app.inject({
          method: 'PUT',
          url: `/api/v1/products/variants/${variantId}/inventory`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { stockQuantity: -5 }
        });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.payload).error.details[0].issue).toContain('Stock must be 0 or more');
      });

      it('should prevent race conditions on concurrent inventory updates using locking', async () => {
        const cat = await prisma.category.create({ data: { name: 'TEST_Concurrency_Cat', slug: 'test-concurrency-cat' } });
        const prod = await prisma.product.create({
          data: {
            name: 'TEST_Concurrency_Prod',
            slug: 'test-concurrency-prod',
            description: 'Product for concurrency testing',
            price: 10,
            originalPrice: 10,
            image: '/img/thumbnail.png',
            categoryId: cat.id,
            variants: {
              create: { sku: 'TEST-CONCUR-SKU', finish: 'Matte', material: 'Bronze', stockQuantity: 100 }
            }
          },
          include: { variants: true }
        });
        const variantId = prod.variants[0].id;

        const updates = Array.from({ length: 5 }).map(() =>
          productRepository.updateVariantInventoryTx(variantId, -10, false)
        );

        await Promise.all(updates);

        const updatedVariant = await prisma.productVariant.findUnique({
          where: { id: variantId }
        });
        expect(updatedVariant?.stockQuantity).toBe(50);
      });

      it('should serve uploaded images with security headers', async () => {
        const base64Content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const uploadRes = await app.inject({
          method: 'POST',
          url: '/api/v1/products/upload-image',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            filename: 'test-header-image.png',
            content: base64Content,
          },
        });
        expect(uploadRes.statusCode).toBe(200);
        const url = JSON.parse(uploadRes.payload).data.url;

        const fileRes = await app.inject({
          method: 'GET',
          url,
        });
        expect(fileRes.statusCode).toBe(200);
        expect(fileRes.headers['x-content-type-options']).toBe('nosniff');
        expect(fileRes.headers['content-security-policy']).toBe("default-src 'none'");
        expect(fileRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');

        const physicalPath = path.join(process.cwd(), 'public', url);
        if (fs.existsSync(physicalPath)) {
          fs.unlinkSync(physicalPath);
        }
      });
    });
  });
});
import path from 'path';
import fs from 'fs';
