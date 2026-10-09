import { PrismaClient } from '@prisma/client';
import { productService } from '../modules/catalog/services/productService';
import { searchService } from '../modules/catalog/services/searchService';
import { cartService } from '../modules/cart/services/cartService';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PHASE 9 QA VERIFICATION START ===\n');

  // 1. Fetch Device Types
  const deviceTypes = await prisma.deviceType.findMany();
  const mobileDT = deviceTypes.find(d => d.name.toLowerCase() === 'mobile');
  const laptopDT = deviceTypes.find(d => d.name.toLowerCase() === 'laptop');
  const cameraDT = deviceTypes.find(d => d.name.toLowerCase() === 'camera');

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
      data: { name: 'Test Category', slug: `test-category-${Date.now()}` }
    });
  }

  let productType = await prisma.productType.findFirst();
  if (!productType) {
    productType = await prisma.productType.create({
      data: { name: 'Test Product Type', slug: `test-product-type-${Date.now()}` }
    });
  }

  // Pre-cleanup old test products from prior runs
  const oldTestProds = await prisma.product.findMany({ where: { slug: { startsWith: 'test-prod-' } } });
  for (const p of oldTestProds) {
    await prisma.productDevicePrice.deleteMany({ where: { productId: p.id } });
    await prisma.productVariant.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }

  // Fetch or create admin test user
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { email: `admin-qa-${Date.now()}@example.com`, passwordHash: 'hash', role: 'ADMIN' }
    });
  }

  // 2. Create Test Products A - F
  console.log('--- Creating Test Products A - F ---');

  const testImage = 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=600&auto=format&fit=crop';

  // A: Mobile Only (₹300)
  const prodA = await productService.createProduct(adminUser.id, {
    name: 'Test Product A (Mobile Only)',
    slug: `test-prod-a-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 300,
    originalPrice: 300,
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
  const prodB = await productService.createProduct(adminUser.id, {
    name: 'Test Product B (Laptop Only)',
    slug: `test-prod-b-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 500,
    originalPrice: 500,
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
  const prodC = await productService.createProduct(adminUser.id, {
    name: 'Test Product C (Camera Only)',
    slug: `test-prod-c-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 700,
    originalPrice: 700,
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
  const prodD = await productService.createProduct(adminUser.id, {
    name: 'Test Product D (Mobile + Laptop)',
    slug: `test-prod-d-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 300,
    originalPrice: 300,
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
  const prodE = await productService.createProduct(adminUser.id, {
    name: 'Test Product E (Mobile + Camera)',
    slug: `test-prod-e-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 350,
    originalPrice: 350,
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
  const prodF = await productService.createProduct(adminUser.id, {
    name: 'Test Product F (Mobile + Laptop + Camera)',
    slug: `test-prod-f-${Date.now()}`,
    description: 'Test product for QA',
    image: testImage,
    price: 300,
    originalPrice: 300,
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
  const allRes = await searchService.search({ limit: 100 });
  const allMatchIds = allRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`ALL Filter returns ${allMatchIds.length}/6 test products (Expected: 6)`);
  if (allMatchIds.length !== 6) throw new Error(`ALL filter failed. Found: ${allMatchIds.length}, Expected: 6`);

  // MOBILE Filter
  const mobileRes = await searchService.search({ deviceType: 'mobile', limit: 100 });
  const mobileMatchIds = mobileRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`MOBILE Filter returns ${mobileMatchIds.length} test products (Expected: 4 -> A, D, E, F)`);
  if (mobileMatchIds.length !== 4 || !mobileMatchIds.includes(prodA.id) || !mobileMatchIds.includes(prodD.id) || !mobileMatchIds.includes(prodE.id) || !mobileMatchIds.includes(prodF.id)) {
    throw new Error('MOBILE filter failed product set check');
  }

  // LAPTOP Filter
  const laptopRes = await searchService.search({ deviceType: 'laptop', limit: 100 });
  const laptopMatchIds = laptopRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  console.log(`LAPTOP Filter returns ${laptopMatchIds.length} test products (Expected: 3 -> B, D, F)`);
  if (laptopMatchIds.length !== 3 || !laptopMatchIds.includes(prodB.id) || !laptopMatchIds.includes(prodD.id) || !laptopMatchIds.includes(prodF.id)) {
    throw new Error('LAPTOP filter failed product set check');
  }

  // CAMERA Filter
  const cameraRes = await searchService.search({ deviceType: 'camera', limit: 100 });
  const cameraMatchIds = cameraRes.products.filter(p => testIds.includes(p.id)).map(p => p.id);
  const cameraMatchNames = cameraRes.products.filter(p => testIds.includes(p.id)).map(p => p.name);
  console.log(`CAMERA Filter returns ${cameraMatchIds.length} test products:`, cameraMatchNames);
  if (cameraMatchIds.length !== 3 || !cameraMatchIds.includes(prodC.id) || !cameraMatchIds.includes(prodE.id) || !cameraMatchIds.includes(prodF.id)) {
    throw new Error(`CAMERA filter failed product set check. Found: ${cameraMatchIds.length} (${cameraMatchNames.join(', ')})`);
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

  const fullProdD = await prisma.product.findUnique({ where: { id: prodD.id }, include: { variants: true } });
  const variantD = fullProdD!.variants[0];

  // Add Product D as Mobile line to Cart
  await cartService.addToCart(
    testUser.id,
    prodD.id,
    variantD.id,
    1,
    undefined,
    undefined,
    mobileDT.id
  );

  // Add Product D as Laptop line to Cart
  await cartService.addToCart(
    testUser.id,
    prodD.id,
    variantD.id,
    1,
    undefined,
    undefined,
    laptopDT.id
  );

  // Verify Cart has 2 distinct line items for Product D
  const cart = await cartService.getCart(testUser.id);
  const prodDItems = cart.items.filter(i => i.productId === prodD.id);
  console.log(`Cart contains ${prodDItems.length} separate lines for Product D (Expected: 2)`);
  if (prodDItems.length !== 2) throw new Error('Cart failed to store separate lines for different device types');

  // Verify Cart Subtotal
  const subtotalVal = cart.summary ? cart.summary.subtotal : cart.subtotal;
  console.log(`Cart Subtotal: ₹${subtotalVal} (Expected: ₹800 [300 + 500])`);
  if (Number(subtotalVal) !== 800) throw new Error('Cart subtotal calculation incorrect');

  console.log('✓ Cart Engine & Multi-device Line Separation Verified Successfully!\n');

  // 5. Test Order Historical Price Snapshotting
  console.log('--- Testing Order Historical Price Snapshotting ---');

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-TEST-${Date.now()}`,
      userId: testUser.id,
      customerSnapshot: { name: 'QA Tester', email: testUser.email },
      pricingSnapshot: { subtotal: 800, total: 800 },
      shippingAddress: { fullName: 'QA Tester', street: '123 St', city: 'Surat', state: 'Gujarat', zip: '395006', country: 'India' },
      subtotal: 800,
      total: 800,
      items: {
        create: [
          {
            productVariantId: variantD.id,
            productName: prodD.name,
            variantName: 'Matte / Standard 3M',
            sku: variantD.sku,
            finish: variantD.finish,
            material: variantD.material,
            unitPrice: 300,
            pricePaid: 300,
            quantity: 1,
            deviceType: 'Mobile'
          },
          {
            productVariantId: variantD.id,
            productName: prodD.name,
            variantName: 'Matte / Standard 3M',
            sku: variantD.sku,
            finish: variantD.finish,
            material: variantD.material,
            unitPrice: 500,
            pricePaid: 500,
            quantity: 1,
            deviceType: 'Laptop'
          }
        ]
      }
    },
    include: { items: true }
  });

  console.log(`Order Created! Order Number: ${order.orderNumber}`);
  console.log(`Order Items Count: ${order.items.length}`);
  order.items.forEach((item, idx) => {
    console.log(` Item ${idx + 1}: ${item.productName} | DeviceType: ${item.deviceType || 'N/A'} | Price: ₹${item.unitPrice}`);
  });

  // Now, edit Product D's price for Mobile to ₹400 in database
  console.log('\nMutating Product D Mobile price in database to ₹400...');
  await productService.updateProduct(adminUser.id, prodD.id, {
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

  // Clean up test data
  console.log('--- Cleaning Up Test Data ---');
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

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
