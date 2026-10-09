export enum EmailTemplateType {
  WELCOME = 'WELCOME',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  PAYMENT_SUCCESSFUL = 'PAYMENT_SUCCESSFUL',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
  CONTACT_AUTO_REPLY = 'CONTACT_AUTO_REPLY',
  CONTACT_ADMIN_NOTIFICATION = 'CONTACT_ADMIN_NOTIFICATION',
}

export interface BaseRecipient {
  email: string;
  name?: string;
}

export interface WelcomeContext {
  recipient: BaseRecipient;
  shopUrl?: string;
}

export interface EmailVerificationContext {
  recipient: BaseRecipient;
  verificationUrl: string;
  expiresInMinutes?: number;
}

export interface ForgotPasswordContext {
  recipient: BaseRecipient;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface PasswordResetSuccessContext {
  recipient: BaseRecipient;
  loginUrl?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  device?: string;
  finish?: string;
  material?: string;
  image?: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state?: string;
  zip: string;
  phone?: string;
}

export interface OrderConfirmationContext {
  recipient: BaseRecipient;
  orderNumber: string;
  orderDate?: string;
  items: OrderItem[];
  subtotal: number;
  discount?: number;
  shippingFee?: number;
  total: number;
  shippingAddress: ShippingAddress;
  trackOrderUrl?: string;
}

export interface PaymentSuccessfulContext {
  recipient: BaseRecipient;
  orderNumber: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  paymentDate?: string;
}

export interface OrderShippedContext {
  recipient: BaseRecipient;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: string;
  shippingAddress: ShippingAddress;
}

export interface OutForDeliveryContext {
  recipient: BaseRecipient;
  orderNumber: string;
  carrier?: string;
  estimatedDeliveryTime?: string;
  shippingAddress: ShippingAddress;
}

export interface DeliveredContext {
  recipient: BaseRecipient;
  orderNumber: string;
  deliveredDate?: string;
  reviewUrl?: string;
  shippingAddress: ShippingAddress;
}

export interface CancelledContext {
  recipient: BaseRecipient;
  orderNumber: string;
  reason?: string;
  refundAmount?: number;
}

export interface RefundInitiatedContext {
  recipient: BaseRecipient;
  orderNumber: string;
  refundReference: string;
  amount: number;
  processingDays?: string;
}

export interface RefundCompletedContext {
  recipient: BaseRecipient;
  orderNumber: string;
  refundReference: string;
  amount: number;
  paymentMethod?: string;
}

export interface ContactFormAutoReplyContext {
  recipient: BaseRecipient;
  subject: string;
  message: string;
  referenceId?: string;
}

export interface ContactFormAdminNotificationContext {
  adminEmail: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  phone?: string;
  submittedAt?: string;
}

export type TemplateContextMap = {
  [EmailTemplateType.WELCOME]: WelcomeContext;
  [EmailTemplateType.EMAIL_VERIFICATION]: EmailVerificationContext;
  [EmailTemplateType.FORGOT_PASSWORD]: ForgotPasswordContext;
  [EmailTemplateType.PASSWORD_RESET_SUCCESS]: PasswordResetSuccessContext;
  [EmailTemplateType.ORDER_CONFIRMATION]: OrderConfirmationContext;
  [EmailTemplateType.PAYMENT_SUCCESSFUL]: PaymentSuccessfulContext;
  [EmailTemplateType.ORDER_SHIPPED]: OrderShippedContext;
  [EmailTemplateType.OUT_FOR_DELIVERY]: OutForDeliveryContext;
  [EmailTemplateType.DELIVERED]: DeliveredContext;
  [EmailTemplateType.CANCELLED]: CancelledContext;
  [EmailTemplateType.REFUND_INITIATED]: RefundInitiatedContext;
  [EmailTemplateType.REFUND_COMPLETED]: RefundCompletedContext;
  [EmailTemplateType.CONTACT_AUTO_REPLY]: ContactFormAutoReplyContext;
  [EmailTemplateType.CONTACT_ADMIN_NOTIFICATION]: ContactFormAdminNotificationContext;
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
