import { prisma } from '../database/client.js';

async function checkCameraTest() {
  const p = await prisma.product.findFirst({
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

  console.log('CAMERA TEST PRODUCT IN DB:');
  console.log(JSON.stringify(p, null, 2));
}

checkCameraTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
