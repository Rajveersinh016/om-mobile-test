import { Prisma } from '@prisma/client';
import { prisma } from '../database/client.js';
import { eventBus } from '../core/event/eventBus.js';
import * as Events from '../core/event/events.js';

export function createEventInstance(name: string, payload: any) {
  const className = name.endsWith('Event') ? name : `${name}Event`;
  const EventClass = (Events as any)[className];
  if (!EventClass) {
    throw new Error(`Unknown event name mapping: ${className}`);
  }
  return new EventClass(payload);
}

export class OutboxService {
  async saveEvent(tx: Prisma.TransactionClient, name: string, payload: any): Promise<any> {
    return tx.outboxEvent.create({
      data: {
        name,
        payload: payload as any,
        status: 'PENDING',
      },
    });
  }

  async dispatchEventImmediate(eventId: string): Promise<void> {
    const eventRecord = await prisma.outboxEvent.findUnique({
      where: { id: eventId },
    });
    if (!eventRecord || eventRecord.status === 'PROCESSED') return;

    try {
      const eventInstance = createEventInstance(eventRecord.name, eventRecord.payload);
      await eventBus.publish(eventInstance);

      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
        },
      });
    } catch (err: any) {
      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          lastError: err.message || String(err),
          retryCount: { increment: 1 },
          nextRetryAt: new Date(Date.now() + 5000), // Retry in 5 seconds
        },
      });
      throw err;
    }
  }

  async processPendingEvents(): Promise<void> {
    const now = new Date();
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        retryCount: { lt: 5 },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const eventRecord of events) {
      try {
        await prisma.outboxEvent.update({
          where: { id: eventRecord.id },
          data: { status: 'PROCESSING' },
        });

        const eventInstance = createEventInstance(eventRecord.name, eventRecord.payload);
        await eventBus.publish(eventInstance);

        await prisma.outboxEvent.update({
          where: { id: eventRecord.id },
          data: {
            status: 'PROCESSED',
          },
        });
      } catch (err: any) {
        const nextRetryAt = new Date(Date.now() + Math.pow(2, eventRecord.retryCount) * 1000);
        await prisma.outboxEvent.update({
          where: { id: eventRecord.id },
          data: {
            status: 'FAILED',
            lastError: err.message || String(err),
            retryCount: eventRecord.retryCount + 1,
            nextRetryAt,
          },
        });
      }
    }
  }
}

export const outboxService = new OutboxService();

export function startOutboxWorker(intervalMs = 10000) {
  const interval = setInterval(async () => {
    try {
      await outboxService.processPendingEvents();
    } catch (err) {
      console.error('[OutboxWorker] Error processing pending events:', err);
    }
  }, intervalMs);

  // Unref interval to allow process to exit cleanly in tests
  if (interval.unref) {
    interval.unref();
  }
  return interval;
}
