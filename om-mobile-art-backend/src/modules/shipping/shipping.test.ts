import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import argon2 from 'argon2';
import crypto from 'crypto';
import { OrderStatus, PaymentStatus, ShipmentStatus, Role } from '@prisma/client';

describe('Order Fulfillment & Shipping Architecture Test Suite', () => {
  let app: FastifyInstance;

  const testEmail = 'shipping_customer@ommobileart.com';
  const testPass = 'SecurePass123!';
  let userId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let inventoryId: string;
  let paidOrderId: string;
  let paidOrderNumber: string;
  let trackingNumber: string;
  let shipmentId: string;
  const initialStock = 30;

  const cleanupData = async () => {
    const existingUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existingUser) {
      const orders = await prisma.order.findMany({ where: { userId: existingUser.id } });
      for (const o of orders) {
        await prisma.shipment.deleteMany({ where: { orderId: o.id } });
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
        name: 'Shipping Customer',
      },
    });
    userId = user.id;

    // 2. Create Product & Inventory
    const category = await prisma.category.create({
      data: { name: 'Fulfillment Skins', slug: `ship-skins-${Date.now()}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Fulfillment Dragon Skin',
        slug: `ship-dragon-skin-${Date.now()}`,
        description: 'Premium Vinyl Skin',
        price: 599,
        originalPrice: 899,
        image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=400',
        categoryId: category.id,
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `SKU-SHIP-${Date.now()}`,
        finish: 'Leather',
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

    // 3. Create Order & Process Payment (Stock decrements from 30 -> 27)
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        items: [
          {
            productVariantId: variant.id,
            quantity: 3,
            pricePaid: 599,
            productName: product.name,
            variantName: 'Leather / 3M Vinyl',
            sku: variant.sku,
          },
        ],
        customerName: 'Shipping Customer',
        customerEmail: testEmail,
        phone: '9876543210',
        shippingAddress: {
          firstName: 'Fast',
          lastName: 'Delivery',
          street: '456 Express Highway',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          mobile: '9876543210',
        },
      },
    });

    const orderData = JSON.parse(orderRes.body).data;
    paidOrderId = orderData.id;
    paidOrderNumber = orderData.orderNumber;

    // Simulate successful payment verification (decrements stock 30 -> 27)
    const rzpOrderId = `order_mock_ship_${Date.now()}`;
    const rzpPayId = `pay_mock_ship_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
    const sig = crypto.createHmac('sha256', secret).update(`${rzpOrderId}|${rzpPayId}`).digest('hex');

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/create-order',
      payload: { orderId: paidOrderId },
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      payload: {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPayId,
        razorpaySignature: sig,
        orderId: paidOrderId,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
  });

  afterAll(async () => {
    await cleanupData();
    await app.close();
  });

  it('1. Generate Shipment -> Creates Shipment record & sets Order status PACKED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shipping/generate-shipment',
      payload: { orderId: paidOrderId },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.trackingNumber).toBeDefined();
    expect(body.data.carrier).toBe('NOT_CONFIGURED');
    expect(body.data.status).toBe('PACKED');

    trackingNumber = body.data.trackingNumber;
    shipmentId = body.data.shipmentId;

    // Verify DB Shipment record created
    const dbShipment = await prisma.shipment.findUnique({ where: { shipmentId } });
    expect(dbShipment).not.toBeNull();
    expect(dbShipment?.trackingNumber).toBe(trackingNumber);

    // Verify Order status updated to PACKED
    const dbOrder = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(dbOrder?.status).toBe(OrderStatus.PACKED);
    expect(dbOrder?.trackingNumber).toBe(trackingNumber);
  });

  it('2. Prevent Duplicate Shipment Creation -> Returns existing shipment data idempotently', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shipping/generate-shipment',
      payload: { orderId: paidOrderId },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.trackingNumber).toBe(trackingNumber);
  });

  it('3. GET Shipping Label -> Generates printable HTML label with order details and address', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/shipping/label/${shipmentId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('OM MOBILE ART');
    expect(res.body).toContain(trackingNumber);
    expect(res.body).toContain('456 Express Highway');
  });

  it('4. Dispatch Shipment -> Updates status to SHIPPED & sets dispatch date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shipping/dispatch',
      payload: { orderId: paidOrderId },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('SHIPPED');

    // Verify DB update
    const dbOrder = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(dbOrder?.status).toBe(OrderStatus.SHIPPED);
  });

  it('5. Manual / Automated Tracking Status Updates -> Progresses through IN_TRANSIT and OUT_FOR_DELIVERY', async () => {
    const resTransit = await app.inject({
      method: 'PATCH',
      url: '/api/v1/shipping/status',
      payload: {
        orderId: paidOrderId,
        status: 'IN_TRANSIT',
        comment: 'Package sorted at National Sorting Hub',
      },
    });

    expect(resTransit.statusCode).toBe(200);

    const resOut = await app.inject({
      method: 'PATCH',
      url: '/api/v1/shipping/status',
      payload: {
        orderId: paidOrderId,
        status: 'OUT_FOR_DELIVERY',
        comment: 'Out for delivery with postman',
      },
    });

    expect(resOut.statusCode).toBe(200);
    const dbOrder = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(dbOrder?.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
  });

  it('6. GET Tracking Details -> Returns visual stepper, recipient details & checkpoint history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/shipping/track/${trackingNumber}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.trackingNumber).toBe(trackingNumber);
    expect(body.data.orderNumber).toBe(paidOrderNumber);
    expect(body.data.stepper.length).toBe(6);
    expect(body.data.events.length).toBeGreaterThan(0);
  });

  it('7. Mark Order DELIVERED -> Updates actualDelivery and Order status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/shipping/status',
      payload: {
        orderId: paidOrderId,
        status: 'DELIVERED',
        comment: 'Package delivered to recipient',
      },
    });

    expect(res.statusCode).toBe(200);
    const dbOrder = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(dbOrder?.status).toBe(OrderStatus.DELIVERED);

    const dbShipment = await prisma.shipment.findUnique({ where: { shipmentId } });
    expect(dbShipment?.status).toBe(ShipmentStatus.DELIVERED);
    expect(dbShipment?.actualDelivery).not.toBeNull();
  });

  it('8. Order Cancellation & Stock Restoration -> Restores inventory quantity (27 -> 30)', async () => {
    // Verify current stock is 27 (30 - 3)
    const currentInv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(currentInv?.quantity).toBe(initialStock - 3);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shipping/cancel-order',
      payload: {
        orderId: paidOrderId,
        reason: 'Customer requested cancellation',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify Order is CANCELLED
    const dbOrder = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(dbOrder?.status).toBe(OrderStatus.CANCELLED);

    // CRITICAL SECURITY REQUIREMENT: Inventory stock must be RESTORED to 30!
    const restoredInv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    expect(restoredInv?.quantity).toBe(initialStock); // 30 restored!
  });

  it('9. Reject Shipment Creation for Cancelled Order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shipping/generate-shipment',
      payload: { orderId: paidOrderId },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message || body.error?.message).toContain('Cancelled orders cannot create shipments');
  });

  it('10. GET Admin Dashboard Metrics -> Returns accurate metric counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/shipping/admin/dashboard-metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.cancelledOrders).toBeGreaterThanOrEqual(1);
  });
});
