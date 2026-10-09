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

async function resetAdminPassword() {
  console.log('==================================================');
  console.log('RESETTING OM MOBILE ART ADMINISTRATOR PASSWORD');
  console.log('==================================================');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminEmail.trim()) {
    console.error('❌ ERROR: Missing ADMIN_EMAIL in environment variables.');
    console.error('Password reset aborted. Please set ADMIN_EMAIL in your .env file.');
    process.exit(1);
  }

  if (!adminPassword || !adminPassword.trim()) {
    console.error('❌ ERROR: Missing ADMIN_PASSWORD in environment variables.');
    console.error('Password reset aborted. Please set ADMIN_PASSWORD in your .env file.');
    process.exit(1);
  }

  const targetEmail = adminEmail.trim().toLowerCase();
  const adminUser = await prisma.user.findFirst({
    where: {
      email: targetEmail,
      OR: [{ role: 'ADMIN' }, { role: 'EDITOR' }],
      deletedAt: null,
    },
  });

  if (!adminUser) {
    console.error(`❌ ERROR: Administrator account with email '${targetEmail}' not found.`);
    console.error('Run "npm run init-admin" to create the initial administrator account.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(adminPassword.trim());

  await prisma.user.update({
    where: { id: adminUser.id },
    data: {
      passwordHash,
      updatedAt: new Date(),
    },
  });

  await prisma.adminActivityLog.create({
    data: {
      userId: adminUser.id,
      action: 'PASSWORD_RESET_CLI',
      details: 'Administrator password reset via CLI tool',
    },
  });

  console.log('==================================================');
  console.log('✓ ADMINISTRATOR PASSWORD RESET SUCCESSFULLY');
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Role:  ${adminUser.role}`);
  console.log('==================================================');

  await prisma.$disconnect();
}

resetAdminPassword().catch((err) => {
  console.error('❌ PASSWORD RESET FAILED:', err);
  process.exit(1);
});
