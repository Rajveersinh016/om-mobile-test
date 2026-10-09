import { z } from 'zod';

export const updateSettingsSchema = z.object({
  language: z.string().max(10).optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  marketingEmails: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  whatsAppNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  deliveryUpdates: z.boolean().optional(),
  offers: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  settings: updateSettingsSchema.optional(),
  notificationPreferences: updateNotificationPreferencesSchema.optional(),
});

export const uploadAvatarSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1), // base64 content
});

export const addressTypeSchema = z.enum(['HOME', 'OFFICE', 'OTHER']);

export const createAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().min(1, 'Phone number is required').max(20),
  alternativePhone: z.string().max(20).optional().nullable(),
  companyName: z.string().max(100).optional().nullable(),
  gstNumber: z.string().max(50).optional().nullable(),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional().nullable(),
  landmark: z.string().max(255).optional().nullable(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  pincode: z.string().min(1, 'Pincode is required').max(20),
  type: addressTypeSchema.default('HOME'),
  isDefaultShipping: z.boolean().optional().default(false),
  isDefaultBilling: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();
