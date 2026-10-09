import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../database/client.js';
import { ZodSchema } from 'zod';
import { ValidationError, NotFoundError, ConflictError } from '../../../core/exceptions/exceptions.js';
import { createDeviceTypeSchema, updateDeviceTypeSchema } from '../validators/catalogValidator.js';

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

export class DeviceTypeController {
  // GET /api/v1/device-types
  async getDeviceTypes(request: FastifyRequest, reply: FastifyReply) {
    const { includeDeleted } = (request.query || {}) as { includeDeleted?: string };
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

    const deviceTypes = await prisma.deviceType.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    return reply.status(200).send({
      success: true,
      data: deviceTypes
    });
  }

  // GET /api/v1/device-types/:id/brands
  async getBrandsByDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const isAdmin = request.user?.role === 'ADMIN';

    const where: any = { deviceTypeId: id, deletedAt: null };
    if (!isAdmin) {
      where.status = 'PUBLISHED';
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return reply.status(200).send({
      success: true,
      data: brands
    });
  }

  // POST /api/v1/admin/device-types
  async createDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createDeviceTypeSchema, request.body);
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Duplicate checks
    const existing = await prisma.deviceType.findFirst({
      where: {
        OR: [
          { name: { equals: body.name } },
          { slug: { equals: slug } }
        ]
      }
    });

    if (existing) {
      throw new ConflictError('A device type with this name or slug already exists');
    }

    const deviceType = await prisma.deviceType.create({
      data: {
        name: body.name,
        slug,
        description: body.description || '',
        icon: body.icon || 'smartphone',
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : 0,
        isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : true,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        status: body.status || 'PUBLISHED'
      }
    });

    return reply.status(201).send({ success: true, data: deviceType });
  }

  // PUT /api/v1/admin/device-types/:id
  async updateDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateDeviceTypeSchema, request.body);

    const existingType = await prisma.deviceType.findUnique({ where: { id } });
    if (!existingType) {
      throw new NotFoundError('Device type not found');
    }

    let slug = existingType.slug;
    if (body.name || body.slug) {
      const targetName = body.name || existingType.name;
      const targetSlug = body.slug || targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      const duplicate = await prisma.deviceType.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: targetName } },
            { slug: { equals: targetSlug } }
          ]
        }
      });

      if (duplicate) {
        throw new ConflictError('A device type with this name or slug already exists');
      }
      slug = targetSlug;
    }

    const deviceType = await prisma.deviceType.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        description: body.description,
        icon: body.icon,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder as any) : undefined,
        isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        status: body.status
      }
    });

    return reply.status(200).send({ success: true, data: deviceType });
  }

  // DELETE /api/v1/admin/device-types/:id
  async deleteDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { force } = (request.query || {}) as { force?: string };
    const existing = await prisma.deviceType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Device type not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            brand: {
              deviceTypeId: id
            }
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
    await prisma.deviceType.update({
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
      message: 'Device Type deleted successfully.',
      productCount
    });
  }

  // POST /api/v1/admin/device-types/:id/restore
  async restoreDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.deviceType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Device type not found');
    }

    // Recover slug name (strip deleted timestamps)
    const baseSlug = existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let uniqueSlug = baseSlug;
    let count = 1;
    while (true) {
      const dup = await prisma.deviceType.findFirst({ where: { slug: uniqueSlug, id: { not: id } } });
      if (!dup) break;
      uniqueSlug = `${baseSlug}-${count++}`;
    }

    const restored = await prisma.deviceType.update({
      where: { id },
      data: { deletedAt: null, slug: uniqueSlug }
    });

    return reply.status(200).send({ success: true, data: restored, message: 'Device type restored' });
  }

  // DELETE /api/v1/admin/device-types/:id/permanent
  async permanentDeleteDeviceType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const existing = await prisma.deviceType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Device type not found');
    }

    const productCount = await prisma.product.count({
      where: {
        deletedAt: null,
        models: {
          some: {
            brand: {
              deviceTypeId: id
            }
          }
        }
      }
    });

    if (productCount > 0) {
      return reply.status(400).send({
        success: false,
        code: 'IN_USE',
        productCount,
        message: `Cannot delete because this Device Type is used by ${productCount} products.`
      });
    }

    const brandCount = await prisma.brand.count({ where: { deviceTypeId: id, deletedAt: null } });
    if (brandCount > 0) {
      return reply.status(400).send({
        success: false,
        code: 'HAS_CHILDREN',
        message: `Cannot permanently delete because this Device Type has ${brandCount} active brands.`
      });
    }

    try {
      await prisma.deviceType.delete({ where: { id } });
      return reply.status(200).send({ success: true, message: 'Device Type permanently deleted successfully.' });
    } catch (err: any) {
      console.error('Permanent delete DeviceType error:', err);
      return reply.status(400).send({
        success: false,
        message: 'Cannot permanently delete because of foreign key constraint errors in database.'
      });
    }
  }

  // POST /api/v1/admin/device-types/bulk
  async bulkAction(request: FastifyRequest, reply: FastifyReply) {
    const { ids, action, force } = request.body as { ids: string[]; action: 'DELETE' | 'PUBLISH' | 'HIDE' | 'RESTORE'; force?: boolean };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'IDs list is required' });
    }

    if (action === 'DELETE') {
      const productCount = await prisma.product.count({
        where: {
          deletedAt: null,
          models: {
            some: {
              brand: {
                deviceTypeId: { in: ids }
              }
            }
          }
        }
      });

      if (productCount > 0 && !force) {
        return reply.status(409).send({
          success: false,
          code: 'IN_USE',
          productCount,
          message: `Cannot delete because selected Device Types are used by ${productCount} products.`,
          requiresConfirmation: true
        });
      }

      await prisma.$transaction(
        ids.map(id =>
          prisma.deviceType.update({
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
      return reply.status(200).send({ success: true, message: 'Device Types deleted successfully.', productCount });
    } else if (action === 'PUBLISH') {
      await prisma.deviceType.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PUBLISHED', isActive: true }
      });
    } else if (action === 'HIDE') {
      await prisma.deviceType.updateMany({
        where: { id: { in: ids } },
        data: { status: 'HIDDEN', isActive: false }
      });
    } else if (action === 'RESTORE') {
      for (const id of ids) {
        const item = await prisma.deviceType.findUnique({ where: { id } });
        if (item) {
          const baseSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          let uniqueSlug = baseSlug;
          let count = 1;
          while (true) {
            const dup = await prisma.deviceType.findFirst({ where: { slug: uniqueSlug, id: { not: id } } });
            if (!dup) break;
            uniqueSlug = `${baseSlug}-${count++}`;
          }
          await prisma.deviceType.update({
            where: { id },
            data: { deletedAt: null, slug: uniqueSlug }
          });
        }
      }
    }

    return reply.status(200).send({ success: true, message: `Bulk ${action} executed successfully` });
  }
}

export const deviceTypeController = new DeviceTypeController();
