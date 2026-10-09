import { productRepository } from '../repositories/productRepository.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { collectionRepository } from '../repositories/collectionRepository.js';
import { deviceRepository } from '../repositories/deviceRepository.js';
import { productTypeRepository } from '../repositories/productTypeRepository.js';
import { userRepository } from '../../auth/repositories/userRepository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../core/exceptions/exceptions.js';
import { Product, Prisma, ProductVariant, ProductImage } from '@prisma/client';
import { slugService } from './slugService.js';
import { imageUrlGenerator } from './imageUrlGenerator.js';
import { searchService } from './searchService.js';
import { prisma } from '../../../database/client.js';
import { logger } from '../../../services/logger.js';

function mapProductImages(product: any) {
  if (!product) return product;
  if (product.image) {
    product.image = imageUrlGenerator.generateUrl(product.image);
  }
  if (product.hoverImage) {
    product.hoverImage = imageUrlGenerator.generateUrl(product.hoverImage);
  }
  if (product.images) {
    product.images = product.images.map((img: any) => ({
      ...img,
      url: imageUrlGenerator.generateUrl(img.url),
    }));
  }

  // Build structured compatibility tree
  const models = product.models || [];
  const deviceTypeMap = new Map();
  const brandMap = new Map();
  const modelList: any[] = [];

  models.forEach((m: any) => {
    const brand = m.brand || m.series?.brand;
    const deviceType = brand?.deviceType;

    if (deviceType) {
      if (!deviceTypeMap.has(deviceType.id)) {
        deviceTypeMap.set(deviceType.id, {
          id: deviceType.id,
          name: deviceType.name,
          slug: deviceType.slug,
          icon: deviceType.icon,
          sortOrder: deviceType.sortOrder || 0
        });
      }
    }

    if (brand) {
      if (!brandMap.has(brand.id)) {
        brandMap.set(brand.id, {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          logo: brand.logo,
          deviceTypeId: brand.deviceTypeId || deviceType?.id || null,
          sortOrder: brand.sortOrder || 0
        });
      }
    }

    modelList.push({
      id: m.id,
      name: m.name,
      slug: m.slug,
      brandId: m.brandId || brand?.id || null,
      sortOrder: m.sortOrder || 0
    });
  });

  const deviceTypes = Array.from(deviceTypeMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  const brands = Array.from(brandMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  const supportedDtSet = new Set<string>(deviceTypes.map((dt: any) => String(dt.id)));
  const rawDevicePrices = product.devicePrices || [];

  // Filter rawDevicePrices: if product requires device selection and has supported device types, only keep prices for supported device types
  const filteredRawPrices = (product.requiresDeviceSelection !== false && supportedDtSet.size > 0)
    ? rawDevicePrices.filter((dp: any) => supportedDtSet.has(String(dp.deviceTypeId)))
    : rawDevicePrices;

  const devicePrices = filteredRawPrices.map((dp: any) => ({
    id: dp.id,
    deviceTypeId: dp.deviceTypeId,
    deviceType: dp.deviceType ? {
      id: dp.deviceType.id,
      name: dp.deviceType.name,
      slug: dp.deviceType.slug,
      icon: dp.deviceType.icon
    } : null,
    price: Number(dp.price)
  }));

  const validPrices = devicePrices.map((dp: any) => dp.price).filter((p: number) => p > 0);
  const baseProductPrice = Number(product.price || 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : baseProductPrice;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : baseProductPrice;
  // 'isMultiDevice' / 'From ' display mode should ONLY be true if > 1 valid supported device price exists
  const isMultiDevice = validPrices.length > 1;

  product.devicePrices = devicePrices;
  product.minPrice = minPrice;
  product.maxPrice = maxPrice;
  product.isMultiDevice = isMultiDevice;
  product.pricing = {
    minPrice,
    maxPrice,
    priceCount: validPrices.length,
    displayMode: validPrices.length > 1 ? 'range' : (validPrices.length === 1 ? 'single' : 'unavailable')
  };

  product.compatibility = {
    requiresDeviceSelection: product.requiresDeviceSelection !== false,
    deviceTypes,
    brands,
    models: modelList
  };

  logger.debug(`[Compatibility Trace] Product '${product.id}' (${product.name}): requiresDeviceSelection=${product.requiresDeviceSelection}, DeviceTypes=${deviceTypes.length}, Brands=${brands.length}, Models=${modelList.length}`);

  return product;
}

export class ProductService {
  async getProducts(
    params: {
      search?: string;
      categoryId?: string;
      collectionId?: string;
      deviceId?: string;
      material?: string;
      finish?: string;
      minPrice?: number;
      maxPrice?: number;
      isSale?: boolean;
      isNew?: boolean;
      isBestSeller?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'price_asc' | 'price_desc' | 'created_at' | 'name_asc' | 'alphabetical' | 'best_selling' | 'featured' | 'most_popular' | 'newest';
      isAdmin?: boolean;
    } = {}
  ): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;

    const result = await searchService.search(params);
    const products = result.products.map((p) => mapProductImages(p));

    return {
      products,
      total: result.total,
      page,
      limit,
    };
  }

  async getProductById(idOrSlug: string, isAdmin = false): Promise<any> {
    if (!idOrSlug) {
      throw new NotFoundError('Product not found');
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let product = isUuid ? await productRepository.findById(idOrSlug) : await productRepository.findBySlug(idOrSlug);
    if (!product) {
      product = await productRepository.findBySlug(idOrSlug);
    }
    if (!product && isUuid) {
      product = await productRepository.findBySlug(idOrSlug);
    }
    if (!product) {
      const fallbackMatch = await prisma.product.findFirst({
        where: {
          OR: [
            { id: idOrSlug },
            { slug: idOrSlug },
            { sku: idOrSlug }
          ]
        },
        include: {
          category: true,
          collections: true,
          productType: true,
          images: { orderBy: { position: 'asc' } },
          variants: true,
          models: {
            include: {
              brand: { include: { deviceType: true } },
              series: { include: { brand: { include: { deviceType: true } } } }
            }
          }
        }
      });
      if (fallbackMatch) {
        product = fallbackMatch as any;
      }
    }

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!isAdmin && (product.deletedAt !== null || !product.isPublished)) {
      throw new NotFoundError('Product not found');
    }

    const mapped = mapProductImages(product) as any;
    const globalMockup = await prisma.globalProductMockup.findUnique({
      where: { id: 'global-mockup' }
    });

    mapped.defaultFrontMockup = globalMockup?.defaultFrontUrl ? imageUrlGenerator.generateUrl(globalMockup.defaultFrontUrl) : null;
    mapped.defaultBackMockup = globalMockup?.defaultBackUrl ? imageUrlGenerator.generateUrl(globalMockup.defaultBackUrl) : null;

    return mapped;
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    const product = await productRepository.findById(productId);
    if (!product || product.deletedAt !== null) {
      throw new NotFoundError('Product not found');
    }

    const where: Prisma.ProductWhereInput = {
      id: { not: productId },
      deletedAt: null,
      isPublished: true,
      OR: [
        { categoryId: product.categoryId },
        ...(product.collections && product.collections.length > 0
          ? [{ collections: { some: { id: { in: product.collections.map((c: any) => c.id) } } } }]
          : []),
      ],
    };

    const products = await productRepository.findMany(where, 0, limit, { createdAt: 'desc' });
    return products.map((p) => mapProductImages(p));
  }

  async createProduct(
    userId: string,
    data: {
      name: string;
      slug?: string;
      description: string;
      price: number;
      originalPrice: number;
      isSale?: boolean;
      isNew?: boolean;
      isBestSeller?: boolean;
      image: string;
      hoverImage?: string | null;
      categoryId: string;
      productTypeId?: string;
      collectionIds?: string[];
      modelIds?: string[];
      supportedMaterials?: string[];
      supportedFinishes?: string[];
      supportedCoverages?: string[];
      isPublished?: boolean;
      requiresDeviceSelection?: boolean;
      devicePrices?: { deviceTypeId: string; price: number }[];
      variants: {
        sku: string;
        finish: string;
        material: string;
        priceOffset?: number;
        stockQuantity?: number;
      }[];
      images?: {
        url: string;
        publicId?: string;
        position?: number;
      }[];
    }
  ): Promise<Product> {
    // Validate Category
    const category = await categoryRepository.findById(data.categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Validate Product Type
    if (data.productTypeId) {
      const productType = await productTypeRepository.findById(data.productTypeId);
      if (!productType) {
        throw new NotFoundError('Product type not found');
      }
    }

    // Validate Collections
    if (data.collectionIds && data.collectionIds.length > 0) {
      for (const colId of data.collectionIds) {
        const collection = await collectionRepository.findById(colId);
        if (!collection) {
          throw new NotFoundError(`Collection with ID '${colId}' not found`);
        }
      }
    }

    // Validate Models and collect supported device types
    const requiredDeviceTypes = new Map<string, string>();
    if (data.modelIds && data.modelIds.length > 0) {
      for (const modelId of data.modelIds) {
        const model = await prisma.model.findUnique({
          where: { id: modelId },
          include: { brand: { include: { deviceType: true } } }
        });
        if (!model) {
          throw new NotFoundError(`Model with ID '${modelId}' not found`);
        }
        const dt = model.brand?.deviceType;
        if (dt) {
          requiredDeviceTypes.set(dt.id, dt.name);
        }
      }
    }

    // Validate Device Prices
    const rawDevicePrices = data.devicePrices || [];
    const devicePricesInput = rawDevicePrices.map((dp: any) => ({
      deviceTypeId: dp.deviceTypeId,
      price: Number(dp.price)
    }));

    for (const dp of devicePricesInput) {
      if (!dp.deviceTypeId || isNaN(dp.price) || dp.price <= 0) {
        throw new ValidationError('Each device price must have a valid deviceTypeId and positive price.');
      }
      const dt = await prisma.deviceType.findUnique({ where: { id: dp.deviceTypeId } });
      if (!dt) {
        throw new NotFoundError(`Device type '${dp.deviceTypeId}' not found.`);
      }
    }

    // Validate unique SKUs
    const skus = data.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new ValidationError('Duplicate SKUs provided in variants');
    }

    for (const sku of skus) {
      const existing = await productRepository.findVariantBySku(sku);
      if (existing) {
        throw new ConflictError(`Variant SKU '${sku}' already exists`);
      }
    }

    // Generate unique slug for active products
    const baseSlug = data.slug || data.name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await productRepository.findBySlug(s);
      return !!existing && existing.deletedAt === null;
    });

    const productData: Prisma.ProductCreateInput = {
      name: data.name,
      slug: uniqueSlug,
      description: data.description,
      price: data.price,
      originalPrice: data.originalPrice,
      isSale: data.isSale ?? false,
      isNew: data.isNew ?? false,
      isBestSeller: data.isBestSeller ?? false,
      image: data.image,
      hoverImage: data.hoverImage ?? null,
      isPublished: data.isPublished ?? true,
      requiresDeviceSelection: data.requiresDeviceSelection ?? true,
      category: { connect: { id: data.categoryId } },
      productType: data.productTypeId
        ? { connect: { id: data.productTypeId } }
        : undefined,
      collections: data.collectionIds && data.collectionIds.length > 0
        ? { connect: data.collectionIds.map((id) => ({ id })) }
        : undefined,
      models: data.modelIds && data.modelIds.length > 0
        ? { connect: data.modelIds.map((id) => ({ id })) }
        : undefined,
      supportedMaterials: data.supportedMaterials ?? [],
      supportedFinishes: data.supportedFinishes ?? [],
      supportedCoverages: data.supportedCoverages ?? [],
    };

    const variants = data.variants.map((v) => ({
      sku: v.sku,
      finish: v.finish,
      material: v.material,
      priceOffset: v.priceOffset ?? 0.0,
      stockQuantity: v.stockQuantity ?? 0,
    }));

    // Limit gallery images to maximum 5 per product
    const images = (data.images ?? []).slice(0, 5).map((img, index) => ({
      url: img.url,
      publicId: img.publicId,
      position: img.position ?? index,
    }));

    const product = await productRepository.create(productData, variants, images, devicePricesInput);

    // Audit Log
    await userRepository.logActivity(
      userId,
      'CREATE_PRODUCT',
      product.id,
      `Created product '${product.name}' with ${variants.length} variants`
    );

    return mapProductImages(product);
  }

  async updateProduct(
    userId: string,
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      price?: number;
      originalPrice?: number;
      isSale?: boolean;
      isNew?: boolean;
      isBestSeller?: boolean;
      image?: string;
      hoverImage?: string | null;
      categoryId?: string;
      productTypeId?: string;
      collectionIds?: string[];
      modelIds?: string[];
      supportedMaterials?: string[];
      supportedFinishes?: string[];
      supportedCoverages?: string[];
      isPublished?: boolean;
      requiresDeviceSelection?: boolean;
      devicePrices?: { deviceTypeId: string; price: number }[];
      variants?: {
        id?: string;
        sku: string;
        finish: string;
        material: string;
        priceOffset?: number;
        stockQuantity?: number;
      }[];
      images?: {
        url: string;
        publicId?: string;
        position?: number;
      }[];
    }
  ): Promise<Product> {
    const existingProduct = await productRepository.findById(id);
    if (!existingProduct || existingProduct.deletedAt !== null) {
      throw new NotFoundError('Product not found');
    }

    // Validate Category
    if (data.categoryId) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    // Validate Product Type
    if (data.productTypeId) {
      const productType = await productTypeRepository.findById(data.productTypeId);
      if (!productType) {
        throw new NotFoundError('Product type not found');
      }
    }
    // Validate Collections
    if (data.collectionIds) {
      for (const colId of data.collectionIds) {
        const collection = await collectionRepository.findById(colId);
        if (!collection) {
          throw new NotFoundError(`Collection with ID '${colId}' not found`);
        }
      }
    }

    // Validate Device Prices
    let devicePricesInput: { deviceTypeId: string; price: number }[] | undefined = undefined;
    if (data.devicePrices !== undefined) {
      devicePricesInput = data.devicePrices.map((dp: any) => ({
        deviceTypeId: dp.deviceTypeId,
        price: Number(dp.price)
      }));

      for (const dp of devicePricesInput) {
        if (!dp.deviceTypeId || isNaN(dp.price) || dp.price <= 0) {
          throw new ValidationError('Each device price must have a valid deviceTypeId and positive price.');
        }
        const dt = await prisma.deviceType.findUnique({ where: { id: dp.deviceTypeId } });
        if (!dt) {
          throw new NotFoundError(`Device type '${dp.deviceTypeId}' not found.`);
        }
      }
    }

    // Validate unique SKUs
    if (data.variants) {
      const skus = data.variants.map((v) => v.sku);
      if (new Set(skus).size !== skus.length) {
        throw new ValidationError('Duplicate SKUs provided in variants');
      }

      for (const variant of data.variants) {
        const existing = await productRepository.findVariantBySku(variant.sku);
        if (existing && existing.productId !== id) {
          throw new ConflictError(`Variant SKU '${variant.sku}' already exists on another product`);
        }
      }
    }

    const productData: Prisma.ProductUpdateInput = {
      name: data.name,
      description: data.description,
      price: data.price,
      originalPrice: data.originalPrice,
      isSale: data.isSale,
      isNew: data.isNew,
      isBestSeller: data.isBestSeller,
      image: data.image,
      hoverImage: data.hoverImage !== undefined ? data.hoverImage : undefined,
      isPublished: data.isPublished,
      requiresDeviceSelection: data.requiresDeviceSelection !== undefined ? data.requiresDeviceSelection : undefined,
      supportedMaterials: data.supportedMaterials,
      supportedFinishes: data.supportedFinishes,
      supportedCoverages: data.supportedCoverages,
    };

    // Handle slug update or regeneration
    if (data.slug !== undefined || data.name !== undefined) {
      const baseSlug = data.slug || data.name || existingProduct.name;
      const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
        const existing = await productRepository.findBySlug(s);
        return !!existing && existing.deletedAt === null && existing.id !== id;
      });
      productData.slug = uniqueSlug;
    }

    if (data.categoryId) {
      productData.category = { connect: { id: data.categoryId } };
    }
    if (data.productTypeId !== undefined) {
      productData.productType = data.productTypeId
        ? { connect: { id: data.productTypeId } }
        : { disconnect: true };
    }
    if (data.collectionIds !== undefined) {
      productData.collections = {
        set: data.collectionIds.map((id) => ({ id })),
      };
    }
    if (data.modelIds !== undefined) {
      productData.models = {
        set: data.modelIds.map((id) => ({ id })),
      };
    }

    const formattedImages = data.images ? data.images.slice(0, 5).map((img, index) => ({
      url: img.url,
      publicId: img.publicId,
      position: img.position ?? index,
    })) : undefined;

    const product = await productRepository.update(
      id,
      productData,
      data.variants,
      formattedImages,
      devicePricesInput
    );

    // Audit Log
    await userRepository.logActivity(
      userId,
      'UPDATE_PRODUCT',
      product.id,
      `Updated product '${product.name}'`
    );

    return mapProductImages(product);
  }

  async softDeleteProduct(userId: string, id: string): Promise<any> {
    const result = await productRepository.deleteProductTransaction(id);
    const msg = result.action === 'ARCHIVED'
      ? `Product was archived to preserve order history.`
      : `Product deleted successfully.`;

    await userRepository.logActivity(userId, 'DELETE_PRODUCT', id, msg);
    return { action: result.action, name: result.product?.name || 'Product', message: msg };
  }

  async permanentDeleteProduct(userId: string, id: string): Promise<any> {
    const result = await productRepository.deleteProductTransaction(id);
    const msg = result.action === 'ARCHIVED'
      ? `Product was archived to preserve order history.`
      : `Product permanently deleted successfully.`;

    await userRepository.logActivity(userId, 'PERMANENT_DELETE_PRODUCT', id, msg);
    return { action: result.action, message: msg };
  }

  async bulkDeleteProducts(userId: string, ids: string[]): Promise<{ deletedCount: number; archivedCount: number; message: string }> {
    const res = await productRepository.bulkDeleteProductsTransaction(ids);
    const msg = `Successfully processed ${ids.length} products: ${res.deletedCount} deleted, ${res.archivedCount} archived.`;

    await userRepository.logActivity(userId, 'BULK_DELETE_PRODUCTS', 'bulk', msg);
    return { deletedCount: res.deletedCount, archivedCount: res.archivedCount, message: msg };
  }

  async restoreProduct(userId: string, id: string): Promise<Product> {
    const existing = await productRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }
    if (existing.deletedAt === null) {
      throw new ValidationError('Product is not deleted');
    }

    // Free restored slug or deduplicate against active products
    const baseSlug = (existing.slug ? existing.slug.split('-deleted-')[0] : null) || existing.name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existingConflict = await productRepository.findBySlug(s);
      return !!existingConflict && existingConflict.deletedAt === null;
    });

    const product = await productRepository.restore(id, uniqueSlug);

    // Audit Log
    await userRepository.logActivity(userId, 'RESTORE_PRODUCT', id, `Restored product '${product.name}'`);

    return mapProductImages(product);
  }

  async publishProduct(userId: string, id: string): Promise<Product> {
    const existing = await productRepository.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError('Product not found');
    }

    const product = await productRepository.publish(id);

    // Audit Log
    await userRepository.logActivity(userId, 'PUBLISH_PRODUCT', id, `Published product '${product.name}'`);

    return mapProductImages(product);
  }

  async unpublishProduct(userId: string, id: string): Promise<Product> {
    const existing = await productRepository.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError('Product not found');
    }

    const product = await productRepository.unpublish(id);

    // Audit Log
    await userRepository.logActivity(userId, 'UNPUBLISH_PRODUCT', id, `Unpublished product '${product.name}'`);

    return mapProductImages(product);
  }

  async updateInventory(userId: string, variantId: string, stockQuantity: number): Promise<ProductVariant> {
    const variant = await productRepository.findVariantById(variantId);
    if (!variant) {
      throw new NotFoundError('Product variant not found');
    }

    const updated = await productRepository.updateVariantInventory(variantId, stockQuantity);

    // Audit Log
    await userRepository.logActivity(
      userId,
      'UPDATE_INVENTORY',
      variant.productId,
      `Updated variant '${variant.sku}' inventory to ${stockQuantity}`
    );

    return updated;
  }

  async duplicateProduct(userId: string, id: string): Promise<Product> {
    const original = await productRepository.findById(id);
    if (!original) {
      throw new NotFoundError('Product not found');
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newName = `${original.name} (Copy ${randomSuffix})`;
    const baseSlug = `${original.slug || original.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copy-${randomSuffix}`;

    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await productRepository.findBySlug(s);
      return !!existing && existing.deletedAt === null;
    });

    const duplicatedVariants = (original.variants || []).map((v: any) => ({
      sku: `${v.sku}-COPY-${randomSuffix}`,
      finish: v.finish,
      material: v.material,
      priceOffset: v.priceOffset,
      stockQuantity: v.stockQuantity,
    }));

    const duplicatedImages = (original.images || []).map((img: any) => ({
      url: img.url,
      position: img.position,
    }));

    const duplicatedProductData: Prisma.ProductCreateInput = {
      name: newName,
      slug: uniqueSlug,
      description: original.description,
      price: original.price,
      originalPrice: original.originalPrice,
      isSale: original.isSale,
      isNew: original.isNew,
      isBestSeller: original.isBestSeller,
      image: original.image,
      isPublished: false, // Default duplicates as draft
      category: { connect: { id: original.categoryId } },
      productType: original.productTypeId ? { connect: { id: original.productTypeId } } : undefined,
      collections: original.collections && original.collections.length > 0
        ? { connect: original.collections.map((c: any) => ({ id: c.id })) }
        : undefined,
      models: (original as any).models && (original as any).models.length > 0
        ? { connect: (original as any).models.map((m: any) => ({ id: m.id })) }
        : undefined,
      supportedMaterials: original.supportedMaterials ?? [],
      supportedFinishes: original.supportedFinishes ?? [],
      supportedCoverages: original.supportedCoverages ?? [],
    };

    const newProduct = await productRepository.create(
      duplicatedProductData,
      duplicatedVariants,
      duplicatedImages
    );

    // Audit Log
    await userRepository.logActivity(
      userId,
      'DUPLICATE_PRODUCT',
      newProduct.id,
      `Duplicated product '${original.name}' as '${newProduct.name}'`
    );

    return mapProductImages(newProduct);
  }
}

export const productService = new ProductService();
