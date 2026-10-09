import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CustomSkinService {
  async getSettings() {
    let config = await prisma.customSkinConfig.findUnique({
      where: { key: 'default' }
    });
    if (!config) {
      const defaultSettings = { basePrice: 499, enabled: true };
      config = await prisma.customSkinConfig.create({
        data: { key: 'default', settings: defaultSettings }
      });
    }
    return config ? config.settings : null;
  }

  async updateSettings(settings: any) {
    const config = await prisma.customSkinConfig.upsert({
      where: { key: 'default' },
      update: { settings },
      create: { key: 'default', settings }
    });
    return config.settings;
  }
}

export const customSkinService = new CustomSkinService();
