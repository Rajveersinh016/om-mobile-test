import { prisma } from '../../../database/client.js';
import { Cart, CartItem } from '@prisma/client';

export class CartRepository {
  async findOrCreateCart(userId: string): Promise<Cart & { items: any[], coupon?: any }> {
    const itemInclusion = {
      deviceType: true,
      model: {
        include: {
          brand: {
            include: {
              deviceType: true
            }
          }
        }
      },
      variant: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { position: 'asc' },
              },
              devicePrices: {
                include: {
                  deviceType: true
                }
              }
            }
          },
        },
      },
    };

    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        coupon: true,
        items: {
          include: itemInclusion,
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          coupon: true,
          items: {
            include: itemInclusion,
          },
        },
      });
    }

    return cart;
  }

  async findItemById(itemId: string, userId: string): Promise<(CartItem & { cart: Cart }) | null> {
    return prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: {
        cart: true,
      },
    });
  }

  async findItemByVariant(
    cartId: string,
    productVariantId: string,
    deviceTypeId?: string | null,
    modelId?: string | null,
    customModelName?: string | null
  ): Promise<CartItem | null> {
    return prisma.cartItem.findFirst({
      where: {
        cartId,
        productVariantId,
        deviceTypeId: deviceTypeId || null,
        modelId: modelId || null,
        customModelName: customModelName || null,
      },
    });
  }

  async addItem(
    cartId: string,
    productVariantId: string,
    quantity: number,
    deviceTypeId?: string | null,
    modelId?: string | null,
    customModelName?: string | null
  ): Promise<CartItem> {
    return prisma.cartItem.create({
      data: {
        cartId,
        productVariantId,
        quantity,
        deviceTypeId: deviceTypeId || null,
        modelId: modelId || null,
        customModelName: customModelName || null,
      },
    });
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
    return prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  async removeItem(itemId: string): Promise<CartItem> {
    return prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }
}

export const cartRepository = new CartRepository();
