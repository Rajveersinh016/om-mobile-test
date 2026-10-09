import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findFirst({ where: { name: 'camera test' } });
  console.log('Camera Test Product ID:', p?.id);
}
main().finally(() => prisma.$disconnect());
