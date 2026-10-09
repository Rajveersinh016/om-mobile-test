import { prisma } from '../../../database/client.js';

export interface CheckoutSnapshotItem {
  productId: string;
  productVariantId: string;
  deviceTypeId?: string | null;
  deviceTypeName?: string | null;
  modelId?: string | null;
  modelName?: string | null;
  deviceModel?: string | null;
  customModelName?: string | null;
  brandName?: string | null;
  deviceBrand?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productName: string;
  variantName: string;
  sku: string;
  material?: string;
  finish?: string;
  coverage?: string;
  imageUrl?: string | null;
  designJson?: any;
}

export interface CheckoutSnapshot {
  checkoutId: string;
  userId: string;
  cartId: string;
  addressId?: string;
  shippingAddress: any;
  items: CheckoutSnapshotItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  couponId?: string | null;
  currency: string;
  razorpayOrderId: string;
  amountInPaise: number;
  createdAt: string;
  status: 'PREPARED' | 'VERIFIED' | 'FAILED';
  finalizedOrderId?: string;
}

class CheckoutSessionStore {
  private inMemorySessions: Map<string, CheckoutSnapshot> = new Map();

  public async saveSession(session: CheckoutSnapshot): Promise<void> {
    this.inMemorySessions.set(session.checkoutId, session);
    this.inMemorySessions.set(session.razorpayOrderId, session);

    // Also persist in IdempotencyKey table for durable server restarts
    try {
      await prisma.idempotencyKey.upsert({
        where: { key: `chk_session_${session.checkoutId}` },
        update: {
          responseBody: session as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
          key: `chk_session_${session.checkoutId}`,
          requestHash: session.razorpayOrderId,
          userId: session.userId,
          responseCode: 200,
          responseBody: session as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.idempotencyKey.upsert({
        where: { key: `rzp_session_${session.razorpayOrderId}` },
        update: {
          responseBody: session as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
          key: `rzp_session_${session.razorpayOrderId}`,
          requestHash: session.checkoutId,
          userId: session.userId,
          responseCode: 200,
          responseBody: session as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (err) {
      console.warn('[CheckoutSessionStore] Failed DB upsert, stored in-memory:', (err as any).message);
    }
  }

  public async getSession(idOrRazorpayOrderId: string): Promise<CheckoutSnapshot | null> {
    if (!idOrRazorpayOrderId) return null;

    if (this.inMemorySessions.has(idOrRazorpayOrderId)) {
      return this.inMemorySessions.get(idOrRazorpayOrderId)!;
    }

    try {
      const dbKey = idOrRazorpayOrderId.startsWith('chk_')
        ? `chk_session_${idOrRazorpayOrderId}`
        : `rzp_session_${idOrRazorpayOrderId}`;

      const record = await prisma.idempotencyKey.findUnique({
        where: { key: dbKey },
      });

      if (record && record.responseBody) {
        const session = record.responseBody as unknown as CheckoutSnapshot;
        this.inMemorySessions.set(session.checkoutId, session);
        this.inMemorySessions.set(session.razorpayOrderId, session);
        return session;
      }
    } catch (err) {
      console.warn('[CheckoutSessionStore] DB lookup failed:', (err as any).message);
    }

    return null;
  }
}

export const checkoutSessionStore = new CheckoutSessionStore();
