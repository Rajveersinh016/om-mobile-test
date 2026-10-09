import { FastifyRequest, FastifyReply } from 'fastify';
import { emailService } from '../../services/email/emailService.js';
import { logger } from '../../services/logger.js';
import { env } from '../../config/env.js';

export class TestEmailController {
  /**
   * Temporary Development Endpoint: GET /api/v1/test-email
   */
  static async sendTestEmail(request: FastifyRequest, reply: FastifyReply) {
    logger.info(`[Test Email Endpoint] API request received from IP: ${request.ip}`);

    // Phase 9: Disable in production mode
    if (env.NODE_ENV === 'production') {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden: Test email endpoint is a temporary development endpoint and disabled in production.',
      });
    }

    // Determine target recipient (defaulting to Resend account email or delivered@resend.dev)
    const query = (request.query as { to?: string }) || {};
    const body = (request.body as { to?: string }) || {};
    const recipient = (query.to || body.to || 'ommobileart09@gmail.com').trim();

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      logger.error(`[Test Email Endpoint] Invalid recipient email address: "${recipient}"`);
      return reply.status(400).send({
        success: false,
        error: `Invalid recipient email address: "${recipient}". Please provide a valid email via ?to=email@example.com`,
      });
    }

    // Phase 1 Validation check
    const configValidation = emailService.validateConfiguration();
    if (!configValidation.valid) {
      logger.error(`[Test Email Endpoint] Configuration validation failed: ${configValidation.errors.join(', ')}`);
      return reply.status(422).send({
        success: false,
        provider: configValidation.providerName,
        error: `Configuration invalid: ${configValidation.errors.join('; ')}`,
      });
    }

    const subject = 'OM Mobile Art - Email Service Test';
    const textContent = `Hello,\n\nThis is a test email from OM Mobile Art.\n\nIf you received this email, the Resend integration is working correctly.\n\nThank you,\nOM Mobile Art`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #1E293B; max-width: 600px; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px;">
        <h2 style="color: #03045E; margin-top: 0;">OM Mobile Art — Email Service Test</h2>
        <p>Hello,</p>
        <p>This is a test email from <strong>OM Mobile Art</strong>.</p>
        <p>If you received this email, the <strong>Resend</strong> integration is working correctly.</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 13px; color: #64748B;">Thank you,<br/><strong>OM Mobile Art Team</strong></p>
      </div>
    `;

    logger.info(`[Test Email Endpoint] Dispatching test email | Recipient: ${recipient} | Subject: "${subject}" | Provider: ${configValidation.providerName}`);

    try {
      const result = await emailService.sendEmail({
        to: recipient,
        subject,
        html: htmlContent,
        text: textContent,
        templateName: 'TEST_EMAIL',
      });

      if (!result.success) {
        logger.error(`[Test Email Endpoint] Resend dispatch failed | Error: ${result.error}`);
        return reply.status(400).send({
          success: false,
          error: result.error || 'Resend API rejected test email dispatch.',
          provider: result.provider,
        });
      }

      logger.info(`[Test Email Endpoint] Resend response accepted | Email ID: ${result.messageId} | Recipient: ${recipient}`);

      return reply.status(200).send({
        success: true,
        message: 'Test email sent successfully',
        emailId: result.messageId,
        provider: result.provider,
      });
    } catch (error) {
      const errorMsg = emailService.handleErrors(error);
      logger.error(`[Test Email Endpoint] Exception encountered: ${errorMsg}`);
      return reply.status(500).send({
        success: false,
        error: errorMsg,
        provider: configValidation.providerName,
      });
    }
  }
}
