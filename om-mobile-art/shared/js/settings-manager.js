/**
 * OM Mobile Art — Shared Settings Manager (settings-manager.js)
 * Single Source of Truth client wrapper for Website Settings.
 * Automatically fetches live settings from MySQL backend API (GET /api/v1/settings),
 * populates store metadata, updates Navbar, Footer, Announcement Bar, SEO, and enforces Maintenance mode.
 */

(function () {
  'use strict';

  let settingsData = null;

  const SettingsManager = {
    async init() {
      await this.loadSettings();
      this.applyHeadMetadata();
      this.applyDOMBindings();
      this.renderAnnouncementBar();
      this.renderSocialLinks();
      this.checkMaintenanceMode();
      this.setupLiveSyncListeners();
    },

    setupLiveSyncListeners() {
      try {
        if ('BroadcastChannel' in window) {
          const syncChannel = new BroadcastChannel('om_store_sync');
          syncChannel.onmessage = async (event) => {
            if (event.data && (event.data.type === 'SETTINGS_UPDATED' || event.data.type === 'STORE_UPDATED')) {
              console.log('[SettingsManager] Received live sync broadcast:', event.data);
              await this.loadSettings(true);
              this.applyHeadMetadata();
              this.applyDOMBindings();
              this.renderAnnouncementBar();
              this.renderSocialLinks();
              this.checkMaintenanceMode();
            }
          };
        }
      } catch (e) {}

      window.addEventListener('storage', async (e) => {
        if (e.key === 'om_settings_timestamp' || e.key === 'om_settings_cache') {
          console.log('[SettingsManager] Storage event detected settings update.');
          await this.loadSettings(true);
          this.applyHeadMetadata();
          this.applyDOMBindings();
          this.renderAnnouncementBar();
          this.renderSocialLinks();
          this.checkMaintenanceMode();
        }
      });

      window.addEventListener('settings-updated', async () => {
        console.log('[SettingsManager] Custom settings-updated event triggered.');
        await this.loadSettings(true);
        this.applyHeadMetadata();
        this.applyDOMBindings();
        this.renderAnnouncementBar();
        this.renderSocialLinks();
        this.checkMaintenanceMode();
      });
    },

    async loadSettings(forceRefresh = false) {
      if (!forceRefresh && settingsData) return settingsData;

      // Try sessionStorage cache first for rapid rendering
      const cached = sessionStorage.getItem('om_settings_cache');
      if (!forceRefresh && cached) {
        try {
          settingsData = JSON.parse(cached);
        } catch (e) {}
      }

      try {
        const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
        const res = await fetch(`${API_URL}/settings`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            settingsData = json.data;
            sessionStorage.setItem('om_settings_cache', JSON.stringify(settingsData));
          }
        }
      } catch (err) {
        console.warn('SettingsManager: Could not connect to backend settings API, using defaults/cache', err);
      }

      if (!settingsData) {
        settingsData = this.getDefaults();
      }

      return settingsData;
    },

    getDefaults() {
      return {
        store: {
          storeName: 'OM Mobile Art',
          storeTagline: 'Precision-Fit Vinyl Skins & Device Protection',
          businessDescription: 'Premium 3M vinyl skins for mobile devices, laptops, tablets, and cameras.',
          storeUrl: 'http://localhost:8080',
          currencySymbol: '₹',
          currencyCode: 'INR',
          shippingFreeThreshold: 999,
          shippingFlatRate: 49
        },
        brand: {
          primaryLogoUrl: '../../assets/logos/logo.png',
          faviconUrl: '../../assets/logos/favicon.png'
        },
        contact: {
          supportEmail: 'ommobileart09@gmail.com',
          supportPhone: '+91 96386 52327',
          whatsappNumber: '+91 96386 52327',
          officeAddress: '123 Skin Street, Mumbai, Maharashtra 400001, India',
          businessHours: 'Mon - Sat: 10:00 AM - 7:00 PM IST'
        },
        seo: {
          metaTitle: 'OM Mobile Art | Premium Mobile Skins & Protection',
          metaDescription: 'Shop high-quality 3M vinyl skins for mobile phones, laptops, and tablets.',
          keywords: 'mobile skins, laptop skins, vinyl wraps, phone protection'
        },
        footer: {
          footerText: 'Crafting premium vinyl skins with 0.23mm precision fit.',
          copyrightText: '© 2026 OM Mobile Art. All rights reserved.'
        },
        announcement: {
          text: '⚡ Special Launch Offer: Get 10% OFF on all 3M Skins! Use Code: WELCOME10',
          bgColor: '#03045E',
          textColor: '#FFFFFF',
          linkUrl: 'shop/pages/shop.html',
          isActive: true
        },
        maintenance: {
          isActive: false,
          message: "We are currently upgrading our store to bring you better skins. We'll be back shortly!"
        },
        features: {
          wishlist: true,
          reviews: true,
          coupons: true,
          guestCheckout: true,
          cashOnDelivery: true,
          customSkin: true,
          inventory: true,
          compareProducts: true,
          search: true,
          announcementBar: true,
          maintenanceBanner: false
        },
        socialLinks: [],
        legalPages: []
      };
    },

    getStoreName() {
      return settingsData?.store?.storeName || 'OM Mobile Art';
    },

    getStoreTagline() {
      return settingsData?.store?.storeTagline || 'Precision-Fit Vinyl Skins';
    },

    getCurrencySymbol() {
      return settingsData?.store?.currencySymbol || '₹';
    },

    getCurrencyCode() {
      return settingsData?.store?.currencyCode || 'INR';
    },

    getFreeShippingThreshold() {
      return Number(settingsData?.store?.shippingFreeThreshold) || 999;
    },

    getFlatShippingRate() {
      return Number(settingsData?.store?.shippingFlatRate) || 49;
    },

    getSupportEmail() {
      return settingsData?.contact?.supportEmail || 'ommobileart09@gmail.com';
    },

    getMapsEmbedUrl() {
      return settingsData?.contact?.mapsEmbedUrl || 'https://maps.google.com/maps?q=21.2386814,72.8876396+(Om+Mobile+%26+Art)&t=&z=17&ie=UTF8&iwloc=&output=embed';
    },

    getSupportPhone() {
      return settingsData?.contact?.supportPhone || '+91 96386 52327';
    },

    getWhatsappNumber() {
      return settingsData?.contact?.whatsappNumber || '+91 96386 52327';
    },

    getOfficeAddress() {
      return settingsData?.contact?.officeAddress || 'Shop No. - 1, Swadhyaya Complex, Lajamani Chowk, Mota Varachha, Surat - 394101';
    },

    getBusinessHours() {
      return settingsData?.contact?.businessHours || 'Mon - Sat: 10:00 AM - 7:00 PM IST';
    },

    getLogoUrl() {
      const rawUrl = settingsData?.brand?.primaryLogoUrl;
      return this.resolveAssetUrl(rawUrl, '../../assets/logos/logo.png');
    },

    getFaviconUrl() {
      const rawUrl = settingsData?.brand?.faviconUrl;
      return this.resolveAssetUrl(rawUrl, '../../assets/logos/favicon.png');
    },

    resolveAssetUrl(url, fallbackPath) {
      const target = url || fallbackPath;
      if (!target || typeof target !== 'string') return window.DEFAULT_BRAND_LOGO_SVG || '';
      if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
        return target;
      }
      const parts = window.location.pathname.split('/').filter(Boolean);
      let depth = parts.length > 0 && parts[parts.length - 1].includes('.') ? parts.length - 1 : parts.length;
      let cleanPath = target.replace(/^(\.\.\/)+/, '').replace(/^\//, '');
      let prefix = '';
      for (let i = 0; i < depth; i++) {
        prefix += '../';
      }
      return (prefix || './') + cleanPath;
    },

    isFeatureEnabled(key) {
      if (!settingsData?.features) return true;
      if (settingsData.features[key] !== undefined) return Boolean(settingsData.features[key]);
      const lowerKey = String(key).toLowerCase();
      if (settingsData.features[lowerKey] !== undefined) return Boolean(settingsData.features[lowerKey]);
      return true;
    },

    isMaintenanceActive() {
      return Boolean(settingsData?.maintenance?.isActive);
    },

    getMaintenanceMessage() {
      return settingsData?.maintenance?.message || "We are currently upgrading our store to bring you better skins. We'll be back shortly!";
    },

    getLegalPage(slug) {
      const pages = settingsData?.legalPages || [];
      return pages.find(p => p.slug === slug) || null;
    },

    applyHeadMetadata() {
      const s = settingsData?.seo || {};
      const brand = settingsData?.brand || {};

      if (s.metaTitle && document.title.includes('OM Mobile Art')) {
        document.title = s.metaTitle;
      }

      // Favicon & Apple Touch Icon
      const faviconUrl = this.getFaviconUrl();
      if (faviconUrl) {
        const timestamp = brand.updatedAt ? new Date(brand.updatedAt).getTime() : Date.now();
        const cacheBustUrl = faviconUrl.includes('data:') ? faviconUrl : `${faviconUrl}${faviconUrl.includes('?') ? '&' : '?'}v=${timestamp}`;

        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = cacheBustUrl;

        let appleLink = document.querySelector("link[rel='apple-touch-icon']");
        if (!appleLink) {
          appleLink = document.createElement('link');
          appleLink.rel = 'apple-touch-icon';
          document.getElementsByTagName('head')[0].appendChild(appleLink);
        }
        appleLink.href = cacheBustUrl;
      }

      // Meta description & keywords
      if (s.metaDescription) {
        let metaDesc = document.querySelector("meta[name='description']");
        if (metaDesc) metaDesc.setAttribute('content', s.metaDescription);
      }
      if (s.keywords) {
        let metaKey = document.querySelector("meta[name='keywords']");
        if (metaKey) metaKey.setAttribute('content', s.keywords);
      }
    },

    applyDOMBindings() {
      const storeName = this.getStoreName();
      const phone = this.getSupportPhone();
      const whatsapp = this.getWhatsappNumber();
      const email = this.getSupportEmail();
      const address = this.getOfficeAddress();
      const hours = this.getBusinessHours();
      const logoUrl = this.getLogoUrl();
      const mapsUrl = this.getMapsEmbedUrl();

      // Bind text elements with data-setting
      document.querySelectorAll('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (key === 'storeName') el.textContent = storeName;
        else if (key === 'storeTagline') el.textContent = this.getStoreTagline();
        else if (key === 'supportPhone') el.textContent = phone;
        else if (key === 'whatsappNumber') el.textContent = whatsapp;
        else if (key === 'supportEmail') el.textContent = email;
        else if (key === 'officeAddress') el.textContent = address;
        else if (key === 'businessHours') el.textContent = hours;
        else if (key === 'footerText') el.textContent = settingsData?.footer?.footerText || '';
        else if (key === 'copyrightText') el.textContent = settingsData?.footer?.copyrightText || `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;
      });

      // Bind logo images with fallback handler
      document.querySelectorAll('[data-setting-src="logo"]').forEach(img => {
        img.src = logoUrl;
        img.onerror = function () {
          if (window.handleLogoError) window.handleLogoError(this);
        };
      });

      // Bind iframe maps url
      document.querySelectorAll('[data-setting-src="mapsEmbedUrl"]').forEach(iframe => {
        if (mapsUrl) iframe.src = mapsUrl;
      });

      // Bind hrefs
      document.querySelectorAll('[data-setting-href]').forEach(link => {
        const type = link.dataset.settingHref;
        if (type === 'phone') link.href = `tel:${phone.replace(/\s+/g, '')}`;
        else if (type === 'email') link.href = `mailto:${email}`;
        else if (type === 'whatsapp') link.href = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
        else if (type === 'directions') link.href = settingsData?.contact?.mapsShareUrl || 'https://maps.app.goo.gl/t14LWUswCdPH8ShVA';
      });
    },

    renderAnnouncementBar() {
      const ann = settingsData?.announcement;
      const isFeatureOn = this.isFeatureEnabled('announcementBar');
      let barEl = document.getElementById('announcement-bar') || document.getElementById('header-announcement');

      if (!barEl) return;

      if (!isFeatureOn || !ann || ann.isActive === false) {
        barEl.style.display = 'none';
        return;
      }

      barEl.style.display = 'block';
      barEl.style.backgroundColor = ann.bgColor || '#03045E';
      barEl.style.color = ann.textColor || '#FFFFFF';

      const contentEl = barEl.querySelector('.announcement-text') || barEl;
      if (ann.linkUrl) {
        contentEl.innerHTML = `<a href="${ann.linkUrl}" class="hover:underline flex items-center justify-center gap-2">${ann.text}</a>`;
      } else {
        contentEl.textContent = ann.text;
      }
    },

    renderSocialLinks() {
      const links = settingsData?.socialLinks || [];
      const container = document.getElementById('footer-social-links') || document.querySelector('.social-links-container');
      if (!container || links.length === 0) return;

      const getIcon = (platform) => {
        const p = platform.toLowerCase();
        if (p.includes('insta')) return 'photo_camera';
        if (p.includes('face')) return 'share';
        if (p.includes('whats')) return 'chat';
        if (p.includes('you')) return 'play_circle';
        if (p.includes('x') || p.includes('twit')) return 'alternate_email';
        return 'link';
      };

      container.innerHTML = links.map(l => `
        <a href="${l.url}" target="_blank" rel="noopener noreferrer" title="${l.platform}" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
          <span class="material-symbols-outlined text-sm">${getIcon(l.platform)}</span>
        </a>
      `).join('');
    },

    checkMaintenanceMode() {
      if (!this.isMaintenanceActive()) return;

      // Allow admin users to view storefront
      const session = localStorage.getItem('om_user_session');
      if (session) {
        try {
          const u = JSON.parse(session);
          if (u.isAdmin || u.role === 'ADMIN') return;
        } catch (e) {}
      }

      const isMaintenancePage = window.location.pathname.includes('maintenance.html');
      if (isMaintenancePage) return;

      // Inject full screen Maintenance Overlay
      const overlay = document.createElement('div');
      overlay.id = 'maintenance-overlay';
      overlay.className = 'fixed inset-0 z-[99999] bg-[#03045E] text-white flex flex-col items-center justify-center p-6 text-center';
      overlay.innerHTML = `
        <div class="max-w-md space-y-6">
          <div class="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-4xl text-[#CAF0F8]">build</span>
          </div>
          <h1 class="text-3xl font-extrabold tracking-tight">${this.getStoreName()}</h1>
          <p class="text-lg font-medium text-[#CAF0F8]">${this.getMaintenanceMessage()}</p>
          <div class="pt-4 text-xs text-gray-300">
            <p>Support: <a href="mailto:${this.getSupportEmail()}" class="underline font-bold">${this.getSupportEmail()}</a></p>
          </div>
          <div class="pt-6">
            <a href="../../admin/pages/login.html" class="text-xs text-white/50 hover:text-white underline">Admin Access Portal →</a>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  };

  window.SettingsManager = SettingsManager;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SettingsManager.init());
  } else {
    SettingsManager.init();
  }
})();
