import { FastifyInstance } from 'fastify';
import { shippingController } from './controllers/shippingController.js';

export const shippingRoutes = async (app: FastifyInstance) => {
  // Generate Shipment
  app.post(
    '/generate-shipment',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.generateShipment
  );

  // Dispatch Shipment
  app.post(
    '/dispatch',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.dispatchShipment
  );

  // Update Status Manually / Automatically
  app.patch(
    '/status',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.updateStatus
  );

  // Cancel Order & Restore Inventory Stock
  app.post(
    '/cancel-order',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.cancelOrder
  );

  // Track Shipment by Tracking Number or Order ID
  app.get(
    '/track/:identifier',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.getTrackingDetails
  );

  // Get Printable Shipping Label HTML
  app.get(
    '/label/:shipmentId',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.getShippingLabel
  );

  // Admin Dashboard Metrics
  app.get(
    '/admin/dashboard-metrics',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    shippingController.getAdminMetrics
  );
};

