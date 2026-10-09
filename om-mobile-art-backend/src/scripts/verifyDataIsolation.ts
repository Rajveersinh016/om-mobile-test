import { PrismaClient } from '@prisma/client';
import { productService } from '../modules/catalog/services/productService';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DATA ISOLATION TEST START ===\n');

  // 1. Fetch Device Types
  const deviceTypes = await prisma.deviceType.findMany();
  const mobileDT = deviceTypes.find(d => d.name.toLowerCase() === 'mobile');
  const laptopDT = deviceTypes.find(d => d.name.toLowerCase() === 'laptop');
  const cameraDT = deviceTypes.find(d => d.name.toLowerCase() === 'camera');

  if (!mobileDT || !laptopDT || !cameraDT) {
    throw new Error('Required Device Types (Mobile, Laptop, Camera) not found in database');
  }

  // Helper category & product type
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Test Category', slug: `test-cat-iso-${Date.now()}` }
    });
  }

  let productType = await prisma.productType.findFirst();
  if (!productType) {
    productType = await prisma.productType.create({
      data: { name: 'Test Product Type', slug: `test-pt-iso-${Date.now()}` }
    });
  }

  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { email: `admin-iso-${Date.now()}@example.com`, passwordHash: 'hash', role: 'ADMIN' }
    });
  }

  // Pre-cleanup old test isolation products
  const oldTestProds = await prisma.product.findMany({ where: { slug: { startsWith: 'iso-prod-' } } });
  for (const p of oldTestProds) {
    await prisma.productDevicePrice.deleteMany({ where: { productId: p.id } });
    await prisma.productVariant.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  }

  const testImage = 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=600&auto=format&fit=crop';

  console.log('--- Step 1: Creating Products A, B, C ---');

  // Product A: Mobile ₹300, Laptop ₹500, Camera ₹700
  const prodA = await productService.createProduct(adminUser.id, {
    name: 'ISO Product A',
    slug: `iso-prod-a-${Date.now()}`,
    description: 'Test isolation A',
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
    variants: [{ sku: `SKU-ISO-A-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });

  // Product B: Mobile ₹350, Laptop ₹600, Camera ₹800
  const prodB = await productService.createProduct(adminUser.id, {
    name: 'ISO Product B',
    slug: `iso-prod-b-${Date.now()}`,
    description: 'Test isolation B',
    image: testImage,
    price: 350,
    originalPrice: 350,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id, laptopDT.id, cameraDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 350 },
      { deviceTypeId: laptopDT.id, price: 600 },
      { deviceTypeId: cameraDT.id, price: 800 }
    ],
    variants: [{ sku: `SKU-ISO-B-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });

  // Product C: Mobile ₹400, Laptop ₹650
  const prodC = await productService.createProduct(adminUser.id, {
    name: 'ISO Product C',
    slug: `iso-prod-c-${Date.now()}`,
    description: 'Test isolation C',
    image: testImage,
    price: 400,
    originalPrice: 400,
    categoryId: category.id,
    productTypeId: productType.id,
    deviceTypeIds: [mobileDT.id, laptopDT.id],
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 400 },
      { deviceTypeId: laptopDT.id, price: 650 }
    ],
    variants: [{ sku: `SKU-ISO-C-${Date.now()}`, finish: 'Matte', material: 'Standard 3M', stockQuantity: 50 }]
  });

  console.log(`Created Prod A: ${prodA.name} (${prodA.id})`);
  console.log(`Created Prod B: ${prodB.name} (${prodB.id})`);
  console.log(`Created Prod C: ${prodC.name} (${prodC.id})\n`);

  // Helper to fetch prices as a map { 'mobile': price, 'laptop': price, ... }
  async function getPriceMap(productId: string) {
    const dps = await prisma.productDevicePrice.findMany({
      where: { productId },
      include: { deviceType: true }
    });
    const map: Record<string, number> = {};
    dps.forEach(dp => {
      map[dp.deviceType.name.toLowerCase()] = Number(dp.price);
    });
    return map;
  }

  // Initial Verification
  let mapA = await getPriceMap(prodA.id);
  let mapB = await getPriceMap(prodB.id);
  let mapC = await getPriceMap(prodC.id);

  console.log('Initial Prices:');
  console.log(' Product A:', mapA);
  console.log(' Product B:', mapB);
  console.log(' Product C:', mapC, '\n');

  // --- Step 2: Edit Product A ---
  console.log('--- Step 2: Editing Product A (Mobile -> 999, Laptop -> 888, Camera -> 777) ---');
  await productService.updateProduct(adminUser.id, prodA.id, {
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 999 },
      { deviceTypeId: laptopDT.id, price: 888 },
      { deviceTypeId: cameraDT.id, price: 777 }
    ]
  });

  mapA = await getPriceMap(prodA.id);
  mapB = await getPriceMap(prodB.id);
  mapC = await getPriceMap(prodC.id);

  console.log('After updating Product A:');
  console.log(' Product A:', mapA);
  console.log(' Product B:', mapB);
  console.log(' Product C:', mapC);

  if (mapA.mobile !== 999 || mapA.laptop !== 888 || mapA.camera !== 777) {
    throw new Error('Product A failed to update its device prices correctly!');
  }
  if (mapB.mobile !== 350 || mapB.laptop !== 600 || mapB.camera !== 800) {
    throw new Error('ISOLATION FAILURE: Updating Product A corrupted Product B prices!');
  }
  if (mapC.mobile !== 400 || mapC.laptop !== 650) {
    throw new Error('ISOLATION FAILURE: Updating Product A corrupted Product C prices!');
  }
  console.log('✓ TEST 1 PASSED: Editing Product A left Products B and C 100% untouched!\n');

  // --- Step 3: Edit Product B ---
  console.log('--- Step 3: Editing Product B (Mobile -> 1111) ---');
  await productService.updateProduct(adminUser.id, prodB.id, {
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 1111 },
      { deviceTypeId: laptopDT.id, price: 600 },
      { deviceTypeId: cameraDT.id, price: 800 }
    ]
  });

  mapA = await getPriceMap(prodA.id);
  mapB = await getPriceMap(prodB.id);
  mapC = await getPriceMap(prodC.id);

  console.log('After updating Product B:');
  console.log(' Product A:', mapA);
  console.log(' Product B:', mapB);
  console.log(' Product C:', mapC);

  if (mapA.mobile !== 999) throw new Error('ISOLATION FAILURE: Product A changed when updating Product B!');
  if (mapB.mobile !== 1111) throw new Error('Product B failed to update mobile price to 1111');
  if (mapC.mobile !== 400) throw new Error('ISOLATION FAILURE: Product C changed when updating Product B!');
  console.log('✓ TEST 2 PASSED: Editing Product B left Products A and C 100% untouched!\n');

  // --- Step 4: Remove Camera Compatibility from Product A ---
  console.log('--- Step 4: Removing Camera Compatibility from Product A ---');
  await productService.updateProduct(adminUser.id, prodA.id, {
    devicePrices: [
      { deviceTypeId: mobileDT.id, price: 999 },
      { deviceTypeId: laptopDT.id, price: 888 }
    ]
  });

  mapA = await getPriceMap(prodA.id);
  mapB = await getPriceMap(prodB.id);
  mapC = await getPriceMap(prodC.id);

  console.log('After removing Camera from Product A:');
  console.log(' Product A:', mapA);
  console.log(' Product B:', mapB);
  console.log(' Product C:', mapC);

  if (mapA.camera !== undefined) throw new Error('Camera price was not removed from Product A!');
  if (mapB.camera !== 800) throw new Error('ISOLATION FAILURE: Removing Camera from Product A deleted Product B camera price!');
  console.log('✓ TEST 3 PASSED: Removing Camera from Product A left Product B camera price intact!\n');

  // --- Cleanup ---
  console.log('--- Cleaning Up Test Data ---');
  const ids = [prodA.id, prodB.id, prodC.id];
  for (const id of ids) {
    await prisma.productDevicePrice.deleteMany({ where: { productId: id } });
    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  }
  console.log('Cleanup complete.');

  console.log('\n=== ALL DATA ISOLATION TESTS PASSED SUCCESSFULLY! ===');
}

main()
  .catch((err) => {
    console.error('\n❌ DATA ISOLATION TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
