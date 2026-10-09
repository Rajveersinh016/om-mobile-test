import { OrderStatus, PaymentStatus } from '@prisma/client';
import { ValidationError } from '../../../core/exceptions/exceptions.js';

export function validateOrderStatusTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return;

  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING_PAYMENT: ['PAID', 'CONFIRMED', 'PROCESSING', 'FAILED', 'CANCELLED'],
    PAID: ['CONFIRMED', 'PROCESSING', 'PRINTING', 'REFUNDED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'PRINTING', 'CANCELLED'],
    PROCESSING: ['PRINTING', 'QUALITY_CHECK', 'PACKED', 'CANCELLED'],
    PRINTING: ['QUALITY_CHECK', 'PACKED', 'CANCELLED'],
    QUALITY_CHECK: ['PACKED', 'READY_TO_SHIP', 'CANCELLED'],
    PACKED: ['READY_TO_SHIP', 'SHIPPED', 'CANCELLED'],
    READY_TO_SHIP: ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'RETURNED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'COMPLETED', 'RETURNED'],
    DELIVERED: ['COMPLETED', 'RETURNED', 'REFUNDED'],
    COMPLETED: ['RETURNED', 'REFUNDED'],
    CANCELLED: [],
    FAILED: [],
    RETURNED: ['REFUNDED'],
    REFUNDED: [],
  };

  const allowed = validTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new ValidationError(`Invalid order status transition from ${from} to ${to}`);
  }
}

export function validatePaymentStatusTransition(from: PaymentStatus, to: PaymentStatus) {
  if (from === to) return;

  const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['PROCESSING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED', 'CANCELLED'],
    PROCESSING: ['AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED'],
    AUTHORIZED: ['CAPTURED', 'PAID', 'FAILED'],
    CAPTURED: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    PAID: ['REFUNDED', 'PARTIALLY_REFUNDED'],
    FAILED: [],
    CANCELLED: [],
    REFUNDED: [],
    PARTIALLY_REFUNDED: [],
  };

  const allowed = validTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new ValidationError(`Invalid payment status transition from ${from} to ${to}`);
  }
}
