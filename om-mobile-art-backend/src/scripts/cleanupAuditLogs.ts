import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Load .env
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
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const prisma = new PrismaClient();

async function cleanupAuditLogs() {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '730', 10);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  console.log('==================================================');
  console.log('AUDIT LOG AUTOMATED CLEANUP TASK');
  console.log(`Retention Threshold: ${retentionDays} days (Older than ${cutoffDate.toISOString()})`);
  console.log('==================================================');

  // Purge old Admin Activity Logs
  const deletedAdminLogs = await prisma.adminActivityLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  // Purge old Customer Account Activity Logs
  const deletedAccountLogs = await prisma.accountActivity.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  console.log('==================================================');
  console.log('✓ AUDIT LOG CLEANUP COMPLETED SUCCESSFULLY');
  console.log(`  Deleted Admin Activity Logs:    ${deletedAdminLogs.count}`);
  console.log(`  Deleted Account Activity Logs:  ${deletedAccountLogs.count}`);
  console.log('==================================================');

  await prisma.$disconnect();
}

cleanupAuditLogs().catch((err) => {
  console.error('❌ AUDIT LOG CLEANUP FAILED:', err);
  process.exit(1);
});
