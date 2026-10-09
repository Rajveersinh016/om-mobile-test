import { settingsRepository } from '../repositories/settingsRepository.js';
import { NotFoundError } from '../../../core/exceptions/exceptions.js';

let cachedPublicSettings: any = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute in-memory cache

export class SettingsService {
  clearCache() {
    cachedPublicSettings = null;
    cacheExpiry = 0;
  }

  async getPublicSettings(): Promise<any> {
    const now = Date.now();
    if (cachedPublicSettings && now < cacheExpiry) {
      return cachedPublicSettings;
    }

    const [
      store,
      brand,
      socialLinks,
      contact,
      seo,
      footer,
      maintenance,
      toggles,
      announcement,
      legalPages,
    ] = await Promise.all([
      settingsRepository.getStoreSettings(),
      settingsRepository.getBrandConfig(),
      settingsRepository.getSocialLinks(),
      settingsRepository.getContactInfo(),
      settingsRepository.getSeoConfig(),
      settingsRepository.getFooterConfig(),
      settingsRepository.getMaintenanceConfig(),
      settingsRepository.getFeatureToggles(),
      settingsRepository.getAnnouncementBar(),
      settingsRepository.getLegalPages(),
    ]);

    const activeSocial = (socialLinks || []).filter(s => s.isActive);
    const featureFlags: Record<string, boolean> = {};
    (toggles || []).forEach(t => {
      featureFlags[t.key] = t.isEnabled;
    });

    const bundle = {
      store: store || {
        storeName: 'OM Mobile Art',
        storeTagline: 'Precision-Fit Vinyl Skins & Device Protection',
        businessDescription: 'Premium 3M vinyl skins for mobile devices, laptops, tablets, and cameras.',
        storeUrl: 'http://localhost:8080',
        timezone: 'Asia/Kolkata',
        currencySymbol: '₹',
        currencyCode: 'INR',
        language: 'en',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12H',
        shippingFreeThreshold: 999,
        shippingFlatRate: 49,
      },
      brand: brand || {
        primaryLogoUrl: '../../assets/logos/logo.png',
        faviconUrl: '../../assets/logos/favicon.png',
      },
      socialLinks: activeSocial,
      contact: contact || {
        supportEmail: 'ommobileart09@gmail.com',
        supportPhone: '+91 96386 52327',
        whatsappNumber: '+91 96386 52327',
        officeAddress: 'Mumbai, Maharashtra, India',
        businessHours: 'Mon - Sat: 10:00 AM - 7:00 PM IST',
      },
      seo: seo || {
        metaTitle: 'OM Mobile Art | Premium Mobile Skins & Protection',
        metaDescription: 'Shop high-quality 3M vinyl skins for mobile phones, laptops, and tablets.',
        keywords: 'mobile skins, laptop skins, vinyl wraps, phone protection',
        canonicalUrl: 'http://localhost:8080',
        robotsMeta: 'index, follow',
      },
      footer: footer || {
        footerText: 'Crafting premium vinyl skins with 0.23mm precision fit.',
        copyrightText: '© 2026 OM Mobile Art. All rights reserved.',
      },
      announcement: announcement ? {
        text: announcement.text,
        bgColor: announcement.bgColor,
        textColor: announcement.textColor,
        linkUrl: announcement.linkUrl,
        isActive: announcement.isActive,
        isScrolling: announcement.isScrolling ?? false,
        icon: (announcement as any).icon || 'campaign',
        closeButton: (announcement as any).closeButton ?? false,
        sticky: (announcement as any).sticky ?? false,
      } : {
        text: '⚡ Special Launch Offer: Get 10% OFF on all 3M Skins! Use Code: WELCOME10',
        bgColor: '#03045E',
        textColor: '#FFFFFF',
        linkUrl: 'shop/pages/shop.html',
        isActive: true,
        isScrolling: false,
        icon: 'campaign',
        closeButton: false,
        sticky: false,
      },
      maintenance: maintenance || {
        isActive: false,
        message: "We are currently upgrading our store to bring you better skins. We'll be back shortly!",
      },
      features: featureFlags,
      legalPages: legalPages || [],
    };

    cachedPublicSettings = bundle;
    cacheExpiry = now + CACHE_TTL_MS;
    return bundle;
  }

  async updateAnnouncementBar(data: any) {
    this.clearCache();
    return settingsRepository.upsertAnnouncementBar(data);
  }

  async getAdminSettings(): Promise<any> {
    const [
      publicBundle,
      smtp,
      security,
      backup,
      allSocial,
      allToggles,
    ] = await Promise.all([
      this.getPublicSettings(),
      settingsRepository.getEmailSmtpConfig(),
      settingsRepository.getSecurityPolicy(),
      settingsRepository.getBackupConfig(),
      settingsRepository.getSocialLinks(),
      settingsRepository.getFeatureToggles(),
    ]);

    return {
      ...publicBundle,
      allSocialLinks: allSocial,
      allFeatureToggles: allToggles,
      smtp: smtp ? {
        host: smtp.host,
        port: smtp.port,
        username: smtp.username,
        senderName: smtp.senderName,
        senderEmail: smtp.senderEmail,
      } : {
        host: 'smtp.mailtrap.io',
        port: 587,
        username: '',
        senderName: 'OM Mobile Art',
        senderEmail: 'noreply@ommobileart.com',
      },
      security: security || {
        passwordMinLength: 8,
        sessionTimeoutMinutes: 1440,
        maxLoginAttempts: 5,
        twoFactorEnabled: false,
      },
      backup: backup || {
        autoBackupEnabled: true,
        backupFrequency: 'DAILY',
        storageProvider: 'LOCAL',
      },
    };
  }

  async updateStoreSettings(data: any) {
    this.clearCache();
    return settingsRepository.upsertStoreSettings(data);
  }

  async updateBrandConfig(data: any) {
    this.clearCache();
    return settingsRepository.upsertBrandConfig(data);
  }

  async updateContactInfo(data: any) {
    this.clearCache();
    return settingsRepository.upsertContactInfo(data);
  }

  async updateSeoConfig(data: any) {
    this.clearCache();
    return settingsRepository.upsertSeoConfig(data);
  }

  async updateFooterConfig(data: any) {
    this.clearCache();
    return settingsRepository.upsertFooterConfig(data);
  }

  async updateEmailSmtpConfig(data: any) {
    this.clearCache();
    if (data.password) {
      data.encryptedPassword = Buffer.from(data.password).toString('base64');
      delete data.password;
    }
    return settingsRepository.upsertEmailSmtpConfig(data);
  }

  async updateMaintenanceConfig(data: any) {
    this.clearCache();
    return settingsRepository.upsertMaintenanceConfig(data);
  }

  async updateFeatureToggles(toggles: Record<string, boolean>) {
    this.clearCache();
    const results = [];
    for (const [key, isEnabled] of Object.entries(toggles)) {
      results.push(await settingsRepository.upsertFeatureToggle(key, isEnabled));
    }
    return results;
  }

  async updateSecurityPolicy(data: any) {
    return settingsRepository.upsertSecurityPolicy(data);
  }

  async updateBackupConfig(data: any) {
    return settingsRepository.upsertBackupConfig(data);
  }

  // ── Social Links ──
  async createSocialLink(data: any) {
    this.clearCache();
    return settingsRepository.createSocialLink(data);
  }

  async updateSocialLink(id: string, data: any) {
    this.clearCache();
    return settingsRepository.updateSocialLink(id, data);
  }

  async deleteSocialLink(id: string) {
    this.clearCache();
    return settingsRepository.deleteSocialLink(id);
  }

  // ── Legal Pages ──
  async getLegalPages() {
    return settingsRepository.getLegalPages();
  }

  async getLegalPageBySlug(slug: string) {
    const page = await settingsRepository.getLegalPageBySlug(slug);
    if (!page) throw new NotFoundError(`Legal page '${slug}' not found`);
    return page;
  }

  async upsertLegalPage(data: any) {
    return settingsRepository.upsertLegalPage(data.slug, data);
  }

  async deleteLegalPage(id: string) {
    return settingsRepository.deleteLegalPage(id);
  }
}

export const settingsService = new SettingsService();
