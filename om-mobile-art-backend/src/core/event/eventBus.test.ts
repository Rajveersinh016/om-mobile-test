import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus } from './eventBus.js';
import { DomainEvent } from './domainEvent.js';
import { EventHandler } from './eventHandler.js';
import { 
  ReservationCreatedEvent, 
  CouponAppliedEvent 
} from './events.js';

describe('Domain Event Bus Unit & Integration Tests', () => {
  beforeEach(() => {
    eventBus.clearSubscribers();
  });

  it('should publish an event to a registered subscriber', async () => {
    let receivedEvent: DomainEvent | null = null;

    const handler: EventHandler = {
      async handle(event: DomainEvent) {
        receivedEvent = event;
      },
    };

    eventBus.subscribe('ReservationCreated', handler);

    const event = new ReservationCreatedEvent({
      reservationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      userId: 'f1b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b',
      items: [{ productVariantId: '16b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b', quantity: 2 }],
    });

    await eventBus.publish(event);

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.name).toBe('ReservationCreated');
    expect(receivedEvent!.payload.reservationId).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('should publish to multiple handlers registered for the same event', async () => {
    let count = 0;

    const handler1: EventHandler = {
      async handle() {
        count += 1;
      },
    };

    const handler2: EventHandler = {
      async handle() {
        count += 2;
      },
    };

    eventBus.subscribe('ReservationCreated', handler1);
    eventBus.subscribe('ReservationCreated', handler2);

    const event = new ReservationCreatedEvent({
      reservationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      userId: 'f1b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b',
      items: [],
    });

    await eventBus.publish(event);
    expect(count).toBe(3);
  });

  it('should execute handlers sequentially in their subscription order', async () => {
    const order: string[] = [];

    const handler1: EventHandler = {
      async handle() {
        order.push('first');
      },
    };

    const handler2: EventHandler = {
      async handle() {
        order.push('second');
      },
    };

    eventBus.subscribe('ReservationCreated', handler1);
    eventBus.subscribe('ReservationCreated', handler2);

    const event = new ReservationCreatedEvent({
      reservationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      userId: 'f1b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b',
      items: [],
    });

    await eventBus.publish(event);
    expect(order).toEqual(['first', 'second']);
  });

  it('should maintain failure isolation when a handler throws an error', async () => {
    const executed: string[] = [];

    const handler1: EventHandler = {
      async handle() {
        executed.push('handler1');
      },
    };

    const handler2: EventHandler = {
      async handle() {
        throw new Error('Crashing handler');
      },
    };

    const handler3: EventHandler = {
      async handle() {
        executed.push('handler3');
      },
    };

    eventBus.subscribe('ReservationCreated', handler1);
    eventBus.subscribe('ReservationCreated', handler2);
    eventBus.subscribe('ReservationCreated', handler3);

    const event = new ReservationCreatedEvent({
      reservationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      userId: 'f1b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b',
      items: [],
    });

    // Should complete successfully without throwing
    await expect(eventBus.publish(event)).resolves.not.toThrow();

    // Verify handler1 and handler3 still completed execution
    expect(executed).toEqual(['handler1', 'handler3']);
  });

  it('should complete safely when publishing an unhandled event type', async () => {
    const event = new CouponAppliedEvent({
      userId: 'f1b9f6b6-9bb2-4be1-9b28-cd2d3f3f090b',
      couponId: '8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      code: 'PROMO20',
    });

    await expect(eventBus.publish(event)).resolves.not.toThrow();
  });
});
