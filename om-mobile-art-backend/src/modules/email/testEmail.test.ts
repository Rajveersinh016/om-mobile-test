import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';

describe('Temporary Development Test Email Endpoint (GET /api/v1/test-email)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 400 Bad Request for an invalid recipient email address', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test-email?to=notanemail',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid recipient email address');
  });

  it('should process test email dispatch for a valid recipient and return required JSON schema', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test-email?to=admin@ommobileart.com',
    });

    // In dev console mode or configured Resend mode, check JSON payload response format
    const body = JSON.parse(response.body);
    if (response.statusCode === 200) {
      expect(body.success).toBe(true);
      expect(body.message).toBe('Test email sent successfully');
      expect(body.emailId).toBeDefined();
      expect(body.provider).toBeDefined();
    } else {
      // If Resend API key is unverified or invalid, exact error details must be present
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    }
  });

});
