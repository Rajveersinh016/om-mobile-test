import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid productId format' }),
  productVariantId: z.string().uuid({ message: 'Invalid productVariantId format' }),
  quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
  deviceTypeId: z.string().uuid({ message: 'Invalid deviceTypeId format' }).optional().nullable(),
  modelId: z.string().uuid({ message: 'Invalid modelId format' }).optional().nullable(),
  customModelName: z.string().max(255).optional().nullable(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
});
