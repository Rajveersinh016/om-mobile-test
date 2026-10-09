import { DomainEvent } from './domainEvent.js';
import { EventHandler } from './eventHandler.js';

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe(eventName: string, handler: EventHandler): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.name;
    const handlers = this.handlers.get(eventName) || [];

    // Trigger all registered handlers sequentially
    // Wrap in try-catch to enforce failure isolation
    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (err) {
        console.error(
          `[EventBus] Error in handler for event '${eventName}':`,
          err
        );
      }
    }
  }

  clearSubscribers(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
