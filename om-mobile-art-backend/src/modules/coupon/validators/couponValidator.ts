import { z } from 'zod';
import { DiscountType } from '@prisma/client';

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(1, { message: 'Coupon code is required' })
    .transform((val) => val.trim().toUpperCase()),
  description: z.string().optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().min(0, { message: 'Discount value must be at least 0' }),
  maxDiscount: z.number().min(0).optional().nullable(),
  minCartValue: z.number().min(0).optional().nullable(),
  validFrom: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  validUntil: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  globalUsageLimit: z.number().int().min(1).optional().nullable(),
  perUserUsageLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  firstOrderOnly: z.boolean().optional().default(false),
  applicableCategoryIds: z.array(z.string().uuid()).optional().default([]),
  applicableCollectionIds: z.array(z.string().uuid()).optional().default([]),
  applicableProductIds: z.array(z.string().uuid()).optional().default([]),
  applicableDeviceIds: z.array(z.string().uuid()).optional().default([]),
  excludedProductIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateCouponSchema = createCouponSchema.partial();

export const applyCouponSchema = z.object({
  code: z
    .string()
    .min(1, { message: 'Coupon code is required' })
    .transform((val) => val.trim().toUpperCase()),
});
