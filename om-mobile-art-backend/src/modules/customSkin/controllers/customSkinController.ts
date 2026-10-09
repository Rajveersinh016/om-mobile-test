import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../database/client.js';
import { customSkinService } from '../services/customSkinService.js';
import { uploadService } from '../../catalog/services/uploadService.js';
import { imageUrlGenerator } from '../../catalog/services/imageUrlGenerator.js';
import { AuthenticationError, ValidationError } from '../../../core/exceptions/exceptions.js';

export class CustomSkinController {
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await customSkinService.getSettings();
    return reply.status(200).send({
      success: true,
      data: settings
    });
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const settings = request.body as any;
    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Invalid settings object');
    }

    const updated = await customSkinService.updateSettings(settings);
    return reply.status(200).send({
      success: true,
      data: updated
    });
  }

  async getConfig(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = (await customSkinService.getSettings()) || {};

    // Fetch live mobile brands & models from DB to construct dynamic matrix & brands list
    const mobileBrandsFromDb = await prisma.brand.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        deviceType: {
          is: {
            OR: [
              { name: { contains: 'mobile' } },
              { name: { contains: 'smartphone' } },
              { slug: { contains: 'mobile' } },
              { slug: { contains: 'smartphone' } }
            ],
            deletedAt: null
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        models: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { series: true }
        }
      }
    });

    // Fetch live laptop brands & models from DB
    const laptopBrandsFromDb = await prisma.brand.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        deviceType: {
          is: {
            OR: [
              { name: { contains: 'laptop' } },
              { name: { contains: 'macbook' } },
              { slug: { contains: 'laptop' } },
              { slug: { contains: 'macbook' } }
            ],
            deletedAt: null
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        models: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { series: true }
        }
      }
    });

    const dynamicDeviceMatrix: any[] = [];
    const mobileBrandsList: any[] = [];
    const laptopBrandsList: any[] = [];

    for (const b of mobileBrandsFromDb) {
      const brandModels: any[] = [];
      for (const m of b.models) {
        brandModels.push({
          id: m.id,
          name: m.name,
          slug: m.slug,
          series: m.series?.name || ''
        });
        dynamicDeviceMatrix.push({
          category: 'Mobile',
          brand: b.name,
          brandId: b.id,
          series: m.series?.name || '',
          model: m.name,
          modelId: m.id,
          cameraBump: b.name.toLowerCase().includes('apple') ? 'apple' : (b.name.toLowerCase().includes('samsung') ? 'samsung' : 'google'),
          extraCharge: 0,
          stockStatus: 'In Stock',
          estimatedDispatch: '24 Hours'
        });
      }
      mobileBrandsList.push({
        id: b.id,
        name: b.name,
        slug: b.slug,
        models: brandModels
      });
    }

    for (const b of laptopBrandsFromDb) {
      const brandModels: any[] = [];
      for (const m of b.models) {
        brandModels.push({
          id: m.id,
          name: m.name,
          slug: m.slug,
          series: m.series?.name || ''
        });
        dynamicDeviceMatrix.push({
          category: 'Laptop',
          brand: b.name,
          brandId: b.id,
          series: m.series?.name || '',
          model: m.name,
          modelId: m.id,
          cameraBump: 'none',
          extraCharge: 0,
          stockStatus: 'In Stock',
          estimatedDispatch: '24 Hours'
        });
      }
      laptopBrandsList.push({
        id: b.id,
        name: b.name,
        slug: b.slug,
        models: brandModels
      });
    }

    const finalDeviceMatrix = (settings.devices && settings.devices.length > 0) ? settings.devices : dynamicDeviceMatrix;

    // Format to align with custom-skin/config requirements
    const configData = {
      hero: {
        title: settings.heroTitle || "Design Your Custom Skin",
        subtitle: settings.heroSubtitle || "Upload your favorite photos, artwork, logo or design and create a premium precision-cut skin."
      },
      heroTitle: settings.heroTitle || "Design Your Custom Skin",
      heroSubtitle: settings.heroSubtitle || "Upload your favorite photos, artwork, logo or design and create a premium precision-cut skin.",
      pricing: {
        basePrice: settings.basePrice !== undefined ? settings.basePrice : (settings.backPanelBasePrice !== undefined ? settings.backPanelBasePrice : 300)
      },
      basePrice: settings.basePrice !== undefined ? settings.basePrice : (settings.backPanelBasePrice !== undefined ? settings.backPanelBasePrice : 300),
      backPanelBasePrice: settings.backPanelBasePrice !== undefined ? settings.backPanelBasePrice : 300,
      laptopBackBasePrice: settings.laptopBackBasePrice !== undefined ? settings.laptopBackBasePrice : 500,
      taxPercentage: 0,
      shippingCharge: settings.shippingCharge !== undefined ? settings.shippingCharge : 50,
      defaultCurrency: settings.defaultCurrency || "INR",

      benefits: settings.benefits || ["Bubble Free Installation", "Premium Vinyl", "Scratch Resistant", "Precision Cut", "Residue Free Removal"],
      warnings: {
        lowResolutionWarning: settings.warningMessages?.lowQualityWarning || settings.lowQualityWarning || "Low resolution image uploaded. Preview might look blurry.",
        maximumUploadWarning: settings.warningMessages?.sizeWarning || settings.sizeWarning || "File size exceeds maximum upload limit."
      },
      warningMessages: {
        lowQualityWarning: settings.warningMessages?.lowQualityWarning || settings.lowQualityWarning || "Low resolution image uploaded. Preview might look blurry.",
        sizeWarning: settings.warningMessages?.sizeWarning || settings.sizeWarning || "File size exceeds maximum upload limit."
      },
      uploadRules: {
        recommendedResolution: settings.recommendedResolution || settings.minResolution || "1200x2400",
        maxUploadSize: settings.maxUploadSize || 10,
        allowedFileTypes: settings.allowedFileTypes || ["png", "jpg", "jpeg", "webp"]
      },
      recommendedResolution: settings.recommendedResolution || settings.minResolution || "1200x2400",
      maxUploadSize: settings.maxUploadSize || 10,
      allowedFileTypes: settings.allowedFileTypes || ["png", "jpg", "jpeg", "webp"],

      materials: (settings.materials && settings.materials.length > 0) ? settings.materials : [
        { name: "3M Vinyl Standard", slug: "3m-vinyl-standard", texture: "#1A1A1A", extraCharge: 0 },
        { name: "Matte Carbon Fiber", slug: "matte-carbon-fiber", texture: "#2B2B2B", extraCharge: 50 },
        { name: "Textured Leather", slug: "textured-leather", texture: "#4A2E1D", extraCharge: 75 },
        { name: "Brushed Titanium", slug: "brushed-titanium", texture: "#707070", extraCharge: 100 }
      ],
      finishes: (settings.finishes && settings.finishes.length > 0) ? settings.finishes : [
        { name: "Matte Finish", slug: "matte", extraCharge: 0 },
        { name: "Glossy Finish", slug: "glossy", extraCharge: 0 },
        { name: "Satin Finish", slug: "satin", extraCharge: 30 }
      ],
      coverage: (settings.coverages && settings.coverages.length > 0) ? settings.coverages : ((settings.coverage && settings.coverage.length > 0) ? settings.coverage : [
        { name: "Full Back Panel", slug: "full-back", extraCharge: 0 },
        { name: "Back + Camera Bump", slug: "back-camera", extraCharge: 30 },
        { name: "Full Body (Wrap-around)", slug: "full-body", extraCharge: 50 }
      ]),
      coverages: (settings.coverages && settings.coverages.length > 0) ? settings.coverages : ((settings.coverage && settings.coverage.length > 0) ? settings.coverage : [
        { name: "Full Back Panel", slug: "full-back", extraCharge: 0 },
        { name: "Back + Camera Bump", slug: "back-camera", extraCharge: 30 },
        { name: "Full Body (Wrap-around)", slug: "full-body", extraCharge: 50 }
      ]),
      faqs: settings.faqs || [],
      fonts: settings.fonts || [],
      supportLinks: {
        chatUrl: settings.helpLinks?.chatLink || settings.chatLink || "",
        guideUrl: settings.helpLinks?.guideLink || settings.guideLink || "",
        templateUrl: settings.helpLinks?.templateLink || settings.templateLink || "",
        guidelinesUrl: settings.helpLinks?.guidelinesLink || settings.guidelinesLink || ""
      },
      helpLinks: {
        chatLink: settings.helpLinks?.chatLink || settings.chatLink || "",
        guideLink: settings.helpLinks?.guideLink || settings.guideLink || "",
        templateLink: settings.helpLinks?.templateLink || settings.templateLink || "",
        guidelinesLink: settings.helpLinks?.guidelinesLink || settings.guidelinesLink || ""
      },
      deviceMatrix: finalDeviceMatrix,
      mobileBrands: mobileBrandsList,
      laptopBrands: laptopBrandsList,
      deliveryTime: settings.deliveryTime || "Dispatched in 24 hours",
      orderNotes: settings.orderNotes || "",
      videoUrl: settings.videoUrl || "",
      installationGuideUrl: settings.installationGuideUrl || "",

      studioEnabled: settings.studioEnabled !== undefined ? settings.studioEnabled : true,
      showFaq: settings.showFaq !== undefined ? settings.showFaq : true,
      showHelpCard: settings.showHelpCard !== undefined ? settings.showHelpCard : true,
      showCoverage: settings.showCoverage !== undefined ? settings.showCoverage : true,
      backPanelEnabled: settings.backPanelEnabled !== undefined ? settings.backPanelEnabled : true,
      laptopBackEnabled: settings.laptopBackEnabled !== undefined ? settings.laptopBackEnabled : true,

      // Editor limits and flags
      defaultZoom: settings.defaultZoom !== undefined ? settings.defaultZoom : 100,
      defaultRotation: settings.defaultRotation !== undefined ? settings.defaultRotation : 0,
      maxZoom: settings.maxZoom !== undefined ? settings.maxZoom : 300,
      minZoom: settings.minZoom !== undefined ? settings.minZoom : 50,
      rotationLimits: settings.rotationLimits || "none",
      enableFlip: settings.enableFlip !== undefined ? settings.enableFlip : true,
      enableDrag: settings.enableDrag !== undefined ? settings.enableDrag : true,
      enableGrid: settings.enableGrid !== undefined ? settings.enableGrid : true,
      enableSafeArea: settings.enableSafeArea !== undefined ? settings.enableSafeArea : true,
      enableBleedArea: settings.enableBleedArea !== undefined ? settings.enableBleedArea : true,
      defaultPreviewMode: settings.defaultPreviewMode || "back",
      
      updatedAt: new Date().toISOString()
    };

    return reply.status(200).send({
      success: true,
      data: configData
    });
  }

  async updateConfig(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const configInput = request.body as any;
    if (!configInput || typeof configInput !== 'object') {
      throw new ValidationError('Invalid configuration object');
    }

    // Map configuration input back to settings schema
    const currentSettings: any = (await customSkinService.getSettings()) || {};

    const updatedSettings = {
      ...currentSettings,
      heroTitle: configInput.hero?.title || configInput.heroTitle || currentSettings.heroTitle,
      heroSubtitle: configInput.hero?.subtitle || configInput.heroSubtitle || currentSettings.heroSubtitle,
      basePrice: configInput.pricing?.basePrice !== undefined ? configInput.pricing.basePrice : (configInput.basePrice !== undefined ? configInput.basePrice : currentSettings.basePrice),
      benefits: configInput.benefits || currentSettings.benefits,
      warningMessages: {
        lowQualityWarning: configInput.warnings?.lowResolutionWarning || configInput.warningMessages?.lowQualityWarning || currentSettings.warningMessages?.lowQualityWarning,
        sizeWarning: configInput.warnings?.maximumUploadWarning || configInput.warningMessages?.sizeWarning || currentSettings.warningMessages?.sizeWarning
      },
      recommendedResolution: configInput.uploadRules?.recommendedResolution || configInput.recommendedResolution || currentSettings.recommendedResolution,
      maxUploadSize: configInput.uploadRules?.maxUploadSize !== undefined ? configInput.uploadRules.maxUploadSize : (configInput.maxUploadSize !== undefined ? configInput.maxUploadSize : currentSettings.maxUploadSize),
      allowedFileTypes: configInput.uploadRules?.allowedFileTypes || configInput.allowedFileTypes || currentSettings.allowedFileTypes || ["png", "jpg", "jpeg", "webp"],
      materials: configInput.materials || currentSettings.materials,
      finishes: configInput.finishes || currentSettings.finishes,
      coverages: configInput.coverage || configInput.coverages || currentSettings.coverages,
      faqs: configInput.faqs || currentSettings.faqs,
      fonts: configInput.fonts || currentSettings.fonts,
      helpLinks: {
        chatLink: configInput.supportLinks?.chatUrl || configInput.helpLinks?.chatLink || currentSettings.helpLinks?.chatLink,
        guideLink: configInput.supportLinks?.guideUrl || configInput.helpLinks?.guideLink || currentSettings.helpLinks?.guideLink,
        templateLink: configInput.supportLinks?.templateUrl || configInput.helpLinks?.templateLink || currentSettings.helpLinks?.templateLink,
        guidelinesLink: configInput.supportLinks?.guidelinesUrl || configInput.helpLinks?.guidelinesLink || currentSettings.helpLinks?.guidelinesLink
      },
      devices: configInput.deviceMatrix || configInput.devices || currentSettings.devices,
      deliveryTime: configInput.deliveryTime || currentSettings.deliveryTime,
      studioEnabled: configInput.studioEnabled !== undefined ? configInput.studioEnabled : currentSettings.studioEnabled,
      showFaq: configInput.showFaq !== undefined ? configInput.showFaq : currentSettings.showFaq,
      showHelpCard: configInput.showHelpCard !== undefined ? configInput.showHelpCard : currentSettings.showHelpCard,
      showCoverage: configInput.showCoverage !== undefined ? configInput.showCoverage : currentSettings.showCoverage,
      
      // Editor limits and flags mapping
      defaultZoom: configInput.defaultZoom !== undefined ? parseInt(configInput.defaultZoom) : currentSettings.defaultZoom,
      defaultRotation: configInput.defaultRotation !== undefined ? parseInt(configInput.defaultRotation) : currentSettings.defaultRotation,
      maxZoom: configInput.maxZoom !== undefined ? parseInt(configInput.maxZoom) : currentSettings.maxZoom,
      minZoom: configInput.minZoom !== undefined ? parseInt(configInput.minZoom) : currentSettings.minZoom,
      rotationLimits: configInput.rotationLimits !== undefined ? configInput.rotationLimits : currentSettings.rotationLimits,
      enableFlip: configInput.enableFlip !== undefined ? (configInput.enableFlip === true || configInput.enableFlip === 'true') : currentSettings.enableFlip,
      enableDrag: configInput.enableDrag !== undefined ? (configInput.enableDrag === true || configInput.enableDrag === 'true') : currentSettings.enableDrag,
      enableGrid: configInput.enableGrid !== undefined ? (configInput.enableGrid === true || configInput.enableGrid === 'true') : currentSettings.enableGrid,
      enableSafeArea: configInput.enableSafeArea !== undefined ? (configInput.enableSafeArea === true || configInput.enableSafeArea === 'true') : currentSettings.enableSafeArea,
      enableBleedArea: configInput.enableBleedArea !== undefined ? (configInput.enableBleedArea === true || configInput.enableBleedArea === 'true') : currentSettings.enableBleedArea,
      defaultPreviewMode: configInput.defaultPreviewMode || currentSettings.defaultPreviewMode,

      // Mobile & Laptop Services Properties
      backPanelEnabled: configInput.backPanelEnabled !== undefined ? configInput.backPanelEnabled : currentSettings.backPanelEnabled,
      laptopBackEnabled: configInput.laptopBackEnabled !== undefined ? configInput.laptopBackEnabled : currentSettings.laptopBackEnabled,
      backPanelBasePrice: configInput.backPanelBasePrice !== undefined ? parseFloat(configInput.backPanelBasePrice) : currentSettings.backPanelBasePrice,
      laptopBackBasePrice: configInput.laptopBackBasePrice !== undefined ? parseFloat(configInput.laptopBackBasePrice) : currentSettings.laptopBackBasePrice,
      taxPercentage: 0,
      shippingCharge: configInput.shippingCharge !== undefined ? parseFloat(configInput.shippingCharge) : currentSettings.shippingCharge,
      defaultCurrency: configInput.defaultCurrency || currentSettings.defaultCurrency || "INR",
      enableGoogleFonts: configInput.enableGoogleFonts !== undefined ? configInput.enableGoogleFonts : currentSettings.enableGoogleFonts,
      maxTextLayers: configInput.maxTextLayers !== undefined ? parseInt(configInput.maxTextLayers) : currentSettings.maxTextLayers,
      maxCharactersPerLayer: configInput.maxCharactersPerLayer !== undefined ? parseInt(configInput.maxCharactersPerLayer) : currentSettings.maxCharactersPerLayer,
      allowedColors: configInput.allowedColors || currentSettings.allowedColors,
      textPricingExtra: configInput.textPricingExtra !== undefined ? parseFloat(configInput.textPricingExtra) : currentSettings.textPricingExtra,
      minResolution: configInput.minResolution || currentSettings.minResolution,
      compressionQuality: configInput.compressionQuality !== undefined ? parseFloat(configInput.compressionQuality) : currentSettings.compressionQuality,
      enableBackgroundRemoval: configInput.enableBackgroundRemoval !== undefined ? configInput.enableBackgroundRemoval : currentSettings.enableBackgroundRemoval,
      enableAutoCrop: configInput.enableAutoCrop !== undefined ? configInput.enableAutoCrop : currentSettings.enableAutoCrop,
      enableSmartCenter: configInput.enableSmartCenter !== undefined ? configInput.enableSmartCenter : currentSettings.enableSmartCenter,
      enableWatermark: configInput.enableWatermark !== undefined ? configInput.enableWatermark : currentSettings.enableWatermark,
      maxUploads: configInput.maxUploads !== undefined ? parseInt(configInput.maxUploads) : currentSettings.maxUploads,
      allowedAspectRatio: configInput.allowedAspectRatio || currentSettings.allowedAspectRatio,
      orderNotes: configInput.orderNotes || currentSettings.orderNotes,
      videoUrl: configInput.videoUrl || currentSettings.videoUrl,
      installationGuideUrl: configInput.installationGuideUrl || currentSettings.installationGuideUrl
    };

    const updated = await customSkinService.updateSettings(updatedSettings);

    return reply.status(200).send({
      success: true,
      data: updated
    });
  }

  async getMaterials(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = await customSkinService.getSettings();
    const list = settings?.materials ? settings.materials.filter((m: any) => m.isActive) : [];
    return reply.status(200).send({ success: true, data: list });
  }

  async getFinishes(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = await customSkinService.getSettings();
    const list = settings?.finishes ? settings.finishes.filter((f: any) => f.isActive) : [];
    return reply.status(200).send({ success: true, data: list });
  }

  async getCoverage(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = await customSkinService.getSettings();
    const list = settings?.coverages ? settings.coverages.filter((c: any) => c.isActive) : [];
    return reply.status(200).send({ success: true, data: list });
  }

  async getFaqs(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = await customSkinService.getSettings();
    const list = settings?.faqs || [];
    return reply.status(200).send({ success: true, data: list });
  }

  async getFonts(request: FastifyRequest, reply: FastifyReply) {
    const settings: any = await customSkinService.getSettings();
    const list = settings?.fonts ? settings.fonts.filter((f: any) => f.isActive) : [];
    return reply.status(200).send({ success: true, data: list });
  }

  async calculatePrice(request: FastifyRequest, reply: FastifyReply) {
    const body = (request.body as any) || {};
    const flowType = body.flowType === 'laptop' ? 'laptop' : 'mobile';
    const settings: any = (await customSkinService.getSettings()) || {};

    const minQty = 1;
    const qty = Math.max(minQty, Number(body.quantity) || minQty);

    let basePrice = 0;
    let optionPrice = 0;

    if (flowType === 'laptop') {
      basePrice = settings.laptopBackBasePrice !== undefined ? settings.laptopBackBasePrice : 500;
    } else {
      basePrice = settings.backPanelBasePrice !== undefined ? settings.backPanelBasePrice : 300;
    }

    // Match material extra
    const materials = settings.materials || [];
    const mat = materials.find((m: any) => m.slug === body.materialSlug || m.name === body.materialName);
    if (mat) optionPrice += Number(mat.extraCharge) || 0;

    // Match finish extra
    const finishes = settings.finishes || [];
    const fin = finishes.find((f: any) => f.slug === body.finishSlug || f.name === body.finishName);
    if (fin) optionPrice += Number(fin.extraCharge) || 0;

    // Match coverage extra
    const coverages = settings.coverages || settings.coverage || [];
    const cov = coverages.find((c: any) => c.slug === body.coverageSlug || c.name === body.coverageName);
    if (cov) optionPrice += Number(cov.extraCharge) || 0;

    // Text extra
    const textExtra = settings.textPricingExtra !== undefined ? settings.textPricingExtra : 0;
    optionPrice += (Number(body.textLayersCount) || 0) * textExtra;

    const calculatedUnitPrice = basePrice + optionPrice;
    const lineTotal = calculatedUnitPrice * qty;

    console.log('[CUSTOM-SKIN PRICE]', {
      productId: body.productId || 'CUSTOM-SKIN',
      deviceId: body.deviceId || body.modelId || '',
      brandId: body.brandId || '',
      modelId: body.modelId || '',
      finish: body.finishSlug || body.finishName || '',
      material: body.materialSlug || body.materialName || '',
      basePrice,
      optionPrice,
      calculatedUnitPrice,
      quantity: qty,
      lineTotal
    });

    return reply.status(200).send({
      success: true,
      data: {
        flowType,
        basePrice,
        optionPrice,
        calculatedUnitPrice,
        unitPrice: calculatedUnitPrice,
        quantity: qty,
        lineTotal,
        minOrderQuantity: minQty
      }
    });
  }

  async uploadImage(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { content: string; filename: string };
    if (!body || !body.content || !body.filename) {
      throw new ValidationError('Upload content and filename are required');
    }

    const result = await uploadService.upload(body.content, body.filename);
    const url = imageUrlGenerator.generateUrl(result.key);

    return reply.status(200).send({
      success: true,
      data: { url }
    });
  }
}

export const customSkinController = new CustomSkinController();
