import { prisma } from '../../../database/client.js';
import { Prisma, Collection } from '@prisma/client';

export class CollectionRepository {
  async findAll(isAdmin = false, includeDeleted = false): Promise<Collection[]> {
    const where: Prisma.CollectionWhereInput = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (!isAdmin) {
      where.isActive = true;
      where.isVisible = true;
      where.status = 'PUBLISHED';
    }
    return prisma.collection.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      include: {
        products: {
          select: { id: true }
        }
      }
    }) as any;
  }

  async findById(id: string): Promise<(Collection & { products: { id: string }[] }) | null> {
    return prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          select: { id: true }
        }
      }
    }) as any;
  }

  async findBySlug(slug: string): Promise<Collection | null> {
    return prisma.collection.findUnique({
      where: { slug },
    });
  }

  async create(data: Prisma.CollectionCreateInput): Promise<Collection> {
    return prisma.collection.create({
      data,
    });
  }

  async update(id: string, data: Prisma.CollectionUpdateInput): Promise<Collection> {
    return prisma.collection.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<Collection> {
    return prisma.collection.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        isVisible: false,
        status: 'ARCHIVED',
        slug: `${id}-deleted-${Date.now()}`
      },
    });
  }

  async restore(id: string, newSlug: string): Promise<Collection> {
    return prisma.collection.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
        isVisible: true,
        status: 'PUBLISHED',
        slug: newSlug,
      },
    });
  }

  async permanentDelete(id: string): Promise<Collection> {
    await prisma.collection.update({
      where: { id },
      data: { products: { set: [] } }
    });
    return prisma.collection.delete({
      where: { id },
    });
  }
}

export const collectionRepository = new CollectionRepository();
