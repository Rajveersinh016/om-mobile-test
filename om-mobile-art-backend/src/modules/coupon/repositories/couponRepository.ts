import { prisma } from '../../../database/client.js';
import { Coupon, CouponStatus } from '@prisma/client';
import { CouponFilterQuery } from '../coupon.types.js';

export class CouponRepository {
  async findById(id: string) {
    return prisma.coupon.findUnique({
      where: { id },
      include: {
        rules: true,
        targets: true,
        usages: {
          take: 10,
          orderBy: { usedAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    const clean = code ? code.trim() : '';
    if (!clean) return null;
    return prisma.coupon.findFirst({
      where: {
        code: { equals: clean }
      },
      include: {
        rules: true,
        targets: true,
      },
    });
  }

  async findFiltered(query: CouponFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term } },
        { name: { contains: term } },
        { description: { contains: term } },
      ];
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as CouponStatus;
    }

    if (query.discountType && query.discountType !== 'ALL') {
      where.discountType = query.discountType as any;
    }

    const [total, items] = await Promise.all([
      prisma.coupon.count({ where }),
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rules: true,
          targets: true,
          _count: {
            select: { usages: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async create(data: any, rulesData?: any, targetsData?: any) {
    return prisma.coupon.create({
      data: {
        ...data,
        rules: rulesData ? { create: rulesData } : undefined,
        targets: targetsData ? { create: targetsData } : undefined,
      },
      include: {
        rules: true,
        targets: true,
      },
    });
  }

  async update(id: string, data: any, rulesData?: any, targetsData?: any) {
    const updatePayload: any = { ...data };

    if (rulesData) {
      updatePayload.rules = {
        upsert: {
          create: rulesData,
          update: rulesData,
        },
      };
    }

    if (targetsData) {
      updatePayload.targets = {
        upsert: {
          create: targetsData,
          update: targetsData,
        },
      };
    }

    return prisma.coupon.update({
      where: { id },
      data: updatePayload,
      include: {
        rules: true,
        targets: true,
      },
    });
  }

  async delete(id: string) {
    return prisma.coupon.delete({
      where: { id },
    });
  }

  async getStats() {
    const now = new Date();

    const [total, active, expired, unused, totalDiscountAgg] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { status: 'ACTIVE' } }),
      prisma.coupon.count({
        where: {
          OR: [
            { status: 'EXPIRED' },
            { endDate: { lt: now } },
          ],
        },
      }),
      prisma.coupon.count({ where: { usageCount: 0 } }),
      prisma.coupon.aggregate({
        _sum: {
          totalDiscountGiven: true,
          usageCount: true,
        },
      }),
    ]);

    return {
      totalCoupons: total,
      activeCoupons: active,
      expiredCoupons: expired,
      unusedCoupons: unused,
      totalUsages: totalDiscountAgg._sum.usageCount || 0,
      totalDiscountGiven: totalDiscountAgg._sum.totalDiscountGiven || 0,
    };
  }

  async recordUsage(couponId: string, userId: string, discountAmount: number, orderId?: string) {
    return prisma.$transaction(async (tx) => {
      const usage = await tx.couponUsage.create({
        data: {
          couponId,
          userId,
          orderId,
          discountAmount,
        },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: {
          usageCount: { increment: 1 },
          totalDiscountGiven: { increment: discountAmount },
        },
      });

      return usage;
    });
  }
}

export const couponRepository = new CouponRepository();
