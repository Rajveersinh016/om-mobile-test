/**
 * OM Mobile Art — Admin Panel Orchestrator (admin.js)
 * Automatically loads all individual JS modules, bootstraps the layout,
 * and configures responsive sidebar styling dynamically.
 */
(function() {
  'use strict';

  // Compute prefix relative path to root directory
  const scripts = document.getElementsByTagName('script');
  let prefix = '';
  for (let s of scripts) {
    const src = s.getAttribute('src') || '';
    if (src.includes('admin/js/admin.js') || src.includes('../js/admin.js')) {
      prefix = src.split('js/admin.js')[0];
      break;
    }
  }

  // Prepend shared notifications.js to define window.showConfirm and window.showToast
  const sNotif = document.createElement('script');
  sNotif.src = prefix + '../shared/js/notifications.js';
  sNotif.async = false;
  document.head.appendChild(sNotif);

  const pageName = window.location.pathname.split('/').pop() || 'dashboard.html';

  // Base shared infrastructure files
  const files = [
    'utils.js',
    'auth.js',
    'loader.js',
    'sidebar.js',
    'header.js',
    'search.js',
    'profile.js',
    'notifications.js',
    'breadcrumbs.js',
    'router.js',
    'navigation.js'
  ];

  // Append page-specific module controller
  if (pageName.includes('orders.html')) {
    files.push('orders.js');
  } else if (pageName.includes('customers.html')) {
    files.push('customers.js');
  } else if (pageName.includes('coupons.html')) {
    files.push('coupons.js');
  } else if (pageName.includes('inventory.html')) {
    files.push('inventory.js');
  } else if (pageName.includes('settings.html')) {
    files.push('settings.js');
  } else if (pageName.includes('homepage_manager.html')) {
    files.push('homepage_manager.js');
  } else if (pageName.includes('custom_skin_manager.html')) {
    files.push('custom_skin_manager.js');
  } else {
    files.push('admin_legacy.js');
  }

  files.forEach(f => {
    // Avoid re-injecting if script tag already exists in HTML
    const existing = Array.from(document.scripts).some(s => {
      const src = s.getAttribute('src') || s.src || '';
      return src.includes('/' + f) || src.endsWith(f);
    });
    if (!existing) {
      const s = document.createElement('script');
      s.src = prefix + 'js/' + f;
      s.async = false;
      document.head.appendChild(s);
    }
  });

})();
