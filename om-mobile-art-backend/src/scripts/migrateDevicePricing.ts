import { prisma } from '../database/client.js';
import { logger } from '../services/logger.js';

async function migrate() {
  console.log('--- Starting Device Pricing Database Migration ---');

  // 1. Create product_device_prices table if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_device_prices (
      id VARCHAR(191) NOT NULL,
      productId VARCHAR(191) NOT NULL,
      deviceTypeId VARCHAR(191) NOT NULL,
      price DOUBLE NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY product_device_prices_productId_deviceTypeId_key (productId, deviceTypeId),
      INDEX product_device_prices_productId_idx (productId),
      INDEX product_device_prices_deviceTypeId_idx (deviceTypeId),
      CONSTRAINT fk_pdp_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT fk_pdp_device_type FOREIGN KEY (deviceTypeId) REFERENCES device_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ product_device_prices table verified/created.');

  // 2. Add deviceTypeId to cart_items if missing
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE cart_items ADD COLUMN deviceTypeId VARCHAR(191) NULL;
    `);
    console.log('✓ Added deviceTypeId column to cart_items.');
  } catch (err: any) {
    if (err.message?.includes('Duplicate column name')) {
      console.log('ℹ deviceTypeId column already exists in cart_items.');
    } else {
      console.log('Info on cart_items alter:', err.message);
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_device_type FOREIGN KEY (deviceTypeId) REFERENCES device_types(id) ON DELETE SET NULL;
    `);
    console.log('✓ Added foreign key constraint for deviceTypeId in cart_items.');
  } catch (err: any) {
    // ignore if constraint exists
  }

  // 3. Migrate existing products to create initial ProductDevicePrice records
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      models: {
        include: {
          brand: {
            include: {
              deviceType: true
            }
          }
        }
      },
      devicePrices: true
    }
  });

  console.log(`Found ${products.length} products to check for device price migration.`);

  // Get default DeviceTypes if product has no models connected
  const allDeviceTypes = await prisma.deviceType.findMany({ where: { deletedAt: null } });

  for (const product of products) {
    // Determine supported deviceTypes from models
    const deviceTypeIds = new Set<string>();
    product.models.forEach((m) => {
      const dt = m.brand?.deviceType;
      if (dt?.id) {
        deviceTypeIds.add(dt.id);
      }
    });

    // Fallback: If no models connected, connect to Mobile or first deviceType if available
    if (deviceTypeIds.size === 0 && allDeviceTypes.length > 0) {
      const mobileType = allDeviceTypes.find((dt) => dt.name.toLowerCase().includes('mobile') || dt.slug.includes('mobile')) || allDeviceTypes[0];
      if (mobileType) {
        deviceTypeIds.add(mobileType.id);
      }
    }

    for (const dtId of deviceTypeIds) {
      const existing = product.devicePrices.find((dp) => dp.deviceTypeId === dtId);
      if (!existing) {
        const newId = `pdp_${product.id.slice(0, 8)}_${dtId.slice(0, 8)}`;
        await prisma.productDevicePrice.create({
          data: {
            id: newId,
            productId: product.id,
            deviceTypeId: dtId,
            price: product.price
          }
        });
        console.log(`  + Created ProductDevicePrice for product '${product.name}' (${product.id}) and deviceType '${dtId}': ₹${product.price}`);
      }
    }
  }

  console.log('✓ Data migration complete.');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
