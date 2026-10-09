import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRoutes } from './modules/auth/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { profileRoutes } from './modules/profile/routes.js';
import { wishlistRoutes } from './modules/wishlist/routes.js';
import { cartRoutes } from './modules/cart/routes.js';
import { couponRoutes } from './modules/coupon/routes.js';
import { reservationRoutes } from './modules/reservation/routes.js';
import { checkoutRoutes } from './modules/checkout/routes.js';
import { orderRoutes } from './modules/order/routes.js';
import { homepageRoutes } from './modules/homepage/routes.js';
import { customSkinRoutes } from './modules/customSkin/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { inventoryRoutes } from './modules/inventory/routes.js';
import { customerRoutes } from './modules/customer/routes.js';
import { reviewRoutes } from './modules/review/routes.js';
import { paymentRoutes } from './modules/payment/routes.js';
import { shippingRoutes } from './modules/shipping/routes.js';
import multipart from '@fastify/multipart';
import fs from 'fs';
import path from 'path';

export const buildApp = async () => {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    bodyLimit: 25 * 1024 * 1024,
  });

  // Fastify Multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max file limit
    },
  });

  // Global plugins - Helmet Security Headers
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'res.cloudinary.com', '*.cloudinary.com'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  });
  
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(compress, { global: true });

  if (process.env.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: 1000,
      timeWindow: '1 minute',
    });
  }

  // Global Error Interceptor
  app.setErrorHandler(errorHandler);

  // Health routes registration
  const { healthRoutes } = await import('./modules/health/health.routes.js');
  await app.register(healthRoutes, { prefix: '/health' });

  // Root route
  app.get('/', async () => {
    return {
      status: 'online',
      service: 'OM Mobile Art Backend API',
      health: '/health',
      apiPrefix: '/api/v1',
      timestamp: new Date().toISOString(),
    };
  });

  // Secure static file serving for uploads
  app.get('/uploads/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const cleanFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'uploads', cleanFilename);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'File not found' });
    }

    const ext = path.extname(cleanFilename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    reply.header('Content-Type', contentType);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "default-src 'none'");
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(fs.createReadStream(filePath));
  });

  // Auth routes registration
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Catalog routes registration
  await app.register(catalogRoutes, { prefix: '/api/v1' });

  // Profile routes registration
  await app.register(profileRoutes, { prefix: '/api/v1' });

  // Wishlist routes registration
  await app.register(wishlistRoutes, { prefix: '/api/v1' });

  // Cart routes registration
  await app.register(cartRoutes, { prefix: '/api/v1' });

  // Coupon routes registration
  await app.register(couponRoutes, { prefix: '/api/v1' });

  // Reservation routes registration
  await app.register(reservationRoutes, { prefix: '/api/v1' });

  // Checkout routes registration
  await app.register(checkoutRoutes, { prefix: '/api/v1' });

  // Order routes registration
  await app.register(orderRoutes, { prefix: '/api/v1' });

  // Homepage routes registration
  await app.register(homepageRoutes, { prefix: '/api/v1' });

  // Custom Skin Workshop routes registration
  await app.register(customSkinRoutes, { prefix: '/api/v1' });

  // Settings routes registration
  await app.register(settingsRoutes, { prefix: '/api/v1' });

  // Inventory routes registration
  await app.register(inventoryRoutes, { prefix: '/api/v1' });

  // Customer routes registration
  await app.register(customerRoutes, { prefix: '/api/v1' });

  // Review routes registration
  await app.register(reviewRoutes, { prefix: '/api/v1' });

  // Payment routes registration
  await app.register(paymentRoutes, { prefix: '/api/v1/payments' });
  await app.register(paymentRoutes, { prefix: '/api/v1' });

  // Shipping routes registration
  await app.register(shippingRoutes, { prefix: '/api/v1/shipping' });
  await app.register(shippingRoutes, { prefix: '/api/v1' });

  // Cloudinary Media routes registration
  await app.register(mediaRoutes, { prefix: '/api/v1/media' });
  await app.register(mediaRoutes, { prefix: '/api/v1' });

  // Contact Form routes registration
  const { contactRoutes } = await import('./modules/contact/routes.js');
  await app.register(contactRoutes, { prefix: '/api/v1' });

  // Temporary Development Email Test Endpoint registration
  const { testEmailRoutes } = await import('./modules/email/testEmail.routes.js');
  await app.register(testEmailRoutes, { prefix: '/api/v1' });

  return app;
};
