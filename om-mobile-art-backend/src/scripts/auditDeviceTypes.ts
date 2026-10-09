import { prisma } from '../database/client.js';

async function auditDeviceTypes() {
  console.log('============================================================');
  console.log('DEVICE TYPES DATABASE AUDIT');
  console.log('============================================================\n');

  const deviceTypes = await prisma.deviceType.findMany({
    include: {
      _count: {
        select: {
          brands: true,
          productPrices: true,
          cartItems: true,
        },
      },
    },
  });

  console.log(`Total DeviceType records in DB: ${deviceTypes.length}\n`);

  console.log('ID | Name | Slug | Brands | ProductPrices | CartItems');
  console.log('--------------------------------------------------------------------------------');

  for (const dt of deviceTypes) {
    console.log(
      `${dt.id} | "${dt.name}" | "${dt.slug}" | ${dt._count.brands} | ${dt._count.productPrices} | ${dt._count.cartItems}`
    );
  }

  // Also check ProductDevicePrice records for any duplicate (productId, deviceTypeId) pairs
  const allPrices = await prisma.productDevicePrice.findMany({
    include: {
      product: { select: { name: true } },
      deviceType: { select: { name: true } },
    },
  });

  const priceMap = new Map<string, typeof allPrices>();
  let duplicatePricesCount = 0;

  for (const p of allPrices) {
    const key = `${p.productId}_${p.deviceTypeId}`;
    if (!priceMap.has(key)) {
      priceMap.set(key, []);
    }
    priceMap.get(key)!.push(p);
  }

  console.log(`\nTotal ProductDevicePrice records: ${allPrices.length}`);

  for (const [key, records] of priceMap.entries()) {
    if (records.length > 1) {
      duplicatePricesCount++;
      console.warn(`⚠️ DUPLICATE PRICE ENTRY FOR PRODUCT '${records[0].product.name}' & DEVICE '${records[0].deviceType.name}':`, records.map(r => `[id=${r.id}, price=₹${r.price}]`).join(', '));
    }
  }

  console.log(`Duplicate (productId, deviceTypeId) pairs in ProductDevicePrice: ${duplicatePricesCount}\n`);
}

auditDeviceTypes()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
