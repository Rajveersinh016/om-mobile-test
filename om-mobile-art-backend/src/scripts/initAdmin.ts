import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import fs from 'fs';
import path from 'path';

// Robust .env parser
const envPath = path.resolve(__dirname, '../../.env');
const altEnvPath = path.resolve(process.cwd(), '.env');
const targetEnv = fs.existsSync(envPath) ? envPath : fs.existsSync(altEnvPath) ? altEnvPath : null;

if (targetEnv) {
  const content = fs.readFileSync(targetEnv, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace('\r', '').trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const idx = line.indexOf('=');
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key) {
        process.env[key] = val;
      }
    }
  }
}

const prisma = new PrismaClient();

async function initAdmin() {
  console.log('==================================================');
  console.log('INITIALIZING OM MOBILE ART ADMINISTRATOR ACCOUNT');
  console.log('==================================================');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminEmail.trim()) {
    console.error('❌ ERROR: Missing ADMIN_EMAIL in environment variables.');
    console.error('Initialization aborted. Please define ADMIN_EMAIL in your .env file.');
    process.exit(1);
  }

  if (!adminPassword || !adminPassword.trim()) {
    console.error('❌ ERROR: Missing ADMIN_PASSWORD in environment variables.');
    console.error('Initialization aborted. Please define ADMIN_PASSWORD in your .env file.');
    process.exit(1);
  }

  const existingAdmins = await prisma.user.findMany({
    where: {
      OR: [{ role: 'ADMIN' }, { role: 'EDITOR' }],
      deletedAt: null,
    },
  });

  if (existingAdmins.length > 0) {
    console.log(`ℹ Administrator account already exists (${existingAdmins.length} found).`);
    console.log('Initialization aborted to prevent accidental modification.');
    console.log('Use "npm run reset-admin-password" to change administrator credentials if needed.');
    await prisma.$disconnect();
    return;
  }

  // Create single administrator account
  const passwordHash = await argon2.hash(adminPassword.trim());
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail.trim().toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      name: 'System Administrator',
    },
  });

  console.log('==================================================');
  console.log('✓ ADMINISTRATOR ACCOUNT CREATED SUCCESSFULLY');
  console.log(`  ID:    ${adminUser.id}`);
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Role:  ${adminUser.role}`);
  console.log('==================================================');

  await prisma.$disconnect();
}

initAdmin().catch((err) => {
  console.error('❌ ADMIN INITIALIZATION FAILED:', err);
  process.exit(1);
});
