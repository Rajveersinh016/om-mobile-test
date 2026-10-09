import { logger } from '../../../services/logger.js';

export class SlugService {
  normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/[\s-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async generateUniqueSlug(
    baseName: string,
    checkExists: (slug: string) => Promise<boolean>
  ): Promise<string> {
    const baseSlug = this.normalize(baseName) || 'unnamed';
    let slug = baseSlug;
    let counter = 1;
    
    while (await checkExists(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
      logger.info({ baseSlug, slug, counter }, 'Slug collision detected; sequential counter incremented');
    }
    
    return slug;
  }
}

export const slugService = new SlugService();
