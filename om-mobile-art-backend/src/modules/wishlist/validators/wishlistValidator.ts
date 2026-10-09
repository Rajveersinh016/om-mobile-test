import { z } from 'zod';

export const addToWishlistSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid productId format' }),
  productVariantId: z.string().uuid({ message: 'Invalid productVariantId format' }),
});
