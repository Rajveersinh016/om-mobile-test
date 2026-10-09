import { collectionRepository } from '../repositories/collectionRepository.js';
import { ConflictError, NotFoundError } from '../../../core/exceptions/exceptions.js';
import { Collection } from '@prisma/client';
import { slugService } from './slugService.js';

export class CollectionService {
  async getAllCollections(isAdmin = false, includeDeleted = false): Promise<Collection[]> {
    return collectionRepository.findAll(isAdmin, includeDeleted);
  }

  async getCollectionById(idOrSlug: string): Promise<Collection> {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);
    let collection = null;
    if (isUuid) {
      collection = await collectionRepository.findById(idOrSlug);
    } else {
      collection = await collectionRepository.findBySlug(idOrSlug);
    }
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }
    return collection;
  }

  async getCollectionBySlug(slug: string): Promise<Collection> {
    const collection = await collectionRepository.findBySlug(slug);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }
    return collection;
  }

  async createCollection(data: any): Promise<Collection> {
    const baseSlug = data.slug || data.name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await collectionRepository.findBySlug(s);
      return !!existing;
    });

    const { productIds, ...fields } = data;

    const createPayload: any = {
      ...fields,
      slug: uniqueSlug,
    };

    if (productIds && productIds.length > 0) {
      createPayload.products = {
        connect: productIds.map((id: string) => ({ id })),
      };
    }

    return collectionRepository.create(createPayload);
  }

  async updateCollection(id: string, data: any): Promise<Collection> {
    const collection = await collectionRepository.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    let uniqueSlug = collection.slug;
    if (data.slug || data.name) {
      const baseSlug = data.slug || data.name;
      uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
        const existing = await collectionRepository.findBySlug(s);
        return !!existing && existing.id !== id;
      });
    }

    const { productIds, ...fields } = data;

    const updatePayload: any = {
      ...fields,
      slug: uniqueSlug,
    };

    if (productIds !== undefined) {
      updatePayload.products = {
        set: productIds.map((pid: string) => ({ id: pid })),
      };
    }

    return collectionRepository.update(id, updatePayload);
  }

  async deleteCollection(id: string): Promise<Collection> {
    const collection = await collectionRepository.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }
    return collectionRepository.softDelete(id);
  }

  async restoreCollection(id: string): Promise<Collection> {
    const collection = await collectionRepository.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    // Clean name by removing copy/deleted indicators if any, or generate slug from name
    const baseSlug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await collectionRepository.findBySlug(s);
      return !!existing && existing.id !== id;
    });

    return collectionRepository.restore(id, uniqueSlug);
  }

  async permanentDeleteCollection(id: string): Promise<Collection> {
    const collection = await collectionRepository.findById(id);
    if (!collection) {
      throw new NotFoundError('Collection not found');
    }
    return collectionRepository.permanentDelete(id);
  }

  async duplicateCollection(id: string): Promise<Collection> {
    const original = await collectionRepository.findById(id);
    if (!original) {
      throw new NotFoundError('Collection to duplicate not found');
    }

    const duplicateName = `${original.name} (Copy)`;
    const baseSlug = `${original.slug || original.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copy`;
    
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await collectionRepository.findBySlug(s);
      return !!existing;
    });

    const duplicatePayload: any = {
      name: duplicateName,
      slug: uniqueSlug,
      description: original.description,
      shortDescription: original.shortDescription,
      seoTitle: original.seoTitle,
      seoDescription: original.seoDescription,
      seoKeywords: original.seoKeywords,
      desktopBanner: original.desktopBanner,
      desktopBannerPublicId: original.desktopBannerPublicId,
      mobileBanner: original.mobileBanner,
      thumbnail: original.thumbnail,
      thumbnailPublicId: original.thumbnailPublicId,
      isFeatured: original.isFeatured,
      isHomepage: original.isHomepage,
      isTrending: original.isTrending,
      isSeasonal: original.isSeasonal,
      isActive: original.isActive,
      isVisible: original.isVisible,
      status: original.status,
      sortOrder: original.sortOrder,
    };

    if (original.products && original.products.length > 0) {
      duplicatePayload.products = {
        connect: original.products.map((p) => ({ id: p.id })),
      };
    }

    return collectionRepository.create(duplicatePayload);
  }
}

export const collectionService = new CollectionService();
