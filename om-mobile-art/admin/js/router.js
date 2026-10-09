/**
 * OM Mobile Art — Admin Page Router (router.js)
 * Handles all navigation from one centralized place.
 */
(function() {
  'use strict';

  const VALID_PAGES = [
    'dashboard.html',
    'products.html',
    'orders.html',
    'orders_premium.html',
    'customers.html',
    'inventory.html',
    'collections.html',
    'device_types.html',
    'device-types.html',
    'brands.html',
    'models.html',
    'coupons.html',
    'reviews.html',
    'reports.html',
    'settings.html',
    'profile.html',
    'banners.html',
    'homepage_manager.html',
    'custom_skin_manager.html',
    'product_mockups.html',
    'product-mockups.html',
    'mockups.html',
    'login.html',
    '404.html'
  ];

  window.AdminRouter = {
    goTo: (pageName) => {
      let page = pageName.split('?')[0];
      const query = pageName.includes('?') ? '?' + pageName.split('?')[1] : '';
      
      const prefix = page.startsWith('../') ? '../' : '';
      let basePage = page.replace(/^(\.\.\/)+/, '').replace(/^\/admin\//, '').replace(/^admin\//, '');

      if (basePage === 'device-types' || basePage === 'device-types.html' || basePage === 'device_types') basePage = 'device_types.html';
      if (basePage === 'brands' || basePage === 'brands.html') basePage = 'brands.html';
      if (basePage === 'models' || basePage === 'models.html') basePage = 'models.html';
      if (basePage === 'product-mockups' || basePage === 'product-mockups.html' || basePage === 'mockups' || basePage === 'mockups.html' || basePage === 'product_mockups') basePage = 'product_mockups.html';

      let finalPage = basePage;
      if (!finalPage.endsWith('.html') && !finalPage.includes('#')) {
        finalPage = finalPage + '.html';
      }

      if (VALID_PAGES.includes(finalPage) || VALID_PAGES.some(p => finalPage.startsWith(p))) {
        window.location.href = prefix + finalPage + query;
      } else {
        console.warn('[AdminRouter] Page not found:', finalPage);
        window.location.href = '404.html';
      }
    }
  };
})();
