import { cartRepository } from '../repositories/cartRepository.js';
import { productSelectionService } from '../../catalog/services/productSelectionService.js';
import { pricingService } from '../../catalog/services/pricingService.js';
import { prisma } from '../../../database/client.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError 
} from '../../../core/exceptions/exceptions.js';
import { CartItem } from '@prisma/client';

export class CartService {
  async logActivity(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    details?: string
  ): Promise<void> {
    await prisma.accountActivity.create({
      data: {
        userId,
        action,
        ipAddress,
        userAgent,
        details,
      },
    });
  }

  async getCart(userId: string): Promise<any> {
    let cart = await cartRepository.findOrCreateCart(userId);
    
    // Check and auto-correct minOrderQty violations
    let updatedAny = false;
    for (const item of cart.items) {
      const minQty = item.variant?.product?.minOrderQty || 1;
      if (item.quantity < minQty) {
        await cartRepository.updateItemQuantity(item.id, minQty);
        item.quantity = minQty;
        updatedAny = true;
      }
    }

    if (updatedAny) {
      cart = await cartRepository.findOrCreateCart(userId);
    }
    
    let canCheckout = true;
    const items = cart.items.map((item) => {
      // Validate the pre-loaded selection synchronously to avoid N+1 queries
      const validation = productSelectionService.validatePreloadedSelection(
        item.variant?.product,
        item.variant
      );

      let status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'UNPUBLISHED' | 'DELETED' | 'INVALID_VARIANT' = 'AVAILABLE';
      if (validation.status === 'DELETED') status = 'DELETED';
      else if (validation.status === 'UNPUBLISHED') status = 'UNPUBLISHED';
      else if (validation.status === 'INVALID') status = 'INVALID_VARIANT';
      else if (validation.status === 'OUT_OF_STOCK' || item.quantity > (item.variant?.stockQuantity || 0)) {
        status = 'OUT_OF_STOCK';
      }

      if (status !== 'AVAILABLE') {
        canCheckout = false;
      }

      const effectiveDeviceTypeId = item.deviceTypeId || item.model?.brand?.deviceTypeId || item.model?.brand?.deviceType?.id;
      const devicePrices = item.variant?.product?.devicePrices || [];
      let basePrice = Number(item.variant?.product?.price || 0);

      if (effectiveDeviceTypeId && devicePrices.length > 0) {
        const dp = devicePrices.find((p: any) => p.deviceTypeId === effectiveDeviceTypeId);
        if (dp && dp.price > 0) {
          basePrice = Number(dp.price);
        }
      }

      const priceOffset = Number(item.variant?.priceOffset || 0);
      const unitPrice = pricingService.calculateItemPrice(basePrice, priceOffset);
      const lineTotal = unitPrice * item.quantity;

      const resolvedBrandName = item.model?.brand?.name || null;
      const resolvedModelName = item.customModelName || item.model?.name || null;
      const resolvedProductName = item.variant?.product?.name || null;
      const resolvedImageUrl = item.variant?.image || item.variant?.product?.image || (item.variant?.product?.images && item.variant?.product?.images[0]?.url) || null;

      return {
        id: item.id,
        productId: item.variant?.productId || null,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        deviceTypeId: effectiveDeviceTypeId || null,
        deviceTypeName: item.deviceType?.name || item.model?.brand?.deviceType?.name || null,
        modelId: item.modelId || null,
        modelName: resolvedModelName,
        deviceModel: resolvedModelName,
        customModelName: item.customModelName || null,
        brandName: resolvedBrandName,
        deviceBrand: resolvedBrandName,
        productName: resolvedProductName,
        imageUrl: resolvedImageUrl,
        createdAt: item.createdAt,
        product: item.variant?.product
          ? {
              id: item.variant.product.id,
              name: item.variant.product.name,
              image: item.variant.product.image,
              slug: item.variant.product.slug,
              images: item.variant.product.images || [],
            }
          : null,
        variant: item.variant
          ? {
              id: item.variant.id,
              productId: item.variant.productId,
              sku: item.variant.sku,
              finish: item.variant.finish,
              material: item.variant.material,
              stockQuantity: item.variant.stockQuantity,
              image: item.variant.image || null,
              product: item.variant.product
                ? {
                    id: item.variant.product.id,
                    name: item.variant.product.name,
                    image: item.variant.product.image,
                    slug: item.variant.product.slug,
                  }
                : null,
            }
          : null,
        unitPrice,
        lineTotal,
        status,
      };
    });

    let couponUsagesCount = 0;
    let userUsagesCount = 0;
    let completedOrdersCount = 0;
    let summary: any = null;

    if (cart.coupon) {
      couponUsagesCount = await prisma.couponUsage.count({
        where: { couponId: cart.coupon.id },
      });
      userUsagesCount = await prisma.couponUsage.count({
        where: { couponId: cart.coupon.id, userId },
      });
      completedOrdersCount = await prisma.order.count({
        where: { userId, status: { not: 'CANCELLED' } },
      });
    }

    const availableItemsForPricing = cart.items
      .filter((item: any) => {
        const validation = productSelectionService.validatePreloadedSelection(
          item.variant?.product,
          item.variant
        );
        return validation.status === 'AVAILABLE';
      })
      .map((item: any) => {
        const effDevTypeId = item.deviceTypeId || item.model?.brand?.deviceTypeId || item.model?.brand?.deviceType?.id;
        const dPrices = item.variant?.product?.devicePrices || [];
        let bPrice = Number(item.variant?.product?.price || 0);
        if (effDevTypeId && dPrices.length > 0) {
          const matchDp = dPrices.find((p: any) => p.deviceTypeId === effDevTypeId);
          if (matchDp && matchDp.price > 0) {
            bPrice = Number(matchDp.price);
          }
        }
        return {
          price: pricingService.calculateItemPrice(bPrice, Number(item.variant?.priceOffset || 0)),
          quantity: item.quantity,
          productId: item.variant?.productId,
          categoryId: item.variant?.product?.categoryId,
          collectionIds: item.variant?.product?.collections?.map((c: any) => c.id) || [],
          modelIds: item.variant?.product?.models?.map((m: any) => m.id) || [],
        };
      });

    const storeSetting = await prisma.storeSetting.findFirst({
      select: { shippingFreeThreshold: true, shippingFlatRate: true }
    });
    const freeThreshold = storeSetting?.shippingFreeThreshold ?? 999;
    const flatRate = storeSetting?.shippingFlatRate ?? 49;

    summary = pricingService.calculateSummary(
      availableItemsForPricing,
      cart.coupon,
      couponUsagesCount,
      userUsagesCount,
      completedOrdersCount,
      { freeThreshold, flatRate }
    );

    if (cart.coupon && summary.couponValid === false) {
      canCheckout = false;
    }

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      coupon: cart.coupon
        ? {
            id: cart.coupon.id,
            code: cart.coupon.code,
            description: cart.coupon.description,
            discountType: cart.coupon.discountType,
            discountValue: cart.coupon.discountValue,
            isValid: summary.couponValid,
            reason: summary.couponReason,
          }
        : null,
      summary,
      canCheckout,
    };
  }

  async addToCart(
    userId: string,
    productId: string,
    productVariantId: string,
    quantity: number,
    ipAddress?: string,
    userAgent?: string,
    deviceTypeId?: string | null,
    modelId?: string | null,
    customModelName?: string | null
  ): Promise<any> {
    try {
      if (quantity <= 0) {
        throw new ValidationError('Quantity must be at least 1');
      }

      // Resolve deviceTypeId from model if not passed explicitly
      let targetDeviceTypeId = deviceTypeId;
      if (!targetDeviceTypeId && modelId) {
        const modelObj = await prisma.model.findUnique({
          where: { id: modelId },
          include: { brand: true }
        });
        if (modelObj?.brand?.deviceTypeId) {
          targetDeviceTypeId = modelObj.brand.deviceTypeId;
        }
      }

      // 1. Validate selection using shared Selection service
      const validation = await productSelectionService.validateSelection(
        productId,
        productVariantId
      );

      if (!validation.isValid || validation.status === 'DELETED' || validation.status === 'UNPUBLISHED' || validation.status === 'INVALID') {
        throw new ValidationError(
          validation.reason || 'This product variant is inactive or unavailable'
        );
      }

      if (validation.status === 'OUT_OF_STOCK') {
        throw new ValidationError('Product variant is currently out of stock');
      }

      const variant = validation.variant;
      const product = validation.product;
      const minQty = product?.minOrderQty || 1;
      if (quantity < minQty) {
        throw new ValidationError(`Minimum order quantity is ${minQty}.`);
      }

      // 2. Fetch or create customer cart
      const cart = await cartRepository.findOrCreateCart(userId);

      // 3. Check duplicate variant in cart (key: cartId, productVariantId, deviceTypeId, modelId)
      const existingItem = await cartRepository.findItemByVariant(
        cart.id,
        productVariantId,
        targetDeviceTypeId,
        modelId,
        customModelName
      );
      let item: CartItem;

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > variant.stockQuantity) {
          throw new ValidationError(
            `Requested quantity of ${newQuantity} exceeds available stock of ${variant.stockQuantity}`
          );
        }
        item = await cartRepository.updateItemQuantity(existingItem.id, newQuantity);
        await this.logActivity(
          userId,
          'CART_QUANTITY_UPDATE',
          ipAddress,
          userAgent,
          `Incremented cart item ${item.id} quantity to ${newQuantity}`
        );
      } else {
        if (quantity > variant.stockQuantity) {
          throw new ValidationError(
            `Requested quantity of ${quantity} exceeds available stock of ${variant.stockQuantity}`
          );
        }
        item = await cartRepository.addItem(
          cart.id,
          productVariantId,
          quantity,
          targetDeviceTypeId,
          modelId,
          customModelName
        );
        await this.logActivity(
          userId,
          'CART_ADD',
          ipAddress,
          userAgent,
          `Added variant ${productVariantId} (qty: ${quantity}, deviceType: ${targetDeviceTypeId || 'none'}, model: ${modelId || customModelName || 'none'}) to cart`
        );
      }

      return item;
    } catch (err: any) {
      await this.logActivity(
        userId,
        'CART_ACTION_FAIL',
        ipAddress,
        userAgent,
        `Failed to add variant ${productVariantId} to cart: ${err.message}`
      );
      throw err;
    }
  }

  async updateCartItemQuantity(
    itemId: string,
    userId: string,
    quantity: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    try {
      if (quantity <= 0) {
        throw new ValidationError('Quantity must be at least 1');
      }

      const cartItem = await cartRepository.findItemById(itemId, userId);
      if (!cartItem) {
        throw new NotFoundError('Cart item not found');
      }

      // Check product variant and stock status using shared selection
      const variantId = cartItem.productVariantId;
      const dbVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!dbVariant) {
        throw new ValidationError('Variant no longer exists');
      }

      const validation = await productSelectionService.validateSelection(
        dbVariant.productId,
        variantId
      );

      if (!validation.isValid || validation.status === 'DELETED' || validation.status === 'UNPUBLISHED' || validation.status === 'INVALID') {
        throw new ValidationError('Product variant is currently unavailable');
      }

      const minQty = dbVariant.product?.minOrderQty || 1;
      if (quantity < minQty) {
        throw new ValidationError(`Minimum order quantity is ${minQty}.`);
      }

      if (quantity > dbVariant.stockQuantity) {
        throw new ValidationError(
          `Requested quantity of ${quantity} exceeds available stock of ${dbVariant.stockQuantity}`
        );
      }

      const updated = await cartRepository.updateItemQuantity(itemId, quantity);
      await this.logActivity(
        userId,
        'CART_QUANTITY_UPDATE',
        ipAddress,
        userAgent,
        `Updated cart item ${itemId} quantity to ${quantity}`
      );

      return updated;
    } catch (err: any) {
      await this.logActivity(
        userId,
        'CART_ACTION_FAIL',
        ipAddress,
        userAgent,
        `Failed to update cart item ${itemId} quantity: ${err.message}`
      );
      throw err;
    }
  }

  async removeFromCart(
    itemId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const cartItem = await cartRepository.findItemById(itemId, userId);
    if (!cartItem) {
      throw new NotFoundError('Cart item not found');
    }

    await cartRepository.removeItem(itemId);
    await this.logActivity(
      userId,
      'CART_REMOVE',
      ipAddress,
      userAgent,
      `Removed cart item ${itemId}`
    );
  }

  async clearCart(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const cart = await cartRepository.findOrCreateCart(userId);
    await cartRepository.clearCart(cart.id);
    await this.logActivity(
      userId,
      'CART_CLEAR',
      ipAddress,
      userAgent,
      `Cleared cart ${cart.id}`
    );
  }

  async getCartSummary(userId: string): Promise<any> {
    const cart = await this.getCart(userId);
    return {
      canCheckout: cart.canCheckout,
      summary: cart.summary,
    };
  }
}

export const cartService = new CartService();
