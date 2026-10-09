export interface DomainEvent<T = any> {
  name: string;
  timestamp: Date;
  payload: T;
}
