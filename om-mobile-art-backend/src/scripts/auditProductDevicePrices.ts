import { prisma } from '../database/client.js';

async function auditProductDevicePrices() {
  console.log('============================================================');
  console.log('DATABASE DIAGNOSTIC REPORT: PRODUCT DEVICE PRICES');
  console.log('============================================================\n');

  // 1. Audit "camera test" product specifically
  const cameraTestProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { name: { contains: 'camera test' } },
        { slug: { contains: 'camera-test' } }
      ]
    },
    include: {
      devicePrices: {
        include: {
          deviceType: true
        }
      }
    }
  });

  if (cameraTestProduct) {
    console.log(`PRODUCT AUDIT: "${cameraTestProduct.name}" (ID: ${cameraTestProduct.id})`);
    console.log(`- Base Price: ₹${cameraTestProduct.price}`);
    console.log(`- Original Price: ₹${cameraTestProduct.originalPrice}`);
    console.log(`- Device Prices Count: ${cameraTestTestDevicePrices(cameraTestProduct.devicePrices)}`);
    for (const dp of cameraTestProduct.devicePrices) {
      console.log(`  * DeviceType: "${dp.deviceType.name}" (${dp.deviceTypeId}) -> Price: ₹${dp.price}`);
    }
  } else {
    console.log('Product "camera test" not found in DB.');
  }

  console.log('\n------------------------------------------------------------');
  console.log('ALL PRODUCTS & THEIR DEVICE PRICES DIAGNOSTIC REPORT:');
  console.log('------------------------------------------------------------');

  const allProducts = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      devicePrices: {
        include: {
          deviceType: true
        }
      }
    }
  });

  for (const p of allProducts) {
    console.log(`\nProduct: "${p.name}" (ID: ${p.id}, Slug: "${p.slug}")`);
    console.log(`  BasePrice: ₹${p.price} | OrigPrice: ₹${p.originalPrice}`);
    if (p.devicePrices.length === 0) {
      console.log('  DevicePrices: NONE');
    } else {
      for (const dp of p.devicePrices) {
        console.log(`  DevicePrices: [${dp.deviceType.name} (id: ${dp.deviceTypeId})] = ₹${dp.price}`);
      }
    }
  }
}

function cameraTestTestDevicePrices(dps: any[]) {
  return dps ? dps.length : 0;
}

auditProductDevicePrices()
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
