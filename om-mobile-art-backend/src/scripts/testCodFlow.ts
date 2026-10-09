import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const prisma = new PrismaClient({ log: ['error'] });

async function testCodOrderFlow() {
  console.log('=== TEST COD ORDER CREATION FLOW ===\n');

  const user = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' }
  });
  if (!user) throw new Error('No test customer found');

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const product = await prisma.product.findFirst({
    where: { name: 'camera test' },
    include: {
      variants: { include: { inventory: true } },
      devicePrices: { include: { deviceType: true } },
      models: { include: { brand: { include: { deviceType: true } } } }
    }
  });
  if (!product) throw new Error('Product "camera test" not found');

  const initialStock = product.variants[0]?.inventory?.quantity ?? 0;

  const payload = {
    shippingAddress: {
      fullName: 'COD Test Customer',
      phone: '9876543210',
      addressLine1: '789 COD Boulevard',
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India'
    },
    paymentMethod: 'COD',
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

  console.log('[1] Calling POST /api/v1/checkout/prepare with paymentMethod: "COD"...');
  const res = await fetch('http://localhost:3000/api/v1/checkout/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`COD order creation failed: ${JSON.stringify(data)}`);
  }

  const codOrder = data.data;
  console.log('✓ COD Order Created:', {
    orderId: codOrder.id,
    orderNumber: codOrder.orderNumber,
    status: codOrder.status,
    paymentStatus: codOrder.paymentStatus,
    subtotal: codOrder.subtotal,
    shippingFee: codOrder.shippingFee,
    total: codOrder.total
  });

  if (codOrder.paymentStatus !== 'PENDING') throw new Error(`Expected paymentStatus PENDING, got ${codOrder.paymentStatus}`);
  if (codOrder.shippingFee !== 0) throw new Error(`Expected shippingFee 0, got ${codOrder.shippingFee}`);
  if (codOrder.total !== 1299) throw new Error(`Expected total 1299, got ${codOrder.total}`);

  // Check that no Razorpay order was created for COD
  if (codOrder.razorpayOrderId) {
    throw new Error(`COD should NOT have a Razorpay order ID! Got: ${codOrder.razorpayOrderId}`);
  }

  console.log('\n🎉 COD Order verified: Correct Total ₹1299, Shipping ₹0, No Razorpay order, Payment Status PENDING!');
}

testCodOrderFlow()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
