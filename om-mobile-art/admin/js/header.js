/**
 * OM Mobile Art — Header Component Controller (header.js)
 * Fetches and injects header.html, configures title headings, ticking clock,
 * admin profiles, notification sub-modules, global search, and sidebar collapse controls.
 */
(function() {
  'use strict';

  window.AdminHeader = {
    init: (title) => {
      const prefix = window.AdminUtils ? window.AdminUtils.getPrefix() : '../../';

      fetch(prefix + 'admin/components/header.html')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch header');
          return res.text();
        })
        .then(html => {
          const header = document.querySelector('header');
          if (header) {
            header.className = "sticky top-0 z-40 h-[60px] bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6";
            header.innerHTML = html;

            // Set dynamic heading title
            const titleEl = document.getElementById('admin-header-title');
            if (titleEl) titleEl.textContent = title;

            // Clock tick
            const timeEl = document.getElementById('admin-time');
            if (timeEl) {
              const tick = () => {
                timeEl.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              };
              tick();
              setInterval(tick, 60000);
            }

            // Initials and profile details
            const initialsEl = document.getElementById('admin-initials');
            const nameEl = document.getElementById('admin-name');
            if (window.DB) {
              const u = window.DB.getCurrentUser();
              if (u) {
                const nameVal = (u.name && u.name !== 'null' && u.name.trim()) ? u.name : (u.email ? u.email.split('@')[0] : 'Administrator');
                if (initialsEl) initialsEl.textContent = nameVal.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
                if (nameEl) nameEl.textContent = nameVal;
              }
            }

            // Boot sub-components inside header container
            if (window.AdminProfile) window.AdminProfile.init();
            if (window.AdminNotification) window.AdminNotification.init();
            if (window.AdminSearch) window.AdminSearch.init();

            // Collapsible Sidebar handler
            const toggleBtn = document.getElementById('sidebar-toggle-btn');
            if (toggleBtn) {
              toggleBtn.addEventListener('click', () => {
                const aside = document.querySelector('aside');
                const body = document.body;
                const mainWrapper = document.querySelector('div.ml-\\[220px\\], main.ml-\\[220px\\], div.ml-\\[240px\\], main.ml-\\[240px\\]');
                
                if (aside) {
                  body.classList.toggle('sidebar-collapsed');
                  const collapsed = body.classList.contains('sidebar-collapsed');
                  localStorage.setItem('admin_sidebar_collapsed', collapsed);

                  if (collapsed) {
                    aside.style.width = '64px';
                    if (mainWrapper) mainWrapper.style.marginLeft = '64px';
                    aside.querySelectorAll('span:not(.material-symbols-outlined)').forEach(el => el.classList.add('hidden'));
                  } else {
                    aside.style.width = '220px';
                    if (mainWrapper) mainWrapper.style.marginLeft = '220px';
                    aside.querySelectorAll('span:not(.material-symbols-outlined)').forEach(el => el.classList.remove('hidden'));
                  }
                }
              });
            }
          }
        })
        .catch(err => console.error('[OM Admin Header]', err));
    }
  };
})();
