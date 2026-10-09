import { prisma } from '../../../database/client.js';

export class MockupService {
  async getGlobalMockup() {
    let mockup = await prisma.globalProductMockup.findUnique({
      where: { id: 'global-mockup' }
    });
    if (!mockup) {
      mockup = await prisma.globalProductMockup.create({
        data: { id: 'global-mockup' }
      });
    }
    return mockup;
  }

  async updateGlobalMockup(data: {
    defaultFrontUrl?: string | null;
    defaultFrontPublicId?: string | null;
    defaultBackUrl?: string | null;
    defaultBackPublicId?: string | null;
  }) {
    return await prisma.globalProductMockup.upsert({
      where: { id: 'global-mockup' },
      update: {
        ...(data.defaultFrontUrl !== undefined && { defaultFrontUrl: data.defaultFrontUrl }),
        ...(data.defaultFrontPublicId !== undefined && { defaultFrontPublicId: data.defaultFrontPublicId }),
        ...(data.defaultBackUrl !== undefined && { defaultBackUrl: data.defaultBackUrl }),
        ...(data.defaultBackPublicId !== undefined && { defaultBackPublicId: data.defaultBackPublicId }),
      },
      create: {
        id: 'global-mockup',
        defaultFrontUrl: data.defaultFrontUrl ?? null,
        defaultFrontPublicId: data.defaultFrontPublicId ?? null,
        defaultBackUrl: data.defaultBackUrl ?? null,
        defaultBackPublicId: data.defaultBackPublicId ?? null,
      }
    });
  }
}

export const mockupService = new MockupService();
