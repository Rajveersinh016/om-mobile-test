import { homepageRepository } from '../repositories/homepageRepository.js';
import { prisma } from '../../../database/client.js';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';
import {
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

export class HomepageService {
  async getLayout(): Promise<any[]> {
    const sections = await homepageRepository.findAllSections();
    const now = new Date();

    // Filter active sections based on isActive and optional scheduling dates
    const activeSections = sections.filter((sec) => {
      if (!sec.isActive) return false;
      if (sec.startDate && now < new Date(sec.startDate)) return false;
      if (sec.endDate && now > new Date(sec.endDate)) return false;
      return true;
    });

    const result: any[] = [];

    for (const sec of activeSections) {
      let sectionData = { ...sec, settings: typeof sec.settings === 'string' ? JSON.parse(sec.settings) : (sec.settings || {}) };

      // 1. Hero Video Slider
      if (sec.sectionKey === 'hero') {
        const heroVideos = await homepageRepository.findActiveHeroVideos();
        const heroSliderSettings = await homepageRepository.findHeroSliderSettings();
        sectionData.settings.heroVideos = heroVideos;
        sectionData.settings.sliderSettings = heroSliderSettings;
      }
      // 2. Announcement Bar
      else if (sec.sectionKey === 'announcement_bar') {
        const announcements = await homepageRepository.findAllAnnouncementBars();
        sectionData.settings.announcements = announcements.filter((a) => {
          if (!a.isActive) return false;
          if (a.startDate && now < new Date(a.startDate)) return false;
          if (a.endDate && now > new Date(a.endDate)) return false;
          return true;
        });
      }
      // 3. Featured Products Sections (trending, best_sellers, new_arrivals)
      else if (['trending', 'best_sellers', 'new_arrivals'].includes(sec.sectionKey)) {
        const limit = sectionData.settings.limit || 4;
        const mode = sectionData.settings.mode || 'auto';
        let products: any[] = [];

        if (mode === 'manual' && Array.isArray(sectionData.settings.productIds) && sectionData.settings.productIds.length > 0) {
          const productIds = sectionData.settings.productIds;
          const fetchedProducts = await prisma.product.findMany({
            where: {
              id: { in: productIds },
              isPublished: true,
              deletedAt: null,
            },
            include: { category: true, images: true },
          });
          products = productIds
            .map((id: string) => fetchedProducts.find((p: any) => p.id === id))
            .filter((p: any) => !!p);
        } else {
          if (sec.sectionKey === 'trending') {
            products = await prisma.product.findMany({
              where: { isPublished: true, deletedAt: null, OR: [{ isBestSeller: true }, { isNew: true }, { isTrending: true }, { isFeatured: true }] },
              take: limit,
              include: { category: true, images: true },
              orderBy: { createdAt: 'desc' },
            });
            if (products.length === 0) {
              products = await prisma.product.findMany({
                where: { isPublished: true, deletedAt: null },
                take: limit,
                include: { category: true, images: true },
                orderBy: { createdAt: 'desc' },
              });
            }
          } else if (sec.sectionKey === 'best_sellers') {
            products = await prisma.product.findMany({
              where: { isPublished: true, deletedAt: null, isBestSeller: true },
              take: limit,
              include: { category: true, images: true },
              orderBy: { createdAt: 'desc' },
            });
            if (products.length === 0) {
              products = await prisma.product.findMany({
                where: { isPublished: true, deletedAt: null },
                take: limit,
                include: { category: true, images: true },
                orderBy: { createdAt: 'desc' },
              });
            }
          } else if (sec.sectionKey === 'new_arrivals') {
            products = await prisma.product.findMany({
              where: { isPublished: true, deletedAt: null },
              take: limit,
              include: { category: true, images: true },
              orderBy: { createdAt: 'desc' },
            });
          }
        }

        sectionData.settings.products = products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          originalPrice: p.originalPrice || p.price,
          image: p.image,
          images: p.images ? p.images.map((img: any) => ({ url: typeof img === 'string' ? img : img.url, position: img.position })) : [p.image],
          isSale: p.isSale,
          isNew: p.isNew,
          isBestSeller: p.isBestSeller,
          isTrending: p.isTrending,
          isFeatured: p.isFeatured,
          brand: p.category ? p.category.name : 'OM Mobile Art',
          rating: p.rating || 0,
          reviewsCount: p.reviewsCount || 0,
          stock: p.stockQuantity !== undefined ? p.stockQuantity : 50,
          createdAt: p.createdAt
        }));
      }
      // 4. Promo Cards
      else if (sec.sectionKey === 'promo_cards') {
        const promoCards = await homepageRepository.findAllPromoCards();
        sectionData.settings.cards = promoCards.filter((c) => c.isVisible);
      }
      // 5. Categories
      else if (sec.sectionKey === 'categories') {
        const customCategoryCards = await homepageRepository.findAllCategoryCards();
        let cats: any[] = [];
        if (customCategoryCards && customCategoryCards.length > 0) {
          cats = customCategoryCards.filter((c) => c.isVisible);
        } else {
          cats = sectionData.settings.categories || sectionData.settings.featuredCategories || [];
        }

        // Filter exclusively to allowed 4 device categories
        const allowedKeys = [
          { key: 'camera', match: (n: string) => (n.includes('camera') || n.includes('dslr')) && !n.includes('lens'), displayName: 'Camera', defaultImg: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera', isFeatured: true, priority: 1 },
          { key: 'camera-lens', match: (n: string) => n.includes('camera lens') || n.includes('lens'), displayName: 'Camera Lens', defaultImg: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera%20Lens', isFeatured: true, priority: 2 },
          { key: 'mobile', match: (n: string) => n.includes('mobile') || n.includes('phone'), displayName: 'Mobile', defaultImg: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Mobile', isFeatured: false, priority: 3 },
          { key: 'laptop', match: (n: string) => n.includes('laptop') || n.includes('macbook'), displayName: 'Laptop', defaultImg: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Laptop', isFeatured: false, priority: 4 }
        ];

        const isPersonOrInvalidImage = (img: string | undefined | null) => {
          if (!img || img === 'null' || img === 'undefined') return true;
          if (img.includes('lh3.googleusercontent.com')) return true;
          if (img.includes('photo-1494790108377')) return true;
          return false;
        };

        const mappedCats = allowedKeys.map(cfg => {
          const found = cats.find(c => cfg.match((c.displayName || c.name || '').toLowerCase()));
          const rawImg = found?.image || found?.imageUrl;
          return {
            id: found?.id || `cat-${cfg.key}`,
            name: found?.name || cfg.displayName,
            displayName: found?.displayName || found?.name || cfg.displayName,
            image: !isPersonOrInvalidImage(rawImg) ? rawImg : cfg.defaultImg,
            link: found?.link || found?.destinationLink || cfg.link,
            isFeatured: cfg.isFeatured,
            sortOrder: cfg.priority,
            isVisible: found ? found.isVisible !== false : true,
            productCount: 0
          };
        }).filter(c => c.isVisible);

        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        // Dynamically compute live published product count for each category
        for (const cat of mappedCats) {
          const rawName = (cat.displayName || cat.name || '').toLowerCase();
          let searchKeyword = '';
          if (rawName.includes('camera lens') || rawName.includes('lens')) {
            searchKeyword = 'lens';
          } else if (rawName.includes('camera')) {
            searchKeyword = 'camera';
          } else if (rawName.includes('mobile') || rawName.includes('phone')) {
            searchKeyword = 'mobile';
          } else if (rawName.includes('laptop') || rawName.includes('macbook')) {
            searchKeyword = 'laptop';
          }

          const orConditions: any[] = [];
          if (cat.id && isUuid(cat.id)) {
            orConditions.push({ categoryId: cat.id });
          }
          if (searchKeyword) {
            orConditions.push({ category: { name: { contains: searchKeyword } } });
            orConditions.push({ name: { contains: searchKeyword } });
          }

          const count = await prisma.product.count({
            where: {
              isPublished: true,
              deletedAt: null,
              ...(orConditions.length > 0 ? { OR: orConditions } : {})
            }
          });

          const defaultFallbackCounts: Record<string, number> = {
            'Camera': 128,
            'Camera Lens': 54,
            'Mobile': 312,
            'Laptop': 86
          };

          cat.productCount = count > 0 ? count : (defaultFallbackCounts[cat.displayName] || 50);
        }

        // Priority sort: Camera (1) -> Camera Lens (2) -> Mobile (3) -> Laptop (4)
        mappedCats.sort((a, b) => a.sortOrder - b.sortOrder);
        sectionData.settings.categories = mappedCats;
      }
      // 6. Featured Collections
      else if (sec.sectionKey === 'collections') {
        const dbCollections = await prisma.collection.findMany({
          where: { isActive: true, isVisible: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        sectionData.settings.featuredCollections = dbCollections.map((col) => ({
          id: col.id,
          name: col.name,
          description: col.description || col.shortDescription || '',
          image: col.thumbnail || col.desktopBanner || '',
          link: `collection_detail.html?collectionId=${col.id}`,
        }));
      }
      // 7. Brand Showcase
      else if (sec.sectionKey === 'brands') {
        const brandCards = await homepageRepository.findAllBrandCards();
        if (brandCards.length > 0) {
          sectionData.settings.brands = brandCards.filter((b) => b.isActive);
        } else {
          const dbBrands = await prisma.brand.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          });
          sectionData.settings.brands = dbBrands.map((b) => ({
            id: b.id,
            name: b.name,
            logoUrl: b.logo,
            linkUrl: `/shop/pages/device_selector.html`,
          }));
        }
      }
      // 8. Testimonials
      else if (sec.sectionKey === 'testimonials') {
        const testimonials = await homepageRepository.findAllTestimonials();
        sectionData.settings.testimonials = testimonials.filter((t) => t.isVisible);
      }
      // 9. Why Choose Us
      else if (sec.sectionKey === 'why_choose_us') {
        const whyCards = await homepageRepository.findAllWhyChooseUsCards();
        sectionData.settings.cards = whyCards.filter((c) => c.isVisible);
      }
      // 10. Newsletter Config
      else if (sec.sectionKey === 'newsletter') {
        const newsletter = await homepageRepository.findNewsletterConfig();
        if (newsletter) {
          sectionData.settings.heading = newsletter.heading;
          sectionData.settings.description = newsletter.description;
          sectionData.settings.bgImageUrl = newsletter.bgImageUrl;
          sectionData.settings.isActive = newsletter.isActive;
        }
      }

      result.push(sectionData);
    }

    return result;
  }

  // ── Master Sections ──
  async getAllSections(): Promise<HomepageSection[]> {
    return homepageRepository.findAllSections();
  }

  async updateSection(id: string, data: any): Promise<HomepageSection> {
    const section = await homepageRepository.findSectionById(id);
    if (!section) {
      throw new NotFoundError('Homepage section not found');
    }
    return homepageRepository.updateSection(id, data);
  }

  async reorderSections(orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.homepageSection.update({
          where: { id },
          data: { position: index + 1 },
        })
      )
    );
  }

  // ── Hero Banners ──
  async getBanners(): Promise<Banner[]> {
    return homepageRepository.findAllBanners();
  }

  async createBanner(data: any): Promise<Banner> {
    return homepageRepository.createBanner(data);
  }

  async updateBanner(id: string, data: any): Promise<Banner> {
    const banner = await homepageRepository.findBannerById(id);
    if (!banner) throw new NotFoundError('Banner not found');
    return homepageRepository.updateBanner(id, data);
  }

  async deleteBanner(id: string): Promise<Banner> {
    const banner = await homepageRepository.findBannerById(id);
    if (!banner) throw new NotFoundError('Banner not found');
    return homepageRepository.deleteBanner(id);
  }

  // ── Single Unified Announcement Bar ──
  async getSingleAnnouncement(): Promise<any> {
    let bar = await prisma.announcementBar.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!bar) {
      bar = await prisma.announcementBar.create({
        data: {
          text: '⚡ FREE SHIPPING ON ALL INDIA ORDERS OVER ₹999! USE CODE: WELCOME10',
          bgColor: '#03045E',
          textColor: '#FFFFFF',
          linkUrl: '/shop/pages/shop.html',
          isActive: true,
          isScrolling: false,
          priority: 0,
        },
      });
    }

    const featureToggle = await prisma.storeFeatureToggle.findUnique({ where: { key: 'announcementBar' } });
    const isEnabled = featureToggle ? featureToggle.isEnabled : bar.isActive;

    return {
      id: bar.id,
      enabled: isEnabled && bar.isActive,
      isActive: isEnabled && bar.isActive,
      text: bar.text,
      bgColor: bar.bgColor,
      textColor: bar.textColor,
      linkUrl: bar.linkUrl,
      isScrolling: bar.isScrolling,
      icon: (bar as any).icon || 'campaign',
      closeButton: (bar as any).closeButton ?? false,
      sticky: (bar as any).sticky ?? false,
      updatedAt: bar.updatedAt,
    };
  }

  async updateSingleAnnouncement(data: any): Promise<any> {
    let bar = await prisma.announcementBar.findFirst({ orderBy: { createdAt: 'desc' } });
    const isEnabled = data.enabled !== undefined ? Boolean(data.enabled) : (data.isActive !== undefined ? Boolean(data.isActive) : true);

    const updatePayload = {
      text: data.text || '⚡ FREE SHIPPING ON ALL INDIA ORDERS OVER ₹999!',
      bgColor: data.bgColor || '#03045E',
      textColor: data.textColor || '#FFFFFF',
      linkUrl: data.linkUrl || '/shop/pages/shop.html',
      isActive: isEnabled,
      isScrolling: Boolean(data.isScrolling),
    };

    if (bar) {
      bar = await prisma.announcementBar.update({
        where: { id: bar.id },
        data: updatePayload,
      });
    } else {
      bar = await prisma.announcementBar.create({
        data: updatePayload,
      });
    }

    await prisma.storeFeatureToggle.upsert({
      where: { key: 'announcementBar' },
      update: { isEnabled },
      create: { key: 'announcementBar', isEnabled },
    });

    return {
      id: bar.id,
      enabled: isEnabled,
      isActive: isEnabled,
      text: bar.text,
      bgColor: bar.bgColor,
      textColor: bar.textColor,
      linkUrl: bar.linkUrl,
      isScrolling: bar.isScrolling,
      icon: data.icon || 'campaign',
      closeButton: Boolean(data.closeButton),
      sticky: Boolean(data.sticky),
      updatedAt: bar.updatedAt,
    };
  }

  // ── Announcement Bars List (Legacy Support) ──
  async getAnnouncementBars(): Promise<AnnouncementBar[]> {
    return homepageRepository.findAllAnnouncementBars();
  }

  async createAnnouncementBar(data: any): Promise<AnnouncementBar> {
    return homepageRepository.createAnnouncementBar(data);
  }

  async updateAnnouncementBar(id: string, data: any): Promise<AnnouncementBar> {
    const bar = await homepageRepository.findAnnouncementBarById(id);
    if (!bar) throw new NotFoundError('Announcement Bar not found');
    return homepageRepository.updateAnnouncementBar(id, data);
  }

  async deleteAnnouncementBar(id: string): Promise<AnnouncementBar> {
    const bar = await homepageRepository.findAnnouncementBarById(id);
    if (!bar) throw new NotFoundError('Announcement Bar not found');
    return homepageRepository.deleteAnnouncementBar(id);
  }

  // ── Promo Cards ──
  async getPromoCards(): Promise<HomepagePromoCard[]> {
    return homepageRepository.findAllPromoCards();
  }

  async createPromoCard(data: any): Promise<HomepagePromoCard> {
    return homepageRepository.createPromoCard(data);
  }

  async updatePromoCard(id: string, data: any): Promise<HomepagePromoCard> {
    const card = await homepageRepository.findPromoCardById(id);
    if (!card) throw new NotFoundError('Promo Card not found');
    return homepageRepository.updatePromoCard(id, data);
  }

  async deletePromoCard(id: string): Promise<HomepagePromoCard> {
    const card = await homepageRepository.findPromoCardById(id);
    if (!card) throw new NotFoundError('Promo Card not found');
    return homepageRepository.deletePromoCard(id);
  }

  // ── Category Cards ──
  async getCategoryCards(): Promise<HomepageCategoryCard[]> {
    return homepageRepository.findAllCategoryCards();
  }

  async createCategoryCard(data: any): Promise<HomepageCategoryCard> {
    return homepageRepository.createCategoryCard(data);
  }

  async updateCategoryCard(id: string, data: any): Promise<HomepageCategoryCard> {
    const card = await homepageRepository.findCategoryCardById(id);
    if (!card) throw new NotFoundError('Category Card not found');
    return homepageRepository.updateCategoryCard(id, data);
  }

  async deleteCategoryCard(id: string): Promise<HomepageCategoryCard> {
    const card = await homepageRepository.findCategoryCardById(id);
    if (!card) throw new NotFoundError('Category Card not found');
    return homepageRepository.deleteCategoryCard(id);
  }

  // ── Brand Cards ──
  async getBrandCards(): Promise<HomepageBrandCard[]> {
    return homepageRepository.findAllBrandCards();
  }

  async createBrandCard(data: any): Promise<HomepageBrandCard> {
    return homepageRepository.createBrandCard(data);
  }

  async updateBrandCard(id: string, data: any): Promise<HomepageBrandCard> {
    const card = await homepageRepository.findBrandCardById(id);
    if (!card) throw new NotFoundError('Brand Card not found');
    return homepageRepository.updateBrandCard(id, data);
  }

  async deleteBrandCard(id: string): Promise<HomepageBrandCard> {
    const card = await homepageRepository.findBrandCardById(id);
    if (!card) throw new NotFoundError('Brand Card not found');
    return homepageRepository.deleteBrandCard(id);
  }

  // ── Testimonials ──
  async getTestimonials(): Promise<Testimonial[]> {
    return homepageRepository.findAllTestimonials();
  }

  async createTestimonial(data: any): Promise<Testimonial> {
    return homepageRepository.createTestimonial(data);
  }

  async updateTestimonial(id: string, data: any): Promise<Testimonial> {
    const item = await homepageRepository.findTestimonialById(id);
    if (!item) throw new NotFoundError('Testimonial not found');
    return homepageRepository.updateTestimonial(id, data);
  }

  async deleteTestimonial(id: string): Promise<Testimonial> {
    const item = await homepageRepository.findTestimonialById(id);
    if (!item) throw new NotFoundError('Testimonial not found');
    return homepageRepository.deleteTestimonial(id);
  }

  // ── Why Choose Us ──
  async getWhyChooseUsCards(): Promise<WhyChooseUsCard[]> {
    return homepageRepository.findAllWhyChooseUsCards();
  }

  async createWhyChooseUsCard(data: any): Promise<WhyChooseUsCard> {
    return homepageRepository.createWhyChooseUsCard(data);
  }

  async updateWhyChooseUsCard(id: string, data: any): Promise<WhyChooseUsCard> {
    const card = await homepageRepository.findWhyChooseUsCardById(id);
    if (!card) throw new NotFoundError('Why Choose Us Card not found');
    return homepageRepository.updateWhyChooseUsCard(id, data);
  }

  async deleteWhyChooseUsCard(id: string): Promise<WhyChooseUsCard> {
    const card = await homepageRepository.findWhyChooseUsCardById(id);
    if (!card) throw new NotFoundError('Why Choose Us Card not found');
    return homepageRepository.deleteWhyChooseUsCard(id);
  }

  // ── Newsletter ──
  async getNewsletterConfig(): Promise<NewsletterConfig | null> {
    return homepageRepository.findNewsletterConfig();
  }

  async updateNewsletterConfig(data: any): Promise<NewsletterConfig> {
    return homepageRepository.upsertNewsletterConfig(data);
  }

  // ── Hero Videos ──
  async getHeroVideos(adminOnly = false): Promise<{ videos: HeroVideo[]; settings: HeroSliderSettings }> {
    const videos = adminOnly ? await homepageRepository.findAllHeroVideos() : await homepageRepository.findActiveHeroVideos();
    const settings = await homepageRepository.findHeroSliderSettings();
    return { videos, settings };
  }

  async createHeroVideo(data: any): Promise<HeroVideo> {
    if (!data.title || !data.videoUrl) {
      throw new Error('Title and Desktop Video URL are required');
    }
    return homepageRepository.createHeroVideo({
      title: data.title,
      videoUrl: data.videoUrl,
      mobileVideoUrl: data.mobileVideoUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });
  }

  async updateHeroVideo(id: string, data: any): Promise<HeroVideo> {
    const item = await homepageRepository.findHeroVideoById(id);
    if (!item) throw new NotFoundError('Hero Video not found');
    return homepageRepository.updateHeroVideo(id, data);
  }

  async deleteHeroVideo(id: string): Promise<HeroVideo> {
    const item = await homepageRepository.findHeroVideoById(id);
    if (!item) throw new NotFoundError('Hero Video not found');
    return homepageRepository.deleteHeroVideo(id);
  }

  async reorderHeroVideos(items: { id: string; orderIndex: number }[]): Promise<void> {
    return homepageRepository.updateHeroVideoOrder(items);
  }

  // ── Hero Slider Settings ──
  async getHeroSliderSettings(): Promise<HeroSliderSettings> {
    return homepageRepository.findHeroSliderSettings();
  }

  async updateHeroSliderSettings(data: any): Promise<HeroSliderSettings> {
    return homepageRepository.upsertHeroSliderSettings(data);
  }
}

export const homepageService = new HomepageService();
