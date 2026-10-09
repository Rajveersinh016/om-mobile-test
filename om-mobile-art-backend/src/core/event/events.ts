import { DomainEvent } from './domainEvent.js';

export class ReservationCreatedEvent implements DomainEvent {
  name = 'ReservationCreated';
  timestamp = new Date();
  constructor(
    public payload: {
      reservationId: string;
      userId: string;
      items: { productVariantId: string; quantity: number }[];
    }
  ) {}
}

export class ReservationCommittedEvent implements DomainEvent {
  name = 'ReservationCommitted';
  timestamp = new Date();
  constructor(
    public payload: {
      reservationId: string;
      userId: string;
    }
  ) {}
}

export class ReservationCancelledEvent implements DomainEvent {
  name = 'ReservationCancelled';
  timestamp = new Date();
  constructor(
    public payload: {
      reservationId: string;
      userId: string;
    }
  ) {}
}

export class OrderCreatedEvent implements DomainEvent {
  name = 'OrderCreated';
  timestamp = new Date();
  constructor(
    public payload: {
      orderId: string;
      userId: string;
      total: number;
    }
  ) {}
}

export class OrderCancelledEvent implements DomainEvent {
  name = 'OrderCancelled';
  timestamp = new Date();
  constructor(
    public payload: {
      orderId: string;
      userId: string;
    }
  ) {}
}

export class CouponAppliedEvent implements DomainEvent {
  name = 'CouponApplied';
  timestamp = new Date();
  constructor(
    public payload: {
      userId: string;
      couponId: string;
      code: string;
    }
  ) {}
}

export class CouponRedeemedEvent implements DomainEvent {
  name = 'CouponRedeemed';
  timestamp = new Date();
  constructor(
    public payload: {
      userId: string;
      couponId: string;
      code: string;
      orderId: string;
    }
  ) {}
}

export class PaymentCreatedEvent implements DomainEvent {
  name = 'PaymentCreated';
  timestamp = new Date();
  constructor(
    public payload: {
      paymentId: string;
      orderId: string;
      amount: number;
    }
  ) {}
}

export class PaymentSucceededEvent implements DomainEvent {
  name = 'PaymentSucceeded';
  timestamp = new Date();
  constructor(
    public payload: {
      paymentId: string;
      orderId: string;
      amount: number;
    }
  ) {}
}

export class PaymentFailedEvent implements DomainEvent {
  name = 'PaymentFailed';
  timestamp = new Date();
  constructor(
    public payload: {
      paymentId: string;
      orderId: string;
      reason: string;
    }
  ) {}
}

export class InventoryAdjustedEvent implements DomainEvent {
  name = 'InventoryAdjusted';
  timestamp = new Date();
  constructor(
    public payload: {
      variantId: string;
      sku: string;
      previousStock: number;
      newStock: number;
    }
  ) {}
}

export class AccountActivityCreatedEvent implements DomainEvent {
  name = 'AccountActivityCreated';
  timestamp = new Date();
  constructor(
    public payload: {
      userId: string;
      action: string;
      details?: string;
    }
  ) {}
}

export class NotificationRequestedEvent implements DomainEvent {
  name = 'NotificationRequested';
  timestamp = new Date();
  constructor(
    public payload: {
      userId: string;
      title: string;
      message: string;
      channel: 'EMAIL' | 'SMS' | 'PUSH';
    }
  ) {}
}

export class PaymentRequestedEvent implements DomainEvent {
  name = 'PaymentRequested';
  timestamp = new Date();
  constructor(
    public payload: {
      paymentId: string;
      orderId: string;
      amount: number;
    }
  ) {}
}

export class OrderConfirmedEvent implements DomainEvent {
  name = 'OrderConfirmed';
  timestamp = new Date();
  constructor(
    public payload: {
      orderId: string;
      userId: string;
      total: number;
    }
  ) {}
}

export class InventoryCommittedEvent implements DomainEvent {
  name = 'InventoryCommitted';
  timestamp = new Date();
  constructor(
    public payload: {
      reservationId: string;
      userId: string;
      items: { productVariantId: string; quantity: number }[];
    }
  ) {}
}

