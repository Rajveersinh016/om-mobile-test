import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const prisma = new PrismaClient({ log: ['error'] });

async function run() {
  console.log('=== TESTING CAMERA TEST PRODUCT CHECKOUT PRICING & RAZORPAY AMOUNT ===\n');

  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' }
  });

  if (!user) throw new Error('No user found');

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const product = await prisma.product.findFirst({
    where: { name: 'camera test' },
    include: {
      variants: true,
      devicePrices: { include: { deviceType: true } },
      models: { include: { brand: { include: { deviceType: true } } } }
    }
  });

  if (!product) throw new Error('Product "camera test" not found');

  console.log(`Product: "${product.name}"`);
  console.log(`Base Price: ₹${product.price}`);
  console.log(`Camera Device Price: ₹${product.devicePrices[0]?.price}`);

  const payload = {
    shippingAddress: {
      fullName: 'Test Customer',
      phone: '9876543210',
      addressLine1: '123 Test Street',
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
        deviceTypeId: product.devicePrices[0].deviceTypeId,
        deviceType: 'Camera',
        modelId: product.models[0]?.id,
        customModelName: product.models[0]?.name,
        quantity: 1,
        finish: 'Matte',
        material: 'Standard 3M'
      }
    ]
  };

  const res = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  console.log(`Status: ${res.status}`);
  console.log('Snapshot:', {
    subtotal: json.data?.subtotal,
    shipping: json.data?.shipping,
    discount: json.data?.discount,
    total: json.data?.total,
    amountInPaise: json.data?.amount,
    razorpayOrderId: json.data?.razorpayOrderId
  });

  if (json.data?.subtotal !== 1299) {
    throw new Error(`Expected subtotal 1299, got ${json.data?.subtotal}`);
  }
  if (json.data?.shipping !== 0) {
    throw new Error(`Expected shipping 0 (FREE), got ${json.data?.shipping}`);
  }
  if (json.data?.total !== 1299) {
    throw new Error(`Expected total 1299, got ${json.data?.total}`);
  }
  if (json.data?.amount !== 129900) {
    throw new Error(`Expected Razorpay amount 129900 paise (₹1299), got ${json.data?.amount}`);
  }

  console.log('\n SUCCESS: Cart Subtotal (₹1299) == Checkout Total (₹1299) == Razorpay Amount (₹1299)! No ₹50 added!');
}

run()
  .catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
