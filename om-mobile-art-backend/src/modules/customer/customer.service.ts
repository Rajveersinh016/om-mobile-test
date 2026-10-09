import { prisma } from '../../database/client.js';
import { CustomerStatus } from '@prisma/client';
import { 
  CustomerFilterQuery, 
  CustomerProfileUpdateInput, 
  CustomerStatusUpdateInput, 
  CustomerNoteInput, 
  AddressInput, 
  CustomerDashboardStats 
} from './customer.types.js';
import { AppError, NotFoundError, ValidationError } from '../../core/exceptions/exceptions.js';

export class CustomerService {

  /**
   * Safe User Selection fields (Excludes passwordHash)
   */
  private static readonly userSelectFields = {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    status: true,
    tags: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  };

  /**
   * Get Customers list with Search, Filters & Aggregates.
   */
  public static async getCustomers(query: CustomerFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      role: 'CUSTOMER',
      deletedAt: null,
    };

    // Search filter
    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { id: { equals: term } },
        { name: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
      ];
    }

    // Status filter
    if (query.status && query.status !== 'ALL') {
      where.status = query.status as CustomerStatus;
    }

    // Tag filter
    if (query.tag && query.tag.trim() !== '') {
      where.tags = { array_contains: query.tag.trim() };
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...this.userSelectFields,
          avatars: {
            where: { isActive: true },
            take: 1,
            select: { url: true },
          },
          orders: {
            where: { status: { notIn: ['CANCELLED', 'FAILED', 'REFUNDED'] } },
            select: { total: true },
          },
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    const formattedCustomers = users.map(user => {
      const totalSpent = user.orders.reduce((acc, o) => acc + o.total, 0);
      const ordersCount = user._count.orders;
      const avatarUrl = user.avatars[0]?.url || null;

      return {
        id: user.id,
        name: user.name || 'Customer',
        email: user.email,
        phone: user.phone || 'N/A',
        status: user.status,
        tags: user.tags,
        avatarUrl,
        registrationDate: user.createdAt,
        lastLoginDate: user.lastLoginAt || user.updatedAt,
        totalOrders: ordersCount,
        totalSpent: Math.round(totalSpent * 100) / 100,
      };
    });

    // Filtering by orders count or spent if requested
    let filtered = formattedCustomers;
    if (query.minOrders !== undefined) filtered = filtered.filter(c => c.totalOrders >= Number(query.minOrders));
    if (query.maxOrders !== undefined) filtered = filtered.filter(c => c.totalOrders <= Number(query.maxOrders));
    if (query.minSpent !== undefined) filtered = filtered.filter(c => c.totalSpent >= Number(query.minSpent));
    if (query.maxSpent !== undefined) filtered = filtered.filter(c => c.totalSpent <= Number(query.maxSpent));

    return {
      items: filtered,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single Customer details by ID with complete relations.
   */
  public static async getCustomerById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...this.userSelectFields,
        addresses: {
          orderBy: { isDefaultShipping: 'desc' },
        },
        settings: true,
        notificationPreferences: true,
        avatars: {
          where: { isActive: true },
          take: 1,
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Customer user account not found');
    }

    const confirmedOrders = await prisma.order.findMany({
      where: { userId: id, status: { notIn: ['CANCELLED', 'FAILED', 'REFUNDED'] } },
      select: { total: true },
    });

    const totalOrdersCount = await prisma.order.count({ where: { userId: id } });
    const totalSpent = confirmedOrders.reduce((acc, o) => acc + o.total, 0);

    return {
      ...user,
      avatarUrl: user.avatars[0]?.url || null,
      totalOrdersCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
    };
  }

  /**
   * Update Customer Profile information.
   */
  public static async updateCustomerProfile(id: string, input: CustomerProfileUpdateInput, adminUser?: { id?: string; name?: string }) {
    await this.getCustomerById(id);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.phone !== undefined) updateData.phone = input.phone.trim();
    if (input.tags !== undefined && Array.isArray(input.tags)) updateData.tags = input.tags;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: this.userSelectFields,
    });

    // Log Activity
    await prisma.accountActivity.create({
      data: {
        userId: id,
        action: 'PROFILE_UPDATED_BY_ADMIN',
        details: `Profile updated by ${adminUser?.name || 'Admin'}`,
      },
    });

    return updated;
  }

  /**
   * Update Customer Account Status (Active, Suspended, Blocked, Deleted).
   */
  public static async updateCustomerStatus(id: string, input: CustomerStatusUpdateInput, adminUser?: { id?: string; name?: string }) {
    const { status, reason } = input;
    await this.getCustomerById(id);

    const updateData: any = { status };
    if (status === 'DELETED') {
      updateData.deletedAt = new Date();
    } else {
      updateData.deletedAt = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: this.userSelectFields,
    });

    // Log Activity
    await prisma.accountActivity.create({
      data: {
        userId: id,
        action: `ACCOUNT_STATUS_${status}`,
        details: `Status set to ${status}. Reason: ${reason || 'Admin action'}`,
      },
    });

    if (adminUser?.id) {
      const action = status === 'BLOCKED' ? 'CUSTOMER_BLOCKED' : status === 'ACTIVE' ? 'CUSTOMER_UNBLOCKED' : `CUSTOMER_STATUS_${status}`;
      await prisma.adminActivityLog.create({
        data: {
          userId: adminUser.id,
          action,
          targetId: id,
          details: `Customer account status updated to ${status}. Reason: ${reason || 'Admin action'}`,
        },
      });
    }

    return updated;
  }

  /**
   * Add internal Admin Note to Customer profile.
   */
  public static async addCustomerNote(userId: string, input: CustomerNoteInput, adminUser?: { id?: string; name?: string }) {
    await this.getCustomerById(userId);

    const note = await prisma.customerNote.create({
      data: {
        userId,
        authorId: adminUser?.id,
        authorName: adminUser?.name || 'Admin',
        content: input.content.trim(),
      },
    });

    return note;
  }

  /**
   * Delete Admin Note.
   */
  public static async deleteCustomerNote(noteId: string) {
    const note = await prisma.customerNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundError('Customer note not found');
    }

    await prisma.customerNote.delete({
      where: { id: noteId },
    });

    return { message: 'Customer note deleted successfully' };
  }

  /**
   * Manage Customer Addresses (Create, Update, Delete, Set Default).
   */
  public static async manageAddress(userId: string, input: AddressInput & { action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'SET_DEFAULT'; addressId?: string }) {
    await this.getCustomerById(userId);

    const { action = 'CREATE', addressId } = input;

    if (action === 'DELETE') {
      if (!addressId) throw new ValidationError('Address ID is required for deletion');
      await prisma.address.delete({ where: { id: addressId } });
      return { message: 'Address deleted successfully' };
    }

    if (action === 'SET_DEFAULT') {
      if (!addressId) throw new ValidationError('Address ID is required to set default');
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefaultShipping: false, isDefaultBilling: false },
      });
      const updated = await prisma.address.update({
        where: { id: addressId },
        data: { isDefaultShipping: true, isDefaultBilling: true },
      });
      return updated;
    }

    if (action === 'UPDATE') {
      if (!addressId) throw new ValidationError('Address ID is required for update');
      const updated = await prisma.address.update({
        where: { id: addressId },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          alternativePhone: input.alternativePhone,
          companyName: input.companyName,
          gstNumber: input.gstNumber,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          landmark: input.landmark,
          city: input.city,
          state: input.state,
          country: input.country || 'India',
          pincode: input.pincode,
          type: input.type || 'HOME',
        },
      });
      return updated;
    }

    // Default CREATE action
    if (input.isDefaultShipping) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefaultShipping: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId,
        fullName: input.fullName,
        phone: input.phone,
        alternativePhone: input.alternativePhone,
        companyName: input.companyName,
        gstNumber: input.gstNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        landmark: input.landmark,
        city: input.city,
        state: input.state,
        country: input.country || 'India',
        pincode: input.pincode,
        type: input.type || 'HOME',
        isDefaultShipping: Boolean(input.isDefaultShipping),
        isDefaultBilling: Boolean(input.isDefaultBilling),
      },
    });

    return newAddress;
  }

  /**
   * Export Customer List as CSV.
   */
  public static async exportCsv(query: CustomerFilterQuery): Promise<string> {
    const result = await this.getCustomers({ ...query, limit: 2000, page: 1 });
    const customers = result.items;

    const headers = [
      'Customer ID',
      'Full Name',
      'Email Address',
      'Phone Number',
      'Account Status',
      'Customer Tags',
      'Registration Date',
      'Last Login Date',
      'Total Orders',
      'Total Spent (INR)',
    ];

    const rows = customers.map(c => [
      `"${c.id}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.email}"`,
      `"${c.phone}"`,
      `"${c.status}"`,
      `"${(c.tags || []).join('; ')}"`,
      `"${new Date(c.registrationDate).toISOString()}"`,
      `"${new Date(c.lastLoginDate).toISOString()}"`,
      c.totalOrders,
      c.totalSpent,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get Dashboard Summary Metrics for Customers.
   */
  public static async getDashboardStats(): Promise<CustomerDashboardStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      total,
      active,
      suspended,
      blocked,
      newThisMonth,
      ordersAgg
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      prisma.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE', deletedAt: null } }),
      prisma.user.count({ where: { role: 'CUSTOMER', status: 'SUSPENDED', deletedAt: null } }),
      prisma.user.count({ where: { role: 'CUSTOMER', status: 'BLOCKED', deletedAt: null } }),
      prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      prisma.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'FAILED', 'REFUNDED'] }, deletedAt: null },
        _sum: { total: true },
      }),
    ]);

    const totalRevenue = ordersAgg._sum.total || 0;
    const averageLifetimeSpend = total > 0 ? Math.round((totalRevenue / total) * 100) / 100 : 0;

    return {
      totalCustomers: total,
      activeCustomers: active,
      suspendedCustomers: suspended,
      blockedCustomers: blocked,
      newThisMonthCount: newThisMonth,
      averageLifetimeSpend,
    };
  }
}
