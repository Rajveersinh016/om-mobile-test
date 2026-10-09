import { z } from 'zod';

export const updateSectionSchema = z.object({
  isActive: z.boolean().optional(),
  startDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  endDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  settings: z.record(z.any()).optional(),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.string().uuid({ message: 'Invalid section ID format' })),
});

export const createBannerSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  subtitle: z.string().optional().nullable(),
  imageUrl: z.string().min(1, { message: 'Desktop image URL is required' }),
  mobileImageUrl: z.string().optional().nullable(),
  ctaText: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  position: z.number().int().optional().default(0),
  startDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  endDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  alignment: z.string().optional().default('left'),
  overlayOpacity: z.number().optional().default(0.15),
});

export const updateBannerSchema = createBannerSchema.partial();

export const createAnnouncementBarSchema = z.object({
  text: z.string().min(1, { message: 'Announcement text is required' }),
  bgColor: z.string().optional().default('#03045E'),
  textColor: z.string().optional().default('#FFFFFF'),
  linkUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isScrolling: z.boolean().optional().default(false),
  priority: z.number().int().optional().default(0),
  startDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  endDate: z.string().nullable().optional().transform(v => v ? new Date(v) : null),
});

export const updateAnnouncementBarSchema = createAnnouncementBarSchema.partial();

export const createPromoCardSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  buttonText: z.string().optional().nullable(),
  buttonLink: z.string().optional().nullable(),
  bgColor: z.string().optional().default('#F8FAFC'),
  sortOrder: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

export const updatePromoCardSchema = createPromoCardSchema.partial();

export const createCategoryCardSchema = z.object({
  name: z.string().min(1, { message: 'Category name is required' }),
  imageUrl: z.string().optional().nullable(),
  destinationLink: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

export const updateCategoryCardSchema = createCategoryCardSchema.partial();

export const createBrandCardSchema = z.object({
  name: z.string().min(1, { message: 'Brand name is required' }),
  logoUrl: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateBrandCardSchema = createBrandCardSchema.partial();

export const createTestimonialSchema = z.object({
  customerName: z.string().min(1, { message: 'Customer name is required' }),
  profileImage: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().default(5),
  comment: z.string().min(1, { message: 'Testimonial comment is required' }),
  sortOrder: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();

export const createWhyChooseUsSchema = z.object({
  icon: z.string().optional().default('verified'),
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string().min(1, { message: 'Description is required' }),
  sortOrder: z.number().int().optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

export const updateWhyChooseUsSchema = createWhyChooseUsSchema.partial();

export const updateNewsletterConfigSchema = z.object({
  heading: z.string().optional(),
  description: z.string().optional(),
  bgImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
