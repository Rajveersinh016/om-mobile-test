import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema;

export const createProductTypeSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  thumbnail: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductTypeSchema = createProductTypeSchema;

export const createCollectionSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  desktopBanner: z.string().optional(),
  desktopBannerPublicId: z.string().optional(),
  mobileBanner: z.string().optional(),
  thumbnail: z.string().optional(),
  thumbnailPublicId: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isHomepage: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isSeasonal: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']).optional(),
  sortOrder: z.number().int().optional(),
  images: z.array(z.string()).optional(),
  theme: z.string().optional(),
  productIds: z.array(z.string().uuid({ message: 'Invalid product ID' })).optional(),
});

export const updateCollectionSchema = createCollectionSchema;

export const createDeviceSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  brand: z.string().min(1, { message: 'Brand is required' }),
  slug: z.string().optional(),
});

export const updateDeviceSchema = createDeviceSchema;

export const variantSchema = z.object({
  id: z.string().uuid({ message: 'Invalid variant ID' }).optional(),
  sku: z.string().min(1, { message: 'SKU is required' }),
  finish: z.string().min(1, { message: 'Finish is required' }),
  material: z.string().min(1, { message: 'Material is required' }),
  priceOffset: z.number().default(0),
  stockQuantity: z.number().int().min(0, { message: 'Stock must be 0 or more' }).default(0),
});

export const imageSchema = z.object({
  url: z.string().min(1, { message: 'Image URL is required' }),
  publicId: z.string().optional(),
  position: z.number().int().default(0),
});

export const devicePriceSchema = z.object({
  deviceTypeId: z.string().uuid({ message: 'Invalid deviceTypeId' }),
  price: z.number().positive({ message: 'Price must be positive' }),
});

export const createProductSchema = z.object({
  name: z.string().min(1, { message: 'Product name is required' }),
  slug: z.string().optional(),
  description: z.string().min(1, { message: 'Product description is required' }),
  price: z.number().positive({ message: 'Price must be positive' }),
  originalPrice: z.number().positive({ message: 'Original price must be positive' }),
  isSale: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  isBestSeller: z.boolean().optional().default(false),
  image: z.string().min(1, { message: 'Primary image is required' }),
  hoverImage: z.string().nullable().optional(),
  categoryId: z.string().uuid({ message: 'Invalid categoryId format' }),
  productTypeId: z.string().uuid({ message: 'Invalid productTypeId format' }).optional(),
  collectionIds: z.array(z.string().uuid()).optional(),
  modelIds: z.array(z.string().uuid()).optional(),
  supportedMaterials: z.array(z.string()).optional(),
  supportedFinishes: z.array(z.string()).optional(),
  supportedCoverages: z.array(z.string()).optional(),
  isPublished: z.boolean().optional().default(true),
  requiresDeviceSelection: z.boolean().optional(),
  variants: z.array(variantSchema).min(1, { message: 'At least one variant is required' }),
  images: z.array(imageSchema).optional(),
  devicePrices: z.array(devicePriceSchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().optional(),
  isSale: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  image: z.string().min(1).optional(),
  hoverImage: z.string().nullable().optional(),
  categoryId: z.string().uuid().optional(),
  productTypeId: z.string().uuid().optional(),
  collectionIds: z.array(z.string().uuid()).optional(),
  modelIds: z.array(z.string().uuid()).optional(),
  supportedMaterials: z.array(z.string()).optional(),
  supportedFinishes: z.array(z.string()).optional(),
  supportedCoverages: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  requiresDeviceSelection: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
  images: z.array(imageSchema).optional(),
  devicePrices: z.array(devicePriceSchema).optional(),
});

export const updateInventorySchema = z.object({
  stockQuantity: z.number().int().min(0, { message: 'Stock must be 0 or more' }),
});

export const uploadImageSchema = z.object({
  filename: z.string().min(1, { message: 'Filename is required' }),
  content: z.string().min(1, { message: 'Content (Base64) is required' }),
});

export const getProductsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid({ message: 'Invalid categoryId format' }).optional(),
  collectionId: z.string().uuid({ message: 'Invalid collectionId format' }).optional(),
  productTypeId: z.string().uuid({ message: 'Invalid productTypeId format' }).optional(),
  deviceId: z.string().uuid({ message: 'Invalid deviceId format' }).optional(),
  deviceType: z.string().optional(),
  material: z.string().optional(),
  finish: z.string().optional(),
  brand: z.string().optional(),
  availability: z.enum(['in_stock', 'out_of_stock']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  isSale: z.coerce.boolean().optional(),
  isNew: z.coerce.boolean().optional(),
  isBestSeller: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.enum(['price_asc', 'price_desc', 'created_at', 'name_asc', 'alphabetical', 'best_selling', 'featured', 'most_popular', 'newest']).optional().default('created_at'),
});

export const createDeviceTypeSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']).optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

export const updateDeviceTypeSchema = createDeviceTypeSchema;

export const createBrandSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  deviceTypeId: z.string().uuid({ message: 'Invalid deviceTypeId' }).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateBrandSchema = createBrandSchema;

export const createModelSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  slug: z.string().optional(),
  releaseYear: z.number().int().optional(),
  brandId: z.string().uuid({ message: 'Invalid brandId' }),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateModelSchema = createModelSchema;
