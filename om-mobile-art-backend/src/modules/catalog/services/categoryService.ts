import { categoryRepository } from '../repositories/categoryRepository.js';
import { ConflictError, NotFoundError } from '../../../core/exceptions/exceptions.js';
import { Category } from '@prisma/client';
import { slugService } from './slugService.js';

export class CategoryService {
  async getAllCategories(): Promise<Category[]> {
    return categoryRepository.findAll();
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category> {
    const category = await categoryRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  async createCategory(name: string, slug?: string): Promise<Category> {
    const baseSlug = slug || name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await categoryRepository.findBySlug(s);
      return !!existing;
    });

    return categoryRepository.create({ name, slug: uniqueSlug });
  }

  async updateCategory(id: string, name: string, slug?: string): Promise<Category> {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const baseSlug = slug || name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await categoryRepository.findBySlug(s);
      return !!existing && existing.id !== id;
    });

    return categoryRepository.update(id, { name, slug: uniqueSlug });
  }

  async deleteCategory(id: string): Promise<Category> {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return categoryRepository.delete(id);
  }
}

export const categoryService = new CategoryService();
