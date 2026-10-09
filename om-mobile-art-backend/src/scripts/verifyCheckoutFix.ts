import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const prisma = new PrismaClient({ log: ['error'] });

async function runVerification() {
  console.log('=== RUNNING VERIFICATION FOR CHECKOUT PREPARE & RAZORPAY FLOW ===\n');

  // 1. Find a customer user
  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' }
  });

  if (!user) {
    throw new Error('No active customer user found');
  }

  console.log(`Using customer: ${user.email} (${user.id})`);

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 2. Find "Test Product A (All Devices)" or a product with device pricing
  const productA = await prisma.product.findFirst({
    where: { name: { contains: 'Test Product A' } },
    include: { variants: true, devicePrices: { include: { deviceType: true } } }
  });

  if (!productA) {
    throw new Error('Test Product A not found');
  }

  console.log(`Found Product: "${productA.name}" (ID: ${productA.id})`);
  console.log(`Device prices:`, productA.devicePrices.map(dp => `${dp.deviceType.name}: ₹${dp.price}`));

  const cameraPrice = productA.devicePrices.find(dp => dp.deviceType.name.toLowerCase() === 'camera');
  if (!cameraPrice) {
    throw new Error('Camera price not found for Test Product A');
  }

  // 3. Test checkout prepare with cartItems specifying Camera device
  console.log('\n--- Test 1: POST /checkout/prepare with Camera device item (price should be authoritative ₹' + cameraPrice.price + ') ---');
  const payload1 = {
    shippingAddress: {
      fullName: 'John Doe',
      phone: '9876543210',
      addressLine1: '42 MG Road',
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India'
    },
    paymentMethod: 'ONLINE',
    gateway: 'RAZORPAY',
    cartItems: [
      {
        id: productA.id,
        productId: productA.id,
        productVariantId: productA.variants[0].id,
        deviceTypeId: cameraPrice.deviceTypeId,
        deviceType: 'Camera',
        customModelName: 'Canon EOS R5',
        quantity: 1,
        finish: productA.variants[0].finish,
        material: productA.variants[0].material
      }
    ]
  };

  const res1 = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload1)
  });

  const json1 = await res1.json();
  console.log(`Response status: ${res1.status} ${res1.statusText}`);
  if (!res1.ok || !json1.success) {
    console.error('Test 1 FAILED:', JSON.stringify(json1, null, 2));
    throw new Error(`Test 1 Failed: ${json1.message || json1.error?.message}`);
  }

  console.log('Test 1 PASSED!');
  console.log('Snapshot Subtotal:', json1.data.subtotal);
  console.log('Snapshot Total:', json1.data.total);
  console.log('Snapshot Amount (paise):', json1.data.amount);
  console.log('Razorpay Order ID:', json1.data.razorpayOrderId);
  console.log('Razorpay Key ID:', json1.data.keyId);

  if (json1.data.subtotal !== Number(cameraPrice.price)) {
    throw new Error(`Expected subtotal ₹${cameraPrice.price}, got ₹${json1.data.subtotal}`);
  }

  // 4. Test Out-Of-Stock error handling
  console.log('\n--- Test 2: Out of Stock validation message ---');
  // Temporarily set variant stock to 0
  const originalStock = productA.variants[0].stockQuantity;
  await prisma.productVariant.update({
    where: { id: productA.variants[0].id },
    data: { stockQuantity: 0 }
  });

  try {
    const res2 = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload1)
    });

    const json2 = await res2.json();
    console.log(`Response status: ${res2.status} ${res2.statusText}`);
    console.log('Response JSON message:', json2.message);
    console.log('Response JSON error:', json2.error);

    if (res2.status !== 400) {
      throw new Error(`Expected status 400 for out of stock, got ${res2.status}`);
    }
    if (!json2.message || !json2.message.includes('out of stock')) {
      throw new Error(`Expected message to mention 'out of stock', got: ${json2.message}`);
    }
    console.log('Test 2 PASSED: Descriptive out of stock error returned correctly.');
  } finally {
    // Restore original stock
    await prisma.productVariant.update({
      where: { id: productA.variants[0].id },
      data: { stockQuantity: originalStock }
    });
  }

  // 5. Test 3: Verify user cart in DB after prepare
  console.log('\n--- Test 3: Verify DB cart reconciliation ---');
  const userCart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: { items: { include: { variant: { include: { product: true } } } } }
  });
  console.log(`DB cart item count: ${userCart?.items.length}`);
  for (const item of userCart?.items || []) {
    console.log(`  - ${item.variant.product.name} | qty: ${item.quantity} | deviceTypeId: ${item.deviceTypeId}`);
  }

  if (!userCart || userCart.items.length !== 1 || userCart.items[0].deviceTypeId !== cameraPrice.deviceTypeId) {
    throw new Error('DB cart was not properly reconciled with client cart items');
  }
  console.log('Test 3 PASSED: DB cart properly reconciled with client cart items.');

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

runVerification()
  .catch(err => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
