import { FastifyInstance } from 'fastify';
import { TestEmailController } from './testEmail.controller.js';

export async function testEmailRoutes(app: FastifyInstance) {
  // Temporary Development Endpoint: GET /api/v1/test-email and POST /api/v1/test-email
  app.get('/test-email', TestEmailController.sendTestEmail);
  app.post('/test-email', TestEmailController.sendTestEmail);
}
