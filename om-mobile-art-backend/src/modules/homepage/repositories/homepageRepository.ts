import { prisma } from '../../../database/client.js';
import {
  Prisma,
  HomepageSection,
  Banner,
  AnnouncementBar,
  HomepagePromoCard,
  HomepageCategoryCard,
  HomepageBrandCard,
  Testimonial,
  WhyChooseUsCard,
  NewsletterConfig,
  HeroVideo,
  HeroSliderSettings,
} from '@prisma/client';

export class HomepageRepository {
  async findAllSections(): Promise<HomepageSection[]> {
    return prisma.homepageSection.findMany({
      orderBy: { position: 'asc' },
    });
  }

  async findSectionById(id: string): Promise<HomepageSection | null> {
    return prisma.homepageSection.findUnique({
      where: { id },
    });
  }

  async findSectionByKey(sectionKey: string): Promise<HomepageSection | null> {
    return prisma.homepageSection.findUnique({
      where: { sectionKey },
    });
  }

  async updateSection(id: string, data: Prisma.HomepageSectionUpdateInput): Promise<HomepageSection> {
    return prisma.homepageSection.update({
      where: { id },
      data,
    });
  }

  async updateSectionPosition(id: string, position: number): Promise<HomepageSection> {
    return prisma.homepageSection.update({
      where: { id },
      data: { position },
    });
  }

  // ── Hero Banners ──
  async findAllBanners(): Promise<Banner[]> {
    return prisma.banner.findMany({
      orderBy: { position: 'asc' },
    });
  }

  async findBannerById(id: string): Promise<Banner | null> {
    return prisma.banner.findUnique({
      where: { id },
    });
  }

  async createBanner(data: Prisma.BannerCreateInput): Promise<Banner> {
    return prisma.banner.create({ data });
  }

  async updateBanner(id: string, data: Prisma.BannerUpdateInput): Promise<Banner> {
    return prisma.banner.update({
      where: { id },
      data,
    });
  }

  async deleteBanner(id: string): Promise<Banner> {
    return prisma.banner.delete({
      where: { id },
    });
  }

  // ── Announcement Bars ──
  async findAllAnnouncementBars(): Promise<AnnouncementBar[]> {
    return prisma.announcementBar.findMany({
      orderBy: { priority: 'desc' },
    });
  }

  async findAnnouncementBarById(id: string): Promise<AnnouncementBar | null> {
    return prisma.announcementBar.findUnique({ where: { id } });
  }

  async createAnnouncementBar(data: Prisma.AnnouncementBarCreateInput): Promise<AnnouncementBar> {
    return prisma.announcementBar.create({ data });
  }

  async updateAnnouncementBar(id: string, data: Prisma.AnnouncementBarUpdateInput): Promise<AnnouncementBar> {
    return prisma.announcementBar.update({ where: { id }, data });
  }

  async deleteAnnouncementBar(id: string): Promise<AnnouncementBar> {
    return prisma.announcementBar.delete({ where: { id } });
  }

  // ── Promotional Cards ──
  async findAllPromoCards(): Promise<HomepagePromoCard[]> {
    return prisma.homepagePromoCard.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findPromoCardById(id: string): Promise<HomepagePromoCard | null> {
    return prisma.homepagePromoCard.findUnique({ where: { id } });
  }

  async createPromoCard(data: Prisma.HomepagePromoCardCreateInput): Promise<HomepagePromoCard> {
    return prisma.homepagePromoCard.create({ data });
  }

  async updatePromoCard(id: string, data: Prisma.HomepagePromoCardUpdateInput): Promise<HomepagePromoCard> {
    return prisma.homepagePromoCard.update({ where: { id }, data });
  }

  async deletePromoCard(id: string): Promise<HomepagePromoCard> {
    return prisma.homepagePromoCard.delete({ where: { id } });
  }

  // ── Category Cards ──
  async findAllCategoryCards(): Promise<HomepageCategoryCard[]> {
    return prisma.homepageCategoryCard.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findCategoryCardById(id: string): Promise<HomepageCategoryCard | null> {
    return prisma.homepageCategoryCard.findUnique({ where: { id } });
  }

  async createCategoryCard(data: Prisma.HomepageCategoryCardCreateInput): Promise<HomepageCategoryCard> {
    return prisma.homepageCategoryCard.create({ data });
  }

  async updateCategoryCard(id: string, data: Prisma.HomepageCategoryCardUpdateInput): Promise<HomepageCategoryCard> {
    return prisma.homepageCategoryCard.update({ where: { id }, data });
  }

  async deleteCategoryCard(id: string): Promise<HomepageCategoryCard> {
    return prisma.homepageCategoryCard.delete({ where: { id } });
  }

  // ── Brand Cards ──
  async findAllBrandCards(): Promise<HomepageBrandCard[]> {
    return prisma.homepageBrandCard.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findBrandCardById(id: string): Promise<HomepageBrandCard | null> {
    return prisma.homepageBrandCard.findUnique({ where: { id } });
  }

  async createBrandCard(data: Prisma.HomepageBrandCardCreateInput): Promise<HomepageBrandCard> {
    return prisma.homepageBrandCard.create({ data });
  }

  async updateBrandCard(id: string, data: Prisma.HomepageBrandCardUpdateInput): Promise<HomepageBrandCard> {
    return prisma.homepageBrandCard.update({ where: { id }, data });
  }

  async deleteBrandCard(id: string): Promise<HomepageBrandCard> {
    return prisma.homepageBrandCard.delete({ where: { id } });
  }

  // ── Testimonials ──
  async findAllTestimonials(): Promise<Testimonial[]> {
    return prisma.testimonial.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findTestimonialById(id: string): Promise<Testimonial | null> {
    return prisma.testimonial.findUnique({ where: { id } });
  }

  async createTestimonial(data: Prisma.TestimonialCreateInput): Promise<Testimonial> {
    return prisma.testimonial.create({ data });
  }

  async updateTestimonial(id: string, data: Prisma.TestimonialUpdateInput): Promise<Testimonial> {
    return prisma.testimonial.update({ where: { id }, data });
  }

  async deleteTestimonial(id: string): Promise<Testimonial> {
    return prisma.testimonial.delete({ where: { id } });
  }

  // ── Why Choose Us ──
  async findAllWhyChooseUsCards(): Promise<WhyChooseUsCard[]> {
    return prisma.whyChooseUsCard.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findWhyChooseUsCardById(id: string): Promise<WhyChooseUsCard | null> {
    return prisma.whyChooseUsCard.findUnique({ where: { id } });
  }

  async createWhyChooseUsCard(data: Prisma.WhyChooseUsCardCreateInput): Promise<WhyChooseUsCard> {
    return prisma.whyChooseUsCard.create({ data });
  }

  async updateWhyChooseUsCard(id: string, data: Prisma.WhyChooseUsCardUpdateInput): Promise<WhyChooseUsCard> {
    return prisma.whyChooseUsCard.update({ where: { id }, data });
  }

  async deleteWhyChooseUsCard(id: string): Promise<WhyChooseUsCard> {
    return prisma.whyChooseUsCard.delete({ where: { id } });
  }

  // ── Newsletter Config ──
  async findNewsletterConfig(): Promise<NewsletterConfig | null> {
    return prisma.newsletterConfig.findFirst();
  }

  async upsertNewsletterConfig(data: { heading?: string; description?: string; bgImageUrl?: string | null; isActive?: boolean }): Promise<NewsletterConfig> {
    const existing = await prisma.newsletterConfig.findFirst();
    if (existing) {
      return prisma.newsletterConfig.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.newsletterConfig.create({
      data: {
        heading: data.heading || 'Stay in the Loop',
        description: data.description || 'Subscribe for updates',
        bgImageUrl: data.bgImageUrl,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  // ── Hero Videos ──
  async findAllHeroVideos(): Promise<HeroVideo[]> {
    return prisma.heroVideo.findMany({
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findActiveHeroVideos(): Promise<HeroVideo[]> {
    return prisma.heroVideo.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findHeroVideoById(id: string): Promise<HeroVideo | null> {
    return prisma.heroVideo.findUnique({ where: { id } });
  }

  async createHeroVideo(data: Prisma.HeroVideoCreateInput): Promise<HeroVideo> {
    return prisma.heroVideo.create({ data });
  }

  async updateHeroVideo(id: string, data: Prisma.HeroVideoUpdateInput): Promise<HeroVideo> {
    return prisma.heroVideo.update({ where: { id }, data });
  }

  async deleteHeroVideo(id: string): Promise<HeroVideo> {
    return prisma.heroVideo.delete({ where: { id } });
  }

  async updateHeroVideoOrder(items: { id: string; orderIndex: number }[]): Promise<void> {
    await prisma.$transaction(
      items.map(item =>
        prisma.heroVideo.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        })
      )
    );
  }

  // ── Hero Slider Settings ──
  async findHeroSliderSettings(): Promise<HeroSliderSettings> {
    const existing = await prisma.heroSliderSettings.findFirst();
    if (existing) return existing;
    return prisma.heroSliderSettings.create({
      data: {
        isEnabled: true,
        autoplay: true,
        autoplayDelay: 5,
        showControls: true,
        showDots: true,
        showNavigationArrows: true,
        loop: true,
        showProgressBar: true,
        muteByDefault: true,
      },
    });
  }

  async upsertHeroSliderSettings(data: Prisma.HeroSliderSettingsUpdateInput): Promise<HeroSliderSettings> {
    const existing = await prisma.heroSliderSettings.findFirst();
    if (existing) {
      return prisma.heroSliderSettings.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.heroSliderSettings.create({
      data: {
        isEnabled: data.isEnabled !== undefined ? Boolean(data.isEnabled) : true,
        autoplay: data.autoplay !== undefined ? Boolean(data.autoplay) : true,
        autoplayDelay: typeof data.autoplayDelay === 'number' ? data.autoplayDelay : 5,
        showControls: data.showControls !== undefined ? Boolean(data.showControls) : true,
        showDots: data.showDots !== undefined ? Boolean(data.showDots) : true,
        showNavigationArrows: data.showNavigationArrows !== undefined ? Boolean(data.showNavigationArrows) : true,
        loop: data.loop !== undefined ? Boolean(data.loop) : true,
        showProgressBar: data.showProgressBar !== undefined ? Boolean(data.showProgressBar) : true,
        muteByDefault: data.muteByDefault !== undefined ? Boolean(data.muteByDefault) : true,
      },
    });
  }
}

export const homepageRepository = new HomepageRepository();
