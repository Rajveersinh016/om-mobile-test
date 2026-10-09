import { prisma } from '../database/client.js';

async function main() {
  const deviceTypes = await prisma.deviceType.findMany({
    include: {
      brands: true,
      productPrices: {
        include: {
          product: true,
        },
      },
    },
  });

  console.log("Device Types Summary:");
  for (const dt of deviceTypes) {
    console.log(`\n- ${dt.name} (id: ${dt.id}, slug: ${dt.slug}): ${dt.brands.length} brands, ${dt.productPrices.length} product device prices`);
    for (const p of dt.productPrices) {
      console.log(`   Product: ${p.product?.name} (${p.productId}) -> Price: ₹${p.price}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
