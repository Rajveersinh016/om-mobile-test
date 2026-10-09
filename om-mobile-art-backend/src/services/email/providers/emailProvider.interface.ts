export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  templateName: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface IEmailProvider {
  name: string;
  sendEmail(payload: SendEmailPayload): Promise<SendEmailResult>;
}
