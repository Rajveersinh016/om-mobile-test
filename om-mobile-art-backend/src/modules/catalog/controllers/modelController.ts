import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../database/client.js';
import { ZodSchema } from 'zod';
import { ValidationError, NotFoundError, ConflictError } from '../../../core/exceptions/exceptions.js';
import { createModelSchema, updateModelSchema } from '../validators/catalogValidator.js';

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

export class ModelController {
  // GET /api/v1/models
  async getModels(request: FastifyRequest, reply: FastifyReply) {
    const { brandId, seriesId, deviceTypeId, q, limit, page, includeDeleted, status } = request.query as {
      brandId?: string;
      seriesId?: string;
      deviceTypeId?: string;
      q?: string;
      limit?: string;
      page?: string;
      includeDeleted?: string;
      status?: string;
    };
    const isAdmin = request.user?.role === 'ADMIN';

    const where: any = {};
    if (!isAdmin) {
      where.deletedAt = null;
      where.status = 'PUBLISHED';
      where.brand = { isActive: true, deletedAt: null };
    } else {
      if (includeDeleted !== 'true') {
        where.deletedAt = null;
      }
      if (status && status !== 'all') {
        where.status = status;
      }
    }

    const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

    if (brandId && brandId !== 'all') {
      if (isUuid(brandId)) {
        where.brandId = brandId;
      } else {
        const br = await prisma.brand.findFirst({
          where: {
            OR: [
              { slug: brandId },
              { name: { contains: brandId } }
            ],
            deletedAt: null
          }
        });
        if (br) {
          where.brandId = br.id;
        } else {
          where.brandId = '00000000-0000-0000-0000-000000000000';
        }
      }
    }
    if (seriesId) {
      if (isUuid(seriesId)) {
        where.seriesId = seriesId;
      } else {
        const sr = await prisma.series.findFirst({
          where: {
            OR: [
              { name: { contains: seriesId } }
            ]
          }
        });
        if (sr) {
          where.seriesId = sr.id;
        } else {
          where.seriesId = '00000000-0000-0000-0000-000000000000';
        }
      }
    }
    if (deviceTypeId && deviceTypeId !== 'all') {
      if (isUuid(deviceTypeId)) {
        where.brand = { deviceTypeId };
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
          where.brand = { deviceTypeId: dt.id };
        } else {
          where.brand = { deviceTypeId: '00000000-0000-0000-0000-000000000000' };
        }
      }
    }
    if (q) {
      where.name = { contains: q };
    }

    const take = limit ? parseInt(limit) : undefined;
    const skip = page && take ? (parseInt(page) - 1) * take : undefined;

    const [models, total] = await Promise.all([
      prisma.model.findMany({
        where,
        include: {
          brand: {
            include: {
              deviceType: true
            }
          },
          series: true
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take,
        skip
      }),
      prisma.model.count({ where })
    ]);

    return reply.status(200).send({
      success: true,
      data: models,
      total,
      page: page ? parseInt(page) : 1,
      limit: take || total
    });
  }

  // POST /api/v1/admin/models
  async createModel(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createModelSchema, request.body);
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Duplicate check under same Brand
    const existing = await prisma.model.findFirst({
      where: {
        brandId: body.brandId,
        OR: [
          { name: { equals: body.name } },
          { slug: { equals: slug } }
        ]
      }
    });

    if (existing) {
      throw new ConflictError('A model with this name or slug already exists under this brand');
    }

    const model = await prisma.model.create({
      data: {
        name: body.name,
        slug,
        releaseYear: body.releaseYear,
        brandId: body.brandId,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : 0,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        status: body.status || 'PUBLISHED'
      },
      include: {
        brand: true,
        series: true
      }
    });

    return reply.status(201).send({ success: true, data: model });
  }

  // PUT /api/v1/admin/models/:id
  async updateModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateModelSchema, request.body);

    const existingModel = await prisma.model.findUnique({ where: { id } });
    if (!existingModel) {
      throw new NotFoundError('Model not found');
    }

    let slug = existingModel.slug;
    if (body.name || body.slug || body.brandId !== undefined) {
      const targetName = body.name || existingModel.name;
      const targetSlug = body.slug || targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const targetBrandId = body.brandId !== undefined ? body.brandId : existingModel.brandId;

      const duplicate = await prisma.model.findFirst({
        where: {
          id: { not: id },
          brandId: targetBrandId,
          OR: [
            { name: { equals: targetName } },
            { slug: { equals: targetSlug } }
          ]
        }
      });

      if (duplicate) {
        throw new ConflictError('A model with this name or slug already exists under this brand');
      }
      slug = targetSlug;
    }

    const model = await prisma.model.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        releaseYear: body.releaseYear,
        brandId: body.brandId,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        status: body.status
      },
      include: {
        brand: true,
        series: true
      }
    });

    return reply.status(200).send({ success: true, data: model });
  }

  // DELETE /api/v1/admin/models/:id
  async deleteModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { force } = (request.query || {}) as { force?: string };
    const existing = await prisma.model.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Model not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            id
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
    await prisma.model.update({
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
      message: 'Model deleted successfully.',
      productCount
    });
  }

  // POST /api/v1/admin/models/:id/restore
  async restoreModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.model.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Model not found');
    }

    const baseSlug = existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let uniqueSlug = baseSlug;
    let count = 1;
    while (true) {
      const dup = await prisma.model.findFirst({
        where: { slug: uniqueSlug, id: { not: id }, brandId: existing.brandId }
      });
      if (!dup) break;
      uniqueSlug = `${baseSlug}-${count++}`;
    }

    const restored = await prisma.model.update({
      where: { id },
      data: { deletedAt: null, slug: uniqueSlug }
    });

    return reply.status(200).send({ success: true, data: restored, message: 'Model restored' });
  }

  // DELETE /api/v1/admin/models/:id/permanent
  async permanentDeleteModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.model.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Model not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            id
          }
        }
      }
    });

    if (productCount > 0) {
      return reply.status(400).send({
        success: false,
        code: 'IN_USE',
        productCount,
        message: `Cannot delete because this Model is used by ${productCount} products.`
      });
    }

    try {
      await prisma.model.delete({ where: { id } });
      return reply.status(200).send({ success: true, message: 'Model permanently deleted successfully.' });
    } catch (err: any) {
      console.error('Permanent delete Model error:', err);
      return reply.status(400).send({
        success: false,
        message: 'Cannot permanently delete because of foreign key constraint errors in database.'
      });
    }
  }

  // POST /api/v1/admin/models/bulk
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
              id: { in: ids }
            }
          }
        }
      });

      if (productCount > 0 && !force) {
        return reply.status(409).send({
          success: false,
          code: 'IN_USE',
          productCount,
          message: `Cannot delete because selected Models are used by ${productCount} products.`,
          requiresConfirmation: true
        });
      }

      await prisma.$transaction(
        ids.map(id =>
          prisma.model.update({
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
      return reply.status(200).send({ success: true, message: 'Models deleted successfully.', productCount });
    } else if (action === 'PUBLISH') {
      await prisma.model.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PUBLISHED', isActive: true }
      });
    } else if (action === 'HIDE') {
      await prisma.model.updateMany({
        where: { id: { in: ids } },
        data: { status: 'HIDDEN', isActive: false }
      });
    } else if (action === 'RESTORE') {
      for (const id of ids) {
        const item = await prisma.model.findUnique({ where: { id } });
        if (item) {
          const baseSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          let uniqueSlug = baseSlug;
          let count = 1;
          while (true) {
            const dup = await prisma.model.findFirst({
              where: { slug: uniqueSlug, id: { not: id }, brandId: item.brandId }
            });
            if (!dup) break;
            uniqueSlug = `${baseSlug}-${count++}`;
          }
          await prisma.model.update({
            where: { id },
            data: { deletedAt: null, slug: uniqueSlug }
          });
        }
      }
    } else if (action === 'MOVE') {
      if (!targetId) {
        return reply.status(400).send({ success: false, message: 'Target Brand ID is required for MOVE action' });
      }
      await prisma.model.updateMany({
        where: { id: { in: ids } },
        data: { brandId: targetId }
      });
    }

    return reply.status(200).send({ success: true, message: `Bulk ${action} executed successfully` });
  }

  // POST /api/v1/admin/models/import-csv
  async importCSV(request: FastifyRequest, reply: FastifyReply) {
    const { csvText } = request.body as { csvText: string };
    if (!csvText) {
      return reply.status(400).send({ success: false, message: 'CSV text is required' });
    }

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const validationErrors: string[] = [];
    let successCount = 0;

    let startIndex = 0;
    if (lines[0].toLowerCase().includes('name')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 1) continue;

      const name = parts[0];
      const customSlug = parts[1] || '';
      const releaseYearStr = parts[2] || '';
      const sortOrderStr = parts[3] || '';
      const statusText = (parts[4] || 'PUBLISHED').toUpperCase();
      const brandName = parts[5] || '';

      if (!name) {
        validationErrors.push(`Row ${i + 1}: Model Name is required`);
        continue;
      }

      if (!brandName) {
        validationErrors.push(`Row ${i + 1}: Brand Name is required`);
        continue;
      }

      const brand = await prisma.brand.findFirst({
        where: { name: { equals: brandName }, deletedAt: null }
      });

      if (!brand) {
        validationErrors.push(`Row ${i + 1}: Brand '${brandName}' not found in database`);
        continue;
      }

      const slug = customSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const releaseYear = releaseYearStr ? parseInt(releaseYearStr) : null;
      const sortOrder = sortOrderStr ? parseInt(sortOrderStr) : 0;

      // Duplicate check under this brand
      const dup = await prisma.model.findFirst({
        where: {
          brandId: brand.id,
          OR: [
            { name: { equals: name } },
            { slug: { equals: slug } }
          ]
        }
      });

      if (dup) {
        validationErrors.push(`Row ${i + 1}: Model '${name}' already exists under brand '${brandName}'`);
        continue;
      }

      await prisma.model.create({
        data: {
          name,
          slug,
          releaseYear,
          brandId: brand.id,
          sortOrder,
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
}

export const modelController = new ModelController();
