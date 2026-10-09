import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { homepageController } from './controllers/homepageController.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { authorize } from '../../middlewares/rbacMiddleware.js';

export const homepageRoutes = async (app: FastifyInstance) => {
  const adminAuth = { preHandler: [authenticate, authorize(Role.ADMIN)] };

  // Public Storefront Endpoints
  app.get('/homepage/layout', homepageController.getLayout);
  app.get('/homepage/hero-videos', homepageController.getHeroVideos);
  app.get('/homepage/banners', homepageController.getBanners);

  // Hero Video & Slider Settings (Admin)
  app.get('/homepage/admin/hero-videos', adminAuth, homepageController.getAdminHeroVideos);
  app.post('/homepage/hero-videos', adminAuth, homepageController.createHeroVideo);
  app.put('/homepage/hero-videos/order', adminAuth, homepageController.reorderHeroVideos);
  app.put('/homepage/hero-videos/:id', adminAuth, homepageController.updateHeroVideo);
  app.delete('/homepage/hero-videos/:id', adminAuth, homepageController.deleteHeroVideo);
  app.get('/homepage/hero-slider/settings', adminAuth, homepageController.getHeroSliderSettings);
  app.put('/homepage/hero-slider/settings', adminAuth, homepageController.updateHeroSliderSettings);
  // Single Unified Announcement Bar Endpoints
  app.get('/homepage/announcement', homepageController.getSingleAnnouncement);
  app.put('/homepage/announcement', adminAuth, homepageController.updateSingleAnnouncement);

  // Administrative Layout & Section Ordering
  app.get('/homepage/sections', adminAuth, homepageController.getAllSections);
  app.put('/homepage/sections/reorder', adminAuth, homepageController.reorderSections);
  app.put('/homepage/sections/:id', adminAuth, homepageController.updateSection);

  // Banners
  app.post('/homepage/banners', adminAuth, homepageController.createBanner);
  app.put('/homepage/banners/:id', adminAuth, homepageController.updateBanner);
  app.delete('/homepage/banners/:id', adminAuth, homepageController.deleteBanner);

  // Announcement Bars List (Legacy)
  app.get('/homepage/announcements', adminAuth, homepageController.getAnnouncementBars);
  app.post('/homepage/announcements', adminAuth, homepageController.createAnnouncementBar);
  app.put('/homepage/announcements/:id', adminAuth, homepageController.updateAnnouncementBar);
  app.delete('/homepage/announcements/:id', adminAuth, homepageController.deleteAnnouncementBar);

  // Promo Cards
  app.get('/homepage/promo-cards', adminAuth, homepageController.getPromoCards);
  app.post('/homepage/promo-cards', adminAuth, homepageController.createPromoCard);
  app.put('/homepage/promo-cards/:id', adminAuth, homepageController.updatePromoCard);
  app.delete('/homepage/promo-cards/:id', adminAuth, homepageController.deletePromoCard);

  // Category Cards
  app.get('/homepage/category-cards', adminAuth, homepageController.getCategoryCards);
  app.post('/homepage/category-cards', adminAuth, homepageController.createCategoryCard);
  app.put('/homepage/category-cards/:id', adminAuth, homepageController.updateCategoryCard);
  app.delete('/homepage/category-cards/:id', adminAuth, homepageController.deleteCategoryCard);

  // Brand Cards
  app.get('/homepage/brand-cards', adminAuth, homepageController.getBrandCards);
  app.post('/homepage/brand-cards', adminAuth, homepageController.createBrandCard);
  app.put('/homepage/brand-cards/:id', adminAuth, homepageController.updateBrandCard);
  app.delete('/homepage/brand-cards/:id', adminAuth, homepageController.deleteBrandCard);

  // Testimonials
  app.get('/homepage/testimonials', adminAuth, homepageController.getTestimonials);
  app.post('/homepage/testimonials', adminAuth, homepageController.createTestimonial);
  app.put('/homepage/testimonials/:id', adminAuth, homepageController.updateTestimonial);
  app.delete('/homepage/testimonials/:id', adminAuth, homepageController.deleteTestimonial);

  // Why Choose Us Cards
  app.get('/homepage/why-choose-us', adminAuth, homepageController.getWhyChooseUsCards);
  app.post('/homepage/why-choose-us', adminAuth, homepageController.createWhyChooseUsCard);
  app.put('/homepage/why-choose-us/:id', adminAuth, homepageController.updateWhyChooseUsCard);
  app.delete('/homepage/why-choose-us/:id', adminAuth, homepageController.deleteWhyChooseUsCard);

  // Newsletter Config
  app.get('/homepage/newsletter', adminAuth, homepageController.getNewsletterConfig);
  app.put('/homepage/newsletter', adminAuth, homepageController.updateNewsletterConfig);
};
