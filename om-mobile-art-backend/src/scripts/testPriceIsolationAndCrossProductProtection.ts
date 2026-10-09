import { prisma } from '../database/client.js';

async function runPriceIsolationTests() {
  console.log('============================================================');
  console.log('AUTOMATED SUITE: PRICE ISOLATION & E2E INTEGRITY TESTS');
  console.log('============================================================\n');

  // 1. Ensure Canonical Device Types exist
  const dtMobile = await prisma.deviceType.findUnique({ where: { slug: 'mobile' } });
  const dtLaptop = await prisma.deviceType.findUnique({ where: { slug: 'laptop' } });
  const dtCamera = await prisma.deviceType.findUnique({ where: { slug: 'camera' } });

  if (!dtMobile || !dtLaptop || !dtCamera) {
    throw new Error('Canonical device types must exist!');
  }

  // Find or create test Category
  let category = await prisma.category.findFirst({ where: { slug: 'test-category-iso' } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Test Category ISO', slug: 'test-category-iso' }
    });
  }

  console.log('--- TEST 1: PRODUCT PRICE ISOLATION (A=700, B=1200, C=1800) ---');

  const prodA = await prisma.product.create({
    data: {
      name: 'Isolation Product A',
      slug: `iso-prod-a-${Date.now()}`,
      description: 'Test A',
      price: 700,
      originalPrice: 700,
      image: 'https://example.com/a.jpg',
      categoryId: category.id,
      devicePrices: {
        create: [
          { deviceTypeId: dtMobile.id, price: 300 },
          { deviceTypeId: dtLaptop.id, price: 500 },
          { deviceTypeId: dtCamera.id, price: 700 },
        ]
      }
    },
    include: { devicePrices: true }
  });

  const prodB = await prisma.product.create({
    data: {
      name: 'Isolation Product B',
      slug: `iso-prod-b-${Date.now()}`,
      description: 'Test B',
      price: 1200,
      originalPrice: 1200,
      image: 'https://example.com/b.jpg',
      categoryId: category.id,
      devicePrices: {
        create: [
          { deviceTypeId: dtMobile.id, price: 450 },
          { deviceTypeId: dtLaptop.id, price: 800 },
          { deviceTypeId: dtCamera.id, price: 1200 },
        ]
      }
    },
    include: { devicePrices: true }
  });

  const prodC = await prisma.product.create({
    data: {
      name: 'Isolation Product C',
      slug: `iso-prod-c-${Date.now()}`,
      description: 'Test C',
      price: 1800,
      originalPrice: 1800,
      image: 'https://example.com/c.jpg',
      categoryId: category.id,
      devicePrices: {
        create: [
          { deviceTypeId: dtCamera.id, price: 1800 },
        ]
      }
    },
    include: { devicePrices: true }
  });

  console.log(`✓ Created Product A (Camera=₹700), Product B (Camera=₹1200), Product C (Camera=₹1800)`);

  // Edit Product A Camera price to 800 using composite unique upsert
  await prisma.productDevicePrice.update({
    where: {
      productId_deviceTypeId: {
        productId: prodA.id,
        deviceTypeId: dtCamera.id
      }
    },
    data: { price: 800 }
  });

  console.log(`✓ Updated Product A Camera price to ₹800`);

  // Verify Product B and Product C prices are untouched
  const priceA = await prisma.productDevicePrice.findUnique({
    where: { productId_deviceTypeId: { productId: prodA.id, deviceTypeId: dtCamera.id } }
  });
  const priceB = await prisma.productDevicePrice.findUnique({
    where: { productId_deviceTypeId: { productId: prodB.id, deviceTypeId: dtCamera.id } }
  });
  const priceC = await prisma.productDevicePrice.findUnique({
    where: { productId_deviceTypeId: { productId: prodC.id, deviceTypeId: dtCamera.id } }
  });

  console.log(`  Product A Camera Price: ₹${priceA?.price}`);
  console.log(`  Product B Camera Price: ₹${priceB?.price}`);
  console.log(`  Product C Camera Price: ₹${priceC?.price}`);

  if (priceA?.price !== 800 || priceB?.price !== 1200 || priceC?.price !== 1800) {
    throw new Error(`❌ Price isolation failure! Expected A=800, B=1200, C=1800. Found A=${priceA?.price}, B=${priceB?.price}, C=${priceC?.price}`);
  }
  console.log(`✅ [PASS] TEST 1: Modifying Product A did NOT affect Product B or Product C!`);

  console.log('\n--- TEST 2: DEVICE SWITCH PRICE SCOPING ---');

  const getPrice = async (pId: string, dtId: string) => {
    const res = await prisma.productDevicePrice.findUnique({
      where: { productId_deviceTypeId: { productId: pId, deviceTypeId: dtId } }
    });
    return res?.price;
  };

  const pAMobile = await getPrice(prodA.id, dtMobile.id);
  const pALaptop = await getPrice(prodA.id, dtLaptop.id);
  const pACamera = await getPrice(prodA.id, dtCamera.id);

  const pBMobile = await getPrice(prodB.id, dtMobile.id);
  const pBLaptop = await getPrice(prodB.id, dtLaptop.id);
  const pBCamera = await getPrice(prodB.id, dtCamera.id);

  console.log(`  Product A Prices -> Mobile: ₹${pAMobile}, Laptop: ₹${pALaptop}, Camera: ₹${pACamera}`);
  console.log(`  Product B Prices -> Mobile: ₹${pBMobile}, Laptop: ₹${pBLaptop}, Camera: ₹${pBCamera}`);

  if (pAMobile !== 300 || pALaptop !== 500 || pACamera !== 800 || pBMobile !== 450 || pBLaptop !== 800 || pBCamera !== 1200) {
    throw new Error('❌ Device switch price scoping failed!');
  }
  console.log(`✅ [PASS] TEST 2: Each product maintains its own independent device-type pricing hierarchy!`);

  console.log('\n--- TEST 3: CLEANUP TEST PRODUCTS ---');

  await prisma.productDevicePrice.deleteMany({
    where: { productId: { in: [prodA.id, prodB.id, prodC.id] } }
  });
  await prisma.product.deleteMany({
    where: { id: { in: [prodA.id, prodB.id, prodC.id] } }
  });
  console.log(`✓ Cleaned up isolation test products cleanly.`);

  console.log('\n============================================================');
  console.log('ALL PRICE ISOLATION TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('============================================================');
}

runPriceIsolationTests()
  .catch((err) => {
    console.error('Fatal test failure:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
