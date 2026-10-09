import { PrismaClient } from '@prisma/client';
import { ProductService } from '../services/productService';
import { SearchService } from '../services/searchService';
import { CartService } from '../services/cartService';
import { CheckoutService } from '../services/checkoutService';
import { ProductRepository } from '../repositories/productRepository';
import { CartRepository } from '../repositories/cartRepository';

const prisma = new PrismaClient();
const productRepository = new ProductRepository(prisma);
const productService = new ProductService(productRepository);
const searchService = new SearchService(productRepository);
const cartRepository = new CartRepository(prisma);
const cartService = new CartService(cartRepository, productRepository);
const checkoutService = new CheckoutService(prisma, cartRepository);

async function main() {
  console.log('=== PHASE 9 QA VERIFICATION START ===\n');

  // 1. Fetch Device Types
  const mobileDT = await prisma.deviceType.findFirst({ where: { name: { equals: 'Mobile', mode: 'insensitive' } } });
  const laptopDT = await prisma.deviceType.findFirst({ where: { name: { equals: 'Laptop', mode: 'insensitive' } } });
  const cameraDT = await prisma.deviceType.findFirst({ where: { name: { equals: 'Camera', mode: 'insensitive' } } });

  if (!mobileDT || !laptopDT || !cameraDT) {
    throw new Error('Required Device Types (Mobile, Laptop, Camera) not found in database');
  }

  console.log('Device Types verified:');
  console.log(` - Mobile ID: ${mobileDT.id}`);
  console.log(` - Laptop ID: ${laptopDT.id}`);
  console.log(` - Camera ID: ${cameraDT.id}\n`);

  // Fetch or create a default category & product type for testing
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Test Category', slug: 'test-category' }
    });
  }

  let productType = await prisma.productType.findFirst();
  if (!productType) {
    productType = await prisma.productType.create({
      data: { name: 'Test Product Type', slug: 'test-product-type' }
    });
  }

  // 2. Create Test Products A - F
  console.log('--- Creating Test Products A - F ---');

  // A: Mobile Only (₹300)
  const prodA = await productService.createProduct({
    name: 'Test Product A (Mobile Only)',
    slug: `test-prod-a-${Date.now()}`,
    description: 'Test product for QA',
    price: 300,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 300 }
    ],
    variants: [{ sku: `SKU-A-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod A: ${prodA.name} [ID: ${prodA.id}]`);

  // B: Laptop Only (₹500)
  const prodB = await productService.createProduct({
    name: 'Test Product B (Laptop Only)',
    slug: `test-prod-b-${Date.now()}`,
    description: 'Test product for QA',
    price: 500,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [laptopDT.id],
    devicePrices: [
      { deviceTypeId: laptopDT.id, price: 500 }
    ],
    variants: [{ sku: `SKU-B-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod B: ${prodB.name} [ID: ${prodB.id}]`);

  // C: Camera Only (₹700)
  const prodC = await productService.createProduct({
    name: 'Test Product C (Camera Only)',
    slug: `test-prod-c-${Date.now()}`,
    description: 'Test product for QA',
    price: 700,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [cameraDT.id],
    devicePrices: [
      { deviceTypeId: cameraDT.id, price: 700 }
    ],
    variants: [{ sku: `SKU-C-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod C: ${prodC.name} [ID: ${prodC.id}]`);

  // D: Mobile (₹300) + Laptop (₹500)
  const prodD = await productService.createProduct({
    name: 'Test Product D (Mobile + Laptop)',
    slug: `test-prod-d-${Date.now()}`,
    description: 'Test product for QA',
    price: 300,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id, laptopDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 300 },
      { deviceTypeId: laptopDT.id, price: 500 }
    ],
    variants: [{ sku: `SKU-D-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod D: ${prodD.name} [ID: ${prodD.id}]`);

  // E: Mobile (₹350) + Camera (₹750)
  const prodE = await productService.createProduct({
    name: 'Test Product E (Mobile + Camera)',
    slug: `test-prod-e-${Date.now()}`,
    description: 'Test product for QA',
    price: 350,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id, cameraDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 350 },
      { deviceTypeId: cameraDT.id, price: 750 }
    ],
    variants: [{ sku: `SKU-E-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod E: ${prodE.name} [ID: ${prodE.id}]`);

  // F: Mobile (₹300) + Laptop (₹500) + Camera (₹700)
  const prodF = await productService.createProduct({
    name: 'Test Product F (Mobile + Laptop + Camera)',
    slug: `test-prod-f-${Date.now()}`,
    description: 'Test product for QA',
    price: 300,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id, laptopDT.id, cameraDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 300 },
      { deviceTypeId: laptopDT.id, price: 500 },
      { deviceTypeId: cameraDT.id, price: 700 }
    ],
    variants: [{ sku: `SKU-F-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });
  console.log(`Created Prod F: ${prodF.name} [ID: ${prodF.id}]\n`);

  // 3. Verify Shop Filters
  console.log('--- Testing Shop Device Filtering ---');

  const testIds = [prodA.id, prodB.id, prodC.id, prodD.id, prodE.id, prodF.id];

  // ALL Filter
  const allRes = await searchService.searchProducts({ limit: 100 });
  const allMatchIds = allRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`ALL Filter returns ${allMatchIds.length}/6 test products (Expected: 6)`);
  if (allMatchIds.length !== 6) throw new Error('ALL filter failed to return all 6 products');

  // MOBILE Filter
  const mobileRes = await searchService.searchProducts({ deviceType: 'mobile', limit: 100 });
  const mobileMatchIds = mobileRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`MOBILE Filter returns ${mobileMatchIds.length} test products (Expected: 4 -> A, D, E, F)`);
  if (mobileMatchIds.length !== 4 || !mobileMatchIds.includes(prodA.id) || !mobileMatchIds.includes(prodD.id) || !mobileMatchIds.includes(prodE.id) || !mobileMatchIds.includes(prodF.id)) {
    throw new Error('MOBILE filter failed product set check');
  }

  // LAPTOP Filter
  const laptopRes = await searchService.searchProducts({ deviceType: 'laptop', limit: 100 });
  const laptopMatchIds = laptopRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`LAPTOP Filter returns ${laptopMatchIds.length} test products (Expected: 3 -> B, D, F)`);
  if (laptopMatchIds.length !== 3 || !laptopMatchIds.includes(prodB.id) || !laptopMatchIds.includes(prodD.id) || !laptopMatchIds.includes(prodF.id)) {
    throw new Error('LAPTOP filter failed product set check');
  }

  // CAMERA Filter
  const cameraRes = await searchService.searchProducts({ deviceType: 'camera', limit: 100 });
  const cameraMatchIds = cameraRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`CAMERA Filter returns ${cameraMatchIds.length} test products (Expected: 3 -> C, E, F)`);
  if (cameraMatchIds.length !== 3 || !cameraMatchIds.includes(prodC.id) || !cameraMatchIds.includes(prodE.id) || !cameraMatchIds.includes(prodF.id)) {
    throw new Error('CAMERA filter failed product set check');
  }

  console.log('✓ All Shop Device Filters Verified Successfully!\n');

  // 4. Test Cart & Multi-device Separate Cart Lines
  console.log('--- Testing Cart Engine & Device-Specific Line Items ---');
  let testUser = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: { email: `testuser-${Date.now()}@example.com`, passwordHash: 'hash', role: 'CUSTOMER' }
    });
  }

  const variantD = prodD.variants[0];

  // Add Product D as Mobile line to Cart
  const cartItemMobile = await cartService.addItem(testUser.id, {
    productId: prodD.id,
    productVariantId: variantD.id,
    deviceTypeId: mobileDT.id,
    quantity: 1
  });
  console.log(`Added Prod D as Mobile to Cart [Unit Price calculated: ₹${cartItemMobile.unitPrice}] (Expected: ₹300)`);
  if (Number(cartItemMobile.unitPrice) !== 300) throw new Error('Cart unit price mismatch for Mobile line');

  // Add Product D as Laptop line to Cart
  const cartItemLaptop = await cartService.addItem(testUser.id, {
    productId: prodD.id,
    productVariantId: variantD.id,
    deviceTypeId: laptopDT.id,
    quantity: 1
  });
  console.log(`Added Prod D as Laptop to Cart [Unit Price calculated: ₹${cartItemLaptop.unitPrice}] (Expected: ₹500)`);
  if (Number(cartItemLaptop.unitPrice) !== 500) throw new Error('Cart unit price mismatch for Laptop line');

  // Verify Cart has 2 distinct line items for Product D
  const cart = await cartService.getCart(testUser.id);
  const prodDItems = cart.items.filter(i => i.productId === prodD.id);
  console.log(`Cart contains ${prodDItems.length} separate lines for Product D (Expected: 2)`);
  if (prodDItems.length !== 2) throw new Error('Cart failed to store separate lines for different device types');

  // Verify Cart Subtotal
  console.log(`Cart Subtotal: ₹${cart.subtotal} (Expected: ₹800 [300 + 500])`);
  if (Number(cart.subtotal) !== 800) throw new Error('Cart subtotal calculation incorrect');

  console.log('✓ Cart Engine & Multi-device Line Separation Verified Successfully!\n');

  // 5. Test Checkout & Order Historical Price Snapshotting
  console.log('--- Testing Checkout & Order Historical Price Snapshotting ---');

  const checkoutSummary = await checkoutService.getCheckoutSummary(testUser.id);
  console.log(`Checkout Total: ₹${checkoutSummary.totalAmount} (Expected: ₹800)`);

  const order = await checkoutService.createCheckoutOrder(testUser.id, {
    shippingAddress: {
      fullName: 'QA Tester',
      streetAddress: '123 Test St',
      city: 'Surat',
      state: 'Gujarat',
      postalCode: '395006',
      country: 'India',
      phone: '9876543210'
    },
    paymentMethod: 'COD'
  });

  console.log(`Order Created! Order Number: ${order.orderNumber}`);
  console.log(`Order Items Count: ${order.items.length}`);
  order.items.forEach((item, idx) => {
    console.log(` Item ${idx + 1}: ${item.productName} | DeviceType: ${item.deviceType || 'N/A'} | Price: ₹${item.unitPrice}`);
  });

  // Now, edit Product D's price for Mobile to ₹400 in database
  console.log('\nMutating Product D Mobile price in database to ₹400...');
  await productService.updateProduct(prodD.id, {
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 400 },
      { deviceTypeId: laptopDT.id, price: 500 }
    ]
  });

  // Verify historical order line item price remains ₹300
  const historicalOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true }
  });

  const mobileOrderItem = historicalOrder?.items.find(i => i.deviceType?.toLowerCase() === 'mobile');
  console.log(`Historical Order Item Price for Mobile line: ₹${mobileOrderItem?.unitPrice} (Expected: ₹300 despite product price update)`);
  if (Number(mobileOrderItem?.unitPrice) !== 300) {
    throw new Error('Historical order price snapshot was corrupted by subsequent product price change!');
  }

  console.log('✓ Historical Order Price Snapshotting Verified Successfully!\n');

  // Clean up test products
  console.log('--- Cleaning Up Test Data ---');
  for (const id of testIds) {
    await prisma.productDevicePrice.deleteMany({ where: { productId: id } });
    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  }
  console.log('Test data cleaned up successfully.');

  console.log('\n=== ALL PHASE 9 QA VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

main()
  .catch((err) => {
    console.error('\n❌ PHASE 9 QA VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
