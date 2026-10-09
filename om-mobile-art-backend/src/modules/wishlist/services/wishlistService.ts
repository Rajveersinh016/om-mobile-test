import { wishlistRepository } from '../repositories/wishlistRepository.js';
import { productSelectionService } from '../../catalog/services/productSelectionService.js';
import { prisma } from '../../../database/client.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError 
} from '../../../core/exceptions/exceptions.js';
import { WishlistItem } from '@prisma/client';

export class WishlistService {
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

  async addToWishlist(
    userId: string,
    productId: string,
    productVariantId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WishlistItem> {
    try {
      // Validate product and variant status using the shared service
      const validation = await productSelectionService.validateSelection(
        productId,
        productVariantId
      );

      if (!validation.isValid || validation.status === 'DELETED' || validation.status === 'UNPUBLISHED' || validation.status === 'INVALID') {
        throw new ValidationError(
          validation.reason || 'This product variant is inactive or unavailable'
        );
      }

      // Prevent duplicates
      const existing = await wishlistRepository.findByUserAndVariant(
        userId,
        productVariantId
      );
      if (existing) {
        throw new ConflictError('This product variant is already in your wishlist');
      }

      const item = await wishlistRepository.create(userId, productId, productVariantId);

      await this.logActivity(
        userId,
        'WISHLIST_ADD',
        ipAddress,
        userAgent,
        `Added product variant ${productVariantId} to wishlist`
      );

      return item;
    } catch (err: any) {
      await this.logActivity(
        userId,
        'WISHLIST_ACTION_FAIL',
        ipAddress,
        userAgent,
        `Failed to add variant ${productVariantId} to wishlist: ${err.message}`
      );
      throw err;
    }
  }

  async removeFromWishlist(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const existing = await wishlistRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Wishlist item not found');
    }

    await wishlistRepository.delete(id, userId);

    await this.logActivity(
      userId,
      'WISHLIST_REMOVE',
      ipAddress,
      userAgent,
      `Removed wishlist item ${id}`
    );
  }

  async listWishlist(userId: string): Promise<any[]> {
    const items = await wishlistRepository.findAllByUserId(userId);
    
    return items.map((item) => {
      // Compute status based on availability rules
      let status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'UNPUBLISHED' | 'DELETED' | 'INVALID' = 'AVAILABLE';
      
      if (!item.product || item.product.deletedAt !== null) {
        status = 'DELETED';
      } else if (!item.product.isPublished) {
        status = 'UNPUBLISHED';
      } else if (!item.variant) {
        status = 'INVALID';
      } else if (item.variant.stockQuantity <= 0) {
        status = 'OUT_OF_STOCK';
      }

      return {
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        createdAt: item.createdAt,
        product: item.product
          ? {
              name: item.product.name,
              price: item.product.price,
              originalPrice: item.product.originalPrice,
              image: item.product.image,
              slug: item.product.slug,
            }
          : null,
        variant: item.variant
          ? {
              sku: item.variant.sku,
              finish: item.variant.finish,
              material: item.variant.material,
            }
          : null,
        status,
      };
    });
  }

  async getWishlistCount(userId: string): Promise<number> {
    return wishlistRepository.countByUserId(userId);
  }

  async moveToCart(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const item = await wishlistRepository.findById(id, userId);
    if (!item) {
      throw new NotFoundError('Wishlist item not found');
    }

    // Verify availability using shared selection validation
    const validation = await productSelectionService.validateSelection(
      item.productId,
      item.productVariantId
    );

    if (!validation.isValid || validation.status !== 'AVAILABLE') {
      throw new ValidationError(
        'Product variant is currently out of stock or unavailable for purchase'
      );
    }

    // Prepare Cart Integration: Remove from wishlist and log move activity.
    // The downstream Cart controller can call this method first, and then append the item to the cart.
    await wishlistRepository.delete(id, userId);

    await this.logActivity(
      userId,
      'WISHLIST_MOVE_TO_CART',
      ipAddress,
      userAgent,
      `Moved wishlist item ${id} (variant ${item.productVariantId}) to cart preparation`
    );

    return {
      message: 'Wishlist item validated and prepared for Cart module integration',
      productId: item.productId,
      productVariantId: item.productVariantId,
    };
  }
}

export const wishlistService = new WishlistService();
