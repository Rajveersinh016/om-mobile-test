import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../database/client.js';
import { ZodSchema } from 'zod';
import { ValidationError, NotFoundError, ConflictError } from '../../../core/exceptions/exceptions.js';
import { createBrandSchema, updateBrandSchema } from '../validators/catalogValidator.js';

function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      issue: err.message,
    }));
    throw new ValidationError('Validation failed', details);
  }
  return result.data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export class BrandController {
  // GET /api/v1/brands
  async getBrands(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { deviceTypeId, mobileOnly, q, limit, page, includeDeleted } = request.query as {
        deviceTypeId?: string;
        mobileOnly?: string;
        q?: string;
        limit?: string;
        page?: string;
        includeDeleted?: string;
      };
      const isAdmin = request.user?.role === 'ADMIN';

      const where: any = {};
      if (!isAdmin) {
        where.deletedAt = null;
        where.status = 'PUBLISHED';
      } else {
        if (includeDeleted !== 'true') {
          where.deletedAt = null;
        }
      }

      if (deviceTypeId) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(deviceTypeId);
        if (isUuid) {
          where.deviceTypeId = deviceTypeId;
        } else {
          const dt = await prisma.deviceType.findFirst({
            where: {
              OR: [
                { slug: deviceTypeId },
                { name: { contains: deviceTypeId } }
              ],
              deletedAt: null
            }
          });
          if (dt) {
            where.deviceTypeId = dt.id;
          } else {
            where.deviceTypeId = '00000000-0000-0000-0000-000000000000';
          }
        }
      }
      if (mobileOnly === 'true' || mobileOnly === '1') {
        where.deviceType = {
          is: {
            OR: [
              { name: { contains: 'mobile' } },
              { name: { contains: 'smartphone' } },
              { slug: { contains: 'mobile' } },
              { slug: { contains: 'smartphone' } }
            ],
            deletedAt: null
          }
        };
      }
      if (q) {
        where.name = { contains: q };
      }

      const take = limit ? parseInt(limit) : undefined;
      const skip = page && take ? (parseInt(page) - 1) * take : undefined;

      const [brands, total] = await Promise.all([
        prisma.brand.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          take,
          skip,
          include: {
            deviceType: true
          }
        }),
        prisma.brand.count({ where })
      ]);

      return reply.status(200).send({
        success: true,
        data: brands,
        total,
        page: page ? parseInt(page) : 1,
        limit: take || total
      });
    } catch (err: any) {
      console.error('Error fetching brands:', err);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch brands'
      });
    }
  }

  // POST /api/v1/admin/brands
  async createBrand(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createBrandSchema, request.body);
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Duplicate check within same Device Type
    const existing = await prisma.brand.findFirst({
      where: {
        deviceTypeId: body.deviceTypeId || null,
        OR: [
          { name: { equals: body.name } },
          { slug: { equals: slug } }
        ]
      }
    });

    if (existing) {
      throw new ConflictError('A brand with this name or slug already exists under this device type');
    }

    const brand = await prisma.brand.create({
      data: {
        name: body.name,
        slug,
        logo: body.logo || '',
        description: body.description || '',
        deviceTypeId: body.deviceTypeId || null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        status: body.status || 'PUBLISHED',
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : 0
      },
      include: {
        deviceType: true
      }
    });

    return reply.status(201).send({
      success: true,
      data: brand
    });
  }

  // PUT /api/v1/admin/brands/:id
  async updateBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateBrandSchema, request.body);

    const existingBrand = await prisma.brand.findUnique({ where: { id } });
    if (!existingBrand) {
      throw new NotFoundError('Brand not found');
    }

    let slug = existingBrand.slug;
    if (body.name || body.slug || body.deviceTypeId !== undefined) {
      const targetName = body.name || existingBrand.name;
      const targetSlug = body.slug || targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const targetDeviceTypeId = body.deviceTypeId !== undefined ? body.deviceTypeId : existingBrand.deviceTypeId;

      const duplicate = await prisma.brand.findFirst({
        where: {
          id: { not: id },
          deviceTypeId: targetDeviceTypeId || null,
          OR: [
            { name: { equals: targetName } },
            { slug: { equals: targetSlug } }
          ]
        }
      });

      if (duplicate) {
        throw new ConflictError('A brand with this name or slug already exists under this device type');
      }
      slug = targetSlug;
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        logo: body.logo,
        description: body.description,
        deviceTypeId: body.deviceTypeId !== undefined ? (body.deviceTypeId || null) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        status: body.status,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : undefined
      },
      include: {
        deviceType: true
      }
    });

    return reply.status(200).send({
      success: true,
      data: brand
    });
  }

  // DELETE /api/v1/admin/brands/:id
  async deleteBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { force } = (request.query || {}) as { force?: string };
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            brandId: id
          }
        }
      }
    });

    if (productCount > 0 && force !== 'true' && force !== '1') {
      return reply.status(409).send({
        success: false,
        code: 'IN_USE',
        productCount,
        message: `This item is currently used by ${productCount} products. Deleting it will affect those products.`,
        requiresConfirmation: true
      });
    }

    // Soft delete
    await prisma.brand.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'HIDDEN',
        isActive: false,
        slug: `${id}-deleted-${Date.now()}`
      }
    });

    return reply.status(200).send({
      success: true,
      message: 'Brand deleted successfully.',
      productCount
    });
  }

  // POST /api/v1/admin/brands/:id/restore
  async restoreBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    const baseSlug = existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let uniqueSlug = baseSlug;
    let count = 1;
    while (true) {
      const dup = await prisma.brand.findFirst({
        where: { slug: uniqueSlug, id: { not: id }, deviceTypeId: existing.deviceTypeId || null }
      });
      if (!dup) break;
      uniqueSlug = `${baseSlug}-${count++}`;
    }

    const restored = await prisma.brand.update({
      where: { id },
      data: { deletedAt: null, slug: uniqueSlug }
    });

    return reply.status(200).send({ success: true, data: restored, message: 'Brand restored' });
  }

  // DELETE /api/v1/admin/brands/:id/permanent
  async permanentDeleteBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            brandId: id
          }
        }
      }
    });

    if (productCount > 0) {
      return reply.status(400).send({
        success: false,
        code: 'IN_USE',
        productCount,
        message: `Cannot delete because this Brand is used by ${productCount} products.`
      });
    }

    const modelCount = await prisma.model.count({ where: { brandId: id, deletedAt: null } });
    if (modelCount > 0) {
      return reply.status(400).send({
        success: false,
        code: 'HAS_CHILDREN',
        message: `Cannot permanently delete because this Brand has ${modelCount} active models.`
      });
    }

    try {
      await prisma.brand.delete({ where: { id } });
      return reply.status(200).send({ success: true, message: 'Brand permanently deleted successfully.' });
    } catch (err: any) {
      console.error('Permanent delete Brand error:', err);
      return reply.status(400).send({
        success: false,
        message: 'Cannot permanently delete because of foreign key constraint errors in database.'
      });
    }
  }

  // POST /api/v1/admin/brands/bulk
  async bulkAction(request: FastifyRequest, reply: FastifyReply) {
    const { ids, action, targetId, force } = request.body as {
      ids: string[];
      action: 'DELETE' | 'PUBLISH' | 'HIDE' | 'RESTORE' | 'MOVE';
      targetId?: string;
      force?: boolean;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'IDs list is required' });
    }

    if (action === 'DELETE') {
      const productCount = await prisma.product.count({
        where: {
          deletedAt: null,
          models: {
            some: {
              brandId: { in: ids }
            }
          }
        }
      });

      if (productCount > 0 && !force) {
        return reply.status(409).send({
          success: false,
          code: 'IN_USE',
          productCount,
          message: `Cannot delete because selected Brands are used by ${productCount} products.`,
          requiresConfirmation: true
        });
      }

      await prisma.$transaction(
        ids.map(id =>
          prisma.brand.update({
            where: { id },
            data: {
              deletedAt: new Date(),
              status: 'HIDDEN',
              isActive: false,
              slug: `${id}-deleted-${Date.now()}`
            }
          })
        )
      );
      return reply.status(200).send({ success: true, message: 'Brands deleted successfully.', productCount });
    } else if (action === 'PUBLISH') {
      await prisma.brand.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PUBLISHED', isActive: true }
      });
    } else if (action === 'HIDE') {
      await prisma.brand.updateMany({
        where: { id: { in: ids } },
        data: { status: 'HIDDEN', isActive: false }
      });
    } else if (action === 'RESTORE') {
      for (const id of ids) {
        const item = await prisma.brand.findUnique({ where: { id } });
        if (item) {
          const baseSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          let uniqueSlug = baseSlug;
          let count = 1;
          while (true) {
            const dup = await prisma.brand.findFirst({
              where: { slug: uniqueSlug, id: { not: id }, deviceTypeId: item.deviceTypeId || null }
            });
            if (!dup) break;
            uniqueSlug = `${baseSlug}-${count++}`;
          }
          await prisma.brand.update({
            where: { id },
            data: { deletedAt: null, slug: uniqueSlug }
          });
        }
      }
    } else if (action === 'MOVE') {
      if (!targetId) {
        return reply.status(400).send({ success: false, message: 'Target Device Type ID is required for MOVE action' });
      }
      await prisma.brand.updateMany({
        where: { id: { in: ids } },
        data: { deviceTypeId: targetId }
      });
    }

    return reply.status(200).send({ success: true, message: `Bulk ${action} executed successfully` });
  }

  // POST /api/v1/admin/brands/import-csv
  async importCSV(request: FastifyRequest, reply: FastifyReply) {
    const { csvText } = request.body as { csvText: string };
    if (!csvText) {
      return reply.status(400).send({ success: false, message: 'CSV text is required' });
    }

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const validationErrors: string[] = [];
    let successCount = 0;

    // Header row skip check (e.g. if starts with Name or Brand Name)
    let startIndex = 0;
    if (lines[0].toLowerCase().includes('name')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 1) continue;

      const name = parts[0];
      const logo = parts[1] || '';
      const customSlug = parts[2] || '';
      const description = parts[3] || '';
      const statusText = (parts[4] || 'PUBLISHED').toUpperCase();
      const deviceTypeName = parts[5] || '';

      if (!name) {
        validationErrors.push(`Row ${i + 1}: Brand Name is required`);
        continue;
      }

      let deviceTypeId: string | null = null;
      if (deviceTypeName) {
        const dt = await prisma.deviceType.findFirst({
          where: { name: { equals: deviceTypeName } }
        });
        if (!dt) {
          validationErrors.push(`Row ${i + 1}: Device Type '${deviceTypeName}' not found in database`);
          continue;
        }
        deviceTypeId = dt.id;
      }

      const slug = customSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check duplicates
      const dup = await prisma.brand.findFirst({
        where: {
          deviceTypeId,
          OR: [
            { name: { equals: name } },
            { slug: { equals: slug } }
          ]
        }
      });

      if (dup) {
        validationErrors.push(`Row ${i + 1}: Brand '${name}' already exists under device type`);
        continue;
      }

      await prisma.brand.create({
        data: {
          name,
          logo,
          slug,
          description,
          deviceTypeId,
          status: ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(statusText)
            ? (statusText as any)
            : 'PUBLISHED',
          isActive: statusText === 'PUBLISHED'
        }
      });
      successCount++;
    }

    return reply.status(200).send({
      success: true,
      imported: successCount,
      errors: validationErrors
    });
  }

  // --- Series Methods (Maintained for backwards compatibility) ---
  async getSeries(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { productId } = request.query as { productId?: string };
    const isAdmin = request.user?.role === 'ADMIN';

    const where: any = { brandId: id };
    if (!isAdmin) {
      where.brand = { isActive: true, deletedAt: null };
    }

    if (productId) {
      where.models = {
        some: {
          products: {
            some: {
              id: productId
            }
          }
        }
      };
    }

    const seriesList = await prisma.series.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return reply.status(200).send({ success: true, data: seriesList });
  }

  async getModels(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { productId, q } = request.query as { productId?: string; q?: string };
    const isAdmin = request.user?.role === 'ADMIN';

    const where: any = { seriesId: id, deletedAt: null };
    if (!isAdmin) {
      where.status = 'PUBLISHED';
    }
    if (q) {
      where.name = { contains: q };
    }
    if (productId) {
      where.products = { some: { id: productId } };
    }

    const models = await prisma.model.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return reply.status(200).send({ success: true, data: models });
  }

  async getBrandModels(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { productId, seriesId, q } = request.query as { productId?: string; seriesId?: string; q?: string };
    const isAdmin = request.user?.role === 'ADMIN';

    const whereClause: any = { brandId: id, deletedAt: null };
    if (seriesId) {
      whereClause.seriesId = seriesId;
    }
    if (!isAdmin) {
      whereClause.status = 'PUBLISHED';
      whereClause.brand = { isActive: true, deletedAt: null };
    }
    if (q) {
      whereClause.name = { contains: q };
    }
    if (productId) {
      whereClause.products = { some: { id: productId } };
    }

    const models = await prisma.model.findMany({
      where: whereClause,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return reply.status(200).send({ success: true, data: models });
  }

  async createSeries(request: FastifyRequest, reply: FastifyReply) {
    const { name, brandId, sortOrder } = request.body as { name: string; brandId: string; sortOrder?: number };
    const series = await prisma.series.create({
      data: { name, brandId, sortOrder: sortOrder ?? 0 }
    });
    return reply.status(201).send({ success: true, data: series });
  }

  async updateSeries(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { name, brandId, sortOrder } = request.body as { name?: string; brandId?: string; sortOrder?: number };
    const series = await prisma.series.update({
      where: { id },
      data: { name, brandId, sortOrder }
    });
    return reply.status(200).send({ success: true, data: series });
  }

  async deleteSeries(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await prisma.series.delete({ where: { id } });
    return reply.status(200).send({ success: true, message: 'Series deleted successfully' });
  }

  async mapProductModels(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { modelIds } = request.body as { modelIds: string[] };

    const product = await prisma.product.update({
      where: { id },
      data: {
        models: {
          set: modelIds.map(mid => ({ id: mid }))
        }
      },
      include: {
        models: true
      }
    });

    return reply.status(200).send({ success: true, data: product });
  }
}

export const brandController = new BrandController();
