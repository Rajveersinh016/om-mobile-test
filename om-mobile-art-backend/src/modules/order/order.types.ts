import { OrderStatus, PaymentStatus, FulfillmentStatus, OrderPriority } from '@prisma/client';

export interface OrderFilterQuery {
  search?: string;
  status?: OrderStatus | 'ALL';
  paymentStatus?: PaymentStatus | 'ALL';
  fulfillmentStatus?: FulfillmentStatus | 'ALL';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'createdAt' | 'total' | 'orderNumber';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface OrderStatusUpdateInput {
  status: OrderStatus;
  comment?: string;
}

export interface PaymentStatusUpdateInput {
  paymentStatus: PaymentStatus;
  comment?: string;
}

export interface FulfillmentStatusUpdateInput {
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;
  courierName?: string;
  courierLink?: string;
  comment?: string;
}

export interface OrderNoteInput {
  content: string;
  isInternal?: boolean;
}

export interface BulkUpdateStatusInput {
  orderIds: string[];
  status: OrderStatus;
  comment?: string;
}

export interface CreateOrderInput {
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  items: Array<{
    productVariantId: string;
    quantity: number;
    pricePaid?: number;
    productName?: string;
    variantName?: string;
    sku?: string;
    imageUrl?: string;
    modelId?: string;
    brandName?: string;
    deviceType?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceName?: string;
    material?: string;
    finish?: string;
    coverage?: string;
  }>;
  shippingAddress: any;
  billingAddress?: any;
  customerNotes?: string;
  couponCode?: string;
}

export interface OrderDashboardMetrics {
  pendingOrders: number;
  processingOrders: number;
  packedOrders: number;
  readyToShipOrders: number;
  cancelledOrders: number;
  todaysOrdersCount: number;
  todaysRevenue: number;
  averageOrderValue: number;
}
