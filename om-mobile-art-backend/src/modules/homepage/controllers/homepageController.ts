import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { homepageService } from '../services/homepageService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import {
  updateSectionSchema,
  reorderSectionsSchema,
  createBannerSchema,
  updateBannerSchema,
  createAnnouncementBarSchema,
  updateAnnouncementBarSchema,
  createPromoCardSchema,
  updatePromoCardSchema,
  createCategoryCardSchema,
  updateCategoryCardSchema,
  createBrandCardSchema,
  updateBrandCardSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  createWhyChooseUsSchema,
  updateWhyChooseUsSchema,
  updateNewsletterConfigSchema,
} from '../validators/homepageValidator.js';

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

export class HomepageController {
  async getLayout(request: FastifyRequest, reply: FastifyReply) {
    const layout = await homepageService.getLayout();
    return reply.status(200).send({
      success: true,
      data: layout,
    });
  }

  async getAllSections(request: FastifyRequest, reply: FastifyReply) {
    const sections = await homepageService.getAllSections();
    return reply.status(200).send({
      success: true,
      data: sections,
    });
  }

  async updateSection(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateSectionSchema, request.body);
    const section = await homepageService.updateSection(id, body);
    return reply.status(200).send({
      success: true,
      data: section,
    });
  }

  async reorderSections(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(reorderSectionsSchema, request.body);
    await homepageService.reorderSections(body.orderedIds);
    return reply.status(200).send({
      success: true,
      message: 'Sections reordered successfully',
    });
  }

  // ── Banners ──
  async getBanners(request: FastifyRequest, reply: FastifyReply) {
    const banners = await homepageService.getBanners();
    return reply.status(200).send({ success: true, data: banners });
  }

  async createBanner(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createBannerSchema, request.body);
    const banner = await homepageService.createBanner(body);
    return reply.status(201).send({ success: true, data: banner });
  }

  async updateBanner(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateBannerSchema, request.body);
    const banner = await homepageService.updateBanner(id, body);
    return reply.status(200).send({ success: true, data: banner });
  }

  async deleteBanner(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteBanner(id);
    return reply.status(200).send({ success: true, message: 'Banner deleted successfully' });
  }

  // ── Single Announcement Endpoint ──
  async getSingleAnnouncement(request: FastifyRequest, reply: FastifyReply) {
    const data = await homepageService.getSingleAnnouncement();
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.status(200).send({ success: true, data });
  }

  async updateSingleAnnouncement(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const data = await homepageService.updateSingleAnnouncement(body);
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.status(200).send({ success: true, data, message: 'Announcement Bar updated successfully' });
  }

  // ── Announcement Bars (List) ──
  async getAnnouncementBars(request: FastifyRequest, reply: FastifyReply) {
    const bars = await homepageService.getAnnouncementBars();
    return reply.status(200).send({ success: true, data: bars });
  }

  async createAnnouncementBar(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createAnnouncementBarSchema, request.body);
    const bar = await homepageService.createAnnouncementBar(body);
    return reply.status(201).send({ success: true, data: bar });
  }

  async updateAnnouncementBar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateAnnouncementBarSchema, request.body);
    const bar = await homepageService.updateAnnouncementBar(id, body);
    return reply.status(200).send({ success: true, data: bar });
  }

  async deleteAnnouncementBar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteAnnouncementBar(id);
    return reply.status(200).send({ success: true, message: 'Announcement Bar deleted successfully' });
  }

  // ── Promo Cards ──
  async getPromoCards(request: FastifyRequest, reply: FastifyReply) {
    const cards = await homepageService.getPromoCards();
    return reply.status(200).send({ success: true, data: cards });
  }

  async createPromoCard(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createPromoCardSchema, request.body);
    const card = await homepageService.createPromoCard(body);
    return reply.status(201).send({ success: true, data: card });
  }

  async updatePromoCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updatePromoCardSchema, request.body);
    const card = await homepageService.updatePromoCard(id, body);
    return reply.status(200).send({ success: true, data: card });
  }

  async deletePromoCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deletePromoCard(id);
    return reply.status(200).send({ success: true, message: 'Promo card deleted successfully' });
  }

  // ── Category Cards ──
  async getCategoryCards(request: FastifyRequest, reply: FastifyReply) {
    const cards = await homepageService.getCategoryCards();
    return reply.status(200).send({ success: true, data: cards });
  }

  async createCategoryCard(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createCategoryCardSchema, request.body);
    const card = await homepageService.createCategoryCard(body);
    return reply.status(201).send({ success: true, data: card });
  }

  async updateCategoryCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateCategoryCardSchema, request.body);
    const card = await homepageService.updateCategoryCard(id, body);
    return reply.status(200).send({ success: true, data: card });
  }

  async deleteCategoryCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteCategoryCard(id);
    return reply.status(200).send({ success: true, message: 'Category card deleted successfully' });
  }

  // ── Brand Cards ──
  async getBrandCards(request: FastifyRequest, reply: FastifyReply) {
    const cards = await homepageService.getBrandCards();
    return reply.status(200).send({ success: true, data: cards });
  }

  async createBrandCard(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createBrandCardSchema, request.body);
    const card = await homepageService.createBrandCard(body);
    return reply.status(201).send({ success: true, data: card });
  }

  async updateBrandCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateBrandCardSchema, request.body);
    const card = await homepageService.updateBrandCard(id, body);
    return reply.status(200).send({ success: true, data: card });
  }

  async deleteBrandCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteBrandCard(id);
    return reply.status(200).send({ success: true, message: 'Brand card deleted successfully' });
  }

  // ── Testimonials ──
  async getTestimonials(request: FastifyRequest, reply: FastifyReply) {
    const items = await homepageService.getTestimonials();
    return reply.status(200).send({ success: true, data: items });
  }

  async createTestimonial(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createTestimonialSchema, request.body);
    const item = await homepageService.createTestimonial(body);
    return reply.status(201).send({ success: true, data: item });
  }

  async updateTestimonial(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateTestimonialSchema, request.body);
    const item = await homepageService.updateTestimonial(id, body);
    return reply.status(200).send({ success: true, data: item });
  }

  async deleteTestimonial(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteTestimonial(id);
    return reply.status(200).send({ success: true, message: 'Testimonial deleted successfully' });
  }

  // ── Why Choose Us ──
  async getWhyChooseUsCards(request: FastifyRequest, reply: FastifyReply) {
    const cards = await homepageService.getWhyChooseUsCards();
    return reply.status(200).send({ success: true, data: cards });
  }

  async createWhyChooseUsCard(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(createWhyChooseUsSchema, request.body);
    const card = await homepageService.createWhyChooseUsCard(body);
    return reply.status(201).send({ success: true, data: card });
  }

  async updateWhyChooseUsCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = validateBody(updateWhyChooseUsSchema, request.body);
    const card = await homepageService.updateWhyChooseUsCard(id, body);
    return reply.status(200).send({ success: true, data: card });
  }

  async deleteWhyChooseUsCard(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteWhyChooseUsCard(id);
    return reply.status(200).send({ success: true, message: 'Feature card deleted successfully' });
  }

  // ── Newsletter ──
  async getNewsletterConfig(request: FastifyRequest, reply: FastifyReply) {
    const config = await homepageService.getNewsletterConfig();
    return reply.status(200).send({ success: true, data: config });
  }

  async updateNewsletterConfig(request: FastifyRequest, reply: FastifyReply) {
    const body = validateBody(updateNewsletterConfigSchema, request.body);
    const config = await homepageService.updateNewsletterConfig(body);
    return reply.status(200).send({ success: true, data: config });
  }

  // ── Hero Videos ──
  async getHeroVideos(request: FastifyRequest, reply: FastifyReply) {
    const result = await homepageService.getHeroVideos(false);
    return reply.status(200).send({ success: true, data: result });
  }

  async getAdminHeroVideos(request: FastifyRequest, reply: FastifyReply) {
    const result = await homepageService.getHeroVideos(true);
    return reply.status(200).send({ success: true, data: result });
  }

  async createHeroVideo(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const video = await homepageService.createHeroVideo(body);
    return reply.status(201).send({ success: true, data: video });
  }

  async updateHeroVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const video = await homepageService.updateHeroVideo(id, body);
    return reply.status(200).send({ success: true, data: video });
  }

  async deleteHeroVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await homepageService.deleteHeroVideo(id);
    return reply.status(200).send({ success: true, message: 'Hero video deleted successfully' });
  }

  async reorderHeroVideos(request: FastifyRequest, reply: FastifyReply) {
    const { items } = request.body as { items: { id: string; orderIndex: number }[] };
    await homepageService.reorderHeroVideos(items || []);
    return reply.status(200).send({ success: true, message: 'Hero video order updated successfully' });
  }

  // ── Hero Slider Settings ──
  async getHeroSliderSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await homepageService.getHeroSliderSettings();
    return reply.status(200).send({ success: true, data: settings });
  }

  async updateHeroSliderSettings(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const settings = await homepageService.updateHeroSliderSettings(body);
    return reply.status(200).send({ success: true, data: settings });
  }
}

export const homepageController = new HomepageController();
