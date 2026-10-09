import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './services/logger.js';
import { prisma } from './database/client.js';

const startServer = async () => {
  try {
    const app = await buildApp();
    
    // Soft database initialization
    try {
      await prisma.$connect();
      logger.info('🔌 Database connection established successfully');

      // Perform Read-Only Admin Health Check
      const admins = await prisma.user.findMany({
        where: { OR: [{ role: 'ADMIN' }, { role: 'EDITOR' }], deletedAt: null },
        select: { email: true, role: true, status: true }
      });

      if (admins.length === 1) {
        const configuredEmail = process.env.ADMIN_EMAIL;
        const admin = admins[0];
        if (configuredEmail && configuredEmail.trim().toLowerCase() !== admin.email.toLowerCase()) {
          logger.warn(`⚠ Warning: Configured ADMIN_EMAIL (${configuredEmail}) does not match existing database administrator (${admin.email}).`);
        } else {
          logger.info(`✓ Administrator account found [Email: ${admin.email} | Role: ${admin.role} | Status: READY]`);
        }
      } else if (admins.length === 0) {
        logger.warn(`⚠ No administrator account found. Run: npm run init-admin`);
      } else {
        logger.info(`✓ Multiple administrator accounts detected (${admins.length} accounts found).`);
      }
    } catch (dbErr: any) {
      logger.warn(`⚠ Database connection warning: ${dbErr.message}. Server starting in standalone mode.`);
    }

    // Email Service Health Check
    const { emailService } = await import('./services/email/emailService.js');
    emailService.initializeHealthCheck();

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 Server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  } catch (error: any) {
    logger.error({
      msg: 'Failed to start server',
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();
