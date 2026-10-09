import { prisma } from '../database/client.js';
import { cartService } from '../modules/cart/services/cartService.js';
import { OrderService } from '../modules/order/order.service.ts';
import { PaymentService } from '../modules/payment/services/paymentService.ts';
import { razorpayClient } from '../services/payment/razorpayClient.js';
import crypto from 'crypto';

async function runTests() {
  console.log('=== STARTING TEST MATRIX FOR DEVICE PRICING & PAYMENT FLOW ===');

  // 1. Find or create Test User
  let user = await prisma.user.findFirst({ where: { email: 'testcustomer@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'testcustomer@example.com',
        passwordHash: 'hashedpassword',
        name: 'Test Customer',
        phone: '9876543210',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      }
    });
  }

  // 2. Find or create Category
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Test Category', slug: 'test-category' }
    });
  }

  // 3. Find or create DeviceTypes (Mobile, Laptop, Camera)
  let mobileDt = await prisma.deviceType.findFirst({ where: { name: 'Mobile' } });
  if (!mobileDt) {
    mobileDt = await prisma.deviceType.create({ data: { name: 'Mobile', slug: 'mobile' } });
  }

  let laptopDt = await prisma.deviceType.findFirst({ where: { name: 'Laptop' } });
  if (!laptopDt) {
    laptopDt = await prisma.deviceType.create({ data: { name: 'Laptop', slug: 'laptop' } });
  }

  let cameraDt = await prisma.deviceType.findFirst({ where: { name: 'Camera' } });
  if (!cameraDt) {
    cameraDt = await prisma.deviceType.create({ data: { name: 'Camera', slug: 'camera' } });
  }

  // 4. Find or create Product A ("Test Product A (All Devices)")
  let product = await prisma.product.findFirst({ where: { name: 'Test Product A (All Devices)' } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Test Product A (All Devices)',
        slug: 'test-product-a-all-devices',
        description: 'Test product for multi-device price verification',
        price: 300,
        originalPrice: 300,
        image: 'https://example.com/test.jpg',
        categoryId: category.id,
        status: 'PUBLISHED',
        isPublished: true,
      }
    });
  }

  // 5. Setup ProductDevicePrice records (Mobile=300, Laptop=500, Camera=700)
  await prisma.productDevicePrice.upsert({
    where: { productId_deviceTypeId: { productId: product.id, deviceTypeId: mobileDt.id } },
    update: { price: 300 },
    create: { productId: product.id, deviceTypeId: mobileDt.id, price: 300 },
  });

  await prisma.productDevicePrice.upsert({
    where: { productId_deviceTypeId: { productId: product.id, deviceTypeId: laptopDt.id } },
    update: { price: 500 },
    create: { productId: product.id, deviceTypeId: laptopDt.id, price: 500 },
  });

  await prisma.productDevicePrice.upsert({
    where: { productId_deviceTypeId: { productId: product.id, deviceTypeId: cameraDt.id } },
    update: { price: 700 },
    create: { productId: product.id, deviceTypeId: cameraDt.id, price: 700 },
  });

  // 6. Ensure product variant exists
  let variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) {
    variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'TEST-PROD-A-VAR1',
        finish: 'Matte',
        material: 'Standard 3M',
        priceOffset: 0,
        stockQuantity: 100,
      }
    });
  }

  console.log('✓ Test Setup Completed: Product A created with Mobile=₹300, Laptop=₹500, Camera=₹700');

  // --- TEST 1: MOBILE PRICE (₹300) ---
  await cartService.clearCart(user.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, mobileDt.id);
  let cart = await cartService.getCart(user.id);
  console.log(`[TEST 1 - MOBILE] Cart Item Unit Price: ₹${cart.items[0].unitPrice} (Expected: 300)`);
  if (cart.items[0].unitPrice !== 300) throw new Error(`TEST 1 Failed: Expected 300, got ${cart.items[0].unitPrice}`);

  // --- TEST 2: LAPTOP PRICE (₹500) ---
  await cartService.clearCart(user.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, laptopDt.id);
  cart = await cartService.getCart(user.id);
  console.log(`[TEST 2 - LAPTOP] Cart Item Unit Price: ₹${cart.items[0].unitPrice} (Expected: 500)`);
  if (cart.items[0].unitPrice !== 500) throw new Error(`TEST 2 Failed: Expected 500, got ${cart.items[0].unitPrice}`);

  // --- TEST 3: CAMERA PRICE (₹700) ---
  await cartService.clearCart(user.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, cameraDt.id);
  cart = await cartService.getCart(user.id);
  console.log(`[TEST 3 - CAMERA] Cart Item Unit Price: ₹${cart.items[0].unitPrice} (Expected: 700)`);
  if (cart.items[0].unitPrice !== 700) throw new Error(`TEST 3 Failed: Expected 700, got ${cart.items[0].unitPrice}`);

  // --- TEST 4: SAME PRODUCT, DIFFERENT DEVICES (Mobile ₹300 + Camera ₹700) ---
  await cartService.clearCart(user.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, mobileDt.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, cameraDt.id);
  cart = await cartService.getCart(user.id);
  console.log(`[TEST 4 - SEPARATE LINES] Cart Total Items: ${cart.items.length} (Expected: 2)`);
  cart.items.forEach((item: any) => {
    console.log(`  - DeviceType: ${item.deviceTypeName}, Unit Price: ₹${item.unitPrice}`);
  });
  if (cart.items.length !== 2) throw new Error(`TEST 4 Failed: Cart items merged! Expected 2 lines.`);

  // --- TEST 5 & 6: PENDING_PAYMENT / PAYMENT FAILURE ---
  await cartService.clearCart(user.id);
  await cartService.addToCart(user.id, product.id, variant.id, 1, undefined, undefined, cameraDt.id);
  cart = await cartService.getCart(user.id);

  const orderInput = {
    userId: user.id,
    customerName: 'Test Customer',
    customerEmail: 'testcustomer@example.com',
    phone: '9876543210',
    shippingAddress: {
      firstName: 'Test',
      lastName: 'Customer',
      addressLine1: '123 Test St',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '394101',
    },
    items: [
      {
        productVariantId: variant.id,
        deviceTypeId: cameraDt.id,
        deviceType: 'Camera',
        quantity: 1,
        unitPrice: 700,
        pricePaid: 700,
      }
    ]
  };

  const newOrder = await OrderService.createOrder(orderInput);
  console.log(`[TEST 5 & 6] Business Order Created with Status: ${newOrder.status}, PaymentStatus: ${newOrder.paymentStatus}, Total: ₹${newOrder.total}`);
  if (newOrder.total !== 749) throw new Error(`Expected order total 749 (700 product + 49 shipping), got ${newOrder.total}`);

  // Check Admin Order List default view
  const adminOrders = await OrderService.getOrders({});
  const isUnpaidInAdminList = adminOrders.items.some(o => o.id === newOrder.id);
  console.log(`[TEST 5 & 6 - ADMIN LIST] Is Unpaid Order in Default Admin List? ${isUnpaidInAdminList} (Expected: false)`);
  if (isUnpaidInAdminList) throw new Error(`TEST 5/6 Failed: Unpaid order appeared in default admin list!`);

  // --- TEST 7: PAYMENT SUCCESS & SIGNATURE VERIFICATION ---
  const razorpayOrderId = `order_test_${Date.now()}`;
  const razorpayPaymentId = `pay_test_${Date.now()}`;
  const secret = process.env.RAZORPAY_KEY_SECRET || 'NZMZZQcExRzFpoEGVJTZsBsr';
  const validSignature = crypto.createHmac('sha256', secret).update(razorpayOrderId + '|' + razorpayPaymentId).digest('hex');

  const payment = await prisma.payment.create({
    data: {
      orderId: newOrder.id,
      userId: user.id,
      gateway: 'RAZORPAY',
      status: 'PENDING',
      amount: newOrder.total,
      currency: 'INR',
      razorpayOrderId,
    }
  });

  const verifyRes = await PaymentService.verifyPayment(
    razorpayOrderId,
    razorpayPaymentId,
    validSignature,
    newOrder.id
  );

  const verifiedOrder = await OrderService.getOrderById(newOrder.id);
  console.log(`[TEST 7 - PAYMENT SUCCESS] Verified Order Status: ${verifiedOrder.status}, PaymentStatus: ${verifiedOrder.paymentStatus}`);
  if (verifiedOrder.status !== 'PAID' && verifiedOrder.status !== 'CONFIRMED') {
    throw new Error('TEST 7 Failed: Order not marked CONFIRMED or PAID after payment success');
  }

  // --- TEST 8: DUPLICATE VERIFICATION (IDEMPOTENCY) ---
  const reVerified = await PaymentService.verifyPayment(
    razorpayOrderId,
    razorpayPaymentId,
    validSignature,
    newOrder.id
  );
  console.log(`[TEST 8 - DUPLICATE VERIFICATION] Idempotency response success: ${reVerified.success}`);
  if (!reVerified.success) throw new Error('TEST 8 Failed: Idempotent verification failed');

  // --- TEST 9: PRODUCT PRICE CHANGE DOES NOT ALTER HISTORICAL ORDER ---
  await prisma.productDevicePrice.update({
    where: { productId_deviceTypeId: { productId: product.id, deviceTypeId: cameraDt.id } },
    data: { price: 800 }
  });

  const historicalOrder = await OrderService.getOrderById(newOrder.id);
  const historicalItemPrice = historicalOrder.items[0].pricePaid;
  console.log(`[TEST 9 - PRICE CHANGE] Historical Order Item Price: ₹${historicalItemPrice} (Expected: 700 despite current price 800)`);
  if (historicalItemPrice !== 700) {
    throw new Error(`TEST 9 Failed: Historical order price changed! Expected 700, got ${historicalItemPrice}`);
  }

  console.log('\n=========================================================');
  console.log('🎉 ALL 9 TEST MATRIX VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=========================================================\n');
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('TEST MATRIX ERROR:', err);
  process.exit(1);
});
