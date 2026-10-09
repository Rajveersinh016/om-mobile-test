import { Resend } from 'resend';
import { IEmailProvider, SendEmailPayload, SendEmailResult } from './emailProvider.interface.js';
import { emailLogger } from '../logger/emailLogger.js';

export class ResendProvider implements IEmailProvider {
  name = 'resend';
  private client: Resend | null = null;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey ? apiKey.trim() : '';
    this.defaultFrom = defaultFrom;
    if (this.apiKey !== '') {
      try {
        this.client = new Resend(this.apiKey);
      } catch (err) {
        this.client = null;
      }
    }
  }

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
    if (!this.apiKey || this.apiKey === '') {
      const errorMsg = 'RESEND_API_KEY is missing or empty in .env. Please set a valid RESEND_API_KEY.';
      emailLogger.logDispatchFailure(payload.templateName, payload.to, errorMsg);
      return {
        success: false,
        provider: this.name,
        error: errorMsg,
      };
    }

    if (!this.client) {
      try {
        this.client = new Resend(this.apiKey);
      } catch (err) {
        const errorMsg = `Failed to initialize Resend SDK: ${err instanceof Error ? err.message : String(err)}`;
        emailLogger.logDispatchFailure(payload.templateName, payload.to, errorMsg);
        return {
          success: false,
          provider: this.name,
          error: errorMsg,
        };
      }
    }

    console.log(`[EmailService] Provider = ${this.name}`);
    console.log(`[EmailService] Sending email to ${payload.to}...`);

    try {
      const response = await this.client.emails.send({
        from: payload.from || this.defaultFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
      });

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        console.error(`[EmailService] Resend response: FAILED - ${errorMsg}`);
        emailLogger.logDispatchFailure(payload.templateName, payload.to, errorMsg);
        return {
          success: false,
          provider: this.name,
          error: errorMsg,
        };
      }

      const messageId = response.data?.id || `resend-${Date.now()}`;
      console.log(`[EmailService] Resend response: SUCCESS`);
      console.log(`[EmailService] Email sent successfully with messageId: ${messageId}`);
      emailLogger.logDispatchSuccess(payload.templateName, payload.to, messageId);

      return {
        success: true,
        messageId,
        provider: this.name,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[EmailService] Resend response: EXCEPTION - ${errorMsg}`);
      emailLogger.logDispatchFailure(payload.templateName, payload.to, errorMsg);
      return {
        success: false,
        provider: this.name,
        error: errorMsg,
      };
    }
  }
}
