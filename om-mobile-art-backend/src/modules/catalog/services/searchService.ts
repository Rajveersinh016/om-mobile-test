import { Product, Prisma } from '@prisma/client';
import { productRepository } from '../repositories/productRepository.js';

export interface SearchQueryParams {
  search?: string;
  categoryId?: string;
  collectionId?: string;
  productTypeId?: string;
  deviceId?: string;
  deviceType?: string;
  material?: string;
  finish?: string;
  brand?: string;
  availability?: 'in_stock' | 'out_of_stock';
  minPrice?: number;
  maxPrice?: number;
  isSale?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'created_at' | 'name_asc' | 'alphabetical' | 'best_selling' | 'featured' | 'most_popular' | 'newest';
  isAdmin?: boolean;
}

export interface ISearchProvider {
  search(params: SearchQueryParams): Promise<{ products: Product[]; total: number }>;
}

export class PrismaSearchProvider implements ISearchProvider {
  async search(params: SearchQueryParams): Promise<{ products: Product[]; total: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    // For customers, show only active published products
    if (!params.isAdmin) {
      where.deletedAt = null;
      where.isPublished = true;
    } else {
      where.deletedAt = null;
    }

    if (params.categoryId) where.categoryId = params.categoryId;
    
    if (params.productTypeId) where.productTypeId = params.productTypeId;

    if (params.collectionId) {
      where.collections = {
        some: {
          id: params.collectionId,
        },
      };
    }
    
    if (params.deviceId) {
      where.models = {
        some: {
          id: params.deviceId,
        },
      };
    }

    if (params.deviceType && params.deviceType !== 'all') {
      const dtSearch = params.deviceType.trim();
      const devTypeFilter = {
        OR: [
          { id: dtSearch },
          { slug: dtSearch.toLowerCase() },
          { name: { contains: dtSearch } }
        ]
      };
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            {
              models: {
                some: {
                  OR: [
                    { brand: { deviceType: devTypeFilter } },
                    { series: { brand: { deviceType: devTypeFilter } } }
                  ]
                }
              }
            },
            {
              requiresDeviceSelection: false,
              devicePrices: {
                some: {
                  price: { gt: 0 },
                  deviceType: devTypeFilter
                }
              }
            }
          ]
        }
      ];
    }

    if (params.material) {
      where.supportedMaterials = {
        array_contains: params.material,
      };
    }

    if (params.finish) {
      where.supportedFinishes = {
        array_contains: params.finish,
      };
    }

    if (params.brand) {
      where.models = {
        some: {
          series: {
            brand: {
              name: {
                equals: params.brand,
              },
            },
          },
        },
      };
    }

    if (params.availability === 'in_stock') {
      where.variants = {
        some: {
          stockQuantity: { gt: 0 },
        },
      };
    } else if (params.availability === 'out_of_stock') {
      where.variants = {
        every: {
          stockQuantity: { lte: 0 },
        },
      };
    }

    if (params.isSale !== undefined) where.isSale = params.isSale;
    if (params.isNew !== undefined) where.isNew = params.isNew;
    if (params.isBestSeller !== undefined) where.isBestSeller = params.isBestSeller;

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {};
      if (params.minPrice !== undefined) where.price.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.price.lte = params.maxPrice;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'price_asc':
          orderBy = { price: 'asc' };
          break;
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
        case 'name_asc':
        case 'alphabetical':
          orderBy = { name: 'asc' };
          break;
        case 'best_selling':
          orderBy = { isBestSeller: 'desc' };
          break;
        case 'featured':
          orderBy = { isNew: 'desc' };
          break;
        case 'most_popular':
          orderBy = { isBestSeller: 'desc' };
          break;
        case 'created_at':
        case 'newest':
        default:
          orderBy = { createdAt: 'desc' };
          break;
      }
    }

    const [products, total] = await Promise.all([
      productRepository.findMany(where, skip, limit, orderBy),
      productRepository.count(where),
    ]);

    return {
      products,
      total,
    };
  }
}

export const searchService = new PrismaSearchProvider();
