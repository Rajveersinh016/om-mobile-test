import { FastifyInstance } from 'fastify';
import { paymentController } from './controllers/paymentController.js';

export const paymentRoutes = async (app: FastifyInstance) => {
  // Create Razorpay Order
  app.post(
    '/create-order',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    paymentController.createOrder
  );

  // Verify Razorpay Payment Signature
  app.post(
    '/verify',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    paymentController.verifyPayment
  );

  // Razorpay Webhook Callback
  app.post(
    '/webhook',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    paymentController.handleWebhook
  );

  // Get Payment Details by ID
  app.get(
    '/:id',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    paymentController.getPayment
  );
};
