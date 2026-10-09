import dotenv from 'dotenv';
import path from 'path';
import { env } from '../../../config/env.js';

export interface EmailConfig {
  provider: 'auto' | 'resend' | 'smtp' | 'console';
  from: string;
  replyTo: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure: boolean;
  appFrontendUrl: string;
  adminEmail: string;
}

export function getEmailConfig(): EmailConfig {
  // Always load latest .env entries dynamically from process.env / disk
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

  const provider = (process.env.EMAIL_PROVIDER || env.EMAIL_PROVIDER || 'resend').trim() as 'auto' | 'resend' | 'smtp' | 'console';
  const from = (process.env.EMAIL_FROM || env.EMAIL_FROM || 'OM Mobile Art <noreply@ommobileart.com>').trim();
  const replyTo = (process.env.EMAIL_REPLY_TO || env.EMAIL_REPLY_TO || 'support@ommobileart.com').trim();
  const resendApiKey = (process.env.RESEND_API_KEY || env.RESEND_API_KEY || '').trim();
  const smtpHost = (process.env.SMTP_HOST || env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || env.SMTP_PORT || 587);
  const smtpUser = (process.env.SMTP_USER || env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || env.SMTP_PASS || '').trim();
  const smtpSecure = String(process.env.SMTP_SECURE || env.SMTP_SECURE) === 'true';
  const appFrontendUrl = (process.env.APP_FRONTEND_URL || env.APP_FRONTEND_URL || 'http://localhost:8080').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || env.ADMIN_EMAIL || 'admin@ommobileart.com').trim();

  return {
    provider,
    from,
    replyTo,
    resendApiKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    appFrontendUrl,
    adminEmail,
  };
}
