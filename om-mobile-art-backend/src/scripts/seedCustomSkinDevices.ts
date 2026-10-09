import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCustomSkinDevices() {
  console.log('Seeding Mobile Device Types, Brands, and Models for Custom Skin...');

  // 1. Ensure Mobile / Smartphone Device Type exists
  let mobileDeviceType = await prisma.deviceType.findFirst({
    where: {
      OR: [
        { name: { equals: 'Mobile' } },
        { name: { equals: 'Smartphones' } },
        { name: { equals: 'Smartphone' } },
        { slug: { equals: 'mobile' } },
        { slug: { equals: 'smartphones' } }
      ],
      deletedAt: null
    }
  });

  if (!mobileDeviceType) {
    mobileDeviceType = await prisma.deviceType.create({
      data: {
        name: 'Mobile',
        slug: 'mobile',
        description: 'Smartphones and Mobile Devices',
        icon: 'smartphone',
        isActive: true,
        isVisible: true,
        status: 'PUBLISHED'
      }
    });
    console.log('Created Mobile DeviceType:', mobileDeviceType.id);
  } else {
    console.log('Using existing Mobile DeviceType:', mobileDeviceType.name, mobileDeviceType.id);
  }

  // 2. Define standard Mobile Brands and popular models
  const mobileBrandsData = [
    {
      name: 'Apple',
      slug: 'apple',
      models: [
        'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
        'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
        'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
        'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
        'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 11'
      ]
    },
    {
      name: 'Samsung',
      slug: 'samsung',
      models: [
        'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra',
        'Galaxy S23+', 'Galaxy S23', 'Galaxy S22 Ultra', 'Galaxy Z Fold 6',
        'Galaxy Z Flip 6', 'Galaxy A55 5G', 'Galaxy M55 5G'
      ]
    },
    {
      name: 'Google',
      slug: 'google',
      models: [
        'Pixel 9 Pro XL', 'Pixel 9 Pro', 'Pixel 9', 'Pixel 8 Pro', 'Pixel 8',
        'Pixel 8a', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 6a'
      ]
    },
    {
      name: 'OnePlus',
      slug: 'oneplus',
      models: [
        'OnePlus 12', 'OnePlus 12R', 'OnePlus 11 5G', 'OnePlus 11R',
        'OnePlus 10 Pro', 'OnePlus Nord 4', 'OnePlus Nord CE 4'
      ]
    },
    {
      name: 'Nothing',
      slug: 'nothing',
      models: [
        'Nothing Phone (2a) Plus', 'Nothing Phone (2a)', 'Nothing Phone (2)', 'Nothing Phone (1)'
      ]
    },
    {
      name: 'Motorola',
      slug: 'motorola',
      models: [
        'Edge 50 Ultra', 'Edge 50 Pro', 'Edge 50 Fusion', 'Razr 50 Ultra',
        'G85 5G', 'G54 5G'
      ]
    },
    {
      name: 'Xiaomi',
      slug: 'xiaomi',
      models: [
        'Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 14 Civi', 'Redmi Note 13 Pro+',
        'Redmi Note 13 Pro', 'Redmi Note 13'
      ]
    },
    {
      name: 'Realme',
      slug: 'realme',
      models: [
        'Realme GT 6', 'Realme GT 6T', 'Realme 13 Pro+', 'Realme 12 Pro+',
        'Realme P1 Pro 5G'
      ]
    },
    {
      name: 'Vivo',
      slug: 'vivo',
      models: [
        'Vivo X100 Pro', 'Vivo X100', 'Vivo V40 Pro', 'Vivo V40', 'Vivo T3 5G'
      ]
    },
    {
      name: 'Oppo',
      slug: 'oppo',
      models: [
        'Oppo Reno 12 Pro 5G', 'Oppo Reno 12 5G', 'Oppo Find N3 Flip', 'Oppo F27 Pro+ 5G'
      ]
    },
    {
      name: 'iQOO',
      slug: 'iqoo',
      models: [
        'iQOO 12 5G', 'iQOO Neo 9 Pro', 'iQOO Z9 Turbo', 'iQOO Z9 5G'
      ]
    },
    {
      name: 'Poco',
      slug: 'poco',
      models: [
        'Poco F6 5G', 'Poco X6 Pro 5G', 'Poco X6 5G', 'Poco M6 Pro 5G'
      ]
    },
    {
      name: 'Honor',
      slug: 'honor',
      models: [
        'Honor 200 Pro', 'Honor 200', 'Honor Magic 6 Pro', 'Honor 90 5G'
      ]
    },
    {
      name: 'Asus',
      slug: 'asus',
      models: [
        'ROG Phone 8 Pro', 'ROG Phone 8', 'Zenfone 11 Ultra', 'Zenfone 10'
      ]
    },
    {
      name: 'Sony',
      slug: 'sony',
      models: [
        'Xperia 1 VI', 'Xperia 5 V', 'Xperia 10 VI'
      ]
    },
    {
      name: 'Nokia',
      slug: 'nokia',
      models: [
        'Nokia G42 5G', 'Nokia XR21', 'Nokia C32'
      ]
    }
  ];

  for (let bIndex = 0; bIndex < mobileBrandsData.length; bIndex++) {
    const bData = mobileBrandsData[bIndex];
    let brand = await prisma.brand.findFirst({
      where: {
        name: { equals: bData.name },
        deletedAt: null
      }
    });

    if (!brand) {
      brand = await prisma.brand.create({
        data: {
          name: bData.name,
          slug: bData.slug,
          deviceTypeId: mobileDeviceType.id,
          isActive: true,
          status: 'PUBLISHED',
          sortOrder: bIndex
        }
      });
      console.log(`Created Brand ${brand.name}`);
    } else {
      // Ensure brand is linked to Mobile device type
      if (!brand.deviceTypeId || brand.deviceTypeId !== mobileDeviceType.id) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { deviceTypeId: mobileDeviceType.id, isActive: true, status: 'PUBLISHED' }
        });
      }
    }

    // Seed models for this brand
    for (let mIndex = 0; mIndex < bData.models.length; mIndex++) {
      const mName = bData.models[mIndex];
      let model = await prisma.model.findFirst({
        where: {
          brandId: brand.id,
          name: { equals: mName },
          deletedAt: null
        }
      });

      if (!model) {
        const mSlug = mName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await prisma.model.create({
          data: {
            name: mName,
            slug: mSlug,
            brandId: brand.id,
            isActive: true,
            status: 'PUBLISHED',
            sortOrder: mIndex
          }
        });
      }
    }
  }

  console.log('Mobile Device Types, Brands, and Models successfully seeded!');
}

seedCustomSkinDevices()
  .catch((err) => {
    console.error('Error seeding custom skin devices:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
