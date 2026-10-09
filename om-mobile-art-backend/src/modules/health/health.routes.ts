import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/client.js';
import { env } from '../../config/env.js';
import { v2 as cloudinary } from 'cloudinary';

export const healthRoutes = async (app: FastifyInstance) => {
  // Liveness Check
  app.get('/live', async (_req, reply) => {
    return reply.status(200).send({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness Check (Inspects DB, Environment, Admin, and Cloudinary Connectivity)
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, any> = {
      database: 'UNKNOWN',
      cloudinary: 'UNKNOWN',
      environment: 'OK',
      adminAccount: 'UNKNOWN',
    };

    let isHealthy = true;

    // 1. Database Check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'CONNECTED';
    } catch (err: any) {
      checks.database = `DISCONNECTED: ${err.message}`;
      isHealthy = false;
    }

    // 2. Admin Existence Check
    try {
      const adminCount = await prisma.user.count({
        where: { OR: [{ role: 'ADMIN' }, { role: 'EDITOR' }], deletedAt: null },
      });
      checks.adminAccount = adminCount === 1 ? 'OK' : `WARNING: ${adminCount} admins found`;
      if (adminCount === 0) isHealthy = false;
    } catch (err: any) {
      checks.adminAccount = `ERROR: ${err.message}`;
      isHealthy = false;
    }

    // 3. Cloudinary Ping Check
    try {
      if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
        cloudinary.config({
          cloud_name: env.CLOUDINARY_CLOUD_NAME,
          api_key: env.CLOUDINARY_API_KEY,
          api_secret: env.CLOUDINARY_API_SECRET,
        });
        const res = await cloudinary.api.ping();
        checks.cloudinary = res.status === 'ok' ? 'CONNECTED' : 'PING_FAILED';
      } else {
        checks.cloudinary = 'NOT_CONFIGURED';
      }
    } catch (err: any) {
      checks.cloudinary = `DISCONNECTED: ${err.message}`;
    }

    const statusCode = isHealthy ? 200 : 503;
    return reply.status(statusCode).send({
      status: isHealthy ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks,
      system: {
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
      },
    });
  });

  // Overview Health Endpoint
  app.get('/', async (_req, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
    });
  });
};
