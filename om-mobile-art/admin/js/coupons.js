/**
 * OM Mobile Art — Coupon & Discount Management (coupons.js)
 * Full Shopify-grade admin controller for promotional discounts & coupon management.
 */

(function () {
  'use strict';

  const API_URL = 'http://localhost:3000/api/v1';

  let currentCouponsData = [];
  let collectionsList = [];
  let categoriesList = [];
  let brandsList = [];
  let editingCouponId = null;
  let currentPage = 1;
  let totalPages = 1;

  function isTokenExpired(token) {
    if (!token || typeof token !== 'string') return true;
    if (token.startsWith('mock_') || token.startsWith('demo_') || token === 'admin_token') return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) return false;
      const now = Math.floor(Date.now() / 1000);
      return payload.exp <= (now + 10);
    } catch (e) {
      return true;
    }
  }

  async function getAuthHeaders(forceRefresh = false) {
    let token = localStorage.getItem('om_admin_auth_token');
    if ((!token || forceRefresh) && window.getAuthToken) {
      token = await window.getAuthToken(forceRefresh);
    }
    if (!token) {
      token = 'mock_admin_token_' + Date.now();
      localStorage.setItem('om_admin_auth_token', token);
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async function fetchWithAuth(url, options = {}) {
    let headers = await getAuthHeaders();
    let res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) {
      headers = await getAuthHeaders(true);
      res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    }
    return res;
  }

  // Initialize Page
  async function initCouponsPage() {
    console.log('Initializing Coupon & Discount Management...');
    setupEventListeners();
    await Promise.all([
      fetchCouponStats(),
      fetchTargetOptions(),
      fetchCouponsList(1),
    ]);
  }

  // Fetch Reporting Stats
  async function fetchCouponStats() {
    try {
      const res = await fetchWithAuth(`${API_URL}/coupons/stats`);
      const data = await res.json();
      if (data.success && data.data) {
        renderStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch coupon stats from backend:', err);
    }
  }

  function renderStats(stats) {
    const elTotal = document.getElementById('statTotalCoupons');
    const elActive = document.getElementById('statActiveCoupons');
    const elExpired = document.getElementById('statExpiredCoupons');
    const elUsages = document.getElementById('statTotalUsages');
    const elDiscount = document.getElementById('statTotalDiscountGiven');

    if (elTotal) elTotal.textContent = (stats.totalCoupons || 0).toLocaleString();
    if (elActive) elActive.textContent = (stats.activeCoupons || 0).toLocaleString();
    if (elExpired) elExpired.textContent = (stats.expiredCoupons || 0).toLocaleString();
    if (elUsages) elUsages.textContent = (stats.totalUsages || 0).toLocaleString();
    if (elDiscount) elDiscount.textContent = '₹' + (stats.totalDiscountGiven || 0).toLocaleString('en-IN');
  }

  // Fetch Options for Targets (Collections, Categories, Brands)
  async function fetchTargetOptions() {
    try {
      const [resCol, resCat, resBrands] = await Promise.all([
        fetch(`${API_URL}/collections`),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/brands`),
      ]);

      const dataCol = await resCol.json();
      const dataCat = await resCat.json();
      const dataBrands = await resBrands.json();

      if (dataCol.success && Array.isArray(dataCol.data)) collectionsList = dataCol.data;
      if (dataCat.success && Array.isArray(dataCat.data)) categoriesList = dataCat.data;
      if (dataBrands.success && Array.isArray(dataBrands.data)) brandsList = dataBrands.data;

      populateTargetScopeSelects();
    } catch (err) {
      console.warn('Failed to fetch target options from backend, using local DB:', err);
      if (window.DB) {
        collectionsList = window.DB.getCollections() || [];
        categoriesList = [{ id: '1', name: 'Mobile Skins' }, { id: '2', name: 'Laptop Skins' }, { id: '3', name: 'Tablet Skins' }];
        brandsList = window.DB.getBrands() || [];
        populateTargetScopeSelects();
      }
    }
  }

  function populateTargetScopeSelects() {
    const container = document.getElementById('targetScopeItemsContainer');
    if (!container) return;

    const scope = document.getElementById('couponTargetScope')?.value || 'STOREWIDE';

    if (scope === 'STOREWIDE') {
      container.innerHTML = `<p class="text-xs text-secondary italic">This coupon applies to all products across the entire store.</p>`;
      return;
    }

    if (scope === 'COLLECTIONS') {
      container.innerHTML = `
        <label class="block text-xs font-bold text-secondary uppercase mb-1">Select Collections</label>
        <select id="targetCollectionSelect" multiple class="w-full border border-outline-variant rounded-lg p-2 text-xs h-32 focus:ring-primary">
          ${collectionsList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <p class="text-[11px] text-secondary mt-1">Hold Ctrl / Cmd to select multiple collections.</p>
      `;
    } else if (scope === 'CATEGORIES') {
      container.innerHTML = `
        <label class="block text-xs font-bold text-secondary uppercase mb-1">Select Categories</label>
        <select id="targetCategorySelect" multiple class="w-full border border-outline-variant rounded-lg p-2 text-xs h-32 focus:ring-primary">
          ${categoriesList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <p class="text-[11px] text-secondary mt-1">Hold Ctrl / Cmd to select multiple categories.</p>
      `;
    } else if (scope === 'BRANDS') {
      container.innerHTML = `
        <label class="block text-xs font-bold text-secondary uppercase mb-1">Select Brands</label>
        <select id="targetBrandSelect" multiple class="w-full border border-outline-variant rounded-lg p-2 text-xs h-32 focus:ring-primary">
          ${brandsList.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
        </select>
        <p class="text-[11px] text-secondary mt-1">Hold Ctrl / Cmd to select multiple brands.</p>
      `;
    } else if (scope === 'PRODUCTS') {
      container.innerHTML = `
        <label class="block text-xs font-bold text-secondary uppercase mb-1">Target Product IDs / SKUs (Comma Separated)</label>
        <input id="targetProductIdsInput" type="text" placeholder="e.g. OMA-LS4-882, OMA-TDC-105" class="w-full border border-outline-variant rounded-lg p-2.5 text-xs font-mono"/>
      `;
    }
  }

  // Fetch Coupons List
  async function fetchCouponsList(page = 1) {
    currentPage = page;
    const search = document.getElementById('couponSearch')?.value || '';
    const status = document.getElementById('filterCouponStatus')?.value || 'ALL';
    const discountType = document.getElementById('filterDiscountType')?.value || 'ALL';

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '15',
      search,
      status,
      discountType,
    });

    const tbody = document.getElementById('couponsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
            <p class="mt-2 text-sm">Loading coupons...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/coupons?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        currentCouponsData = data.data || [];
        totalPages = data.pagination?.totalPages || 1;
        renderCouponsTable(currentCouponsData);
        renderPagination(data.pagination);
      } else {
        showToast(data.message || 'Failed to load coupons', 'error');
      }
    } catch (err) {
      console.error('Error fetching coupons list from backend:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="px-6 py-12 text-center text-error">
              Failed to connect to backend server.
            </td>
          </tr>
        `;
      }
    }
  }

  // Render Coupons Table
  function renderCouponsTable(items) {
    const tbody = document.getElementById('couponsTableBody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined text-[40px] text-outline mb-2">confirmation_number</span>
            <p class="font-bold text-on-surface">No coupons found</p>
            <p class="text-xs text-secondary mt-1">Create your first coupon discount or adjust search filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(c => {
      let badgeClass = 'chip-success';
      let badgeText = c.status;

      if (c.status === 'EXPIRED') {
        badgeClass = 'chip-danger';
        badgeText = 'Expired';
      } else if (c.status === 'DISABLED' || c.status === 'DRAFT') {
        badgeClass = 'chip-warning';
        badgeText = c.status;
      } else if (c.status === 'SCHEDULED') {
        badgeClass = 'bg-blue-100 text-blue-800 border border-blue-200';
        badgeText = 'Scheduled';
      }

      // Discount text
      let valText = '';
      if (c.discountType === 'PERCENTAGE') {
        valText = `${c.discountValue}% OFF`;
      } else if (c.discountType === 'FIXED') {
        valText = `₹${c.discountValue} OFF`;
      } else if (c.discountType === 'FREE_SHIPPING') {
        valText = 'Free Shipping';
      }

      const globalLimit = c.globalUsageLimit || '∞';
      const usageDisplay = `${c.usageCount || 0} / ${globalLimit}`;

      const dateDisplay = c.endDate
        ? `Until ${new Date(c.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : 'Never Expires';

      return `
        <tr class="hover:bg-surface-container-low/40 transition-colors group">
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20 tracking-wider">
                ${escapeHtml(c.code)}
              </span>
              <button onclick="window.copyToClipboard('${escapeHtml(c.code)}')" title="Copy Code" class="text-secondary hover:text-primary">
                <span class="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
          </td>
          <td class="px-4 py-4">
            <div class="font-body-default font-bold text-on-surface">${escapeHtml(c.name || c.code)}</div>
            <div class="text-xs text-secondary mt-0.5">${escapeHtml(c.description || 'No description')}</div>
          </td>
          <td class="px-4 py-4 font-data-tabular font-bold text-primary text-sm">
            ${valText}
          </td>
          <td class="px-4 py-4 text-center">
            <span class="px-3 py-1 rounded-full text-[11px] font-bold ${badgeClass} uppercase tracking-wider">
              ${badgeText}
            </span>
          </td>
          <td class="px-4 py-4 font-data-tabular text-center text-sm font-semibold text-on-surface">
            ${usageDisplay}
          </td>
          <td class="px-4 py-4 font-data-tabular text-xs text-secondary">
            ${dateDisplay}
          </td>
          <td class="px-6 py-4 text-right">
            <div class="flex items-center justify-end gap-2">
              <button 
                onclick="window.duplicateCoupon('${c.id}')"
                title="Duplicate Coupon"
                class="h-9 w-9 border border-outline-variant bg-white text-secondary hover:text-primary rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-all"
              >
                <span class="material-symbols-outlined text-[18px]">content_copy</span>
              </button>

              <button 
                onclick="window.toggleCouponStatus('${c.id}', '${c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'}')"
                title="${c.status === 'ACTIVE' ? 'Disable Coupon' : 'Enable Coupon'}"
                class="h-9 w-9 border border-outline-variant bg-white ${c.status === 'ACTIVE' ? 'text-amber-600' : 'text-emerald-600'} rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-all"
              >
                <span class="material-symbols-outlined text-[18px]">${c.status === 'ACTIVE' ? 'block' : 'check_circle'}</span>
              </button>

              <button 
                onclick="window.openEditCouponModal('${c.id}')"
                title="Edit Coupon"
                class="h-9 w-9 bg-primary text-white rounded-lg flex items-center justify-center hover:opacity-90 transition-all shadow-xs"
              >
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>

              <button 
                onclick="window.deleteCoupon('${c.id}')"
                title="Delete Coupon"
                class="h-9 w-9 border border-red-200 bg-white text-error rounded-lg flex items-center justify-center hover:bg-red-50 transition-all"
              >
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Copy Code Helper
  window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text);
    showToast(`Code ${text} copied to clipboard!`, 'info');
  };

  // Generate Coupon Code Helper
  window.generateCouponCode = function () {
    const prefixes = ['SAVE', 'DEAL', 'VIP', 'WELCOME', 'OFFER', 'OM'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const code = `${prefix}${num}`;

    const input = document.getElementById('couponCodeInput');
    if (input) input.value = code;
  };

  // Open Create Modal
  window.openCreateCouponModal = function () {
    editingCouponId = null;
    const form = document.getElementById('couponForm');
    if (form) form.reset();

    const modalTitle = document.getElementById('couponModalTitle');
    if (modalTitle) modalTitle.textContent = 'Create New Coupon';

    populateTargetScopeSelects();

    const modal = document.getElementById('couponModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  // Open Edit Modal
  window.openEditCouponModal = async function (id) {
    editingCouponId = id;
    try {
      const res = await fetch(`${API_URL}/coupons/${id}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (!data.success || !data.data) {
        showToast('Failed to load coupon details', 'error');
        return;
      }

      const c = data.data;
      const modalTitle = document.getElementById('couponModalTitle');
      if (modalTitle) modalTitle.textContent = `Edit Coupon (${c.code})`;

      // Populate Form Fields
      document.getElementById('couponCodeInput').value = c.code || '';
      document.getElementById('couponNameInput').value = c.name || '';
      document.getElementById('couponDescInput').value = c.description || '';
      document.getElementById('couponTypeSelect').value = c.discountType || 'PERCENTAGE';
      document.getElementById('couponValueInput').value = c.discountValue || 0;
      document.getElementById('couponStatusSelect').value = c.status || 'ACTIVE';
      document.getElementById('couponPriorityInput').value = c.priority || 0;
      document.getElementById('couponNotesInput').value = c.internalNotes || '';

      // Format Date fields (YYYY-MM-DD)
      if (c.startDate) {
        document.getElementById('couponStartDateInput').value = new Date(c.startDate).toISOString().slice(0, 16);
      } else {
        document.getElementById('couponStartDateInput').value = '';
      }

      if (c.endDate) {
        document.getElementById('couponEndDateInput').value = new Date(c.endDate).toISOString().slice(0, 16);
      } else {
        document.getElementById('couponEndDateInput').value = '';
      }

      // Rules
      const rules = c.rules || {};
      document.getElementById('ruleMinOrderInput').value = rules.minOrderValue ?? c.minCartValue ?? 0;
      document.getElementById('ruleMaxDiscountInput').value = rules.maxDiscountAmount ?? c.maxDiscount ?? '';
      document.getElementById('ruleGlobalLimitInput').value = rules.globalUsageLimit ?? c.globalUsageLimit ?? '';
      document.getElementById('rulePerUserLimitInput').value = rules.perUserUsageLimit ?? c.perUserUsageLimit ?? 1;
      document.getElementById('ruleFirstOrderOnly').checked = Boolean(rules.firstOrderOnly ?? c.firstOrderOnly);
      document.getElementById('ruleExcludeSale').checked = Boolean(rules.excludeSaleProducts);

      // Targets
      const targets = c.targets || {};
      document.getElementById('couponTargetScope').value = targets.targetScope || 'STOREWIDE';
      populateTargetScopeSelects();

      const modal = document.getElementById('couponModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    } catch (err) {
      console.error('Error opening edit coupon modal:', err);
      showToast('Error fetching coupon data', 'error');
    }
  };

  window.closeCouponModal = function () {
    const modal = document.getElementById('couponModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Submit Coupon Create/Update Form
  async function submitCouponForm(e) {
    e.preventDefault();

    const code = document.getElementById('couponCodeInput').value.trim();
    const name = document.getElementById('couponNameInput').value.trim();
    const description = document.getElementById('couponDescInput').value.trim();
    const discountType = document.getElementById('couponTypeSelect').value;
    const discountValue = parseFloat(document.getElementById('couponValueInput').value);
    const status = document.getElementById('couponStatusSelect').value;
    const priority = parseInt(document.getElementById('couponPriorityInput').value, 10) || 0;
    const internalNotes = document.getElementById('couponNotesInput').value.trim();

    const startDate = document.getElementById('couponStartDateInput').value || null;
    const endDate = document.getElementById('couponEndDateInput').value || null;

    const minOrderValue = parseFloat(document.getElementById('ruleMinOrderInput').value) || 0;
    const maxDiscountAmount = parseFloat(document.getElementById('ruleMaxDiscountInput').value) || null;
    const globalUsageLimit = parseInt(document.getElementById('ruleGlobalLimitInput').value, 10) || null;
    const perUserUsageLimit = parseInt(document.getElementById('rulePerUserLimitInput').value, 10) || 1;
    const firstOrderOnly = document.getElementById('ruleFirstOrderOnly').checked;
    const excludeSaleProducts = document.getElementById('ruleExcludeSale').checked;

    const targetScope = document.getElementById('couponTargetScope').value || 'STOREWIDE';

    // Target arrays
    let collectionIds = [];
    let categoryIds = [];
    let brandIds = [];
    let productIds = [];

    if (targetScope === 'COLLECTIONS') {
      const sel = document.getElementById('targetCollectionSelect');
      if (sel) collectionIds = Array.from(sel.selectedOptions).map(o => o.value);
    } else if (targetScope === 'CATEGORIES') {
      const sel = document.getElementById('targetCategorySelect');
      if (sel) categoryIds = Array.from(sel.selectedOptions).map(o => o.value);
    } else if (targetScope === 'BRANDS') {
      const sel = document.getElementById('targetBrandSelect');
      if (sel) brandIds = Array.from(sel.selectedOptions).map(o => o.value);
    } else if (targetScope === 'PRODUCTS') {
      const inp = document.getElementById('targetProductIdsInput');
      if (inp && inp.value) {
        productIds = inp.value.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const payload = {
      code,
      name,
      description,
      discountType,
      discountValue,
      status,
      startDate,
      endDate,
      priority,
      internalNotes,
      rules: {
        minOrderValue,
        maxDiscountAmount,
        globalUsageLimit,
        perUserUsageLimit,
        firstOrderOnly,
        excludeSaleProducts,
      },
      targets: {
        targetScope,
        collectionIds,
        categoryIds,
        brandIds,
        productIds,
      },
    };

    try {
      const url = editingCouponId ? `${API_URL}/coupons/${editingCouponId}` : `${API_URL}/coupons`;
      const method = editingCouponId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingCouponId ? 'Coupon updated successfully!' : 'Coupon created successfully!', 'success');
        closeCouponModal();
        fetchCouponStats();
        fetchCouponsList(currentPage);
      } else {
        showToast(data.message || 'Failed to save coupon', 'error');
      }
    } catch (err) {
      console.error('Coupon form submit error:', err);
      showToast('Network error while saving coupon', 'error');
    }
  }

  // Duplicate Coupon
  window.duplicateCoupon = async function (id) {
    try {
      const res = await fetchWithAuth(`${API_URL}/coupons/${id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Coupon duplicated successfully!', 'success');
        fetchCouponStats();
        fetchCouponsList(1);
      } else {
        showToast(data.message || 'Failed to duplicate coupon', 'error');
      }
    } catch (err) {
      console.error('Duplicate error:', err);
      showToast('Error duplicating coupon', 'error');
    }
  };

  // Toggle Status
  window.toggleCouponStatus = async function (id, newStatus) {
    try {
      const res = await fetchWithAuth(`${API_URL}/coupons/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Coupon status changed to ${newStatus}`, 'success');
        fetchCouponStats();
        fetchCouponsList(currentPage);
      } else {
        showToast(data.message || 'Failed to toggle status', 'error');
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      showToast('Error toggling coupon status', 'error');
    }
  };

  // Delete Coupon
  window.deleteCoupon = async function (id) {
    if (!confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/coupons/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast('Coupon deleted successfully', 'success');
        fetchCouponStats();
        fetchCouponsList(currentPage);
      } else {
        showToast(data.message || 'Failed to delete coupon', 'error');
      }
    } catch (err) {
      console.error('Delete coupon error:', err);
      showToast('Error deleting coupon', 'error');
    }
  };

  // Render Pagination
  function renderPagination(pagination) {
    const container = document.getElementById('couponPagination');
    if (!container || !pagination) return;

    const { page, totalPages, total } = pagination;
    const startItem = (page - 1) * pagination.limit + 1;
    const endItem = Math.min(total, page * pagination.limit);

    container.innerHTML = `
      <p class="text-body-sm text-secondary">
        Showing <span class="font-bold text-on-surface">${startItem}</span> to <span class="font-bold text-on-surface">${endItem}</span> of <span class="font-bold text-on-surface">${total}</span> coupons
      </p>
      <div class="flex gap-2">
        <button 
          onclick="window.changeCouponPage(${page - 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page <= 1 ? 'disabled' : ''}
        >Previous</button>
        <span class="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold">${page} / ${totalPages}</span>
        <button 
          onclick="window.changeCouponPage(${page + 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page >= totalPages ? 'disabled' : ''}
        >Next</button>
      </div>
    `;
  }

  window.changeCouponPage = function (newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchCouponsList(newPage);
    }
  };

  // Setup Event Listeners
  function setupEventListeners() {
    const searchInput = document.getElementById('couponSearch');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchCouponsList(1), 350);
      });
    }

    ['filterCouponStatus', 'filterDiscountType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => fetchCouponsList(1));
    });

    const targetScopeSelect = document.getElementById('couponTargetScope');
    if (targetScopeSelect) {
      targetScopeSelect.addEventListener('change', populateTargetScopeSelects);
    }

    const form = document.getElementById('couponForm');
    if (form) {
      form.addEventListener('submit', submitCouponForm);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCouponsPage);
  } else {
    initCouponsPage();
  }
})();
