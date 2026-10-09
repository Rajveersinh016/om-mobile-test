import { prisma } from '../../../database/client.js';

export interface SelectionValidationResult {
  isValid: boolean;
  reason?: string;
  product?: any;
  variant?: any;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'UNPUBLISHED' | 'DELETED' | 'INVALID';
}

export class ProductSelectionService {
  async validateSelection(
    productId: string,
    variantId: string
  ): Promise<SelectionValidationResult> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { id: variantId },
        },
      },
    });

    if (!product) {
      return { isValid: false, reason: 'Product not found', status: 'INVALID' };
    }

    if (product.deletedAt !== null) {
      return { isValid: false, reason: 'Product is deleted', status: 'DELETED', product };
    }

    if (!product.isPublished) {
      return { isValid: false, reason: 'Product is unpublished', status: 'UNPUBLISHED', product };
    }

    const variant = product.variants[0];
    if (!variant) {
      return {
        isValid: false,
        reason: 'Invalid variant ID for the specified product',
        status: 'INVALID',
        product,
      };
    }

    if (variant.stockQuantity <= 0) {
      // Valid for wishlist, but out of stock
      return { isValid: true, product, variant, status: 'OUT_OF_STOCK' };
    }

    return { isValid: true, product, variant, status: 'AVAILABLE' };
  }

  validatePreloadedSelection(
    product: any,
    variant: any
  ): SelectionValidationResult {
    if (!product) {
      return { isValid: false, reason: 'Product not found', status: 'INVALID' };
    }

    if (product.deletedAt !== null) {
      return { isValid: false, reason: 'Product is deleted', status: 'DELETED', product };
    }

    if (!product.isPublished) {
      return { isValid: false, reason: 'Product is unpublished', status: 'UNPUBLISHED', product };
    }

    if (!variant || variant.productId !== product.id) {
      return {
        isValid: false,
        reason: 'Invalid variant ID for the specified product',
        status: 'INVALID',
        product,
      };
    }

    if (variant.stockQuantity <= 0) {
      return { isValid: true, product, variant, status: 'OUT_OF_STOCK' };
    }

    return { isValid: true, product, variant, status: 'AVAILABLE' };
  }
}

export const productSelectionService = new ProductSelectionService();
