import { prisma } from '../database/client.js';

async function verifyCanonicalDeviceTypes() {
  console.log('============================================================');
  console.log('ACCEPTANCE TEST: DEVICE TYPE & PRICING VERIFICATION');
  console.log('============================================================\n');

  // 1. Fetch device types
  const deviceTypes = await prisma.deviceType.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`[1] Active Device Types Count: ${deviceTypes.length}`);
  for (const dt of deviceTypes) {
    console.log(`    - ID: ${dt.id} | Name: "${dt.name}" | Slug: "${dt.slug}"`);
  }

  if (deviceTypes.length !== 3) {
    console.error(`❌ Expected exactly 3 canonical DeviceTypes, found ${deviceTypes.length}`);
    process.exit(1);
  }

  // Check unique slugs
  const slugs = deviceTypes.map(d => d.slug);
  const expectedSlugs = ['camera', 'laptop', 'mobile'];
  const sortedSlugs = [...slugs].sort();
  if (JSON.stringify(sortedSlugs) !== JSON.stringify(expectedSlugs)) {
    console.error(`❌ Expected slugs ${JSON.stringify(expectedSlugs)}, found ${JSON.stringify(sortedSlugs)}`);
    process.exit(1);
  }
  console.log(`✓ [PASSED] Canonical device type slugs match exactly: mobile, laptop, camera.`);

  // 2. Check ProductDevicePrice unique constraints
  const allPrices = await prisma.productDevicePrice.findMany({
    include: { deviceType: true, product: true }
  });

  const pricePairs = new Set<string>();
  let duplicateCount = 0;

  for (const p of allPrices) {
    const key = `${p.productId}_${p.deviceTypeId}`;
    if (pricePairs.has(key)) {
      console.error(`❌ Duplicate ProductDevicePrice found for key: ${key}`);
      duplicateCount++;
    } else {
      pricePairs.add(key);
    }
  }

  if (duplicateCount > 0) {
    console.error(`❌ Found ${duplicateCount} duplicate ProductDevicePrice records!`);
    process.exit(1);
  }
  console.log(`✓ [PASSED] Zero duplicate ProductDevicePrice records found (${allPrices.length} total prices across catalog).`);

  // 3. Test API endpoint GET /api/v1/device-types
  const response = await fetch('http://localhost:3000/api/v1/device-types');
  const body = await response.json();

  if (!body.success || !Array.isArray(body.data)) {
    console.error(`❌ GET /api/v1/catalog/device-types failed:`, body);
    process.exit(1);
  }

  console.log(`✓ [PASSED] GET /api/v1/catalog/device-types returned ${body.data.length} device types via API:`);
  for (const d of body.data) {
    console.log(`    - ${d.name} (${d.slug}) [ID: ${d.id}]`);
  }

  console.log('\n============================================================');
  console.log('ALL DEVICE TYPE ACCEPTANCE CHECKS PASSED SUCCESSFULLY!');
  console.log('============================================================');
}

verifyCanonicalDeviceTypes()
  .catch((err) => {
    console.error('Acceptance test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
