export interface PricingSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface PricingCartItem {
  price: number;
  quantity: number;
  productId: string;
  categoryId: string;
  collectionIds?: string[];
  modelIds?: string[];
}

export class PricingService {
  calculateItemPrice(basePrice: number, priceOffset: number): number {
    return basePrice + priceOffset;
  }

  validateCoupon(
    coupon: any,
    subtotal: number,
    usagesCount: number,
    userUsagesCount: number,
    completedOrdersCount: number
  ): { isValid: boolean; reason?: string } {
    if (!coupon) {
      return { isValid: false, reason: 'Coupon not found' };
    }

    if (!coupon.isActive) {
      return { isValid: false, reason: 'Coupon is inactive' };
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { isValid: false, reason: 'Coupon validity period has not started yet' };
    }

    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { isValid: false, reason: 'Coupon has expired' };
    }

    if (coupon.globalUsageLimit !== null && usagesCount >= coupon.globalUsageLimit) {
      return { isValid: false, reason: 'Coupon global usage limit has been reached' };
    }

    if (coupon.perUserUsageLimit !== null && userUsagesCount >= coupon.perUserUsageLimit) {
      return { isValid: false, reason: 'Coupon personal usage limit has been reached' };
    }

    if (coupon.minCartValue !== null && subtotal < coupon.minCartValue) {
      return { isValid: false, reason: `Minimum cart value of ${coupon.minCartValue} is required` };
    }

    if (coupon.firstOrderOnly && completedOrdersCount > 0) {
      return { isValid: false, reason: 'Coupon is valid for the first order only' };
    }

    return { isValid: true };
  }

  calculateDiscount(
    items: PricingCartItem[],
    coupon: any,
    validationResult: { isValid: boolean }
  ): number {
    if (!validationResult.isValid || !coupon) {
      return 0;
    }

    // Filter applicable items
    const applicableItems = items.filter((item) => {
      // 1. Excluded products
      if (coupon.excludedProductIds && coupon.excludedProductIds.includes(item.productId)) {
        return false;
      }

      // 2. If applicable categories/collections/products/devices are defined, check them
      const hasCategories = coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0;
      const hasCollections = coupon.applicableCollectionIds && coupon.applicableCollectionIds.length > 0;
      const hasProducts = coupon.applicableProductIds && coupon.applicableProductIds.length > 0;
      const hasDevices = coupon.applicableDeviceIds && coupon.applicableDeviceIds.length > 0;

      // If no filters are defined, it applies globally
      if (!hasCategories && !hasCollections && !hasProducts && !hasDevices) {
        return true;
      }

      let matches = false;
      if (hasCategories && coupon.applicableCategoryIds.includes(item.categoryId)) {
        matches = true;
      }
      if (hasCollections && item.collectionIds && item.collectionIds.some((id) => coupon.applicableCollectionIds.includes(id))) {
        matches = true;
      }
      if (hasProducts && coupon.applicableProductIds.includes(item.productId)) {
        matches = true;
      }
      if (hasDevices && item.modelIds && item.modelIds.some((id) => coupon.applicableDeviceIds.includes(id))) {
        matches = true;
      }

      return matches;
    });

    const applicableSubtotal = applicableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = applicableSubtotal * (coupon.discountValue / 100);
      if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'FIXED') {
      discount = Math.min(coupon.discountValue, applicableSubtotal);
    } else if (coupon.discountType === 'FREE_SHIPPING') {
      discount = 0;
    }

    return parseFloat(discount.toFixed(2));
  }

  calculateSummary(
    items: PricingCartItem[],
    coupon?: any,
    couponUsagesCount = 0,
    userUsagesCount = 0,
    completedOrdersCount = 0,
    shippingConfig?: { freeThreshold?: number; flatRate?: number }
  ): PricingSummary & { couponValid?: boolean; couponReason?: string } {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let discount = 0;
    let couponValid = undefined;
    let couponReason = undefined;

    if (coupon) {
      const validation = this.validateCoupon(
        coupon,
        subtotal,
        couponUsagesCount,
        userUsagesCount,
        completedOrdersCount
      );
      couponValid = validation.isValid;
      couponReason = validation.reason;
      if (validation.isValid) {
        discount = this.calculateDiscount(items, coupon, validation);
      }
    }

    const freeThreshold = shippingConfig?.freeThreshold ?? 999;
    const flatRate = shippingConfig?.flatRate ?? 49;

    let shipping = 0;
    if (subtotal > 0) {
      if (coupon && couponValid && coupon.discountType === 'FREE_SHIPPING') {
        shipping = 0;
      } else if (subtotal >= freeThreshold) {
        shipping = 0; // Free shipping when subtotal reaches or exceeds freeThreshold (₹999)
      } else {
        shipping = flatRate; // Flat shipping rate (₹49) when subtotal is below freeThreshold
      }
    }

    let tax = 0;

    const total = Math.max(0, parseFloat((subtotal - discount + shipping).toFixed(2)));

    return {
      subtotal,
      discount,
      shipping,
      tax,
      total,
      couponValid,
      couponReason,
    };
  }
}

export const pricingService = new PricingService();

