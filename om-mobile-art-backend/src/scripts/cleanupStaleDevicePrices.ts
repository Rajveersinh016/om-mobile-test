import { prisma } from '../database/client.js';

export async function cleanupStaleDevicePrices() {
  console.log('=== STARTING STALE DEVICE PRICE CLEANUP ===');
  
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      devicePrices: {
        include: {
          deviceType: true
        }
      },
      models: {
        include: {
          brand: {
            include: {
              deviceType: true
            }
          }
        }
      }
    }
  });

  let deletedCount = 0;

  for (const product of products) {
    if (!product.requiresDeviceSelection) {
      // Universal fit product supports all configured device prices
      continue;
    }

    const supportedDtIds = new Set<string>();
    for (const m of product.models) {
      const b = m.brand;
      const dt = b?.deviceType;
      if (dt?.id) {
        supportedDtIds.add(dt.id);
      }
    }

    // Identify devicePrices that belong to deviceTypeIds NOT supported by this product
    const stalePrices = product.devicePrices.filter(dp => !supportedDtIds.has(dp.deviceTypeId));

    if (stalePrices.length > 0) {
      console.log(`Product "${product.name}" (${product.id}): Found ${stalePrices.length} stale device prices for unsupported device types.`);
      for (const sp of stalePrices) {
        console.log(`  -> Removing stale price ₹${sp.price} for DeviceType "${sp.deviceType?.name || sp.deviceTypeId}"`);
        await prisma.productDevicePrice.delete({
          where: { id: sp.id }
        });
        deletedCount++;
      }
    }
  }

  console.log(`=== CLEANUP COMPLETE: Deleted ${deletedCount} stale product device price records. ===\n`);
  return deletedCount;
}

if (process.argv[1] && process.argv[1].includes('cleanupStaleDevicePrices')) {
  cleanupStaleDevicePrices()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
