/**
 * OM Mobile Art — Admin Layout Coordinator (navigation.js)
 * Automatically fetches and inserts the reusable sidebar, header, and footer layout components.
 * Manages active states, page titles, auto-updating breadcrumbs, and processes
 * search redirect queries from the global search bar on target listing tables.
 */
(function() {
  'use strict';

  function initNavigation() {
    const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
    if (pageName === 'login') return;

    // Capitalize page title
    const title = document.title.replace(' | OM Admin', '').replace(' | OM Mobile Art Admin', '').replace(' Admin Dashboard', '');

    // Bootstrap sidebar, header, footer, and breadcrumb
    if (window.AdminSidebar) window.AdminSidebar.init();
    if (window.AdminHeader) window.AdminHeader.init(title);
    
    injectFooter();
    if (window.AdminBreadcrumbs) window.AdminBreadcrumbs.inject(title);
    processSearchQueries();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }

  // Fetches and overwrites footer tags dynamically
  function injectFooter() {
    const prefix = window.AdminUtils ? window.AdminUtils.getPrefix() : '../../';
    fetch(prefix + 'admin/components/footer.html')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch footer');
        return res.text();
      })
      .then(html => {
        const footer = document.querySelector('footer');
        if (footer) {
          footer.className = "p-6 pt-0 mt-auto flex justify-between items-center text-secondary text-[11px] font-medium opacity-60";
          footer.innerHTML = html;
        }
      })
      .catch(err => console.error('[OM Admin Footer]', err));
  }

  // Resolves queries like ?search=Stealth and filters local listing inputs automatically
  function processSearchQueries() {
    const searchVal = new URLSearchParams(window.location.search).get('search');
    if (!searchVal) return;

    // Wait slightly for target list scripts to run and bind inputs
    setTimeout(() => {
      const searchInputs = [
        document.getElementById('customer-search'),
        document.getElementById('search-input'),
        document.getElementById('coupon-search'),
        document.getElementById('inventory-search'),
        document.getElementById('admin-search-input')
      ];

      searchInputs.forEach(input => {
        if (input) {
          input.value = searchVal;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }, 400);
  }

  // --- Quick Actions FAB Modal ---
  window.openQuickActionsModal = function() {
    let modal = document.getElementById('admin-quick-actions-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'admin-quick-actions-modal';
      modal.className = 'fixed inset-0 bg-black/50 z-[300] flex justify-center items-center p-4 backdrop-blur-sm transition-opacity duration-300 opacity-0 pointer-events-none';
      modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-outline transform translate-y-[-30px] transition-transform duration-300">
          <div class="flex justify-between items-center p-4 border-b border-outline bg-surface-container-low">
            <h3 class="font-bold text-base">Quick Actions</h3>
            <button onclick="window.closeQuickActionsModal()" class="material-symbols-outlined hover:text-primary cursor-pointer">close</button>
          </div>
          <div class="p-6 space-y-3">
            <button onclick="window.quickAction('add-product')" class="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-primary/10 hover:text-primary rounded-lg font-semibold text-sm transition-all border border-outline text-left cursor-pointer">
              <span class="material-symbols-outlined text-primary">add_shopping_cart</span> Add Product
            </button>
            <button onclick="window.quickAction('create-coupon')" class="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-primary/10 hover:text-primary rounded-lg font-semibold text-sm transition-all border border-outline text-left cursor-pointer">
              <span class="material-symbols-outlined text-primary">sell</span> Create Coupon
            </button>
            <button onclick="window.quickAction('new-collection')" class="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-primary/10 hover:text-primary rounded-lg font-semibold text-sm transition-all border border-outline text-left cursor-pointer">
              <span class="material-symbols-outlined text-primary">category</span> New Collection
            </button>
            <button onclick="window.quickAction('new-customer')" class="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-primary/10 hover:text-primary rounded-lg font-semibold text-sm transition-all border border-outline text-left cursor-pointer">
              <span class="material-symbols-outlined text-primary">person_add</span> New Customer
            </button>
            <button onclick="window.quickAction('generate-report')" class="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-primary/10 hover:text-primary rounded-lg font-semibold text-sm transition-all border border-outline text-left cursor-pointer">
              <span class="material-symbols-outlined text-primary">analytics</span> Generate Report
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    setTimeout(() => {
      modal.classList.remove('opacity-0', 'pointer-events-none');
      modal.querySelector('.bg-white').classList.remove('translate-y-[-30px]');
    }, 50);
  };

  window.closeQuickActionsModal = function() {
    const modal = document.getElementById('admin-quick-actions-modal');
    if (modal) {
      modal.classList.add('opacity-0', 'pointer-events-none');
      modal.querySelector('.bg-white').classList.add('translate-y-[-30px]');
    }
  };

  window.quickAction = function(action) {
    window.closeQuickActionsModal();
    if (action === 'add-product') {
      window.location.href = 'products.html?action=add';
    } else if (action === 'create-coupon') {
      window.location.href = 'coupons.html?action=add';
    } else if (action === 'new-collection') {
      window.location.href = 'collections.html?action=add';
    } else if (action === 'new-customer') {
      window.location.href = 'customers.html?action=add';
    } else if (action === 'generate-report') {
      window.location.href = 'reports.html';
    }
  };
})();
