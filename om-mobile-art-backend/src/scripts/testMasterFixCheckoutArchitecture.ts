import { prisma } from '../database/client.js';
import { cartService } from '../modules/cart/services/cartService.js';
import { checkoutService } from '../modules/checkout/services/checkoutService.js';
import { PaymentService } from '../modules/payment/services/paymentService.js';
import { razorpayClient } from '../services/payment/razorpayClient.js';
import crypto from 'crypto';

async function main() {
  console.log('============================================================');
  console.log('MASTER FIX AUTOMATED VERIFICATION MATRIX');
  console.log('============================================================\n');

  // 1. Setup Test User
  const testEmail = `master_test_${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Master Fix Test User',
      passwordHash: 'hashed_pw',
      role: 'CUSTOMER',
    },
  });
  console.log(`[SETUP] Created test user: ${user.email} (${user.id})`);

  // 2. Setup Device Types (Mobile, Laptop, Camera)
  const dtMobile = await prisma.deviceType.upsert({
    where: { slug: 'mobile' },
    update: { name: 'Mobile' },
    create: { name: 'Mobile', slug: 'mobile' },
  });
  const dtLaptop = await prisma.deviceType.upsert({
    where: { slug: 'laptop' },
    update: { name: 'Laptop' },
    create: { name: 'Laptop', slug: 'laptop' },
  });
  const dtCamera = await prisma.deviceType.upsert({
    where: { slug: 'camera' },
    update: { name: 'Camera' },
    create: { name: 'Camera', slug: 'camera' },
  });
  console.log(`[SETUP] Device Types verified: Mobile (${dtMobile.id}), Laptop (${dtLaptop.id}), Camera (${dtCamera.id})`);

  // 3. Setup Test Category
  const category = await prisma.category.upsert({
    where: { slug: 'skins-mf' },
    update: { name: 'Skins MF' },
    create: { name: 'Skins MF', slug: 'skins-mf' },
  });

  // 4. Create Product A, B, C with Device Prices
  // Product A: Mobile ₹300, Laptop ₹500, Camera ₹700
  const prodA = await prisma.product.create({
    data: {
      name: 'Product A (MF)',
      slug: `product-a-mf-${Date.now()}`,
      description: 'Test product A',
      price: 300,
      originalPrice: 300,
      image: '/img/prod-a.png',
      categoryId: category.id,
      variants: {
        create: [
          { sku: `SKU-A-MATTE-${Date.now()}`, finish: 'Matte', material: '3M Vinyl', priceOffset: 0, stockQuantity: 50 },
        ],
      },
    },
    include: { variants: true },
  });

  await prisma.productDevicePrice.createMany({
    data: [
      { productId: prodA.id, deviceTypeId: dtMobile.id, price: 300 },
      { productId: prodA.id, deviceTypeId: dtLaptop.id, price: 500 },
      { productId: prodA.id, deviceTypeId: dtCamera.id, price: 700 },
    ],
  });

  // Product B: Mobile ₹400, Laptop ₹650, Camera ₹900
  const prodB = await prisma.product.create({
    data: {
      name: 'Product B (MF)',
      slug: `product-b-mf-${Date.now()}`,
      description: 'Test product B',
      price: 400,
      originalPrice: 400,
      image: '/img/prod-b.png',
      categoryId: category.id,
      variants: {
        create: [
          { sku: `SKU-B-MATTE-${Date.now()}`, finish: 'Matte', material: '3M Vinyl', priceOffset: 0, stockQuantity: 50 },
        ],
      },
    },
    include: { variants: true },
  });

  await prisma.productDevicePrice.createMany({
    data: [
      { productId: prodB.id, deviceTypeId: dtMobile.id, price: 400 },
      { productId: prodB.id, deviceTypeId: dtLaptop.id, price: 650 },
      { productId: prodB.id, deviceTypeId: dtCamera.id, price: 900 },
    ],
  });

  console.log('[SETUP] Created Product A and Product B with device prices.');

  // Create Shipping Address for user
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      fullName: 'Master Fix Customer',
      phone: '9876543210',
      addressLine1: '123 Main Street',
      city: 'Surat',
      state: 'Gujarat',
      country: 'India',
      pincode: '395006',
      isDefaultShipping: true,
    },
  });

  let testPassedCount = 0;
  let testFailedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testPassedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      testFailedCount++;
    }
  }

  // TEST 1: Product Detail Device Price Selection
  console.log('\n--- TEST GROUP 1: DEVICE-SPECIFIC PRICING IN CART ---');
  // Add Product A with Camera (₹700) to Cart
  await cartService.addToCart(
    user.id,
    prodA.id,
    prodA.variants[0].id,
    1,
    undefined,
    undefined,
    dtCamera.id
  );

  const cart1 = await cartService.getCart(user.id);
  assert(cart1.items.length === 1, 'Cart contains exactly 1 item');
  assert(cart1.items[0].unitPrice === 700, 'Cart item unitPrice is ₹700 for Camera');
  assert(cart1.items[0].lineTotal === 700, 'Cart item lineTotal is ₹700');
  assert(cart1.summary.subtotal === 700, 'Cart subtotal is ₹700');

  // TEST 2: Single Backend Authoritative Checkout Preparation (No Order created yet)
  console.log('\n--- TEST GROUP 2: CHECKOUT PREPARATION & NO PRE-PAYMENT ADMIN ORDER ---');
  const initialOrderCount = await prisma.order.count({ where: { userId: user.id } });

  const prepResponse = await checkoutService.prepareCheckout(
    user.id,
    address.id,
    undefined,
    undefined,
    'RAZORPAY'
  );

  assert(prepResponse.subtotal === 700, 'Checkout subtotal is ₹700');
  assert(prepResponse.shipping >= 0, `Checkout shipping is ₹${prepResponse.shipping}`);
  const expectedTotal = 700 + prepResponse.shipping;
  assert(prepResponse.total === expectedTotal, `Checkout total matches subtotal + shipping (₹${expectedTotal})`);
  assert(prepResponse.amount === expectedTotal * 100, `Razorpay amount in paise matches total * 100 (${expectedTotal * 100})`);

  const orderCountAfterPrep = await prisma.order.count({ where: { userId: user.id } });
  assert(orderCountAfterPrep === initialOrderCount, 'NO business Order created in DB during checkout preparation (Admin sees zero pending orders)');

  // TEST 3: Multiple Device Types of Same Product in Cart
  console.log('\n--- TEST GROUP 3: MULTIPLE DEVICE TYPES IN CART ---');
  // Add Product A with Mobile (₹300) to Cart
  await cartService.addToCart(
    user.id,
    prodA.id,
    prodA.variants[0].id,
    1,
    undefined,
    undefined,
    dtMobile.id
  );

  const cart2 = await cartService.getCart(user.id);
  assert(cart2.items.length === 2, 'Cart contains 2 separate lines for Camera (₹700) and Mobile (₹300)');
  assert(cart2.summary.subtotal === 1000, 'Cart subtotal for Camera + Mobile is ₹1000');

  // Prepare checkout snapshot for combined cart
  const prep2 = await checkoutService.prepareCheckout(user.id, address.id);
  assert(prep2.subtotal === 1000, 'Combined checkout subtotal is ₹1000');
  const expectedTotal2 = 1000 + prep2.shipping;
  assert(prep2.total === expectedTotal2, `Combined checkout total is ₹${expectedTotal2}`);
  assert(prep2.amount === expectedTotal2 * 100, `Razorpay order amount is ${expectedTotal2 * 100} paise`);

  // TEST 4: Signature & Amount Verification & Post-Payment Order Finalization
  console.log('\n--- TEST GROUP 4: PAYMENT VERIFICATION & ORDER FINALIZATION ---');
  const fakePaymentId = `pay_${Date.now()}_test`;
  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${prep2.razorpayOrderId}|${fakePaymentId}`)
    .digest('hex');

  const verifyResult = await PaymentService.verifyPayment(
    prep2.razorpayOrderId,
    fakePaymentId,
    expectedSignature,
    undefined,
    'ONLINE',
    prep2.checkoutId
  );

  assert(verifyResult.success === true, 'Payment verification succeeded');
  assert(verifyResult.data.status === 'PAID', 'Verified order status is PAID');
  assert(verifyResult.data.amount === expectedTotal2, `Confirmed business order total matches paid amount ₹${expectedTotal2}`);

  const confirmedOrder = await prisma.order.findUnique({
    where: { id: verifyResult.data.orderId },
    include: { items: true },
  });
  assert(confirmedOrder !== null, 'Business order created in DB post-verification');
  assert(confirmedOrder?.status === 'PAID', 'Business order status is PAID in Admin DB');
  assert(confirmedOrder?.total === expectedTotal2, `Business order total is ₹${expectedTotal2}`);
  assert(confirmedOrder?.items.length === 2, 'Business order has 2 OrderItems with correct snapshot prices');

  // Check cart is now empty
  const cartAfterPayment = await cartService.getCart(user.id);
  assert(cartAfterPayment.items.length === 0, 'User cart is cleared after payment verification');

  // TEST 5: Idempotency Verification
  console.log('\n--- TEST GROUP 5: IDEMPOTENCY ---');
  const duplicateVerify = await PaymentService.verifyPayment(
    prep2.razorpayOrderId,
    fakePaymentId,
    expectedSignature,
    undefined,
    'ONLINE',
    prep2.checkoutId
  );

  assert(duplicateVerify.success === true, 'Idempotent duplicate verification succeeds cleanly');
  assert(duplicateVerify.data.orderId === verifyResult.data.orderId, 'Duplicate request returned exact SAME orderId without creating duplicate order');

  const finalOrderCount = await prisma.order.count({ where: { userId: user.id } });
  assert(finalOrderCount === 1, 'Total confirmed business orders in DB remains 1');

  // CLEANUP
  await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
  await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } });
  await prisma.payment.deleteMany({ where: { userId: user.id } });
  await prisma.orderTimelineEvent.deleteMany({ where: { order: { userId: user.id } } });
  await prisma.order.deleteMany({ where: { userId: user.id } });
  await prisma.productDevicePrice.deleteMany({ where: { productId: { in: [prodA.id, prodB.id] } } });
  await prisma.productVariant.deleteMany({ where: { productId: { in: [prodA.id, prodB.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [prodA.id, prodB.id] } } });
  await prisma.address.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('[CLEANUP] Cleaned test data.');

  console.log('\n============================================================');
  console.log(`SUMMARY: ${testPassedCount} PASSED, ${testFailedCount} FAILED.`);
  console.log('============================================================');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
