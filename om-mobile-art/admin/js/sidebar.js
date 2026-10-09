/**
 * OM Mobile Art — Sidebar Logic (sidebar.js)
 * Official Brand Palette: Background #03045E, Hover #0077B6, Active #00B4D8, Active Indicator #90E0EF, Text/Icons White.
 */
(function() {
  'use strict';

  window.AdminSidebar = {
    init: () => {
      const prefix = window.AdminUtils ? window.AdminUtils.getPrefix() : '../../';
      
      fetch(prefix + 'admin/components/sidebar.html?v=' + Date.now())
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch sidebar component');
          return res.text();
        })
        .then(html => {
          const aside = document.querySelector('aside');
          if (aside) {
            aside.className = "fixed left-0 top-0 h-screen w-[220px] bg-[#03045E] border-r border-[#0077B6]/30 flex flex-col py-4 z-50 transition-all duration-300 shadow-xl overflow-hidden";
            aside.innerHTML = html;

            // Compute current active page key cleanly, stripping query strings & hashes
            const pathParts = window.location.pathname.split('/');
            let rawPage = (pathParts.pop() || 'dashboard.html')
              .split('?')[0]
              .split('#')[0]
              .replace(/\.html$/i, '')
              .toLowerCase();

            if (!rawPage || rawPage === 'index' || rawPage === 'home') {
              rawPage = 'dashboard';
            }

            // Route Aliases & Sub-page Mappings
            const routeAliases = {
              'orders_premium': 'orders',
              'order_detail': 'orders',
              'device-types': 'device_types',
              'custom_skin': 'custom_skin_manager',
              'custom-skin': 'custom_skin_manager',
              'home': 'dashboard',
              'index': 'dashboard',
              '': 'dashboard'
            };

            const activePageKey = routeAliases[rawPage] || rawPage;

            // Highlight active navigation link matching current page
            const links = aside.querySelectorAll('#admin-sidebar-nav a');
            links.forEach(link => {
              const pageAttr = (link.getAttribute('data-page') || '').toLowerCase();
              const hrefAttr = (link.getAttribute('href') || '')
                .split('?')[0]
                .split('#')[0]
                .replace(/\.html$/i, '')
                .split('/')
                .pop()
                .toLowerCase();

              const isActive = (pageAttr === activePageKey) || (hrefAttr === activePageKey);

              if (isActive) {
                link.className = "flex items-center text-white font-bold border-l-[4px] border-[#90E0EF] bg-[#0077B6] px-4 py-3 transition-all duration-200 rounded-xl shadow-md";
                const icon = link.querySelector('span.material-symbols-outlined');
                if (icon) icon.className = 'material-symbols-outlined mr-3 text-[20px] text-white';
              } else {
                link.className = "flex items-center text-[#90E0EF]/90 hover:text-white hover:bg-white/10 px-4 py-3 transition-all duration-200 rounded-xl font-medium";
                const icon = link.querySelector('span.material-symbols-outlined');
                if (icon) icon.className = 'material-symbols-outlined mr-3 text-[20px] text-[#90E0EF]/90';
              }
            });

            // Bind routing to all sidebar links
            const navLinks = aside.querySelectorAll('#admin-sidebar-nav a');
            navLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href && href !== '#' && !link.getAttribute('target')) {
                link.addEventListener('click', (e) => {
                  e.preventDefault();
                  if (window.AdminRouter) {
                    window.AdminRouter.goTo(href);
                  } else {
                    window.location.href = href;
                  }
                });
              }
            });

            // Restore collapsed state from local storage
            if (localStorage.getItem('admin_sidebar_collapsed') === 'true') {
              document.body.classList.add('sidebar-collapsed');
              aside.style.width = '64px';
              const mainWrapper = document.querySelector('div.ml-\\[220px\\], main.ml-\\[220px\\], div.ml-\\[240px\\], main.ml-\\[240px\\]');
              if (mainWrapper) mainWrapper.style.marginLeft = '64px';
              aside.querySelectorAll('span:not(.material-symbols-outlined)').forEach(el => el.classList.add('hidden'));
            }

            // Bind Logout Hook
            const logoutBtn = document.getElementById('admin-logout-sidebar');
            if (logoutBtn) {
              logoutBtn.removeAttribute('href');
              logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.showConfirm("Admin Log Out", "Exit administrative panel?", () => {
                  if (window.DB) window.DB.logoutUser();
                  window.showToast("Logged out from admin.", "info");
                  setTimeout(() => {
                    if (window.AdminRouter) {
                      window.AdminRouter.goTo('login.html');
                    } else {
                      window.location.href = 'login.html';
                    }
                  }, 800);
                });
              });
            }
          }
        })
        .catch(err => console.error('[OM Admin Sidebar]', err));
    }
  };
})();
