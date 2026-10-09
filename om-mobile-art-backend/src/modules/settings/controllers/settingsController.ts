import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { settingsService } from '../services/settingsService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import {
  updateStoreSettingsSchema,
  updateBrandConfigSchema,
  createSocialLinkSchema,
  updateSocialLinkSchema,
  updateContactInfoSchema,
  updateSeoConfigSchema,
  updateFooterConfigSchema,
  createLegalPageSchema,
  updateLegalPageSchema,
  updateEmailSmtpSchema,
  updateMaintenanceConfigSchema,
  updateFeatureTogglesSchema,
  updateSecurityPolicySchema,
  updateBackupConfigSchema,
} from '../validators/settingsValidator.js';

function validateBody(schema: ZodSchema<any>, data: unknown): any {
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

export class SettingsController {
  async getPublicSettings(request: FastifyRequest, reply: FastifyReply) {
    const bundle = await settingsService.getPublicSettings();
    return reply.status(200).send({ success: true, data: bundle });
  }

  async updateAnnouncementBar(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const updated = await settingsService.updateAnnouncementBar(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async getAdminSettings(request: FastifyRequest, reply: FastifyReply) {
    const bundle = await settingsService.getAdminSettings();
    return reply.status(200).send({ success: true, data: bundle });
  }

  async updateStoreSettings(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateStoreSettingsSchema, request.body);
    const updated = await settingsService.updateStoreSettings(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateBrandConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateBrandConfigSchema, request.body);
    const updated = await settingsService.updateBrandConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateContactInfo(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateContactInfoSchema, request.body);
    const updated = await settingsService.updateContactInfo(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateSeoConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateSeoConfigSchema, request.body);
    const updated = await settingsService.updateSeoConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateFooterConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateFooterConfigSchema, request.body);
    const updated = await settingsService.updateFooterConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateEmailSmtpConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateEmailSmtpSchema, request.body);
    const updated = await settingsService.updateEmailSmtpConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateMaintenanceConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateMaintenanceConfigSchema, request.body);
    const updated = await settingsService.updateMaintenanceConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateFeatureToggles(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateFeatureTogglesSchema, request.body);
    const updated = await settingsService.updateFeatureToggles(body.toggles);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateSecurityPolicy(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateSecurityPolicySchema, request.body);
    const updated = await settingsService.updateSecurityPolicy(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async updateBackupConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateBackupConfigSchema, request.body);
    const updated = await settingsService.updateBackupConfig(body);
    return reply.status(200).send({ success: true, data: updated });
  }

  // ── Social Links ──
  async createSocialLink(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createSocialLinkSchema, request.body);
    const created = await settingsService.createSocialLink(body);
    return reply.status(201).send({ success: true, data: created });
  }

  async updateSocialLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateSocialLinkSchema, request.body);
    const updated = await settingsService.updateSocialLink(id, body);
    return reply.status(200).send({ success: true, data: updated });
  }

  async deleteSocialLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await settingsService.deleteSocialLink(id);
    return reply.status(200).send({ success: true, message: 'Social link deleted successfully' });
  }

  // ── Legal Pages ──
  async getLegalPages(request: FastifyRequest, reply: FastifyReply) {
    const pages = await settingsService.getLegalPages();
    return reply.status(200).send({ success: true, data: pages });
  }

  async getLegalPageBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const page = await settingsService.getLegalPageBySlug(slug);
    return reply.status(200).send({ success: true, data: page });
  }

  async upsertLegalPage(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createLegalPageSchema, request.body);
    const page = await settingsService.upsertLegalPage(body);
    return reply.status(200).send({ success: true, data: page });
  }

  async deleteLegalPage(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await settingsService.deleteLegalPage(id);
    return reply.status(200).send({ success: true, message: 'Legal page deleted successfully' });
  }
}

export const settingsController = new SettingsController();
