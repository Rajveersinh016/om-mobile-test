import { productTypeRepository } from '../repositories/productTypeRepository.js';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';
import { ProductType } from '@prisma/client';
import { slugService } from './slugService.js';

export class ProductTypeService {
  async getAllProductTypes(isAdmin = false): Promise<ProductType[]> {
    return productTypeRepository.findAll(isAdmin);
  }

  async getProductTypeById(id: string): Promise<ProductType> {
    const productType = await productTypeRepository.findById(id);
    if (!productType) {
      throw new NotFoundError('Product type not found');
    }
    return productType;
  }

  async getProductTypeBySlug(slug: string): Promise<ProductType> {
    const productType = await productTypeRepository.findBySlug(slug);
    if (!productType) {
      throw new NotFoundError('Product type not found');
    }
    return productType;
  }

  async createProductType(data: any): Promise<ProductType> {
    const baseSlug = data.slug || data.name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await productTypeRepository.findBySlug(s);
      return !!existing;
    });

    return productTypeRepository.create({
      ...data,
      slug: uniqueSlug,
    });
  }

  async updateProductType(id: string, data: any): Promise<ProductType> {
    const productType = await productTypeRepository.findById(id);
    if (!productType) {
      throw new NotFoundError('Product type not found');
    }

    let uniqueSlug = productType.slug;
    if (data.slug || data.name) {
      const baseSlug = data.slug || data.name;
      uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
        const existing = await productTypeRepository.findBySlug(s);
        return !!existing && existing.id !== id;
      });
    }

    return productTypeRepository.update(id, {
      ...data,
      slug: uniqueSlug,
    });
  }

  async deleteProductType(id: string): Promise<ProductType> {
    const productType = await productTypeRepository.findById(id);
    if (!productType) {
      throw new NotFoundError('Product type not found');
    }

    return productTypeRepository.delete(id);
  }
}

export const productTypeService = new ProductTypeService();
