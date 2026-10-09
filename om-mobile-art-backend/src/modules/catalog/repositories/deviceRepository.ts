import { prisma } from '../../../database/client.js';
import { Prisma, Device } from '@prisma/client';

export class DeviceRepository {
  async findAll(): Promise<Device[]> {
    return prisma.device.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Device | null> {
    return prisma.device.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Device | null> {
    return prisma.device.findUnique({
      where: { slug },
    });
  }

  async create(data: Prisma.DeviceCreateInput): Promise<Device> {
    return prisma.device.create({
      data,
    });
  }

  async update(id: string, data: Prisma.DeviceUpdateInput): Promise<Device> {
    return prisma.device.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Device> {
    return prisma.device.delete({
      where: { id },
    });
  }
}

export const deviceRepository = new DeviceRepository();
