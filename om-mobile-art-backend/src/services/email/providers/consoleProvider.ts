import { IEmailProvider, SendEmailPayload, SendEmailResult } from './emailProvider.interface.js';
import { emailLogger } from '../logger/emailLogger.js';

export class ConsoleProvider implements IEmailProvider {
  name = 'console';

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
    const messageId = `dev-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    console.log('\n==================================================');
    console.log(`✉️ [DEV EMAIL DISPATCH] Template: ${payload.templateName}`);
    console.log(`To: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`From: ${payload.from || 'default'}`);
    console.log('------------------- TEXT BODY -------------------');
    console.log(payload.text);
    console.log('==================================================\n');

    emailLogger.logDispatchSuccess(payload.templateName, payload.to, messageId);

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }
}
