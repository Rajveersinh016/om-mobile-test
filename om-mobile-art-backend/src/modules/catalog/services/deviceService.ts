import { deviceRepository } from '../repositories/deviceRepository.js';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';
import { Device } from '@prisma/client';
import { slugService } from './slugService.js';

export class DeviceService {
  async getAllDevices(): Promise<Device[]> {
    return deviceRepository.findAll();
  }

  async getDeviceById(id: string): Promise<Device> {
    const device = await deviceRepository.findById(id);
    if (!device) {
      throw new NotFoundError('Device not found');
    }
    return device;
  }

  async createDevice(name: string, brand: string, slug?: string): Promise<Device> {
    const baseSlug = slug || name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await deviceRepository.findBySlug(s);
      return !!existing;
    });

    return deviceRepository.create({ name, brand, slug: uniqueSlug });
  }

  async updateDevice(id: string, name: string, brand: string, slug?: string): Promise<Device> {
    const device = await deviceRepository.findById(id);
    if (!device) {
      throw new NotFoundError('Device not found');
    }

    const baseSlug = slug || name;
    const uniqueSlug = await slugService.generateUniqueSlug(baseSlug, async (s) => {
      const existing = await deviceRepository.findBySlug(s);
      return !!existing && existing.id !== id;
    });

    return deviceRepository.update(id, { name, brand, slug: uniqueSlug });
  }

  async deleteDevice(id: string): Promise<Device> {
    const device = await deviceRepository.findById(id);
    if (!device) {
      throw new NotFoundError('Device not found');
    }

    return deviceRepository.delete(id);
  }
}

export const deviceService = new DeviceService();
