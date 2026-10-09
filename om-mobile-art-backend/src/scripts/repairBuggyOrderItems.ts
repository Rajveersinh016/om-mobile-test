import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SAFE ORDER ITEM SNAPSHOT REPAIR ===\n');

  // Find all order items that have the known buggy fallback productName 'Vinyl Skin'
  const buggyItems = await prisma.orderItem.findMany({
    where: {
      productName: 'Vinyl Skin',
    },
    include: {
      order: {
        select: { orderNumber: true },
      },
      variant: {
        include: {
          product: {
            include: {
              images: { orderBy: { position: 'asc' } },
              models: {
                include: {
                  brand: {
                    include: {
                      deviceType: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${buggyItems.length} order items with buggy snapshot 'Vinyl Skin'.`);

  for (const item of buggyItems) {
    if (!item.variant?.product) {
      console.warn(`Skipping item ${item.id} (Order ${item.order?.orderNumber}): No linked product found.`);
      continue;
    }

    const prod = item.variant.product;
    const authoritativeName = prod.name;
    const authoritativeImage = item.imageUrl || item.variant.image || prod.image || prod.images?.[0]?.url || null;

    // Resolve brand
    const matchedModel = prod.models?.find((m: any) => 
      (item.deviceModel && m.name.toLowerCase() === item.deviceModel.toLowerCase()) ||
      (item.deviceName && m.name.toLowerCase() === item.deviceName.toLowerCase())
    ) || prod.models?.[0];

    const authoritativeBrand = matchedModel?.brand?.name || (item.brandName !== 'OM Mobile Art' ? item.brandName : null);
    const authoritativeDeviceType = item.deviceType && item.deviceType !== 'Mobile' ? item.deviceType : (matchedModel?.brand?.deviceType?.name || item.deviceType || 'Mobile');
    const authoritativeModel = item.customModelName || item.deviceModel || item.deviceName || matchedModel?.name || null;

    console.log(`Repairing Order ${item.order?.orderNumber} (Item ${item.id}):`);
    console.log(`  - productName: "${item.productName}" -> "${authoritativeName}"`);
    console.log(`  - imageUrl: ${item.imageUrl} -> "${authoritativeImage}"`);
    console.log(`  - brandName: "${item.brandName}" -> "${authoritativeBrand}"`);
    console.log(`  - deviceModel: "${item.deviceModel}" -> "${authoritativeModel}"`);
    console.log(`  - deviceType: "${item.deviceType}" -> "${authoritativeDeviceType}"`);

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        productName: authoritativeName,
        imageUrl: authoritativeImage,
        brandName: authoritativeBrand,
        deviceBrand: authoritativeBrand,
        deviceModel: authoritativeModel,
        deviceName: authoritativeModel,
        deviceType: authoritativeDeviceType,
      },
    });
  }

  console.log('\n✓ Safe repair completed successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
