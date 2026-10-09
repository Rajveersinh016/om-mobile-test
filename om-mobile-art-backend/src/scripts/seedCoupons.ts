import { PrismaClient, DiscountType, CouponStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCoupons() {
  console.log('Seeding coupons in PostgreSQL database...');

  const testCoupons = [
    {
      code: 'WELCOME10',
      name: 'Welcome 11% Off',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 11,
      status: CouponStatus.ACTIVE,
      minCartValue: 0,
      isActive: true
    },
    {
      code: 'FLAT100',
      name: 'Flat ₹100 Off',
      discountType: DiscountType.FIXED,
      discountValue: 100,
      status: CouponStatus.ACTIVE,
      minCartValue: 0,
      isActive: true
    },
    {
      code: 'FLAT100_1785326780842',
      name: 'Flat ₹100 Admin Test Coupon',
      discountType: DiscountType.FIXED,
      discountValue: 100,
      status: CouponStatus.ACTIVE,
      minCartValue: 0,
      isActive: true
    },
    {
      code: 'FESTIVE20',
      name: 'Festive 20% Off',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      status: CouponStatus.ACTIVE,
      minCartValue: 500,
      isActive: true
    }
  ];

  for (const cData of testCoupons) {
    const existing = await prisma.coupon.findFirst({
      where: { code: { equals: cData.code } }
    });

    if (!existing) {
      const created = await prisma.coupon.create({
        data: cData
      });
      console.log(`Created coupon ${created.code} (${created.id})`);
    } else {
      await prisma.coupon.update({
        where: { id: existing.id },
        data: {
          status: CouponStatus.ACTIVE,
          isActive: true,
          discountValue: cData.discountValue,
          discountType: cData.discountType
        }
      });
      console.log(`Updated coupon ${existing.code} (${existing.id})`);
    }
  }

  console.log('Coupons seeded successfully!');
}

seedCoupons()
  .catch((err) => {
    console.error('Error seeding coupons:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
