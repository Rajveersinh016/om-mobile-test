import { prisma } from '../../../database/client.js';
import { cartService } from '../../cart/services/cartService.js';
import { cartRepository } from '../../cart/repositories/cartRepository.js';
import { razorpayClient } from '../../../services/payment/razorpayClient.js';
import { checkoutSessionStore, CheckoutSnapshot, CheckoutSnapshotItem } from './checkoutSessionStore.js';
import { orderNumberService } from '../../order/services/orderNumberService.js';
import { outboxService } from '../../../services/outboxService.js';
import { ValidationError, NotFoundError, AppError } from '../../../core/exceptions/exceptions.js';
import { OrderStatus, PaymentStatus, PaymentGateway } from '@prisma/client';
import crypto from 'crypto';

export class CheckoutService {
  async getCheckoutState(userId: string): Promise<any> {
    const cart = await cartService.getCart(userId);
    const defaultAddress = await prisma.address.findFirst({
      where: { userId, isDefaultShipping: true },
    });
    return {
      cart,
      defaultShippingAddress: defaultAddress,
    };
  }

  /**
   * Reconcile/sync active cart items from client session into DB cart before preparation
   */
  async syncCartFromClient(userId: string, clientCartItems: any[]): Promise<void> {
    if (!clientCartItems || !Array.isArray(clientCartItems) || clientCartItems.length === 0) {
      return;
    }

    const userCart = await cartRepository.findOrCreateCart(userId);
    const resolvedItems: {
      productVariantId: string;
      quantity: number;
      deviceTypeId: string | null;
      modelId: string | null;
      customModelName: string | null;
    }[] = [];

    for (const raw of clientCartItems) {
      const pid = raw.productId || raw.id;
      if (!pid) continue;

      // Find product in DB
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: String(pid) },
            { slug: String(pid) }
          ],
          deletedAt: null
        },
        include: {
          variants: true,
          models: {
            include: {
              brand: true
            }
          }
        }
      });

      if (!product || product.variants.length === 0) continue;

      // Find variant
      let variant = null;
      if (raw.productVariantId || raw.variantId) {
        variant = product.variants.find(v => v.id === (raw.productVariantId || raw.variantId));
      }
      if (!variant && raw.finish && raw.material) {
        variant = product.variants.find(
          v => v.finish.toLowerCase() === String(raw.finish).toLowerCase() &&
               v.material.toLowerCase() === String(raw.material).toLowerCase()
        );
      }
      if (!variant) {
        variant = product.variants[0];
      }
      if (!variant) continue;

      // Resolve deviceTypeId
      let dtId: string | null = raw.deviceTypeId || null;
      let modelId: string | null = raw.modelId || null;

      if (modelId) {
        const foundModel = await prisma.model.findUnique({
          where: { id: modelId },
          include: { brand: true }
        });
        if (foundModel) {
          if (!dtId && foundModel.brand?.deviceTypeId) {
            dtId = foundModel.brand.deviceTypeId;
          }
        } else {
          modelId = null;
        }
      }

      if (!dtId && (raw.deviceType || raw.device)) {
        const dtName = String(raw.deviceType || raw.device).trim().toLowerCase();
        const foundDt = await prisma.deviceType.findFirst({
          where: {
            OR: [
              { slug: dtName },
              { name: { equals: dtName } }
            ],
            deletedAt: null
          }
        });
        if (foundDt) {
          dtId = foundDt.id;
        }
      }

      const minQty = product.minOrderQty || 1;
      const qty = Math.max(minQty, Number(raw.quantity || raw.qty || 1));
      const customModelName = raw.customModelName || raw.deviceModel || null;

      resolvedItems.push({
        productVariantId: variant.id,
        quantity: qty,
        deviceTypeId: dtId,
        modelId,
        customModelName: customModelName ? String(customModelName) : null
      });
    }

    if (resolvedItems.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId: userCart.id }
      });

      for (const item of resolvedItems) {
        await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            deviceTypeId: item.deviceTypeId,
            modelId: item.modelId,
            customModelName: item.customModelName
          }
        });
      }
    }
  }

  /**
   * PART 5 & 17: Single Authoritative Checkout Snapshot Preparation & Razorpay Order Creation
   * DOES NOT create a business Order in DB before payment.
   */
  async prepareCheckout(
    userId: string,
    addressId?: string,
    shippingAddressInput?: any,
    couponCodeInput?: string,
    gateway: PaymentGateway = 'RAZORPAY',
    clientCartItems?: any[]
  ): Promise<any> {
    // 0. Synchronize Cart from client if provided
    if (clientCartItems && Array.isArray(clientCartItems) && clientCartItems.length > 0) {
      await this.syncCartFromClient(userId, clientCartItems);
    }

    // 1. Resolve Shipping Address
    let addressSnapshot: any = null;
    let resolvedAddressId: string | undefined = addressId;

    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId },
      });
      if (address) {
        addressSnapshot = {
          fullName: address.fullName,
          phone: address.phone,
          alternativePhone: address.alternativePhone,
          companyName: address.companyName,
          gstNumber: address.gstNumber,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          country: address.country,
          pincode: address.pincode,
        };
      }
    }

    if (!addressSnapshot && shippingAddressInput) {
      addressSnapshot = {
        fullName: shippingAddressInput.fullName || `${shippingAddressInput.firstName || ''} ${shippingAddressInput.lastName || ''}`.trim() || 'Customer',
        phone: shippingAddressInput.phone || shippingAddressInput.mobile || '',
        alternativePhone: shippingAddressInput.alternativePhone || null,
        companyName: shippingAddressInput.companyName || null,
        gstNumber: shippingAddressInput.gstNumber || null,
        addressLine1: shippingAddressInput.addressLine1 || shippingAddressInput.street || '',
        addressLine2: shippingAddressInput.addressLine2 || null,
        landmark: shippingAddressInput.landmark || null,
        city: shippingAddressInput.city || '',
        state: shippingAddressInput.state || '',
        country: shippingAddressInput.country || 'India',
        pincode: shippingAddressInput.pincode || shippingAddressInput.zip || '',
      };
    }

    if (!addressSnapshot) {
      // Try user default address
      const defaultAddr = await prisma.address.findFirst({
        where: { userId, isDefaultShipping: true },
      });
      if (defaultAddr) {
        resolvedAddressId = defaultAddr.id;
        addressSnapshot = {
          fullName: defaultAddr.fullName,
          phone: defaultAddr.phone,
          addressLine1: defaultAddr.addressLine1,
          addressLine2: defaultAddr.addressLine2,
          city: defaultAddr.city,
          state: defaultAddr.state,
          country: defaultAddr.country,
          pincode: defaultAddr.pincode,
        };
      }
    }

    if (!addressSnapshot || !addressSnapshot.addressLine1 || !addressSnapshot.pincode) {
      throw new ValidationError('A valid shipping address is required for checkout preparation.');
    }

    // 2. Fetch User Details for Snapshot
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 3. Fetch Cart from DB & Calculate Authoritative Database Prices
    const evaluatedCart = await cartService.getCart(userId);
    if (!evaluatedCart || !evaluatedCart.items || evaluatedCart.items.length === 0) {
      throw new ValidationError('Cannot prepare checkout for an empty cart.');
    }

    if (!evaluatedCart.canCheckout) {
      const ineligibleItems = evaluatedCart.items
        .filter((i: any) => i.status !== 'AVAILABLE')
        .map((i: any) => {
          const name = i.product?.name || 'Item';
          const reason = i.status === 'OUT_OF_STOCK' ? 'out of stock' : i.status.toLowerCase().replace(/_/g, ' ');
          return `"${name}" (${reason})`;
        });
      const message = ineligibleItems.length > 0
        ? `Cannot proceed to checkout. The following items are unavailable: ${ineligibleItems.join(', ')}. Please update your cart.`
        : 'Cart items are not eligible for checkout.';
      throw new ValidationError(message);
    }

    const summary = evaluatedCart.summary;
    const subtotal = summary.subtotal;
    const shipping = summary.shipping;
    const discount = summary.discount;
    const total = summary.total;

    if (total <= 0) {
      throw new ValidationError('Invalid checkout total amount.');
    }

    const amountInPaise = Math.round(total * 100);

    // 4. Create Razorpay Order on Gateway (Only for online payments - NEVER for COD)
    let razorpayOrder: any = null;
    if (gateway !== ('COD' as PaymentGateway)) {
      const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      try {
        razorpayOrder = await razorpayClient.createOrder(
          amountInPaise,
          'INR',
          receipt,
          {
            userId,
            cartId: evaluatedCart.id,
          }
        );
      } catch (err: any) {
        console.error('[CheckoutService] Razorpay order creation failed:', err.message || err);
        throw new AppError(
          err.message || 'Failed to initialize Razorpay payment order on backend.',
          400,
          'RAZORPAY_ORDER_FAILED'
        );
      }
    }

    // 5. Build Snapshot Items
    const snapshotItems: CheckoutSnapshotItem[] = evaluatedCart.items.map((item: any) => {
      // Prioritize authoritative product name:
      // 1. product.name or variant.product.name from DB
      // 2. item.productName (only if valid and not generic fallback)
      const catalogName = item.product?.name || item.variant?.product?.name || null;
      let resolvedProductName = catalogName;
      if (!resolvedProductName) {
        resolvedProductName = item.productName;
      }
      if (!resolvedProductName || resolvedProductName.trim().toLowerCase() === 'vinyl skin') {
        resolvedProductName = catalogName || item.productName || 'Device Skin';
      }

      // Prioritize authoritative image URL:
      // 1. item.imageUrl
      // 2. item.variant.image
      // 3. item.product.image or item.variant.product.image (primary thumbnail)
      // 4. item.product.images[0].url or item.variant.product.images[0].url
      const resolvedImageUrl = 
        item.imageUrl ||
        item.variant?.image ||
        item.product?.image ||
        item.variant?.product?.image ||
        (item.product?.images && item.product?.images[0]?.url) ||
        (item.variant?.product?.images && item.variant?.product?.images[0]?.url) ||
        null;

      const resolvedBrand = item.brandName || item.deviceBrand || item.model?.brand?.name || null;
      const resolvedModelName = item.modelName || item.customModelName || item.model?.name || item.deviceModel || null;
      const resolvedDeviceTypeName = item.deviceTypeName || item.deviceType?.name || item.model?.brand?.deviceType?.name || 'Mobile';

      return {
        productId: item.productId || item.variant?.productId || item.product?.id,
        productVariantId: item.productVariantId,
        deviceTypeId: item.deviceTypeId || null,
        deviceTypeName: resolvedDeviceTypeName,
        modelId: item.modelId || null,
        modelName: resolvedModelName,
        deviceModel: resolvedModelName,
        customModelName: item.customModelName || resolvedModelName,
        brandName: resolvedBrand,
        deviceBrand: resolvedBrand,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        productName: resolvedProductName,
        variantName: item.variantName || `${item.variant?.finish || 'Matte'} / ${item.variant?.material || 'Vinyl'}`,
        sku: item.sku || item.variant?.sku || 'SKU-GEN',
        material: item.material || item.variant?.material || '3M Vinyl',
        finish: item.finish || item.variant?.finish || 'Matte',
        coverage: item.coverage || 'Full Back',
        imageUrl: resolvedImageUrl,
      };
    });

    const checkoutId = `chk_${crypto.randomUUID()}`;

    // 6. Save Checkout Snapshot in store (NO ORDER RECORD IN DATABASE YET)
    const sessionSnapshot: CheckoutSnapshot = {
      checkoutId,
      userId,
      cartId: evaluatedCart.id,
      addressId: resolvedAddressId,
      shippingAddress: addressSnapshot,
      items: snapshotItems,
      subtotal,
      shipping,
      discount,
      total,
      couponCode: couponCodeInput || evaluatedCart.coupon?.code || null,
      couponId: evaluatedCart.coupon?.id || null,
      currency: 'INR',
      razorpayOrderId: razorpayOrder?.id || null,
      amountInPaise,
      createdAt: new Date().toISOString(),
      status: 'PREPARED',
    };

    await checkoutSessionStore.saveSession(sessionSnapshot);

    console.log('[CHECKOUT PREPARE]', {
      checkoutId,
      gateway,
      razorpayOrderId: razorpayOrder?.id || null,
      subtotal,
      shipping,
      discount,
      total,
      amountInPaise,
    });

    return {
      checkoutId,
      razorpayOrderId: razorpayOrder?.id || null,
      keyId: razorpayOrder ? razorpayClient.getKeyId() : null,
      amount: amountInPaise, // in paise for Razorpay Checkout SDK
      subtotal,
      shipping,
      discount,
      total,
      currency: 'INR',
      items: snapshotItems,
      customerName: addressSnapshot.fullName || user.name || 'Customer',
      customerEmail: user.email,
      customerPhone: addressSnapshot.phone || user.phone || '',
    };
  }

  /**
   * Cash On Delivery Order Finalization (creates COD order immediately)
   */
  async createCodOrder(
    userId: string,
    addressId?: string,
    shippingAddressInput?: any,
    couponCodeInput?: string,
    clientCartItems?: any[]
  ): Promise<any> {
    const prep = await this.prepareCheckout(userId, addressId, shippingAddressInput, couponCodeInput, 'COD' as any, clientCartItems);
    const session = await checkoutSessionStore.getSession(prep.checkoutId);
    if (!session) {
      throw new ValidationError('Checkout session invalid');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const outboxEventIds: string[] = [];

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await orderNumberService.generateOrderNumber(tx);

      const customerSnapshot = {
        name: user.name || session.shippingAddress.fullName || '',
        email: user.email,
        phone: user.phone || session.shippingAddress.phone || '',
      };

      const pricingSnapshot = {
        subtotal: session.subtotal,
        discount: session.discount,
        coupon: session.couponCode ? { code: session.couponCode, amount: session.discount } : null,
        shipping: session.shipping,
        tax: 0,
        grandTotal: session.total,
      };

      const orderItemsData = await Promise.all(session.items.map(async (item) => {
        let resolvedModelName = item.customModelName || item.modelName || item.deviceModel || null;
        let resolvedBrandName = item.deviceBrand || item.brandName || null;

        // If modelName/brandName are missing but modelId is present, resolve from DB
        if ((!resolvedModelName || !resolvedBrandName) && item.modelId && /^[0-9a-f-]{36}$/i.test(item.modelId)) {
          const modelRec = await tx.model.findUnique({
            where: { id: item.modelId },
            include: { brand: { include: { deviceType: true } } }
          });
          if (modelRec) {
            if (!resolvedModelName) resolvedModelName = modelRec.name;
            if (!resolvedBrandName) resolvedBrandName = modelRec.brand?.name || null;
          }
        }

        return {
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          pricePaid: item.unitPrice,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          deviceName: resolvedModelName,
          deviceModel: resolvedModelName,
          customModelName: item.customModelName || resolvedModelName,
          brandName: resolvedBrandName,
          deviceBrand: resolvedBrandName,
          deviceType: item.deviceTypeName || 'Mobile',
          material: item.material || '3M Vinyl',
          finish: item.finish || 'Matte',
          coverage: item.coverage || 'Full Back',
          unitPrice: item.unitPrice,
          unitDiscount: 0,
          couponAllocation: 0,
          taxPercentage: 0,
          imageUrl: item.imageUrl || null,
        };
      }));

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal: session.subtotal,
          discount: session.discount,
          tax: 0,
          shippingFee: session.shipping,
          total: session.total,
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          shippingAddress: session.shippingAddress,
          customerSnapshot,
          pricingSnapshot,
          couponCode: session.couponCode || null,
          couponId: session.couponId || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          userId,
          gateway: 'RAZORPAY',
          status: 'PENDING',
          amount: session.total,
          paymentMethod: 'COD',
        },
      });

      // Clear Cart
      const userCart = await tx.cart.findUnique({ where: { userId } });
      if (userCart) {
        await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
      }

      await tx.orderTimelineEvent.create({
        data: {
          orderId: newOrder.id,
          eventType: 'ORDER_CREATED',
          title: 'COD Order Placed',
          description: 'Cash on delivery order placed successfully',
          actorType: 'CUSTOMER',
          actorId: userId,
        },
      });

      const ev1 = await outboxService.saveEvent(tx, 'OrderCreated', {
        orderId: newOrder.id,
        userId,
        total: session.total,
      });
      outboxEventIds.push(ev1.id);

      return newOrder;
    });

    for (const eventId of outboxEventIds) {
      try {
        await outboxService.dispatchEventImmediate(eventId);
      } catch (err) {}
    }

    return order;
  }
}

export const checkoutService = new CheckoutService();
