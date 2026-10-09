import { SendEmailPayload, SendEmailResult, IEmailProvider } from '../providers/emailProvider.interface.js';
import { emailLogger } from '../logger/emailLogger.js';

export interface QueueTask {
  id: string;
  payload: SendEmailPayload;
  provider: IEmailProvider;
  attempts: number;
  maxAttempts: number;
  resolve: (result: SendEmailResult) => void;
}

export class EmailQueue {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private concurrency = 2;
  private activeWorkers = 0;

  enqueue(payload: SendEmailPayload, provider: IEmailProvider, maxAttempts = 3): Promise<SendEmailResult> {
    return new Promise<SendEmailResult>((resolve) => {
      const task: QueueTask = {
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        payload,
        provider,
        attempts: 0,
        maxAttempts,
        resolve,
      };

      this.queue.push(task);
      emailLogger.logQueueEnqueued(payload.templateName, payload.to, this.queue.length);
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeWorkers++;

    try {
      task.attempts++;
      emailLogger.logDispatchAttempt(task.payload.templateName, task.payload.to, task.provider.name);
      
      const result = await task.provider.sendEmail(task.payload);

      if (result.success || task.attempts >= task.maxAttempts) {
        task.resolve(result);
      } else {
        emailLogger.logQueueRetry(task.payload.templateName, task.payload.to, task.attempts, task.maxAttempts);
        // Re-enqueue with slight backoff
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, 1000 * task.attempts);
      }
    } catch (error) {
      if (task.attempts >= task.maxAttempts) {
        task.resolve({
          success: false,
          provider: task.provider.name,
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        this.queue.push(task);
      }
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}

export const emailQueue = new EmailQueue();
