import { prisma } from '../../../database/client.js';
import { Prisma, ProductType } from '@prisma/client';

export class ProductTypeRepository {
  async findAll(isAdmin = false): Promise<ProductType[]> {
    const where: Prisma.ProductTypeWhereInput = {};
    if (!isAdmin) {
      where.isActive = true;
      where.isVisible = true;
    }
    return prisma.productType.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
    });
  }

  async findById(id: string): Promise<ProductType | null> {
    return prisma.productType.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<ProductType | null> {
    return prisma.productType.findUnique({
      where: { slug },
    });
  }

  async create(data: Prisma.ProductTypeCreateInput): Promise<ProductType> {
    return prisma.productType.create({
      data,
    });
  }

  async update(id: string, data: Prisma.ProductTypeUpdateInput): Promise<ProductType> {
    return prisma.productType.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ProductType> {
    return prisma.productType.delete({
      where: { id },
    });
  }
}

export const productTypeRepository = new ProductTypeRepository();
