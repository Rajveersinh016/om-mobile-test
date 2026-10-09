/**
 * OM Mobile Art — Breadcrumbs Logic (breadcrumbs.js)
 * Automatically computes and prepends navigation trails to page headings.
 */
(function() {
  'use strict';

  window.AdminBreadcrumbs = {
    inject: (title) => {
      const main = document.querySelector('main');
      if (!main) return;

      // Avoid double breadcrumbs if already injected
      if (main.querySelector('nav[aria-label="Breadcrumb"]')) return;

      const breadcrumb = document.createElement('nav');
      breadcrumb.setAttribute('aria-label', 'Breadcrumb');
      breadcrumb.className = "flex text-secondary text-xs font-semibold mb-4 gap-2";
      breadcrumb.innerHTML = `
        <a href="dashboard.html" class="hover:text-primary transition-colors cursor-pointer">Dashboard</a>
        <span class="text-secondary/50">></span>
        <span class="text-on-surface font-bold">${title}</span>
      `;

      // Find the most appropriate container to prepend into:
      // Typically the first div inside main that has a padding or spacing class,
      // or falls back to main itself.
      let target = main;
      const contentContainer = main.querySelector('div.p-container_padding, div.p-6, div.space-y-6');
      if (contentContainer && contentContainer.parentNode === main) {
        target = contentContainer;
      }

      if (target.firstChild) {
        target.insertBefore(breadcrumb, target.firstChild);
      } else {
        target.appendChild(breadcrumb);
      }
    }
  };
})();
