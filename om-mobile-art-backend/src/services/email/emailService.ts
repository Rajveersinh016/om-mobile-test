import { getEmailConfig, EmailConfig } from './config/emailConfig.js';
import { IEmailProvider, SendEmailResult } from './providers/emailProvider.interface.js';
import { ConsoleProvider } from './providers/consoleProvider.js';
import { ResendProvider } from './providers/resendProvider.js';
import { NodemailerProvider } from './providers/nodemailerProvider.js';
import { emailTemplateService } from './templates/emailTemplateService.js';
import { 
  EmailTemplateType, 
  TemplateContextMap, 
  OrderConfirmationContext,
  PaymentSuccessfulContext,
  OrderShippedContext,
  OutForDeliveryContext,
  DeliveredContext,
  CancelledContext,
  RefundInitiatedContext,
  RefundCompletedContext,
  ContactFormAutoReplyContext,
  ContactFormAdminNotificationContext,
} from './templates/templateTypes.js';
import { emailQueue } from './queue/emailQueue.js';
import { logger } from '../logger.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  templateName?: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  providerName: string;
}

export class EmailService {
  private provider!: IEmailProvider;
  private config!: EmailConfig;

  constructor() {
    this.reloadConfiguration();
  }

  public reloadConfiguration(): void {
    this.config = getEmailConfig();
    this.provider = this.resolveProvider(this.config);
  }

  private resolveProvider(config: EmailConfig): IEmailProvider {
    const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
    const providerSetting = (config.provider || 'resend').toLowerCase();
    const apiKey = config.resendApiKey ? config.resendApiKey.trim() : '';

    if (isVitest && !process.env.FORCE_LIVE_EMAIL) {
      return new ConsoleProvider();
    }

    if (providerSetting === 'resend' || (providerSetting === 'auto' && apiKey !== '')) {
      return new ResendProvider(apiKey, config.from);
    }
    if (providerSetting === 'smtp' || (providerSetting === 'auto' && config.smtpHost && config.smtpHost.trim() !== '')) {
      return new NodemailerProvider({
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        secure: config.smtpSecure,
        defaultFrom: config.from,
      });
    }
    return new ConsoleProvider();
  }

  /**
   * Phase 1 & 4 - Validate Environment Configuration
   */
  public validateConfiguration(): ConfigurationValidationResult {
    this.reloadConfiguration();
    const errors: string[] = [];

    if (!this.config.from || this.config.from.trim() === '') {
      errors.push('EMAIL_FROM environment variable is missing or empty');
    }

    if (!this.config.appFrontendUrl || this.config.appFrontendUrl.trim() === '') {
      errors.push('APP_FRONTEND_URL environment variable is missing or empty');
    }

    const isResendProvider = (this.config.provider || '').toLowerCase() === 'resend' || ((this.config.provider || '').toLowerCase() === 'auto' && !!this.config.resendApiKey);

    if (isResendProvider && (!this.config.resendApiKey || this.config.resendApiKey.trim() === '')) {
      errors.push('RESEND_API_KEY environment variable is missing or empty');
    }

    return {
      valid: errors.length === 0,
      errors,
      providerName: this.provider ? this.provider.name : 'resend',
    };
  }

  /**
   * Phase 4 - Health Check on Backend Startup
   */
  public initializeHealthCheck(): void {
    const validation = this.validateConfiguration();
    const apiKeyLoaded = !!(this.config.resendApiKey && this.config.resendApiKey.trim() !== '');

    console.log('\n==================================================');
    console.log('EMAIL SERVICE INITIALIZATION');
    console.log('==================================================');
    console.log(`EMAIL_PROVIDER       : ${this.config.provider || 'resend'}`);
    console.log(`RESEND_API_KEY Loaded: ${apiKeyLoaded ? 'YES' : 'NO'}`);
    console.log(`EMAIL_FROM           : ${this.config.from}`);
    console.log(`EMAIL_REPLY_TO       : ${this.config.replyTo || 'Not Set'}`);
    console.log('==================================================\n');

    if (!validation.valid) {
      logger.error(`✗ Email Service initialization failed: ${validation.errors.join('; ')}`);
      console.error(`✗ Email Service initialization failed: ${validation.errors.join('; ')}`);
    } else {
      logger.info(`✓ Email Service (${this.provider.name}) initialized successfully`);
      console.log(`✓ Email Service (${this.provider.name}) initialized successfully`);
    }
  }

  /**
   * Handle and format errors gracefully
   */
  public handleErrors(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null) {
      return JSON.stringify(error);
    }
    return String(error);
  }

  /**
   * Base method for sending any email payload directly or queued
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!options.to || options.to.trim() === '') {
      return { success: false, provider: this.provider.name, error: 'Recipient email address (to) is required' };
    }
    if (!options.subject || options.subject.trim() === '') {
      return { success: false, provider: this.provider.name, error: 'Email subject is required' };
    }
    if (!options.html && !options.text) {
      return { success: false, provider: this.provider.name, error: 'Email body (html or text) is required' };
    }

    const payload = {
      to: options.to.trim(),
      subject: options.subject.trim(),
      html: options.html || `<p>${options.text || ''}</p>`,
      text: options.text || (options.html ? options.html.replace(/<[^>]*>?/gm, '') : ''),
      from: options.from || this.config.from,
      replyTo: options.replyTo || this.config.replyTo,
      templateName: options.templateName || 'CUSTOM_EMAIL',
    };

    return this.provider.sendEmail(payload);
  }

  /**
   * Convenience method to send HTML emails
   */
  async sendHtmlEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.sendEmail({
      ...options,
      text: options.text || options.html?.replace(/<[^>]*>?/gm, ''),
    });
  }

  /**
   * Convenience method to send Text emails
   */
  async sendTextEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.sendEmail({
      ...options,
      html: options.html || `<p>${options.text}</p>`,
    });
  }

  /**
   * Generic method to render and dispatch any template email via queue
   */
  async sendTemplateEmail<T extends EmailTemplateType>(
    type: T,
    recipientEmail: string,
    context: TemplateContextMap[T]
  ): Promise<SendEmailResult> {
    const rendered = emailTemplateService.render(type, context);

    const payload = {
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      from: this.config.from,
      replyTo: this.config.replyTo,
      templateName: type,
    };

    return emailQueue.enqueue(payload, this.provider);
  }

  // 1. Welcome Email
  async sendWelcomeEmail(recipient: { email: string; name?: string }, shopUrl?: string): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.WELCOME, recipient.email, { recipient, shopUrl });
  }

  // 2. Email Verification
  async sendEmailVerification(
    recipient: { email: string; name?: string },
    verificationUrl: string,
    expiresInMinutes?: number
  ): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.EMAIL_VERIFICATION, recipient.email, { recipient, verificationUrl, expiresInMinutes });
  }

  // 3. Forgot Password
  async sendForgotPassword(
    recipient: { email: string; name?: string },
    resetUrl: string,
    expiresInMinutes?: number
  ): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.FORGOT_PASSWORD, recipient.email, { recipient, resetUrl, expiresInMinutes });
  }

  // 4. Password Reset Success
  async sendPasswordResetSuccess(recipient: { email: string; name?: string }, loginUrl?: string): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.PASSWORD_RESET_SUCCESS, recipient.email, { recipient, loginUrl });
  }

  // 5. Order Confirmation
  async sendOrderConfirmation(context: OrderConfirmationContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.ORDER_CONFIRMATION, context.recipient.email, context);
  }

  // 6. Payment Successful
  async sendPaymentSuccessful(context: PaymentSuccessfulContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.PAYMENT_SUCCESSFUL, context.recipient.email, context);
  }

  // 7. Order Shipped
  async sendOrderShipped(context: OrderShippedContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.ORDER_SHIPPED, context.recipient.email, context);
  }

  // 8. Out For Delivery
  async sendOutForDelivery(context: OutForDeliveryContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.OUT_FOR_DELIVERY, context.recipient.email, context);
  }

  // 9. Delivered
  async sendDelivered(context: DeliveredContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.DELIVERED, context.recipient.email, context);
  }

  // 10. Cancelled
  async sendOrderCancelled(context: CancelledContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.CANCELLED, context.recipient.email, context);
  }

  // 11. Refund Initiated
  async sendRefundInitiated(context: RefundInitiatedContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.REFUND_INITIATED, context.recipient.email, context);
  }

  // 12. Refund Completed
  async sendRefundCompleted(context: RefundCompletedContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.REFUND_COMPLETED, context.recipient.email, context);
  }

  // 13. Contact Form Auto Reply
  async sendContactFormAutoReply(context: ContactFormAutoReplyContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(EmailTemplateType.CONTACT_AUTO_REPLY, context.recipient.email, context);
  }

  // 14. Contact Form Admin Notification
  async sendContactFormAdminNotification(context: ContactFormAdminNotificationContext): Promise<SendEmailResult> {
    return this.sendTemplateEmail(
      EmailTemplateType.CONTACT_ADMIN_NOTIFICATION,
      context.adminEmail || this.config.adminEmail,
      context
    );
  }
}

export const emailService = new EmailService();
