import { couponRepository } from '../repositories/couponRepository.js';
import { prisma } from '../../../database/client.js';
import { 
  AppError, 
  NotFoundError, 
  ValidationError, 
  ConflictError 
} from '../../../core/exceptions/exceptions.js';
import { 
  CreateCouponInput, 
  UpdateCouponInput, 
  CouponFilterQuery, 
  ValidateCouponPayload, 
  CouponValidationResult 
} from '../coupon.types.js';
import { CouponStatus } from '@prisma/client';

export class CouponService {
  /**
   * Evaluate and automatically adjust coupon status based on current date.
   */
  private evaluateCouponStatus(coupon: any): CouponStatus {
    const now = new Date();
    if (coupon.status === 'DISABLED' || coupon.status === 'ARCHIVED' || coupon.status === 'DRAFT') {
      return coupon.status;
    }

    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return 'EXPIRED';
    }

    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return 'SCHEDULED';
    }

    return 'ACTIVE';
  }

  /**
   * Log Admin Activity.
   */
  private async logAdminActivity(userId: string, action: string, targetId?: string, details?: string) {
    try {
      await prisma.adminActivityLog.create({
        data: {
          userId,
          action,
          targetId,
          details,
        },
      });
    } catch (err) {
      console.warn('Failed to write admin activity log:', err);
    }
  }

  /**
   * List Coupons with Search, Filter & Stats.
   */
  public async getCoupons(query: CouponFilterQuery) {
    const result = await couponRepository.findFiltered(query);

    // Dynamic status evaluation
    const updatedItems = result.items.map(coupon => {
      const computedStatus = this.evaluateCouponStatus(coupon);
      return {
        ...coupon,
        status: computedStatus,
        minOrderValue: coupon.rules?.minOrderValue ?? coupon.minCartValue ?? 0,
        maxDiscountAmount: coupon.rules?.maxDiscountAmount ?? coupon.maxDiscount,
        globalUsageLimit: coupon.rules?.globalUsageLimit ?? coupon.globalUsageLimit,
        perUserUsageLimit: coupon.rules?.perUserUsageLimit ?? coupon.perUserUsageLimit,
      };
    });

    return {
      items: updatedItems,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get single Coupon by ID.
   */
  public async getCouponById(id: string) {
    const coupon = await couponRepository.findById(id);
    if (!coupon) {
      throw new NotFoundError('Coupon not found');
    }

    const computedStatus = this.evaluateCouponStatus(coupon);
    return {
      ...coupon,
      status: computedStatus,
    };
  }

  /**
   * Create a new Coupon.
   */
  public async createCoupon(input: CreateCouponInput, adminId?: string) {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new ValidationError('Coupon code is required');
    }

    // Code Uniqueness Check
    const existing = await couponRepository.findByCode(code);
    if (existing) {
      throw new ConflictError(`Coupon with code '${code}' already exists`);
    }

    // Validate Discount Values
    if (input.discountType === 'PERCENTAGE') {
      if (input.discountValue <= 0 || input.discountValue > 100) {
        throw new ValidationError('Percentage discount value must be greater than 0 and less than or equal to 100%');
      }
    } else if (input.discountType === 'FIXED') {
      if (input.discountValue < 0) {
        throw new ValidationError('Fixed discount value cannot be negative');
      }
    }

    // Validate Start / End Dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (input.startDate) {
      startDate = new Date(input.startDate);
      if (isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid start date string format');
      }
    }

    if (input.endDate) {
      endDate = new Date(input.endDate);
      if (isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid end date string format');
      }
    }

    if (startDate && endDate && startDate > endDate) {
      throw new ValidationError('Start date cannot be after end date');
    }

    // Determine initial status
    let initialStatus: CouponStatus = input.status || 'ACTIVE';
    const now = new Date();
    if (endDate && endDate < now) {
      initialStatus = 'EXPIRED';
    } else if (startDate && startDate > now && initialStatus === 'ACTIVE') {
      initialStatus = 'SCHEDULED';
    }

    const couponData = {
      code,
      name: input.name?.trim() || code,
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: Number(input.discountValue),
      status: initialStatus,
      startDate: startDate || null,
      endDate: endDate || null,
      priority: Number(input.priority) || 0,
      internalNotes: input.internalNotes?.trim() || null,
      isActive: initialStatus === 'ACTIVE',
    };

    const rulesData = {
      minOrderValue: Number(input.rules?.minOrderValue) || 0,
      maxDiscountAmount: input.rules?.maxDiscountAmount ? Number(input.rules.maxDiscountAmount) : null,
      globalUsageLimit: input.rules?.globalUsageLimit ? Number(input.rules.globalUsageLimit) : null,
      perUserUsageLimit: Number(input.rules?.perUserUsageLimit) || 1,
      firstOrderOnly: Boolean(input.rules?.firstOrderOnly),
      excludeSaleProducts: Boolean(input.rules?.excludeSaleProducts),
    };

    const targetsData = {
      targetScope: input.targets?.targetScope || 'STOREWIDE',
      collectionIds: input.targets?.collectionIds || [],
      productIds: input.targets?.productIds || [],
      categoryIds: input.targets?.categoryIds || [],
      brandIds: input.targets?.brandIds || [],
    };

    const created = await couponRepository.create(couponData, rulesData, targetsData);

    if (adminId) {
      await this.logAdminActivity(adminId, 'CREATE_COUPON', created.id, `Created coupon ${code}`);
    }

    return created;
  }

  /**
   * Update existing Coupon.
   */
  public async updateCoupon(id: string, input: UpdateCouponInput, adminId?: string) {
    const existing = await couponRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    const couponData: any = {};

    if (input.code) {
      const code = input.code.trim().toUpperCase();
      const codeDuplicate = await couponRepository.findByCode(code);
      if (codeDuplicate && codeDuplicate.id !== id) {
        throw new ConflictError(`Coupon with code '${code}' already exists`);
      }
      couponData.code = code;
    }

    if (input.name !== undefined) couponData.name = input.name.trim();
    if (input.description !== undefined) couponData.description = input.description ? input.description.trim() : null;
    if (input.discountType) couponData.discountType = input.discountType;

    if (input.discountValue !== undefined) {
      const val = Number(input.discountValue);
      const discType = input.discountType || existing.discountType;
      if (discType === 'PERCENTAGE' && (val <= 0 || val > 100)) {
        throw new ValidationError('Percentage discount must be between 1 and 100%');
      }
      if (discType === 'FIXED' && val < 0) {
        throw new ValidationError('Fixed discount value cannot be negative');
      }
      couponData.discountValue = val;
    }

    if (input.status) couponData.status = input.status;
    if (input.priority !== undefined) couponData.priority = Number(input.priority);
    if (input.internalNotes !== undefined) couponData.internalNotes = input.internalNotes;

    if (input.startDate !== undefined) {
      couponData.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.endDate !== undefined) {
      couponData.endDate = input.endDate ? new Date(input.endDate) : null;
    }

    const rulesData = input.rules ? {
      minOrderValue: Number(input.rules.minOrderValue) || 0,
      maxDiscountAmount: input.rules.maxDiscountAmount ? Number(input.rules.maxDiscountAmount) : null,
      globalUsageLimit: input.rules.globalUsageLimit ? Number(input.rules.globalUsageLimit) : null,
      perUserUsageLimit: Number(input.rules.perUserUsageLimit) || 1,
      firstOrderOnly: Boolean(input.rules.firstOrderOnly),
      excludeSaleProducts: Boolean(input.rules.excludeSaleProducts),
    } : undefined;

    const targetsData = input.targets ? {
      targetScope: input.targets.targetScope || 'STOREWIDE',
      collectionIds: input.targets.collectionIds || [],
      productIds: input.targets.productIds || [],
      categoryIds: input.targets.categoryIds || [],
      brandIds: input.targets.brandIds || [],
    } : undefined;

    const updated = await couponRepository.update(id, couponData, rulesData, targetsData);

    if (adminId) {
      await this.logAdminActivity(adminId, 'UPDATE_COUPON', id, `Updated coupon ${existing.code}`);
    }

    return updated;
  }

  /**
   * Duplicate Coupon with '-COPY' code suffix.
   */
  public async duplicateCoupon(id: string, adminId?: string) {
    const existing = await couponRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    let newCode = `${existing.code}-COPY`;
    let counter = 1;
    while (await couponRepository.findByCode(newCode)) {
      newCode = `${existing.code}-COPY${counter}`;
      counter++;
    }

    const couponData = {
      code: newCode,
      name: `${existing.name || existing.code} (Copy)`,
      description: existing.description,
      discountType: existing.discountType,
      discountValue: existing.discountValue,
      status: 'DRAFT' as CouponStatus,
      startDate: existing.startDate,
      endDate: existing.endDate,
      priority: existing.priority,
      internalNotes: `Duplicated from ${existing.code}`,
      usageCount: 0,
      totalDiscountGiven: 0.0,
    };

    const rulesData = existing.rules ? {
      minOrderValue: existing.rules.minOrderValue,
      maxDiscountAmount: existing.rules.maxDiscountAmount,
      globalUsageLimit: existing.rules.globalUsageLimit,
      perUserUsageLimit: existing.rules.perUserUsageLimit,
      firstOrderOnly: existing.rules.firstOrderOnly,
      excludeSaleProducts: existing.rules.excludeSaleProducts,
    } : undefined;

    const targetsData = existing.targets ? {
      targetScope: existing.targets.targetScope,
      collectionIds: existing.targets.collectionIds,
      productIds: existing.targets.productIds,
      categoryIds: existing.targets.categoryIds,
      brandIds: existing.targets.brandIds,
    } : undefined;

    const duplicated = await couponRepository.create(couponData, rulesData, targetsData);

    if (adminId) {
      await this.logAdminActivity(adminId, 'DUPLICATE_COUPON', duplicated.id, `Duplicated coupon ${existing.code} to ${newCode}`);
    }

    return duplicated;
  }

  /**
   * Toggle Coupon Status (Active, Disabled, Archived, Draft).
   */
  public async toggleStatus(id: string, status: CouponStatus, adminId?: string) {
    const existing = await couponRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    const updated = await couponRepository.update(id, {
      status,
      isActive: status === 'ACTIVE',
    });

    if (adminId) {
      await this.logAdminActivity(adminId, 'CHANGE_COUPON_STATUS', id, `Changed status of ${existing.code} to ${status}`);
    }

    return updated;
  }

  /**
   * Delete Coupon.
   */
  public async deleteCoupon(id: string, adminId?: string) {
    const existing = await couponRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    await couponRepository.delete(id);

    if (adminId) {
      await this.logAdminActivity(adminId, 'DELETE_COUPON', id, `Deleted coupon ${existing.code}`);
    }

    return { message: `Coupon ${existing.code} deleted successfully` };
  }

  /**
   * Get Overall Reporting Analytics.
   */
  public async getReportingStats() {
    return couponRepository.getStats();
  }

  /**
   * Checkout Ready Engine: Validate Coupon Code against cart payload and calculate exact discount.
   */
  public async validateCouponForCheckout(payload: ValidateCouponPayload): Promise<CouponValidationResult> {
    const { code, userId, cartSubtotal = 0, cartItems = [] } = payload;
    const cleanCode = code ? code.trim().toUpperCase() : '';

    if (!cleanCode) {
      return {
        valid: false,
        code: '',
        couponId: '',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: 'Please enter a valid coupon code.',
      };
    }

    const coupon = await couponRepository.findByCode(cleanCode);
    if (!coupon) {
      return {
        valid: false,
        code: cleanCode,
        couponId: '',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: 'Invalid coupon code.',
      };
    }

    const now = new Date();

    // Status check
    if (coupon.status === 'DISABLED' || coupon.status === 'ARCHIVED' || coupon.status === 'DRAFT' || coupon.isActive === false) {
      return {
        valid: false,
        code: cleanCode,
        couponId: coupon.id,
        discountType: coupon.discountType as any,
        discountValue: coupon.discountValue,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: `Coupon ${cleanCode} is currently inactive or disabled.`,
      };
    }

    // Expiry check
    const expiry = coupon.endDate || coupon.validUntil;
    if (expiry && new Date(expiry) < now) {
      await couponRepository.update(coupon.id, { status: 'EXPIRED' });
      return {
        valid: false,
        code: cleanCode,
        couponId: coupon.id,
        discountType: coupon.discountType as any,
        discountValue: coupon.discountValue,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: `Coupon ${cleanCode} has expired.`,
      };
    }

    // Schedule check
    const start = coupon.startDate || coupon.validFrom;
    if (start && new Date(start) > now) {
      return {
        valid: false,
        code: cleanCode,
        couponId: coupon.id,
        discountType: coupon.discountType as any,
        discountValue: coupon.discountValue,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: `Coupon ${cleanCode} is scheduled for a future date.`,
      };
    }

    const minOrderValue = coupon.rules?.minOrderValue ?? coupon.minCartValue ?? 0;
    if (cartSubtotal > 0 && cartSubtotal < minOrderValue) {
      return {
        valid: false,
        code: cleanCode,
        couponId: coupon.id,
        discountType: coupon.discountType as any,
        discountValue: coupon.discountValue,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: `Minimum order subtotal of ₹${minOrderValue} required for coupon ${cleanCode}.`,
      };
    }

    // Global Usage Limit check
    const globalLimit = coupon.rules?.globalUsageLimit ?? coupon.globalUsageLimit;
    if (globalLimit && coupon.usageCount >= globalLimit) {
      return {
        valid: false,
        code: cleanCode,
        couponId: coupon.id,
        discountType: coupon.discountType as any,
        discountValue: coupon.discountValue,
        calculatedDiscount: 0,
        finalSubtotal: cartSubtotal,
        message: `Coupon ${cleanCode} has reached its maximum global usage limit.`,
      };
    }

    // Per User Usage Limit check
    if (userId) {
      const userUsageCount = await prisma.couponUsage.count({
        where: { couponId: coupon.id, userId },
      });
      const perUserLimit = coupon.rules?.perUserUsageLimit ?? coupon.perUserUsageLimit ?? 1;
      if (userUsageCount >= perUserLimit) {
        return {
          valid: false,
          code: cleanCode,
          couponId: coupon.id,
          discountType: coupon.discountType as any,
          discountValue: coupon.discountValue,
          calculatedDiscount: 0,
          finalSubtotal: cartSubtotal,
          message: `You have reached the maximum allowed usage limit (${perUserLimit}) for coupon ${cleanCode}.`,
        };
      }

      // First Order Only check
      if (coupon.rules?.firstOrderOnly || coupon.firstOrderOnly) {
        const orderCount = await prisma.order.count({
          where: { userId },
        });
        if (orderCount > 0) {
          return {
            valid: false,
            code: cleanCode,
            couponId: coupon.id,
            discountType: coupon.discountType as any,
            discountValue: coupon.discountValue,
            calculatedDiscount: 0,
            finalSubtotal: cartSubtotal,
            message: `Coupon ${cleanCode} is valid for first-time orders only.`,
          };
        }
      }
    }

    // Calculate Eligible Subtotal based on Targets & Exclusions
    let eligibleSubtotal = 0;
    const targetScope = coupon.targets?.targetScope || 'STOREWIDE';

    for (const item of cartItems) {
      if (coupon.rules?.excludeSaleProducts && item.isSale) {
        continue;
      }

      let isEligible = false;
      if (targetScope === 'STOREWIDE') {
        isEligible = true;
      } else if (targetScope === 'PRODUCTS') {
        isEligible = (coupon.targets?.productIds || []).includes(item.productId || item.id);
      } else if (targetScope === 'CATEGORIES') {
        isEligible = item.categoryId ? (coupon.targets?.categoryIds || []).includes(item.categoryId) : false;
      } else if (targetScope === 'COLLECTIONS') {
        isEligible = item.collectionIds ? item.collectionIds.some(cid => (coupon.targets?.collectionIds || []).includes(cid)) : false;
      } else if (targetScope === 'BRANDS') {
        isEligible = item.brandId ? (coupon.targets?.brandIds || []).includes(item.brandId) : false;
      }

      if (isEligible) {
        const itemPrice = Number(item.price) || 0;
        const itemQty = Number(item.quantity || item.qty) || 1;
        eligibleSubtotal += (itemPrice * itemQty);
      }
    }

    // Fallback if cartItems omitted, use full cartSubtotal
    if (cartItems.length === 0 || eligibleSubtotal <= 0) {
      eligibleSubtotal = cartSubtotal;
    }

    // Compute Discount Amount
    let discountAmount = 0;
    const discTypeStr = String(coupon.discountType).toUpperCase();

    if (discTypeStr === 'PERCENTAGE') {
      discountAmount = (eligibleSubtotal * coupon.discountValue) / 100;
      const maxDiscount = coupon.rules?.maxDiscountAmount ?? coupon.maxDiscount;
      if (maxDiscount && maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, maxDiscount);
      }
    } else if (discTypeStr === 'FIXED' || discTypeStr === 'FLAT' || discTypeStr === 'FIXED_AMOUNT') {
      discountAmount = Math.min(coupon.discountValue, eligibleSubtotal > 0 ? eligibleSubtotal : coupon.discountValue);
    } else if (discTypeStr === 'FREE_SHIPPING') {
      discountAmount = 0;
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalSubtotal = Math.max(0, cartSubtotal - discountAmount);

    return {
      valid: true,
      code: cleanCode,
      couponId: coupon.id,
      discountType: coupon.discountType as any,
      discountValue: coupon.discountValue,
      calculatedDiscount: discountAmount,
      finalSubtotal: Math.round(finalSubtotal * 100) / 100,
      message: `Coupon ${cleanCode} applied successfully! Discount: ₹${discountAmount}`,
    };
  }
}

export const couponService = new CouponService();
