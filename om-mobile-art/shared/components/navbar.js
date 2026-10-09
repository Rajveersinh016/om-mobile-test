/**
 * OM Mobile Art — Navbar and Footer Component (navbar.js)
 * Dynamically injects a unified premium Announcement Bar, Header Navbar, and Footer across the storefront.
 * Official Brand Palette: Deep Navy (#03045E), Royal Blue (#0077B6), Sky Blue (#00B4D8), Light Cyan (#90E0EF), Very Light Cyan (#CAF0F8).
 */

(function () {
  'use strict';

  // Compute prefix relative path to project root
  const scripts = document.getElementsByTagName('script');
  let prefix = '';
  for (let s of scripts) {
    const src = s.getAttribute('src') || '';
    if (src.includes('shared/components/navbar.js')) {
      prefix = src.split('shared/components/navbar.js')[0];
      break;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 0. Route Protection
    checkRouteProtection();

    // 1. Remove legacy promo bars from DOM
    document.querySelectorAll('body > div[class*="tracking-wide"], body > div[class*="tracking-widest"], body > div[class*="h-[36px]"]').forEach(el => el.remove());

    // 2. Render Announcement Bar, Header & Footer
    renderAnnouncementBar();
    renderGlobalHeader();
    renderGlobalFooter();

    // 3. Initialize dynamic controls
    initNavigation();
    updateHeaderBadges();
    initScrollToTop();
    initStickyHeader();
    initMobileMenu();
    initGlobalSearch();

    // 4. Bind Authentication Profile navigation
    bindProfileNavigation();
  });

  function checkRouteProtection() {
    const path = window.location.pathname.toLowerCase();
    const isProtectedRoute = path.includes('/profile.html') || path.endsWith('/profile') || path.endsWith('/account') || path.endsWith('/my-account');
    if (isProtectedRoute) {
      const currentUser = window.DB ? window.DB.getCurrentUser() : null;
      if (!currentUser) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `${prefix}shop/pages/login.html?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
  }

  function bindProfileNavigation() {
    const handleProfileClick = (e) => {
      e.preventDefault();
      const currentUser = window.DB ? window.DB.getCurrentUser() : null;
      if (currentUser) {
        window.location.href = `${prefix}shop/pages/profile.html`;
      } else {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `${prefix}shop/pages/login.html?redirect=${encodeURIComponent(currentPath)}`;
      }
    };

    const profileBtn = document.getElementById('nav-profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', handleProfileClick);
    }

    const drawerProfileLink = document.getElementById('my-account-drawer-link');
    if (drawerProfileLink) {
      drawerProfileLink.addEventListener('click', handleProfileClick);
    }
  }

  window.addEventListener('cart-updated', updateHeaderBadges);
  window.addEventListener('wishlist-updated', updateHeaderBadges);
  window.addEventListener('popstate', initNavigation);
  window.addEventListener('hashchange', initNavigation);

  // ─── Announcement Bar Injection ──────────────────────────────────────────────

  async function renderAnnouncementBar() {
    let bar = document.getElementById('global-announcement-bar');

    if (sessionStorage.getItem('om_announcement_dismissed') === 'true') {
      if (bar) bar.remove();
      return;
    }

    let annObj = null;
    try {
      const res = await fetch('http://localhost:3000/api/v1/homepage/announcement', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.data) {
        annObj = data.data;
      }
    } catch (e) {
      if (window.SettingsManager && sessionStorage.getItem('om_settings_cache')) {
        annObj = JSON.parse(sessionStorage.getItem('om_settings_cache'))?.announcement;
      }
    }

    if (!annObj || annObj.enabled === false || annObj.isActive === false) {
      if (bar) bar.remove();
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'global-announcement-bar';
      document.body.insertBefore(bar, document.body.firstChild);
    }

    const text = annObj.text;
    const bgColor = annObj.bgColor || '#03045E';
    const textColor = annObj.textColor || '#FFFFFF';
    const linkUrl = annObj.linkUrl;
    const isScrolling = Boolean(annObj.isScrolling);
    const iconName = annObj.icon || 'campaign';
    const hasCloseBtn = Boolean(annObj.closeButton);
    const isSticky = Boolean(annObj.sticky);

    bar.className = `w-full h-9 px-4 flex items-center justify-center gap-2 border-b border-[#0077B6]/30 shadow-sm z-50 transition-all overflow-hidden whitespace-nowrap leading-none text-xs ${isSticky ? 'sticky top-0' : 'relative'}`;
    bar.style.backgroundColor = bgColor;
    bar.style.color = textColor;
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';

    const innerContent = `
      <span class="inline-flex items-center gap-1.5 leading-none align-middle">
        <span class="material-symbols-outlined text-[16px] text-[#90E0EF] leading-none inline-flex items-center justify-center align-middle">${iconName}</span>
        <span class="leading-none font-bold uppercase tracking-wider text-xs">${text}</span>
      </span>
      ${linkUrl ? `<a href="${linkUrl}" class="inline-flex items-center gap-1 text-[#90E0EF] hover:text-white transition-colors underline ml-3 font-bold text-xs uppercase tracking-wider leading-none align-middle">
        <span class="leading-none">Shop Now</span>
        <span class="material-symbols-outlined text-[14px] leading-none inline-flex items-center justify-center align-middle">arrow_forward</span>
      </a>` : ''}
    `;

    const closeBtnHtml = hasCloseBtn ? `
      <button onclick="sessionStorage.setItem('om_announcement_dismissed', 'true'); document.getElementById('global-announcement-bar')?.remove();" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/80 hover:text-white transition-colors flex items-center justify-center cursor-pointer" title="Dismiss announcement">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    ` : '';

    if (isScrolling) {
      bar.innerHTML = `<marquee behavior="scroll" direction="left" scrollamount="6" class="w-full font-bold uppercase tracking-wider cursor-pointer leading-none my-auto align-middle" style="line-height: 1;" onmouseover="this.stop()" onmouseout="this.start()">${innerContent}</marquee>${closeBtnHtml}`;
    } else {
      bar.innerHTML = `<div class="w-full flex items-center justify-center gap-2 leading-none my-auto align-middle" style="line-height: 1;">${innerContent}</div>${closeBtnHtml}`;
    }
  }

  // ─── Header Injection ──────────────────────────────────────────────────────

  function renderGlobalHeader() {
    let header = document.getElementById('shop-header-placeholder') || document.querySelector('header');
    if (!header) {
      header = document.createElement('header');
      const bar = document.getElementById('global-announcement-bar');
      if (bar && bar.parentNode === document.body) {
        document.body.insertBefore(header, bar.nextSibling);
      } else {
        document.body.insertBefore(header, document.body.firstChild);
      }
    }
    header.className = "sticky top-0 z-50 h-[72px] bg-white border-b border-[#E5E7EB] shadow-sm";
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '50';

    const currentUser = window.DB ? window.DB.getCurrentUser() : null;
    const isLoggedIn = !!currentUser;
    const sm = window.SettingsManager;

    let userDisplayName = 'Customer';
    if (currentUser) {
      if (currentUser.name && currentUser.name !== 'null' && currentUser.name.trim() !== '') {
        userDisplayName = currentUser.name;
      } else if (currentUser.email) {
        userDisplayName = currentUser.email.split('@')[0];
      }
    }

    const storeName = sm ? sm.getStoreName() : 'OM Mobile Art';
    const logoUrl = sm ? sm.getLogoUrl() : `${prefix}assets/logos/logo.png`;

    const isCustomSkinOn = sm ? sm.isFeatureEnabled('customSkin') : true;
    const isWishlistOn = sm ? sm.isFeatureEnabled('wishlist') : true;
    const isSearchOn = sm ? sm.isFeatureEnabled('search') : true;

    let accountDropdownHtml = '';
    if (isLoggedIn) {
      accountDropdownHtml = `
        <div class="absolute right-0 mt-2 w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-xl py-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 transform origin-top-right z-50">
          <div class="px-4 py-2 border-b border-[#E5E7EB] mb-1 bg-[#F8FAFC]">
            <p class="text-xs text-gray-500">Logged in as</p>
            <p class="text-sm font-bold text-[#111827] truncate">${userDisplayName}</p>
          </div>
          <a href="${prefix}shop/pages/profile.html" class="flex items-center gap-2 px-4 py-2 text-sm text-[#111827] hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-colors"><span class="material-symbols-outlined text-[18px]">account_circle</span> Profile</a>
          <a href="${prefix}shop/pages/profile.html#orders" class="flex items-center gap-2 px-4 py-2 text-sm text-[#111827] hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-colors"><span class="material-symbols-outlined text-[18px]">shopping_bag</span> Orders</a>
          ${isWishlistOn ? `<a href="${prefix}shop/pages/wishlist.html" class="flex items-center gap-2 px-4 py-2 text-sm text-[#111827] hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-colors"><span class="material-symbols-outlined text-[18px]">favorite</span> Wishlist</a>` : ''}
          <a href="${prefix}shop/pages/profile.html#addresses" class="flex items-center gap-2 px-4 py-2 text-sm text-[#111827] hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-colors"><span class="material-symbols-outlined text-[18px]">home</span> Addresses</a>
          <div class="border-t border-[#E5E7EB] my-1"></div>
          <a href="#" id="nav-logout-btn" class="flex items-center gap-2 px-4 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"><span class="material-symbols-outlined text-[18px]">logout</span> Logout</a>
        </div>
      `;
    }

    if (!document.getElementById('om-navbar-active-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'om-navbar-active-styles';
      styleEl.textContent = `
        header nav a.nav-item {
          position: relative;
          transition: color 200ms ease;
        }
        header nav a.nav-item.active {
          color: #03045E !important;
        }
        header nav a.nav-item.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -4px;
          height: 2.5px;
          background-color: #03045E;
          border-radius: 9999px;
        }
      `;
      document.head.appendChild(styleEl);
    }

    header.innerHTML = `
      <div class="relative store-container h-full flex items-center justify-between">
        <!-- Left Side: Clickable Brand Logo -->
        <a class="flex items-center gap-3 group cursor-pointer" href="${prefix}shop/pages/home.html" id="header-logo-link">
          <div class="w-10 h-10 rounded-[16px] overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-0.5 shadow-md">
            <img src="${logoUrl}" alt="${storeName} Logo" class="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105" data-setting-src="logo" onerror="if(window.handleLogoError) window.handleLogoError(this)" />
          </div>
          <span class="text-lg font-bold text-[#03045E] tracking-tight" data-setting="storeName">${storeName}</span>
        </a>
        
        <!-- Center: Navigation Links -->
        <nav class="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <a data-nav="home" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/home.html">Home</a>
          <a data-nav="shop" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/shop.html">Shop</a>
          <a data-nav="collections" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/collections.html">Collections</a>
          ${isCustomSkinOn ? `<a data-nav="custom_skin" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/custom_skin.html">Custom Skin</a>` : ''}
          <a data-nav="about" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/about.html">About</a>
          <a data-nav="contact" class="nav-item text-xs font-bold uppercase tracking-wider text-[#111827] hover:text-[#0077B6] transition-colors py-1 relative" href="${prefix}shop/pages/contact.html">Contact</a>
        </nav>

        <!-- Right: Header Action Buttons -->
        <div class="flex items-center gap-6">
          ${isSearchOn ? `<a href="${prefix}shop/pages/search_results.html" id="header-search-trigger"><button class="material-symbols-outlined text-[#03045E] hover:text-[#0077B6] transition-all active:scale-90 cursor-pointer">search</button></a>` : ''}
          ${isWishlistOn ? `<a href="${prefix}shop/pages/wishlist.html" class="relative"><button class="material-symbols-outlined text-[#03045E] hover:text-[#0077B6] transition-all active:scale-90 cursor-pointer">favorite</button></a>` : ''}
          <a href="${prefix}shop/pages/cart.html" class="relative" id="header-cart-icon-link">
            <button class="material-symbols-outlined text-[#03045E] hover:text-[#0077B6] transition-all active:scale-90 cursor-pointer">shopping_bag</button>
            <span class="absolute -top-1 -right-1 bg-[#03045E] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold" style="display: none;">0</span>
          </a>
          
          <!-- My Account Dropdown Trigger -->
          <div class="relative ${isLoggedIn ? 'group' : ''} py-2" id="my-account-dropdown-trigger">
            <button id="nav-profile-btn" class="flex items-center transition-transform duration-200 active:scale-95 cursor-pointer">
              <span class="material-symbols-outlined text-[#03045E] hover:text-[#0077B6] transition-all">person</span>
            </button>
            ${accountDropdownHtml}
          </div>
        </div>
      </div>
    `;

    // Logout Click handler
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.showConfirm("Logout?", "Are you sure you want to log out of your account?", async () => {
          if (window.API && window.API.logout) {
            try {
              await window.API.logout();
            } catch (err) {
              console.error("Backend logout error:", err);
            }
          }
          if (window.DB) window.DB.logoutUser();
          localStorage.removeItem('om_auth_token');
          localStorage.removeItem('om_user_session');
          window.showToast("Logged out successfully.", "info");
          setTimeout(() => {
            window.location.href = `${prefix}shop/pages/home.html`;
          }, 800);
        });
      });
    }
  }

  // ─── Footer Injection ──────────────────────────────────────────────────────

  function renderGlobalFooter() {
    let footer = document.querySelector('footer');
    if (!footer) {
      footer = document.createElement('footer');
      document.body.appendChild(footer);
    }

    const sm = window.SettingsManager;
    const storeName = sm ? sm.getStoreName() : 'OM Mobile Art';
    const logoUrl = sm ? sm.getLogoUrl() : `${prefix}assets/logos/logo.png`;
    const copyright = (sm && sm.loadSettings) ? (sessionStorage.getItem('om_settings_cache') ? JSON.parse(sessionStorage.getItem('om_settings_cache'))?.footer?.copyrightText : null) || `© ${new Date().getFullYear()} ${storeName}. All rights reserved.` : `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;
    const footerText = (sm && sm.loadSettings) ? (sessionStorage.getItem('om_settings_cache') ? JSON.parse(sessionStorage.getItem('om_settings_cache'))?.footer?.footerText : null) || "Crafting the world's most precise and stylish mobile skins. Your device, our canvas." : "Crafting the world's most precise and stylish mobile skins. Your device, our canvas.";

    footer.className = "w-full py-16 bg-[#03045E] text-white";
    footer.innerHTML = `
      <div class="store-container">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div class="space-y-4">
            <a class="flex items-center gap-3 group cursor-pointer" href="${prefix}shop/pages/home.html">
              <div class="w-10 h-10 rounded-[16px] overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-0.5 shadow-md">
                <img src="${logoUrl}" alt="${storeName} Logo" class="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105" data-setting-src="logo" onerror="if(window.handleLogoError) window.handleLogoError(this)" />
              </div>
              <span class="text-lg font-bold text-white tracking-tight" data-setting="storeName">${storeName}</span>
            </a>
            <p class="text-[#CAF0F8]/80 text-sm leading-relaxed" data-setting="footerText">${footerText}</p>
            <div id="footer-social-links" class="flex gap-4 social-links-container"></div>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-white mb-4">Brand Info</h4>
            <ul class="space-y-2">
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/about.html">About Us</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/about.html#materials">Our Materials</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/contact.html">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-white mb-4">Support & Policy</h4>
            <ul class="space-y-2">
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/installation_guide.html">Installation Guide</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/shipping_policy.html">Shipping Policy</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/refund_policy.html">Returns & Refunds</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/privacy_policy.html">Privacy Policy</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/terms_conditions.html">Terms & Conditions</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-white mb-4">Quick Links</h4>
            <ul class="space-y-2">
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/shop.html">Shop All</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/collections.html">Collections</a></li>
              <li><a class="text-[#CAF0F8] hover:text-[#90E0EF] text-sm transition-colors" href="${prefix}shop/pages/faq.html">FAQ</a></li>
              <li><a class="text-[#90E0EF] hover:text-white text-sm transition-colors font-bold" href="${prefix}admin/pages/login.html">Admin Panel</a></li>
            </ul>
          </div>
        </div>
        <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-[#CAF0F8]/70 text-xs" data-setting="copyrightText">${copyright}</p>
          <div class="flex gap-6">
            <a class="text-[#CAF0F8]/70 hover:text-[#90E0EF] text-xs transition-colors" href="${prefix}shop/pages/privacy_policy.html">Privacy Policy</a>
            <a class="text-[#CAF0F8]/70 hover:text-[#90E0EF] text-xs transition-colors" href="${prefix}shop/pages/terms_conditions.html">Terms & Conditions</a>
          </div>
        </div>
      </div>
    `;

    if (sm && sm.renderSocialLinks) sm.renderSocialLinks();
  }

  // ─── Highlight Active Links ─────────────────────────────────────────────────

  function getActiveTabKey() {
    const path = window.location.pathname.toLowerCase();
    const filename = path.split('/').pop() || '';

    // 1. HOME
    if (
      path === '/' ||
      path === '' ||
      filename === '' ||
      filename === 'index.html' ||
      filename === 'home.html' ||
      filename === 'home'
    ) {
      return 'home';
    }

    // 2. COLLECTIONS (including collection details)
    if (
      filename === 'collections.html' ||
      filename === 'collections' ||
      filename === 'collection_detail.html' ||
      filename === 'collection_detail' ||
      path.includes('/collections/') ||
      path.includes('/collections.html') ||
      path.includes('/collection_detail') ||
      path.includes('/collection/')
    ) {
      return 'collections';
    }

    // 3. CUSTOM SKIN
    if (
      filename === 'custom_skin.html' ||
      filename === 'custom_skin' ||
      filename === 'custom-skin.html' ||
      filename === 'custom-skin' ||
      filename === 'customizer.html' ||
      filename === 'customizer' ||
      path.includes('/custom_skin') ||
      path.includes('/custom-skin') ||
      path.includes('/customizer') ||
      path.includes('/custom/')
    ) {
      return 'custom_skin';
    }

    // 4. ABOUT
    if (
      filename === 'about.html' ||
      filename === 'about' ||
      path.includes('/about.html') ||
      path.includes('/about')
    ) {
      return 'about';
    }

    // 5. CONTACT
    if (
      filename === 'contact.html' ||
      filename === 'contact' ||
      path.includes('/contact.html') ||
      path.includes('/contact')
    ) {
      return 'contact';
    }

    // 6. SHOP (including product details, categories, device selector)
    if (
      filename === 'shop.html' ||
      filename === 'shop' ||
      filename === 'product_detail.html' ||
      filename === 'product_detail' ||
      filename === 'device_selector.html' ||
      filename === 'device_selector' ||
      path.includes('/product/') ||
      path.includes('/product_detail') ||
      path.includes('/category/') ||
      path.includes('/shop.html') ||
      path === '/shop' ||
      (path.includes('/shop/') && !path.includes('/shop/pages/'))
    ) {
      return 'shop';
    }

    return null;
  }

  function getLinkNavKey(link) {
    const dataKey = link.getAttribute('data-nav');
    if (dataKey) return dataKey;

    const href = (link.getAttribute('href') || '').toLowerCase();
    const page = href.split('/').pop() || '';

    if (page.includes('home') || href.endsWith('/')) return 'home';
    if (page.includes('shop') || page.includes('product')) return 'shop';
    if (page.includes('collection')) return 'collections';
    if (page.includes('custom')) return 'custom_skin';
    if (page.includes('about')) return 'about';
    if (page.includes('contact')) return 'contact';

    return null;
  }

  function initNavigation() {
    const activeKey = getActiveTabKey();

    // 1. Desktop Header Nav
    document.querySelectorAll('header nav a').forEach(link => {
      const key = getLinkNavKey(link);
      if (key && key === activeKey) {
        link.classList.add('active', 'text-[#03045E]');
        link.classList.remove('text-[#111827]');
      } else {
        link.classList.remove('active', 'text-[#03045E]');
        link.classList.add('text-[#111827]');
      }
    });

    // 2. Mobile Menu Drawer Nav
    document.querySelectorAll('.mobile-menu-drawer nav a').forEach(link => {
      const key = getLinkNavKey(link);
      if (key && key === activeKey) {
        link.classList.add('bg-[#90E0EF]/30', 'text-[#03045E]', 'font-bold');
        link.classList.remove('text-[#111827]', 'font-medium');
      } else {
        link.classList.remove('bg-[#90E0EF]/30', 'text-[#03045E]', 'font-bold');
        link.classList.add('text-[#111827]', 'font-medium');
      }
    });
  }

  // ─── Badge Counts ──────────────────────────────────────────────────────────

  function updateHeaderBadges() {
    if (!window.DB) return;

    const cart = window.DB.getCart() || [];
    const cartCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    const cartBadge = document.querySelector('#header-cart-icon-link span');
    if (cartBadge) {
      cartBadge.textContent = cartCount;
      cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
    }

    const wishlist = window.DB.getWishlist() || [];
    const wishlistWrapper = document.querySelector('header a[href*="wishlist"]');
    if (wishlistWrapper) {
      let badge = wishlistWrapper.querySelector('.wishlist-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'wishlist-badge absolute -top-1 -right-1 bg-[#03045E] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold';
        wishlistWrapper.style.position = 'relative';
        wishlistWrapper.appendChild(badge);
      }
      badge.textContent = wishlist.length;
      badge.style.display = wishlist.length > 0 ? 'flex' : 'none';
    }
  }

  // ─── Scroll To Top ─────────────────────────────────────────────────────────

  function initScrollToTop() {
    let btn = document.getElementById('scroll-to-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'scroll-to-top';
      btn.title = 'Back to top';
      btn.className = 'fixed bottom-6 right-6 z-40 bg-[#03045E] text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 translate-y-20 opacity-0 hover:bg-[#0077B6] hover:scale-105 active:scale-95';
      btn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
      document.body.appendChild(btn);
      btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
    window.addEventListener('scroll', () => {
      const hidden = window.scrollY <= 300;
      btn.classList.toggle('translate-y-20', hidden);
      btn.classList.toggle('opacity-0', hidden);
    });
  }

  // ─── Sticky Header Shadow & Blur ──────────────────────────────────────────

  function initStickyHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    header.style.transition = 'transform 400ms ease, background-color 300ms ease, box-shadow 300ms ease, backdrop-filter 300ms ease';
    
    const updateStickyState = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 20) {
        header.classList.add('shadow-md');
        header.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        header.style.backdropFilter = 'blur(16px)';
        header.style.webkitBackdropFilter = 'blur(16px)';
      } else {
        header.classList.remove('shadow-md');
        header.style.backgroundColor = '#FFFFFF';
        header.style.backdropFilter = '';
        header.style.webkitBackdropFilter = '';
      }

      header.style.transform = 'translateY(0)';
    };

    window.addEventListener('scroll', updateStickyState, { passive: true });
    updateStickyState();
  }

  // ─── Mobile Menu Drawer ────────────────────────────────────────────────────

  function initMobileMenu() {
    const header = document.querySelector('header');
    if (!header) return;

    const container = header.querySelector('div[class*="max-w"]');
    if (!container) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mobile-menu-btn md:hidden material-symbols-outlined text-[#03045E] hover:text-[#0077B6] transition-transform active:scale-90';
    toggleBtn.setAttribute('aria-label', 'Open menu');
    toggleBtn.textContent = 'menu';
    container.insertBefore(toggleBtn, container.firstElementChild);

    const drawer = document.createElement('div');
    drawer.className = 'mobile-menu-drawer fixed inset-y-0 left-0 w-72 bg-white z-50 -translate-x-full shadow-2xl flex flex-col p-6 border-r border-[#E5E7EB]';
    drawer.style.transition = 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)';
    drawer.innerHTML = `
      <div class="flex items-center justify-between border-b border-[#E5E7EB] pb-4 mb-6">
        <span class="text-[#03045E] font-bold text-lg">OM Mobile Art</span>
        <button class="close-menu-btn material-symbols-outlined text-gray-500 hover:text-[#03045E] transition-transform active:scale-90" aria-label="Close menu">close</button>
      </div>
      <nav class="flex flex-col gap-1">
        <a data-nav="home" href="${prefix}shop/pages/home.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">home</span>Home</a>
        <a data-nav="shop" href="${prefix}shop/pages/shop.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">storefront</span>Shop</a>
        <a data-nav="collections" href="${prefix}shop/pages/collections.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">grid_view</span>Collections</a>
        <a data-nav="custom_skin" href="${prefix}shop/pages/custom_skin.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">draw</span>Custom Skin</a>
        <a data-nav="about" href="${prefix}shop/pages/about.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">info</span>About Us</a>
        <a data-nav="contact" href="${prefix}shop/pages/contact.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">chat</span>Contact Us</a>
      </nav>
      <div class="mt-auto border-t border-[#E5E7EB] pt-4 space-y-1">
        <a href="${prefix}shop/pages/profile.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">account_circle</span>My Account</a>
        <a href="${prefix}shop/pages/wishlist.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">favorite</span>Wishlist</a>
        <a href="${prefix}shop/pages/cart.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#90E0EF]/30 hover:text-[#0077B6] transition-all text-sm font-medium"><span class="material-symbols-outlined text-[20px]">shopping_bag</span>Cart</a>
      </div>
    `;
    document.body.appendChild(drawer);

    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay fixed inset-0 bg-black/40 z-40 hidden opacity-0';
    overlay.style.transition = 'opacity 300ms ease';
    document.body.appendChild(overlay);

    const navLinks = drawer.querySelectorAll('nav a, div.mt-auto a');
    navLinks.forEach((link, idx) => {
      link.style.opacity = '0';
      link.style.transform = 'translateX(-16px)';
      link.style.transition = `opacity 350ms ease ${idx * 40}ms, transform 350ms ease ${idx * 40}ms`;
    });

    const open = () => {
      drawer.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
      setTimeout(() => {
        overlay.classList.add('opacity-100');
        navLinks.forEach(link => {
          link.style.opacity = '1';
          link.style.transform = 'translateX(0)';
        });
      }, 10);
    };

    const close = () => {
      drawer.classList.add('-translate-x-full');
      overlay.classList.remove('opacity-100');
      setTimeout(() => {
        overlay.classList.add('hidden');
        navLinks.forEach(link => {
          link.style.opacity = '0';
          link.style.transform = 'translateX(-16px)';
        });
      }, 300);
    };

    toggleBtn.addEventListener('click', open);
    drawer.querySelector('.close-menu-btn').addEventListener('click', close);
    overlay.addEventListener('click', close);
  }

  // ─── Global Search Modal ───────────────────────────────────────────────────

  function initGlobalSearch() {
    const searchTrigger = document.getElementById('header-search-trigger');
    if (searchTrigger) {
      searchTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openSearchModal();
      });
    }
  }

  function openSearchModal() {
    let modal = document.getElementById('global-search-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-search-modal';
      modal.className = 'fixed inset-0 bg-black/50 z-[100] flex justify-center p-4 pt-[10vh] backdrop-blur-sm opacity-0 pointer-events-none';
      modal.style.transition = 'opacity 300ms ease';
      modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-xl shadow-2xl h-fit overflow-hidden border border-[#E5E7EB] flex flex-col transform scale-95 opacity-0">
          <div class="flex items-center p-4 border-b border-[#E5E7EB]">
            <span class="material-symbols-outlined text-gray-400 mr-3">search</span>
            <input type="text" id="global-search-input" class="w-full border-none focus:ring-0 text-sm text-[#111827] placeholder:text-gray-400 outline-none h-10" placeholder="Search products, brands, or collections..." autocomplete="off">
            <button class="material-symbols-outlined text-gray-500 hover:text-[#03045E] ml-3 close-search-btn">close</button>
          </div>
          <div id="global-search-results" class="max-h-[350px] overflow-y-auto p-4 space-y-4"></div>
          <div class="bg-[#F8FAFC] px-6 py-3 border-t border-[#E5E7EB] flex justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Press Enter to search all</span>
            <span>Matches products, brands, collections</span>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const input = modal.querySelector('#global-search-input');
      const results = modal.querySelector('#global-search-results');
      const modalBox = modal.querySelector('.bg-white');
      
      modalBox.style.transition = 'transform 400ms ease, opacity 400ms ease';

      const closeSearch = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalBox.classList.add('scale-95', 'opacity-0');
      };

      modal.querySelector('.close-search-btn').addEventListener('click', closeSearch);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeSearch(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('opacity-0')) closeSearch(); });

      input.addEventListener('input', window.OM ? window.OM.debounce(handleSearch, 200) : handleSearch);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          window.location.href = `${prefix}shop/pages/search_results.html?query=${encodeURIComponent(input.value.trim())}`;
        }
      });

      function handleSearch(e) {
        const query = (e.target || input).value.trim().toLowerCase();
        if (!query || !window.DB) { results.innerHTML = ''; return; }

        const products = window.DB.getProducts().filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.collection.toLowerCase().includes(query)).slice(0, 5);
        const collections = window.DB.getCollections().filter(c => c.name.toLowerCase().includes(query)).slice(0, 2);

        let html = '';
        if (collections.length) {
          html += `<div class="space-y-2"><h5 class="text-xs font-bold text-[#03045E] uppercase tracking-wider">Collections</h5><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;
          collections.forEach(c => { html += `<a href="${prefix}shop/pages/shop.html?collection=${encodeURIComponent(c.name)}" class="flex items-center gap-3 p-2 hover:bg-[#90E0EF]/30 rounded-lg transition-colors"><div class="w-10 h-10 rounded bg-cover bg-center flex-shrink-0" style="background-image:url('${c.image}')"></div><span class="text-sm font-semibold">${c.name}</span></a>`; });
          html += `</div></div>`;
        }
        if (products.length) {
          html += `<div class="space-y-2 pt-2 border-t border-[#E5E7EB]"><h5 class="text-xs font-bold text-[#03045E] uppercase tracking-wider">Products</h5><div class="space-y-1">`;
          products.forEach(p => {
            const price = window.OM ? window.OM.formatPrice(p.price) : '₹' + Math.round(p.price * 80).toLocaleString('en-IN');
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            const name = p.name.replace(regex, `<mark class="bg-[#90E0EF] rounded-sm px-0.5">$1</mark>`);
            html += `<a href="${prefix}shop/pages/product_detail.html?id=${p.id}" class="flex items-center justify-between p-2 hover:bg-[#90E0EF]/30 rounded-lg transition-colors"><div class="flex items-center gap-3"><img src="${p.image}" class="w-12 h-12 object-cover rounded bg-[#F8FAFC] border border-[#E5E7EB] flex-shrink-0"><div><h6 class="text-sm font-medium">${name}</h6><p class="text-xs text-gray-500">${p.brand} · ${p.collection}</p></div></div><span class="font-bold text-[#03045E] text-sm flex-shrink-0">${price}</span></a>`;
          });
          html += `</div></div>`;
        }
        if (!products.length && !collections.length) {
          html = `<div class="text-center text-gray-500 py-8"><span class="material-symbols-outlined text-4xl block mb-2">find_in_page</span><p class="text-sm">No results for "${query}"</p></div>`;
        }
        
        results.innerHTML = html;
        results.querySelectorAll('a').forEach((el, index) => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(10px)';
          el.style.transition = `opacity 300ms ease ${index * 30}ms, transform 300ms ease ${index * 30}ms`;
          requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          });
        });
      }
    }

    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      const modalBox = modal.querySelector('.bg-white');
      modalBox.classList.remove('scale-95', 'opacity-0');
      modalBox.classList.add('scale-100', 'opacity-100');
      modal.querySelector('#global-search-input').focus();
    }, 10);
  }

})();
