import { CustomerStatus } from '@prisma/client';

export interface CustomerFilterQuery {
  search?: string;
  status?: CustomerStatus | 'ALL';
  tag?: string;
  startDate?: string;
  endDate?: string;
  minOrders?: number;
  maxOrders?: number;
  minSpent?: number;
  maxSpent?: number;
  page?: number;
  limit?: number;
}

export interface CustomerProfileUpdateInput {
  name?: string;
  phone?: string;
  tags?: string[];
  preferredLanguage?: string;
}

export interface CustomerStatusUpdateInput {
  status: CustomerStatus;
  reason?: string;
}

export interface CustomerNoteInput {
  content: string;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  alternativePhone?: string;
  companyName?: string;
  gstNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  type?: 'HOME' | 'OFFICE' | 'OTHER';
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface CustomerDashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  blockedCustomers: number;
  newThisMonthCount: number;
  averageLifetimeSpend: number;
}
