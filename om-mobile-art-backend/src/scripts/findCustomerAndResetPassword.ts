import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'customer@ommobileart.com';
  let user = await prisma.user.findUnique({
    where: { email }
  });

  const hash = await argon2.hash('Customer123!');
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: 'Om Customer',
        phone: '9876543210',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        isEmailVerified: true
      }
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        status: 'ACTIVE',
        isEmailVerified: true
      }
    });
  }

  console.log('Customer credentials ready:');
  console.log('Email:', user.email);
  console.log('Password: Customer123!');
}

main().finally(() => prisma.$disconnect());
