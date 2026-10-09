import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const prisma = new PrismaClient({ log: ['error'] });

async function testPaidShippingFlow() {
  console.log('=== TEST PAID SHIPPING FLOW (SUBTOTAL < STORE THRESHOLD) ===\n');

  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' }
  });
  if (!user) throw new Error('No user found');

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const setting = await prisma.storeSetting.findFirst();
  const threshold = setting?.shippingFreeThreshold ?? 299;
  const flatRate = setting?.shippingFlatRate ?? 29;

  console.log(`Configured Store Shipping: Threshold = ₹${threshold}, Flat Rate = ₹${flatRate}`);

  // Find a product with price < threshold
  const lowPriceProduct = await prisma.product.findFirst({
    where: { price: { lt: threshold } },
    include: { variants: true }
  });

  if (!lowPriceProduct || !lowPriceProduct.variants[0]) {
    console.log(`No product found under ₹${threshold}`);
    return;
  }

  const unitPrice = lowPriceProduct.price;
  console.log(`Using product "${lowPriceProduct.name}" at price ₹${unitPrice}`);

  const payload = {
    shippingAddress: {
      fullName: 'Paid Shipping Test',
      phone: '9876543210',
      addressLine1: '123 Flat Rate Way',
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India'
    },
    paymentMethod: 'UPI',
    gateway: 'RAZORPAY',
    cartItems: [
      {
        id: lowPriceProduct.id,
        productId: lowPriceProduct.id,
        productVariantId: lowPriceProduct.variants[0].id,
        quantity: 1,
        finish: 'Matte',
        material: 'Standard 3M'
      }
    ]
  };

  const prepRes = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const prepData = await prepRes.json();
  if (!prepRes.ok || !prepData.success) {
    throw new Error(`Prepare failed: ${JSON.stringify(prepData)}`);
  }

  const snapshot = prepData.data;
  console.log('Paid Shipping Snapshot:', {
    subtotal: snapshot.subtotal,
    shipping: snapshot.shipping,
    discount: snapshot.discount,
    total: snapshot.total,
    amountPaise: snapshot.amount
  });

  const expectedShipping = flatRate;
  const expectedTotal = snapshot.subtotal + expectedShipping;
  const expectedPaise = expectedTotal * 100;

  if (snapshot.shipping !== expectedShipping) {
    throw new Error(`Expected shipping ${expectedShipping}, got ${snapshot.shipping}`);
  }
  if (snapshot.total !== expectedTotal) {
    throw new Error(`Expected total ${expectedTotal}, got ${snapshot.total}`);
  }
  if (snapshot.amount !== expectedPaise) {
    throw new Error(`Expected amount ${expectedPaise} paise, got ${snapshot.amount}`);
  }

  console.log(`\n✓ Paid shipping verified: Subtotal ₹${snapshot.subtotal} + Shipping ₹${snapshot.shipping} = Total ₹${snapshot.total} == Razorpay ${snapshot.amount} paise!`);
}

testPaidShippingFlow()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
