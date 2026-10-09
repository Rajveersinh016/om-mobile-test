/**
 * OM Mobile Art — Admin Global Search (search.js)
 * Queries products, orders, customers, collections, and coupons,
 * showing live autocomplete suggestion paths with selection redirects.
 */
(function() {
  'use strict';

  window.AdminSearch = {
    init: () => {
      const input = document.getElementById('admin-search-input');
      const dropdown = document.getElementById('admin-search-dropdown');
      if (!input || !dropdown) return;

      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
          dropdown.classList.add('hidden');
          return;
        }

        const products = window.DB ? window.DB.getProducts() : [];
        const orders = window.DB ? window.DB.getOrders() : [];
        const users = window.DB ? window.DB.getUsers() : [];
        const collections = window.DB ? window.DB.getCollections() : [];
        const coupons = window.DB ? window.DB.getCoupons() : [];
        const reviews = window.DB ? window.DB.getReviews() : [];

        let results = [];

        // Match products
        products.filter(p => p.name.toLowerCase().includes(query) || (p.brand && p.brand.toLowerCase().includes(query))).slice(0, 3).forEach(p => {
          results.push({ label: `Product: ${p.name}`, href: `products.html?search=${encodeURIComponent(p.name)}` });
        });

        // Match orders
        orders.filter(o => o.id.toLowerCase().includes(query)).slice(0, 3).forEach(o => {
          results.push({ label: `Order ID: #${o.id.toUpperCase()}`, href: `orders.html?search=${encodeURIComponent(o.id)}` });
        });

        // Match customers
        users.filter(u => !u.isAdmin && (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))).slice(0, 3).forEach(u => {
          results.push({ label: `Customer: ${u.name} (${u.email})`, href: `customers.html?search=${encodeURIComponent(u.name)}` });
        });

        // Match inventory
        products.filter(p => p.name.toLowerCase().includes(query) || `sku-${p.id}`.toLowerCase().includes(query)).slice(0, 3).forEach(p => {
          results.push({ label: `Inventory: ${p.name} (${p.stock} in stock)`, href: `inventory.html?search=${encodeURIComponent(p.name)}` });
        });

        // Match collections
        collections.filter(c => c.name.toLowerCase().includes(query)).slice(0, 3).forEach(c => {
          results.push({ label: `Collection: ${c.name}`, href: `collections.html?search=${encodeURIComponent(c.name)}` });
        });

        // Match coupons
        coupons.filter(c => c.code.toLowerCase().includes(query)).slice(0, 3).forEach(c => {
          results.push({ label: `Coupon: ${c.code}`, href: `coupons.html?search=${encodeURIComponent(c.code)}` });
        });

        // Match reviews
        reviews.filter(r => (r.author && r.author.toLowerCase().includes(query)) || (r.text && r.text.toLowerCase().includes(query))).slice(0, 3).forEach(r => {
          results.push({ label: `Review by ${r.author}`, href: `reviews.html?search=${encodeURIComponent(r.author)}` });
        });

        // Match reports
        const reportTopics = [
          { name: 'Revenue Reports', keywords: ['revenue', 'sales', 'earnings', 'income', 'reports'] },
          { name: 'Orders Analytics', keywords: ['orders', 'transactions', 'sales', 'analytics'] },
          { name: 'Payment Breakdown', keywords: ['payments', 'upi', 'cards', 'cod', 'razorpay'] },
          { name: 'Churn Analysis', keywords: ['churn', 'weekly', 'movement', 'activity'] }
        ];
        reportTopics.filter(t => t.keywords.some(k => k.includes(query))).forEach(t => {
          results.push({ label: `Reports: ${t.name}`, href: `reports.html` });
        });

        // Render dropdown results
        if (results.length > 0) {
          dropdown.innerHTML = results.map(r => `
            <a href="${r.href}" class="block px-4 py-2 text-xs text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors cursor-pointer">${r.label}</a>
          `).join('');
          dropdown.classList.remove('hidden');
        } else {
          dropdown.innerHTML = `<p class="px-4 py-2 text-xs text-secondary italic">No matches found for "${query}"</p>`;
          dropdown.classList.remove('hidden');
        }
      });

      // Close autocomplete on click outside
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }
  };
})();
