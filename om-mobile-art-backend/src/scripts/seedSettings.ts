import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSettings() {
  console.log('Seeding & Initializing Store Settings in PostgreSQL...');

  // 1. StoreSettings
  const existingStore = await prisma.storeSetting.findFirst();
  if (!existingStore) {
    await prisma.storeSetting.create({
      data: {
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
        shippingFreeThreshold: 999.0,
        shippingFlatRate: 49.0
      }
    });
    console.log('Created StoreSetting');
  }

  // 2. BrandConfig
  const existingBrand = await prisma.brandConfig.findFirst();
  if (!existingBrand) {
    await prisma.brandConfig.create({
      data: {
        primaryLogoUrl: '../../assets/logos/logo.png',
        faviconUrl: '../../assets/logos/favicon.png',
        darkLogoUrl: '../../assets/logos/logo.png',
        lightLogoUrl: '../../assets/logos/logo.png'
      }
    });
    console.log('Created BrandConfig');
  }

  // 3. ContactInfo
  const existingContact = await prisma.contactInfo.findFirst();
  if (!existingContact) {
    await prisma.contactInfo.create({
      data: {
        supportEmail: 'ommobileart09@gmail.com',
        supportPhone: '+91 96386 52327',
        whatsappNumber: '+91 96386 52327',
        officeAddress: '123 Skin Street, Mumbai, Maharashtra 400001, India',
        businessHours: 'Mon - Sat: 10:00 AM - 7:00 PM IST'
      }
    });
    console.log('Created ContactInfo');
  }

  // 4. SeoConfig
  const existingSeo = await prisma.seoConfig.findFirst();
  if (!existingSeo) {
    await prisma.seoConfig.create({
      data: {
        metaTitle: 'OM Mobile Art | Premium Mobile Skins & Protection',
        metaDescription: 'Shop high-quality 3M vinyl skins for mobile phones, laptops, and tablets.',
        keywords: 'mobile skins, laptop skins, vinyl wraps, phone protection, custom skins',
        canonicalUrl: 'http://localhost:8080',
        robotsMeta: 'index, follow',
        twitterCard: 'summary_large_image'
      }
    });
    console.log('Created SeoConfig');
  }

  // 5. FooterConfig
  const existingFooter = await prisma.footerConfig.findFirst();
  if (!existingFooter) {
    await prisma.footerConfig.create({
      data: {
        footerText: 'Crafting premium vinyl skins with 0.23mm precision fit.',
        copyrightText: '© 2026 OM Mobile Art. All rights reserved.'
      }
    });
    console.log('Created FooterConfig');
  }

  // 6. AnnouncementBar
  const existingAnnounce = await prisma.announcementBar.findFirst();
  if (!existingAnnounce) {
    await prisma.announcementBar.create({
      data: {
        text: '⚡ Special Launch Offer: Get 10% OFF on all 3M Skins! Use Code: WELCOME10',
        bgColor: '#03045E',
        textColor: '#FFFFFF',
        linkUrl: 'shop/pages/shop.html',
        isActive: true,
        isScrolling: false,
        priority: 1
      }
    });
    console.log('Created AnnouncementBar');
  }

  // 7. SocialLinks
  const socialPlatforms = [
    { platform: 'Instagram', url: 'https://instagram.com/ommobileart', sortOrder: 1 },
    { platform: 'Facebook', url: 'https://facebook.com/ommobileart', sortOrder: 2 },
    { platform: 'WhatsApp', url: 'https://wa.me/919638652327', sortOrder: 3 },
    { platform: 'YouTube', url: 'https://youtube.com/ommobileart', sortOrder: 4 },
    { platform: 'X', url: 'https://x.com/ommobileart', sortOrder: 5 }
  ];

  for (const s of socialPlatforms) {
    const found = await prisma.socialLink.findFirst({ where: { platform: s.platform } });
    if (!found) {
      await prisma.socialLink.create({
        data: {
          platform: s.platform,
          url: s.url,
          sortOrder: s.sortOrder,
          isActive: true
        }
      });
    }
  }

  // 8. LegalPages
  const legalPages = [
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      content: `<h2>Privacy Policy</h2><p>Welcome to OM Mobile Art. Your privacy is critically important to us. This Privacy Policy outlines how we collect, use, and safeguard your personal information when you visit our store or make a purchase.</p><h3>Information We Collect</h3><p>When you place an order, we collect information such as your name, email address, phone number, and shipping address to fulfill your order and provide support.</p><h3>Data Protection</h3><p>We implement strict security measures to maintain the safety of your personal information. We do not sell or trade your data to third parties.</p>`
    },
    {
      slug: 'terms-and-conditions',
      title: 'Terms & Conditions',
      content: `<h2>Terms & Conditions</h2><p>By using our website and purchasing products from OM Mobile Art, you agree to comply with and be bound by the following terms and conditions.</p><h3>Product Usage</h3><p>All mobile skins and protection wraps sold on our website are precision-cut 3M vinyl accessories intended for personal device enhancement.</p>`
    },
    {
      slug: 'refund-policy',
      title: 'Refund Policy',
      content: `<h2>Refund & Return Policy</h2><p>At OM Mobile Art, customer satisfaction is our top priority. If you receive a damaged, defective, or incorrect skin wrap, we offer hassle-free replacements and refunds.</p><h3>Return Eligibility</h3><p>Returns must be reported within 7 days of delivery with photos of the unapplied product.</p>`
    },
    {
      slug: 'shipping-policy',
      title: 'Shipping Policy',
      content: `<h2>Shipping Policy</h2><p>We deliver nationwide across India. Orders are processed within 24-48 hours and shipped via express courier partners.</p><h3>Shipping Costs</h3><p>Free standard shipping is provided on orders above ₹999. Orders below ₹999 incur a flat shipping fee of ₹49.</p>`
    },
    {
      slug: 'cancellation-policy',
      title: 'Cancellation Policy',
      content: `<h2>Cancellation Policy</h2><p>Orders can be cancelled prior to dispatch. Once an order has been shipped, it cannot be cancelled but may be returned per our refund policy.</p>`
    }
  ];

  for (const page of legalPages) {
    await prisma.legalPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content },
      create: { ...page, isPublished: true }
    });
  }
  console.log('LegalPages seeded');

  // 9. StoreFeatureToggles
  const featureKeys = [
    { key: 'wishlist', isEnabled: true },
    { key: 'reviews', isEnabled: true },
    { key: 'coupons', isEnabled: true },
    { key: 'guestCheckout', isEnabled: true },
    { key: 'cashOnDelivery', isEnabled: true },
    { key: 'customSkin', isEnabled: true },
    { key: 'inventory', isEnabled: true },
    { key: 'compareProducts', isEnabled: true },
    { key: 'search', isEnabled: true },
    { key: 'announcementBar', isEnabled: true },
    { key: 'maintenanceBanner', isEnabled: false }
  ];

  for (const f of featureKeys) {
    await prisma.storeFeatureToggle.upsert({
      where: { key: f.key },
      update: { isEnabled: f.isEnabled },
      create: f
    });
  }
  console.log('StoreFeatureToggles seeded');

  // 10. MaintenanceConfig
  const existingMaint = await prisma.maintenanceConfig.findFirst();
  if (!existingMaint) {
    await prisma.maintenanceConfig.create({
      data: {
        isActive: false,
        message: "We are currently upgrading our store to bring you better skins. We'll be back shortly!"
      }
    });
  }

  console.log('Settings database initialization completed successfully!');
}

seedSettings()
  .catch((err) => {
    console.error('Error seeding settings:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
