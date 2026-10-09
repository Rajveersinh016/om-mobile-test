import { logger } from '../../logger.js';

export class EmailLogger {
  logDispatchAttempt(templateName: string, recipient: string, provider: string): void {
    logger.info(`[Email Service] Attempting dispatch | Template: ${templateName} | Recipient: ${recipient} | Provider: ${provider}`);
  }

  logDispatchSuccess(templateName: string, recipient: string, messageId?: string): void {
    logger.info(`[Email Service] ✓ Email Sent | Template: ${templateName} | Recipient: ${recipient}${messageId ? ` | ID: ${messageId}` : ''}`);
  }

  logDispatchFailure(templateName: string, recipient: string, error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Email Service] ❌ Email Dispatch Failed | Template: ${templateName} | Recipient: ${recipient} | Error: ${errorMsg}`);
  }

  logQueueEnqueued(templateName: string, recipient: string, queueSize: number): void {
    logger.debug(`[Email Queue] Enqueued job | Template: ${templateName} | Recipient: ${recipient} | Current Queue Length: ${queueSize}`);
  }

  logQueueRetry(templateName: string, recipient: string, attempt: number, maxAttempts: number): void {
    logger.warn(`[Email Queue] Retrying job (${attempt}/${maxAttempts}) | Template: ${templateName} | Recipient: ${recipient}`);
  }
}

export const emailLogger = new EmailLogger();
