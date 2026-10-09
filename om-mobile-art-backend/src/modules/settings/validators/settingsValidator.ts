import { z } from 'zod';

export const updateStoreSettingsSchema = z.object({
  storeName: z.string().min(1, { message: 'Store name is required' }).optional(),
  storeTagline: z.string().optional(),
  businessDescription: z.string().optional(),
  storeUrl: z.string().optional(),
  timezone: z.string().optional(),
  currencySymbol: z.string().optional(),
  currencyCode: z.string().optional(),
  language: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  shippingFreeThreshold: z.number().min(0).optional(),
  shippingFlatRate: z.number().min(0).optional(),
});

export const updateBrandConfigSchema = z.object({
  primaryLogoUrl: z.string().optional(),
  primaryLogoPublicId: z.string().nullable().optional(),
  darkLogoUrl: z.string().nullable().optional(),
  lightLogoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().optional(),
  faviconPublicId: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  placeholderImage: z.string().nullable().optional(),
  loadingLogoUrl: z.string().nullable().optional(),
  notFoundImage: z.string().nullable().optional(),
  maintenanceImage: z.string().nullable().optional(),
});

export const createSocialLinkSchema = z.object({
  platform: z.string().min(1, { message: 'Platform name is required' }),
  url: z.string().url({ message: 'Valid URL is required' }),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateSocialLinkSchema = createSocialLinkSchema.partial();

export const updateContactInfoSchema = z.object({
  supportEmail: z.string().email({ message: 'Valid email is required' }).optional(),
  supportPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  officeAddress: z.string().optional(),
  mapsEmbedUrl: z.string().nullable().optional(),
  businessHours: z.string().optional(),
});

export const updateSeoConfigSchema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  keywords: z.string().optional(),
  canonicalUrl: z.string().optional(),
  robotsMeta: z.string().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  twitterCard: z.string().optional(),
});

export const updateFooterConfigSchema = z.object({
  footerLogoUrl: z.string().nullable().optional(),
  footerText: z.string().optional(),
  copyrightText: z.string().optional(),
});

export const createLegalPageSchema = z.object({
  slug: z.string().min(1, { message: 'Slug is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  content: z.string().min(1, { message: 'Content is required' }),
  isPublished: z.boolean().optional().default(true),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

export const updateLegalPageSchema = createLegalPageSchema.partial();

export const updateEmailSmtpSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  senderName: z.string().optional(),
  senderEmail: z.string().email({ message: 'Valid sender email is required' }).optional(),
});

export const updateMaintenanceConfigSchema = z.object({
  isActive: z.boolean().optional(),
  message: z.string().optional(),
  expectedReturnTime: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  bannerImageUrl: z.string().nullable().optional(),
  whitelistIps: z.array(z.string()).optional(),
});

export const updateFeatureTogglesSchema = z.object({
  toggles: z.record(z.boolean()),
});

export const updateSecurityPolicySchema = z.object({
  passwordMinLength: z.number().int().min(6).optional(),
  sessionTimeoutMinutes: z.number().int().min(15).optional(),
  maxLoginAttempts: z.number().int().min(1).optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export const updateBackupConfigSchema = z.object({
  autoBackupEnabled: z.boolean().optional(),
  backupFrequency: z.string().optional(),
  storageProvider: z.string().optional(),
});
