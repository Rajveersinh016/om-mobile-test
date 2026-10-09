import nodemailer from 'nodemailer';
import { IEmailProvider, SendEmailPayload, SendEmailResult } from './emailProvider.interface.js';
import { emailLogger } from '../logger/emailLogger.js';

export interface NodemailerOptions {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  defaultFrom: string;
}

export class NodemailerProvider implements IEmailProvider {
  name = 'nodemailer-smtp';
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;

  constructor(options: NodemailerOptions) {
    this.defaultFrom = options.defaultFrom;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user && options.pass ? {
        user: options.user,
        pass: options.pass,
      } : undefined,
    });
  }

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: payload.from || this.defaultFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
      });

      const messageId = info.messageId || `smtp-${Date.now()}`;
      emailLogger.logDispatchSuccess(payload.templateName, payload.to, messageId);

      return {
        success: true,
        messageId,
        provider: this.name,
      };
    } catch (error) {
      emailLogger.logDispatchFailure(payload.templateName, payload.to, error);
      return {
        success: false,
        provider: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
