import { DomainEvent } from './domainEvent.js';

export interface EventHandler<T = any> {
  handle(event: DomainEvent<T>): Promise<void>;
}
