import { FastifyInstance } from 'fastify';
import { authController } from './controllers/authController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';
import { Role } from '@prisma/client';

export const authRoutes = async (app: FastifyInstance) => {
  // Public Routes with Rate Limits
  app.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    authController.register
  );

  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    authController.login
  );

  app.post(
    '/admin/login',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    authController.adminLogin
  );

  app.post(
    '/refresh',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    authController.refreshToken
  );

  app.post('/logout', { preHandler: [authenticate] }, authController.logout);
  app.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    authController.forgotPassword
  );

  app.post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    authController.resetPassword
  );

  app.post(
    '/verify-email',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    authController.verifyEmail
  );

  app.post(
    '/verify-registration-otp',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    authController.verifyEmail
  );

  app.post(
    '/resend-verification',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    authController.resendVerification
  );

  app.post(
    '/resend-verification-otp',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    authController.resendVerification
  );

  app.post(
    '/otp/send',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    authController.sendLoginOTP
  );

  app.post(
    '/otp/verify',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    authController.verifyLoginOTP
  );

  // Authenticated Routes (Customers & Admins)
  app.get('/me', { preHandler: [authenticate] }, authController.me);
  app.post('/change-password', { preHandler: [authenticate] }, authController.changePassword);
  app.put('/profile', { preHandler: [authenticate] }, authController.updateProfile);

  // Protected Role-Based Routes (Admins Only)
  app.get('/admin/test', { preHandler: [authenticate, authorize(Role.ADMIN)] }, async (request, reply) => {
    return {
      success: true,
      message: 'Welcome Admin! You have successfully accessed this protected endpoint.',
    };
  });
};
