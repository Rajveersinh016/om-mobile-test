import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../database/client.js';

export class MaterialController {
  // GET /api/v1/materials
  async getMaterials(request: FastifyRequest, reply: FastifyReply) {
    const isAdmin = request.user?.role === 'ADMIN';
    const where: any = {};
    if (!isAdmin) {
      where.isActive = true;
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        finishes: {
          include: {
            finish: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const formatted = materials.map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description,
      priceOffset: m.priceOffset,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
      allowedFinishes: m.finishes.map(f => f.finish)
    }));

    return reply.status(200).send({
      success: true,
      data: formatted
    });
  }

  // GET /api/v1/finishes
  async getFinishes(request: FastifyRequest, reply: FastifyReply) {
    const isAdmin = request.user?.role === 'ADMIN';
    const where: any = {};
    if (!isAdmin) {
      where.isActive = true;
    }

    const finishes = await prisma.finish.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    return reply.status(200).send({
      success: true,
      data: finishes
    });
  }

  // POST /api/v1/admin/materials
  async createMaterial(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const material = await prisma.material.create({
      data: {
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: body.description || '',
        priceOffset: body.priceOffset !== undefined ? parseFloat(body.priceOffset) : 0,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder) : 0,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true
      }
    });

    if (Array.isArray(body.finishIds) && body.finishIds.length > 0) {
      await prisma.materialFinish.createMany({
        data: body.finishIds.map((finishId: string) => ({
          materialId: material.id,
          finishId
        }))
      });
    }

    return reply.status(201).send({ success: true, data: material });
  }

  // PUT /api/v1/admin/materials/:id
  async updateMaterial(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const material = await prisma.material.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.priceOffset !== undefined && { priceOffset: parseFloat(body.priceOffset) }),
        ...(body.sortOrder !== undefined && { sortOrder: parseInt(body.sortOrder) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) })
      }
    });

    if (Array.isArray(body.finishIds)) {
      await prisma.materialFinish.deleteMany({ where: { materialId: id } });
      if (body.finishIds.length > 0) {
        await prisma.materialFinish.createMany({
          data: body.finishIds.map((finishId: string) => ({
            materialId: id,
            finishId
          }))
        });
      }
    }

    return reply.status(200).send({ success: true, data: material });
  }

  // DELETE /api/v1/admin/materials/:id
  async deleteMaterial(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await prisma.material.delete({ where: { id } });
    return reply.status(200).send({ success: true, message: 'Material deleted' });
  }
}

export const materialController = new MaterialController();
