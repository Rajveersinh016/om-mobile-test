import { FastifyRequest, FastifyReply } from 'fastify';
import { mockupService } from '../services/mockupService.js';

export class MockupController {
  async getGlobalMockup(_request: FastifyRequest, reply: FastifyReply) {
    const mockup = await mockupService.getGlobalMockup();
    return reply.status(200).send({
      success: true,
      data: mockup,
    });
  }

  async updateGlobalMockup(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as {
      defaultFrontUrl?: string | null;
      defaultFrontPublicId?: string | null;
      defaultBackUrl?: string | null;
      defaultBackPublicId?: string | null;
    };
    const updated = await mockupService.updateGlobalMockup(body || {});
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }
}

export const mockupController = new MockupController();
