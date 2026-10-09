export type CouponStatusType = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'SCHEDULED' | 'ARCHIVED';
export type DiscountTypeEnum = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'BUY_X_GET_Y' | 'AUTOMATIC';
export type TargetScopeType = 'STOREWIDE' | 'COLLECTIONS' | 'PRODUCTS' | 'CATEGORIES' | 'BRANDS';

export interface CouponRulesInput {
  minOrderValue?: number;
  maxDiscountAmount?: number;
  globalUsageLimit?: number;
  perUserUsageLimit?: number;
  firstOrderOnly?: boolean;
  excludeSaleProducts?: boolean;
}

export interface CouponTargetsInput {
  targetScope?: TargetScopeType;
  collectionIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountTypeEnum;
  discountValue: number;
  status?: CouponStatusType;
  startDate?: string | Date;
  endDate?: string | Date;
  priority?: number;
  internalNotes?: string;
  rules?: CouponRulesInput;
  targets?: CouponTargetsInput;
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {}

export interface CouponFilterQuery {
  search?: string;
  status?: CouponStatusType | 'ALL';
  discountType?: DiscountTypeEnum | 'ALL';
  page?: number;
  limit?: number;
}

export interface ValidateCouponPayload {
  code: string;
  userId?: string;
  cartSubtotal: number;
  cartItems?: Array<{
    productId: string;
    categoryId?: string;
    collectionIds?: string[];
    brandId?: string;
    price: number;
    quantity: number;
    isSale?: boolean;
  }>;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  couponId: string;
  discountType: DiscountTypeEnum;
  discountValue: number;
  calculatedDiscount: number;
  finalSubtotal: number;
  message: string;
}
