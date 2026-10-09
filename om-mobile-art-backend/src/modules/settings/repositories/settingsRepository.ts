import { prisma } from '../../../database/client.js';
import {
  StoreSetting,
  BrandConfig,
  SocialLink,
  ContactInfo,
  SeoConfig,
  FooterConfig,
  LegalPage,
  EmailSmtpConfig,
  MaintenanceConfig,
  StoreFeatureToggle,
  SecurityPolicy,
  BackupConfig,
  Prisma,
} from '@prisma/client';

export class SettingsRepository {
  // ── Store Settings ──
  async getStoreSettings(): Promise<StoreSetting | null> {
    return prisma.storeSetting.findFirst();
  }

  async upsertStoreSettings(data: Prisma.StoreSettingUpdateInput): Promise<StoreSetting> {
    const existing = await prisma.storeSetting.findFirst();
    if (existing) {
      return prisma.storeSetting.update({ where: { id: existing.id }, data });
    }
    return prisma.storeSetting.create({ data: data as Prisma.StoreSettingCreateInput });
  }

  // ── Brand Config ──
  async getBrandConfig(): Promise<BrandConfig | null> {
    return prisma.brandConfig.findFirst();
  }

  async upsertBrandConfig(data: Prisma.BrandConfigUpdateInput): Promise<BrandConfig> {
    const existing = await prisma.brandConfig.findFirst();
    if (existing) {
      return prisma.brandConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.brandConfig.create({ data: data as Prisma.BrandConfigCreateInput });
  }

  // ── Social Links ──
  async getSocialLinks(): Promise<SocialLink[]> {
    return prisma.socialLink.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSocialLink(data: Prisma.SocialLinkCreateInput): Promise<SocialLink> {
    return prisma.socialLink.create({ data });
  }

  async updateSocialLink(id: string, data: Prisma.SocialLinkUpdateInput): Promise<SocialLink> {
    return prisma.socialLink.update({ where: { id }, data });
  }

  async deleteSocialLink(id: string): Promise<SocialLink> {
    return prisma.socialLink.delete({ where: { id } });
  }

  // ── Contact Info ──
  async getContactInfo(): Promise<ContactInfo | null> {
    return prisma.contactInfo.findFirst();
  }

  async upsertContactInfo(data: Prisma.ContactInfoUpdateInput): Promise<ContactInfo> {
    const existing = await prisma.contactInfo.findFirst();
    if (existing) {
      return prisma.contactInfo.update({ where: { id: existing.id }, data });
    }
    return prisma.contactInfo.create({ data: data as Prisma.ContactInfoCreateInput });
  }

  // ── SEO Config ──
  async getSeoConfig(): Promise<SeoConfig | null> {
    return prisma.seoConfig.findFirst();
  }

  async upsertSeoConfig(data: Prisma.SeoConfigUpdateInput): Promise<SeoConfig> {
    const existing = await prisma.seoConfig.findFirst();
    if (existing) {
      return prisma.seoConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.seoConfig.create({ data: data as Prisma.SeoConfigCreateInput });
  }

  // ── Footer Config ──
  async getFooterConfig(): Promise<FooterConfig | null> {
    return prisma.footerConfig.findFirst();
  }

  async upsertFooterConfig(data: Prisma.FooterConfigUpdateInput): Promise<FooterConfig> {
    const existing = await prisma.footerConfig.findFirst();
    if (existing) {
      return prisma.footerConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.footerConfig.create({ data: data as Prisma.FooterConfigCreateInput });
  }

  // ── Legal Pages ──
  async getLegalPages(): Promise<LegalPage[]> {
    return prisma.legalPage.findMany({ orderBy: { title: 'asc' } });
  }

  async getLegalPageBySlug(slug: string): Promise<LegalPage | null> {
    return prisma.legalPage.findUnique({ where: { slug } });
  }

  async upsertLegalPage(slug: string, data: { title: string; content: string; isPublished?: boolean; metaTitle?: string | null; metaDescription?: string | null }): Promise<LegalPage> {
    return prisma.legalPage.upsert({
      where: { slug },
      create: { slug, title: data.title, content: data.content, isPublished: data.isPublished !== undefined ? data.isPublished : true, metaTitle: data.metaTitle, metaDescription: data.metaDescription },
      update: data,
    });
  }

  async deleteLegalPage(id: string): Promise<LegalPage> {
    return prisma.legalPage.delete({ where: { id } });
  }

  // ── Email SMTP Config ──
  async getEmailSmtpConfig(): Promise<EmailSmtpConfig | null> {
    return prisma.emailSmtpConfig.findFirst();
  }

  async upsertEmailSmtpConfig(data: Prisma.EmailSmtpConfigUpdateInput): Promise<EmailSmtpConfig> {
    const existing = await prisma.emailSmtpConfig.findFirst();
    if (existing) {
      return prisma.emailSmtpConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.emailSmtpConfig.create({ data: data as Prisma.EmailSmtpConfigCreateInput });
  }

  // ── Maintenance Config ──
  async getMaintenanceConfig(): Promise<MaintenanceConfig | null> {
    return prisma.maintenanceConfig.findFirst();
  }

  async upsertMaintenanceConfig(data: Prisma.MaintenanceConfigUpdateInput): Promise<MaintenanceConfig> {
    const existing = await prisma.maintenanceConfig.findFirst();
    if (existing) {
      return prisma.maintenanceConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.maintenanceConfig.create({ data: data as Prisma.MaintenanceConfigCreateInput });
  }

  // ── Feature Toggles ──
  async getFeatureToggles(): Promise<StoreFeatureToggle[]> {
    return prisma.storeFeatureToggle.findMany();
  }

  async upsertFeatureToggle(key: string, isEnabled: boolean): Promise<StoreFeatureToggle> {
    return prisma.storeFeatureToggle.upsert({
      where: { key },
      create: { key, isEnabled },
      update: { isEnabled },
    });
  }

  // ── Security Policy ──
  async getSecurityPolicy(): Promise<SecurityPolicy | null> {
    return prisma.securityPolicy.findFirst();
  }

  async upsertSecurityPolicy(data: Prisma.SecurityPolicyUpdateInput): Promise<SecurityPolicy> {
    const existing = await prisma.securityPolicy.findFirst();
    if (existing) {
      return prisma.securityPolicy.update({ where: { id: existing.id }, data });
    }
    return prisma.securityPolicy.create({ data: data as Prisma.SecurityPolicyCreateInput });
  }

  // ── Backup Config ──
  async getBackupConfig(): Promise<BackupConfig | null> {
    return prisma.backupConfig.findFirst();
  }

  // ── Announcement Bar ──
  async getAnnouncementBar() {
    return prisma.announcementBar.findFirst({
      orderBy: { createdAt: 'desc' }
    });
  }

  async upsertAnnouncementBar(data: any) {
    const existing = await prisma.announcementBar.findFirst();
    if (existing) {
      return prisma.announcementBar.update({ where: { id: existing.id }, data });
    }
    return prisma.announcementBar.create({ data });
  }
}

export const settingsRepository = new SettingsRepository();
