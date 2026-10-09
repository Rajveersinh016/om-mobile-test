import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectImages() {
  console.log('=== PRODUCT IMAGES ===');
  const products = await prisma.product.findMany({
    select: { id: true, name: true, image: true, hoverImage: true }
  });
  console.log('Products image count:', products.length);
  products.forEach(p => {
    if (p.image) console.log(`Product [${p.name}] image: ${p.image}`);
    if (p.hoverImage) console.log(`Product [${p.name}] hoverImage: ${p.hoverImage}`);
  });

  const productImages = await prisma.productImage.findMany();
  console.log('ProductImages count:', productImages.length);
  productImages.forEach(pi => console.log(`ProductImage url: ${pi.url}, publicId: ${pi.publicId}`));

  const variants = await prisma.productVariant.findMany({ select: { id: true, sku: true, image: true } });
  console.log('Variants with image count:', variants.filter(v => v.image).length);
  variants.forEach(v => {
    if (v.image) console.log(`Variant [${v.sku}] image: ${v.image}`);
  });

  console.log('=== COLLECTION IMAGES ===');
  const collections = await prisma.collection.findMany();
  collections.forEach(c => {
    if (c.desktopBanner || c.mobileBanner || c.thumbnail || (c.images && c.images.length > 0)) {
      console.log(`Collection [${c.name}]: desktopBanner=${c.desktopBanner}, mobileBanner=${c.mobileBanner}, thumbnail=${c.thumbnail}, images=${JSON.stringify(c.images)}`);
    }
  });

  console.log('=== GLOBAL MOCKUPS ===');
  const mockups = await prisma.globalProductMockup.findMany();
  console.log(JSON.stringify(mockups, null, 2));

  console.log('=== BANNERS ===');
  const banners = await prisma.banner.findMany();
  banners.forEach(b => console.log(`Banner [${b.title}]: imageUrl=${b.imageUrl}, mobileImageUrl=${b.mobileImageUrl}`));

  console.log('=== BRAND CONFIG ===');
  const brandConfigs = await prisma.brandConfig.findMany();
  console.log(JSON.stringify(brandConfigs, null, 2));

  console.log('=== DEVICE PREVIEWS ===');
  const previews = await prisma.devicePreviewImage.findMany();
  previews.forEach(dp => console.log(`DevicePreviewImage: ${dp.imageUrl}`));

  await prisma.$disconnect();
}

inspectImages().catch(console.error);
