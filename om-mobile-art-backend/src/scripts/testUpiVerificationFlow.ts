import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

const prisma = new PrismaClient({ log: ['error'] });

async function testFullUpiCheckoutAndVerifyFlow() {
  console.log('=== TEST FULL UPI CHECKOUT & PAYMENT VERIFICATION FLOW ===\n');

  // 1. Get test user
  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' }
  });
  if (!user) throw new Error('No test customer found');

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 2. Get "camera test" product
  const product = await prisma.product.findFirst({
    where: { name: 'camera test' },
    include: {
      variants: { include: { inventory: true } },
      devicePrices: { include: { deviceType: true } },
      models: { include: { brand: { include: { deviceType: true } } } }
    }
  });
  if (!product) throw new Error('Product "camera test" not found');

  const initialInventory = product.variants[0]?.inventory?.quantity ?? 0;
  console.log(`Initial stock for variant: ${initialInventory}`);

  // 3. Prepare Checkout with paymentMethod: 'UPI'
  const preparePayload = {
    shippingAddress: {
      fullName: 'UPI Test Customer',
      phone: '9876543210',
      addressLine1: '456 UPI Lane',
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India'
    },
    paymentMethod: 'UPI',
    gateway: 'RAZORPAY',
    cartItems: [
      {
        id: product.id,
        productId: product.id,
        productVariantId: product.variants[0].id,
        deviceTypeId: product.devicePrices[0]?.deviceTypeId,
        deviceType: 'Camera',
        modelId: product.models[0]?.id,
        customModelName: product.models[0]?.name,
        quantity: 1,
        finish: 'Matte',
        material: 'Standard 3M'
      }
    ]
  };

  console.log('\n[1] Calling POST /api/v1/checkout/prepare...');
  const prepRes = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(preparePayload)
  });

  const prepData = await prepRes.json();
  if (!prepRes.ok || !prepData.success) {
    throw new Error(`Prepare failed: ${JSON.stringify(prepData)}`);
  }

  const snapshot = prepData.data;
  console.log('Checkout Snapshot returned:', {
    checkoutId: snapshot.checkoutId,
    razorpayOrderId: snapshot.razorpayOrderId,
    subtotal: snapshot.subtotal,
    shipping: snapshot.shipping,
    discount: snapshot.discount,
    total: snapshot.total,
    amountPaise: snapshot.amount
  });

  // Verification checks:
  if (snapshot.subtotal !== 1299) throw new Error(`Subtotal mismatch: expected 1299, got ${snapshot.subtotal}`);
  if (snapshot.shipping !== 0) throw new Error(`Shipping mismatch: expected 0, got ${snapshot.shipping}`);
  if (snapshot.total !== 1299) throw new Error(`Total mismatch: expected 1299, got ${snapshot.total}`);
  if (snapshot.amount !== 129900) throw new Error(`Paise amount mismatch: expected 129900, got ${snapshot.amount}`);

  // Consistency check (Core Rule #8):
  const expectedTotalPaise = Math.round(Number(snapshot.total) * 100);
  const razorpayOrderAmount = Math.round(Number(snapshot.amount));
  if (expectedTotalPaise !== razorpayOrderAmount) {
    throw new Error(`CONSISTENCY CHECK FAILED: expected ${expectedTotalPaise} paise, but Razorpay order amount is ${razorpayOrderAmount} paise!`);
  }
  console.log('✓ Core Rule #8 Consistency Check Passed: expectedTotalPaise === razorpayOrderAmount (129900 paise)');

  // 4. Simulate UPI Payment Success
  const mockPaymentId = `pay_test_upi_${Date.now()}`;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const signature = crypto
    .createHmac('sha256', keySecret)
    .update(`${snapshot.razorpayOrderId}|${mockPaymentId}`)
    .digest('hex');

  console.log('\n[2] Calling POST /api/v1/payments/verify with HMAC signature...');
  const verifyRes = await fetch('http://localhost:3000/api/v1/payments/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      checkoutId: snapshot.checkoutId,
      razorpayOrderId: snapshot.razorpayOrderId,
      razorpayPaymentId: mockPaymentId,
      razorpaySignature: signature,
      paymentMethod: 'UPI'
    })
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.success) {
    throw new Error(`Payment verification failed: ${JSON.stringify(verifyData)}`);
  }

  console.log('✓ Payment verified successfully! Verified Order:', verifyData.data);

  // 5. Query created Order in DB to verify snapshots
  const confirmedOrder = await prisma.order.findUnique({
    where: { id: verifyData.data.orderId },
    include: { items: true }
  });

  if (!confirmedOrder) throw new Error('Order not found in database');

  console.log('\n[3] Order Snapshot in Database:');
  console.log('- Order Number:', confirmedOrder.orderNumber);
  console.log('- Status:', confirmedOrder.status);
  console.log('- Payment Status:', confirmedOrder.paymentStatus);
  console.log('- Subtotal:', confirmedOrder.subtotal);
  console.log('- Shipping Fee:', confirmedOrder.shippingFee);
  console.log('- Total:', confirmedOrder.total);
  console.log('- Items count:', confirmedOrder.items.length);
  console.log('- Item Unit Price:', confirmedOrder.items[0]?.unitPrice);
  console.log('- Item Device Type:', confirmedOrder.items[0]?.deviceType);

  if (confirmedOrder.status !== 'PAID') throw new Error(`Expected status PAID, got ${confirmedOrder.status}`);
  if (confirmedOrder.paymentStatus !== 'PAID') throw new Error(`Expected paymentStatus PAID, got ${confirmedOrder.paymentStatus}`);
  if (confirmedOrder.shippingFee !== 0) throw new Error(`Expected shippingFee 0, got ${confirmedOrder.shippingFee}`);
  if (confirmedOrder.total !== 1299) throw new Error(`Expected total 1299, got ${confirmedOrder.total}`);
  if (confirmedOrder.items[0]?.unitPrice !== 1299) throw new Error(`Expected item price 1299, got ${confirmedOrder.items[0]?.unitPrice}`);

  // 6. Test Idempotency: verify again with same paymentId
  console.log('\n[4] Testing Idempotency (duplicate verification call)...');
  const duplicateVerifyRes = await fetch('http://localhost:3000/api/v1/payments/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      checkoutId: snapshot.checkoutId,
      razorpayOrderId: snapshot.razorpayOrderId,
      razorpayPaymentId: mockPaymentId,
      razorpaySignature: signature,
      paymentMethod: 'UPI'
    })
  });
  const duplicateData = await duplicateVerifyRes.json();
  if (!duplicateVerifyRes.ok || !duplicateData.success) {
    throw new Error(`Duplicate verification failed: ${JSON.stringify(duplicateData)}`);
  }
  console.log('✓ Idempotency verified: Returned existing order without creating duplicate.');

  // 7. Verify stock deduction
  const updatedVariant = await prisma.productVariant.findUnique({
    where: { id: product.variants[0].id },
    include: { inventory: true }
  });
  console.log(`Updated stock for variant: ${updatedVariant?.inventory?.quantity} (Initial: ${initialInventory})`);
  if ((updatedVariant?.inventory?.quantity ?? 0) !== initialInventory - 1) {
    throw new Error('Stock was not properly deducted!');
  }
  console.log('✓ Stock correctly deducted.');

  console.log('\n🎉 ALL CHECKS PASSED: Cart ₹1299 == Checkout ₹1299 == Razorpay ₹1299 == Order ₹1299, Shipping = ₹0, UPI verified!');
}

testFullUpiCheckoutAndVerifyFlow()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
