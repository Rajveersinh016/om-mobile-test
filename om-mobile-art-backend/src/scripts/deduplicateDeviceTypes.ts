import { prisma } from '../database/client.js';

async function deduplicateDeviceTypes() {
  console.log('============================================================');
  console.log('SAFE DATABASE DEVICE TYPE DEDUPLICATION & MIGRATION');
  console.log('============================================================\n');

  // 1. Fetch all DeviceTypes
  const allDTs = await prisma.deviceType.findMany();
  console.log(`Initial total DeviceType records: ${allDTs.length}`);

  // Canonical mapping by normalized slug / name
  const canonicalMobile = allDTs.find(d => d.slug === 'mobile') || allDTs.find(d => d.name.toLowerCase() === 'mobile');
  const canonicalLaptop = allDTs.find(d => d.slug === 'laptop') || allDTs.find(d => d.name.toLowerCase() === 'laptop');
  const canonicalCamera = allDTs.find(d => d.slug === 'camera') || allDTs.find(d => d.name.toLowerCase() === 'camera');
  const canonicalLens   = allDTs.find(d => d.slug === 'camera-lens') || allDTs.find(d => d.name.toLowerCase().includes('camera lens'));

  if (!canonicalMobile || !canonicalLaptop || !canonicalCamera) {
    throw new Error('Canonical device types (Mobile, Laptop, Camera) must exist!');
  }

  console.log('CANONICAL TARGETS:');
  console.log(`- Mobile: ${canonicalMobile.id} ("${canonicalMobile.name}", slug: "${canonicalMobile.slug}")`);
  console.log(`- Laptop: ${canonicalLaptop.id} ("${canonicalLaptop.name}", slug: "${canonicalLaptop.slug}")`);
  console.log(`- Camera: ${canonicalCamera.id} ("${canonicalCamera.name}", slug: "${canonicalCamera.slug}")`);
  if (canonicalLens) {
    console.log(`- Camera Lens: ${canonicalLens.id} ("${canonicalLens.name}", slug: "${canonicalLens.slug}")`);
  }

  // Map each duplicate/other ID to canonical target ID
  const migrationMap = new Map<string, string>();

  for (const dt of allDTs) {
    if (dt.id === canonicalMobile.id || dt.id === canonicalLaptop.id || dt.id === canonicalCamera.id) {
      continue; // Skip canonical target itself
    }

    const norm = dt.name.toLowerCase();
    const slugNorm = dt.slug.toLowerCase();

    if (norm.includes('mobile') || norm.includes('smartphone') || slugNorm.includes('mobile')) {
      migrationMap.set(dt.id, canonicalMobile.id);
    } else if (norm.includes('laptop') || slugNorm.includes('laptop')) {
      migrationMap.set(dt.id, canonicalLaptop.id);
    } else if (norm.includes('camera') || slugNorm.includes('camera')) {
      migrationMap.set(dt.id, canonicalCamera.id);
    } else {
      console.warn(`Unclassified device type record: ${dt.id} "${dt.name}" (slug: "${dt.slug}") -> default to Mobile`);
      migrationMap.set(dt.id, canonicalMobile.id);
    }
  }

  console.log(`\nFound ${migrationMap.size} duplicate/legacy DeviceType records to migrate into canonical targets.\n`);

  for (const [dupId, targetId] of migrationMap.entries()) {
    const dup = allDTs.find(d => d.id === dupId);
    const target = allDTs.find(d => d.id === targetId);
    console.log(`Migrating duplicate "${dup?.name}" (${dupId}) -> Canonical "${target?.name}" (${targetId})...`);

    // A. Migrate Brands
    const brandUpdate = await prisma.brand.updateMany({
      where: { deviceTypeId: dupId },
      data: { deviceTypeId: targetId },
    });
    if (brandUpdate.count > 0) {
      console.log(`  - Reassigned ${brandUpdate.count} brands to target ${targetId}`);
    }

    // B. Migrate CartItems
    const cartUpdate = await prisma.cartItem.updateMany({
      where: { deviceTypeId: dupId },
      data: { deviceTypeId: targetId },
    });
    if (cartUpdate.count > 0) {
      console.log(`  - Reassigned ${cartUpdate.count} cartItems to target ${targetId}`);
    }

    // C. Migrate ProductDevicePrices safely (handle unique constraint on productId + deviceTypeId)
    const dupPrices = await prisma.productDevicePrice.findMany({
      where: { deviceTypeId: dupId },
    });

    for (const dp of dupPrices) {
      const existingTargetPrice = await prisma.productDevicePrice.findUnique({
        where: {
          productId_deviceTypeId: {
            productId: dp.productId,
            deviceTypeId: targetId,
          },
        },
      });

      if (existingTargetPrice) {
        if (existingTargetPrice.price !== dp.price) {
          console.warn(`  ⚠️ Price conflict for product ${dp.productId}: existing canonical price=₹${existingTargetPrice.price}, duplicate price=₹${dp.price}. Retaining canonical ₹${existingTargetPrice.price}.`);
        }
        // Delete duplicate price record
        await prisma.productDevicePrice.delete({ where: { id: dp.id } });
      } else {
        // Reassign deviceTypeId to targetId
        await prisma.productDevicePrice.update({
          where: { id: dp.id },
          data: { deviceTypeId: targetId },
        });
        console.log(`  - Reassigned ProductDevicePrice for product ${dp.productId} to target ${targetId}`);
      }
    }

    // D. Delete the duplicate DeviceType record
    await prisma.deviceType.delete({ where: { id: dupId } });
    console.log(`  ✓ Deleted duplicate DeviceType record ${dupId}`);
  }

  // 2. Ensure canonical DeviceTypes have normalized names & active status
  await prisma.deviceType.update({
    where: { id: canonicalMobile.id },
    data: { name: 'Mobile', slug: 'mobile', isActive: true, isVisible: true, status: 'PUBLISHED', deletedAt: null },
  });

  await prisma.deviceType.update({
    where: { id: canonicalLaptop.id },
    data: { name: 'Laptop', slug: 'laptop', isActive: true, isVisible: true, status: 'PUBLISHED', deletedAt: null },
  });

  await prisma.deviceType.update({
    where: { id: canonicalCamera.id },
    data: { name: 'Camera', slug: 'camera', isActive: true, isVisible: true, status: 'PUBLISHED', deletedAt: null },
  });



  const finalDTs = await prisma.deviceType.findMany();
  console.log(`\n============================================================`);
  console.log(`DEDUPLICATION COMPLETE. Total DeviceTypes in DB now: ${finalDTs.length}`);
  console.log(`============================================================`);
  for (const dt of finalDTs) {
    console.log(`- ${dt.id} | "${dt.name}" | slug: "${dt.slug}"`);
  }
}

deduplicateDeviceTypes()
  .catch((err) => {
    console.error('Fatal deduplication error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
