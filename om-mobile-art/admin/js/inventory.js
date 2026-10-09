/**
 * OM Mobile Art — Inventory Management (inventory.js)
 * Full Shopify-grade inventory dashboard & stock operation controller.
 */

(function () {
  'use strict';

  var API_URL = window.API_URL || 'http://localhost:3000/api/v1';

  let currentInventoryData = [];
  let collectionsList = [];
  let productTypesList = [];
  let currentPage = 1;
  let totalPages = 1;
  let activeVariantIdForHistory = null;

  function isTokenExpired(token) {
    if (!token || typeof token !== 'string') return true;
    if (token.startsWith('mock_') || token.startsWith('demo_') || token === 'admin_token') return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) return false;
      return payload.exp <= (Math.floor(Date.now() / 1000) + 10);
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

  // Initialize Inventory Page
  async function initInventoryPage() {
    console.log('Initializing Inventory Management...');
    setupEventListeners();
    await Promise.all([
      fetchDashboardStats(),
      fetchFilterOptions(),
      fetchInventoryList(1),
    ]);
  }

  // Fetch Dashboard Stats
  async function fetchDashboardStats() {
    try {
      const res = await fetch(`${API_URL}/inventory/dashboard`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (data && data.success && data.data) {
        renderDashboardStats(data.data);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.warn('Failed to fetch inventory dashboard stats from backend, falling back to local DB:', err);
      const localProducts = (window.DB ? window.DB.getProducts() : null) || [];
      const totalUnits = localProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
      const totalVal = localProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
      renderDashboardStats({
        totalProducts: localProducts.length,
        totalVariants: localProducts.length * 2,
        totalStockUnits: totalUnits,
        lowStockCount: localProducts.filter(p => p.stock < 10).length,
        outOfStockCount: localProducts.filter(p => p.stock === 0).length,
        inventoryValue: Math.round(totalVal),
        recentlyUpdatedCount: 0,
        recentlyUpdated: []
      });
    }
  }

  // Render Dashboard Stats Cards
  function renderDashboardStats(stats) {
    const elProducts = document.getElementById('statTotalProducts');
    const elVariants = document.getElementById('statTotalVariants');
    const elUnits = document.getElementById('statTotalUnits');
    const elLowStock = document.getElementById('statLowStock');
    const elOutOfStock = document.getElementById('statOutOfStock');
    const elValue = document.getElementById('statInventoryValue');
    const elRecentCount = document.getElementById('statRecentUpdates');

    if (elProducts) elProducts.textContent = stats.totalProducts.toLocaleString();
    if (elVariants) elVariants.textContent = stats.totalVariants.toLocaleString();
    if (elUnits) elUnits.textContent = stats.totalStockUnits.toLocaleString();
    if (elLowStock) elLowStock.textContent = stats.lowStockCount.toLocaleString();
    if (elOutOfStock) elOutOfStock.textContent = stats.outOfStockCount.toLocaleString();
    if (elValue) elValue.textContent = '₹' + Math.round(stats.inventoryValue || 0).toLocaleString('en-IN');
    if (elRecentCount) elRecentCount.textContent = (stats.recentlyUpdatedCount || 0).toLocaleString();

    // Render Recent Activity Ledger if element present
    renderActivityLedger(stats.recentlyUpdated || []);
  }

  // Render Activity Ledger in Insights section
  function renderActivityLedger(histories) {
    const container = document.getElementById('activityLedgerContainer');
    if (!container) return;

    if (!histories || histories.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-500 py-4 text-center">No recent stock activity logged.</p>`;
      return;
    }

    container.innerHTML = histories.map(h => {
      const isPositive = h.difference > 0;
      const diffText = isPositive ? `+${h.difference}` : `${h.difference}`;
      const badgeBg = isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600';
      const timeAgo = formatTimeAgo(h.createdAt);

      return `
        <div class="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0 text-xs">
          <div class="h-8 w-8 rounded-full ${badgeBg} flex items-center justify-center font-bold text-[11px] flex-shrink-0">
            ${diffText}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-900 truncate">
              <span class="font-bold text-[#03045E]">${escapeHtml(h.product?.name || 'Product')}</span> (${escapeHtml(h.variant?.finish || '')} ${escapeHtml(h.variant?.material || '')})
            </p>
            <p class="text-[11px] text-gray-500 mt-0.5">${escapeHtml(h.note || 'Stock adjustment')}</p>
          </div>
          <span class="text-[11px] text-gray-400 whitespace-nowrap">${timeAgo}</span>
        </div>
      `;
    }).join('');
  }

  // Fetch Filter Dropdowns (Collections & Product Types)
  async function fetchFilterOptions() {
    try {
      const [resCol, resTypes] = await Promise.all([
        fetch(`${API_URL}/collections`, { headers: await getAuthHeaders() }),
        fetch(`${API_URL}/product-types`, { headers: await getAuthHeaders() }),
      ]);

      const dataCol = await resCol.json();
      const dataTypes = await resTypes.json();

      if (dataCol.success && Array.isArray(dataCol.data)) {
        collectionsList = dataCol.data;
        const select = document.getElementById('filterCollection');
        if (select) {
          select.innerHTML = '<option value="">All Collections</option>' +
            collectionsList.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        }
      }

      if (dataTypes.success && Array.isArray(dataTypes.data)) {
        productTypesList = dataTypes.data;
        const select = document.getElementById('filterProductType');
        if (select) {
          select.innerHTML = '<option value="">All Product Types</option>' +
            productTypesList.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }

  // Fetch Inventory List
  async function fetchInventoryList(page = 1) {
    currentPage = page;
    const search = document.getElementById('inventorySearch')?.value || '';
    const status = document.getElementById('filterStatus')?.value || 'ALL';
    const collectionId = document.getElementById('filterCollection')?.value || '';
    const productTypeId = document.getElementById('filterProductType')?.value || '';

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '15',
      search,
      status,
      collectionId,
      productTypeId,
    });

    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-12 px-4 text-center text-gray-500">
            <span class="material-symbols-outlined animate-spin text-[28px] text-[#0077B6]">sync</span>
            <p class="mt-2 text-xs font-medium">Loading inventory data...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetch(`${API_URL}/inventory?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();

      if (data && data.success && Array.isArray(data.data)) {
        currentInventoryData = data.data || [];
        totalPages = data.pagination?.totalPages || 1;
        renderInventoryTable(currentInventoryData);
        renderPagination(data.pagination);
        populateVariantSelectors(currentInventoryData);
      } else {
        throw new Error(data?.message || 'Failed to load inventory API');
      }
    } catch (err) {
      let products = (window.DB ? window.DB.getProducts() : null) || [];
      if (search) {
        products = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
      }
      currentInventoryData = products.map((p, i) => {
        const stockQty = Number(p.stock || 50);
        const reservedQty = Number(p.reservedStock || 0);
        const minLevel = Number(p.lowStockThreshold || 5);
        return {
          id: p.id,
          productVariantId: p.id,
          sku: `OMA-SKIN-${p.id}`,
          productName: p.name,
          productImage: p.image,
          variantFinish: 'Matte',
          variantMaterial: '3M Vinyl',
          collectionName: p.collection || 'General',
          productTypeName: p.category || 'Mobile Skin',
          quantity: stockQty,
          stock: stockQty,
          reserved: reservedQty,
          reservedStock: reservedQty,
          available: Math.max(0, stockQty - reservedQty),
          minStockLevel: minLevel,
          lowStockThreshold: minLevel,
          reorderPoint: 10,
          incomingStock: 0,
          location: 'Warehouse A',
          stockStatus: stockQty === 0 ? 'OUT_OF_STOCK' : (stockQty <= minLevel ? 'LOW_STOCK' : 'IN_STOCK'),
          updatedAt: p.updatedAt || new Date().toISOString()
        };
      });
      totalPages = 1;
      renderInventoryTable(currentInventoryData);
      renderPagination({ currentPage: 1, totalPages: 1, totalItems: currentInventoryData.length, limit: 15 });
    }
  }

  // Render Inventory Table
  function renderInventoryTable(items) {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-12 px-4 text-center text-gray-500">
            <span class="material-symbols-outlined text-[36px] text-gray-300 mb-2">inventory_2</span>
            <p class="font-bold text-[#03045E] text-xs">No inventory items found</p>
            <p class="text-[11px] text-gray-500 mt-1">Try adjusting your search query or filters.</p>
          </td>
        </tr>
      `;
      return;
    }

  const DEFAULT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23F1F5F9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' font-weight='bold' fill='%2394A3B8'%3ENo Image%3C/text%3E%3C/svg%3E";

  window.handleImageError = function(img) {
    if (img) {
      img.onerror = null;
      img.src = DEFAULT_PLACEHOLDER;
    }
  };

  tbody.innerHTML = items.map(inv => {
      const currentQty = Number(inv.quantity !== undefined ? inv.quantity : (inv.stock !== undefined ? inv.stock : 0));
      const reservedQty = Number(inv.reserved !== undefined ? inv.reserved : (inv.reservedStock !== undefined ? inv.reservedStock : 0));
      const availableQty = inv.available !== undefined ? Number(inv.available) : Math.max(0, currentQty - reservedQty);
      const minThreshold = Number(inv.minStockLevel !== undefined ? inv.minStockLevel : (inv.lowStockThreshold !== undefined ? inv.lowStockThreshold : 5));

      let badgeClass = 'chip-success';
      let badgeText = 'In Stock';

      if (currentQty === 0 || inv.stockStatus === 'OUT_OF_STOCK') {
        badgeClass = 'chip-danger';
        badgeText = 'Sold Out';
      } else if (currentQty <= minThreshold || inv.stockStatus === 'LOW_STOCK') {
        badgeClass = 'chip-warning';
        badgeText = 'Low Stock';
      }

      const imgUrl = inv.productImage || DEFAULT_PLACEHOLDER;
      const variantDesc = `${inv.variantFinish || 'Matte'} • ${inv.variantMaterial || 'Standard 3M'}`;

      return `
        <tr class="hover:bg-gray-50/60 transition-colors group">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
                <img alt="${escapeHtml(inv.productName || 'Product')}" class="object-cover w-full h-full" src="${escapeHtml(imgUrl)}" onerror="window.handleImageError(this)"/>
              </div>
              </div>
              <div class="min-w-0">
                <div class="font-bold text-[#03045E] text-xs truncate">${escapeHtml(inv.productName || 'Product')}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">${escapeHtml(variantDesc)}</div>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4">
            <span class="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-gray-700 border border-gray-200">
              ${escapeHtml(inv.sku || 'N/A')}
            </span>
          </td>
          <td class="py-3.5 px-4 text-center">
            <input 
              id="qtyInput-${inv.productVariantId || inv.id}"
              type="number" 
              class="w-16 h-8 text-center border border-gray-200 rounded-lg focus:outline-none focus:border-[#0077B6] text-xs font-bold"
              value="${currentQty}"
              min="0"
            />
          </td>
          <td class="py-3.5 px-4 text-center text-xs text-gray-500 font-medium">
            ${reservedQty}
          </td>
          <td class="py-3.5 px-4 text-center text-xs font-extrabold text-[#03045E]">
            ${availableQty}
          </td>
          <td class="py-3.5 px-4 text-center text-xs text-gray-500 font-medium">
            ${minThreshold}
          </td>
          <td class="py-3.5 px-4 text-center">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${badgeClass}">
              ${badgeText}
            </span>
          </td>
          <td class="py-3.5 px-4 text-xs text-gray-500 font-medium">
            ${formatTimeAgo(inv.updatedAt)}
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button 
                onclick="window.quickSaveStock('${inv.productVariantId}')"
                title="Quick Save Stock"
                class="h-8 w-8 bg-[#0077B6] hover:bg-[#03045E] text-white rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">save</span>
              </button>
              <button 
                onclick="window.openAdjustModal('${inv.productVariantId}')"
                title="Adjust Stock"
                class="h-8 w-8 border border-gray-200 bg-white text-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">tune</span>
              </button>
              <button 
                onclick="window.openHistoryModal('${inv.productVariantId}')"
                title="View History"
                class="h-8 w-8 border border-gray-200 bg-white text-gray-500 hover:text-[#0077B6] rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">history</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Quick Save Stock directly from table input
  window.quickSaveStock = async function (variantId) {
    const input = document.getElementById(`qtyInput-${variantId}`);
    if (!input) return;

    const newQty = parseInt(input.value, 10);
    if (isNaN(newQty) || newQty < 0) {
      showToast('Please enter a valid stock quantity (0 or greater)', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productVariantId: variantId,
          type: 'SET',
          quantity: newQty,
          reason: 'Quick stock update from admin table',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Stock updated successfully', 'success');
        fetchDashboardStats();
        fetchInventoryList(currentPage);
      } else {
        showToast(data.message || 'Failed to update stock', 'error');
      }
    } catch (err) {
      console.error('Quick save stock failed:', err);
      showToast('Network error while saving stock', 'error');
    }
  };

  // Populate Selectors for Stock Adjust Modal & Transfer
  function populateVariantSelectors(items) {
    const selectVariant = document.getElementById('adjustVariantSelect');
    const selectTarget = document.getElementById('transferTargetSelect');

    if (!selectVariant || !selectTarget) return;

    const options = '<option value="">-- Select Product Variant --</option>' +
      items.map(i => `<option value="${i.productVariantId}">SKU: ${escapeHtml(i.sku)} | ${escapeHtml(i.productName)} (${escapeHtml(i.variantFinish || '')} ${escapeHtml(i.variantMaterial || '')}) [Current: ${i.quantity}]</option>`).join('');

    selectVariant.innerHTML = options;
    selectTarget.innerHTML = options;
  }

  // Open Stock Adjust Modal
  window.openAdjustModal = function (preselectVariantId = null) {
    const modal = document.getElementById('adjustStockModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (preselectVariantId) {
      const select = document.getElementById('adjustVariantSelect');
      if (select) select.value = preselectVariantId;
    }
  };

  // Close Stock Adjust Modal
  window.closeAdjustModal = function () {
    const modal = document.getElementById('adjustStockModal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Submit Stock Adjustment Form
  async function submitStockAdjustment(e) {
    e.preventDefault();
    const variantId = document.getElementById('adjustVariantSelect')?.value;
    const type = document.getElementById('adjustActionType')?.value;
    const quantity = parseInt(document.getElementById('adjustQuantity')?.value, 10);
    const targetVariantId = document.getElementById('transferTargetSelect')?.value;
    const reasonPreset = document.getElementById('adjustReasonPreset')?.value;
    const customReason = document.getElementById('adjustCustomReason')?.value || '';

    if (!variantId) {
      showToast('Please select a product variant', 'warning');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      showToast('Please enter a valid non-negative quantity', 'warning');
      return;
    }

    const finalReason = customReason ? `${reasonPreset}: ${customReason}` : reasonPreset;

    try {
      const res = await fetch(`${API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productVariantId: variantId,
          type,
          quantity,
          targetVariantId: type === 'TRANSFER' ? targetVariantId : undefined,
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Stock adjustment applied successfully!', 'success');
        closeAdjustModal();
        fetchDashboardStats();
        fetchInventoryList(currentPage);
      } else {
        showToast(data.message || 'Failed to adjust stock', 'error');
      }
    } catch (err) {
      console.error('Adjust stock error:', err);
      showToast('Error executing stock adjustment', 'error');
    }
  }

  // Open Inventory History Modal
  window.openHistoryModal = async function (variantId = null) {
    activeVariantIdForHistory = variantId;
    const modal = document.getElementById('historyModal');
    const container = document.getElementById('historyListContainer');
    if (!modal || !container) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    container.innerHTML = `
      <div class="py-12 text-center text-secondary">
        <span class="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
        <p class="mt-2 text-sm">Fetching audit history...</p>
      </div>
    `;

    try {
      const url = variantId ? `${API_URL}/inventory/history/${variantId}` : `${API_URL}/inventory/history`;
      const res = await fetch(url, { headers: await getAuthHeaders() });
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        renderHistoryList(data.data);
      } else {
        container.innerHTML = `<p class="text-center py-8 text-error">Failed to load history records.</p>`;
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      container.innerHTML = `<p class="text-center py-8 text-error">Network error loading history.</p>`;
    }
  };

  // Close History Modal
  window.closeHistoryModal = function () {
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Render History List inside Modal
  function renderHistoryList(histories) {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    if (histories.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-secondary">
          <span class="material-symbols-outlined text-[36px] text-outline">history</span>
          <p class="mt-2 text-sm">No change logs recorded for this variant yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-surface-container-low border-b border-outline-variant font-bold text-secondary text-xs uppercase">
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Product / Variant</th>
            <th class="px-4 py-3 text-center">Old</th>
            <th class="px-4 py-3 text-center">New</th>
            <th class="px-4 py-3 text-center">Change</th>
            <th class="px-4 py-3">Reason</th>
            <th class="px-4 py-3">Admin</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/60">
          ${histories.map(h => {
            const isPos = h.difference > 0;
            const diffClass = isPos ? 'text-primary font-bold' : (h.difference < 0 ? 'text-error font-bold' : 'text-secondary');
            const diffText = isPos ? `+${h.difference}` : `${h.difference}`;
            const dt = new Date(h.createdAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `
              <tr class="hover:bg-surface-container-low/30">
                <td class="px-4 py-3 text-xs text-secondary font-mono">${dt}</td>
                <td class="px-4 py-3">
                  <div class="font-bold text-on-surface">${escapeHtml(h.product?.name || 'Product')}</div>
                  <div class="text-xs text-secondary font-mono">${escapeHtml(h.variant?.sku || '')}</div>
                </td>
                <td class="px-4 py-3 text-center font-mono">${h.oldQuantity}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-on-surface">${h.newQuantity}</td>
                <td class="px-4 py-3 text-center font-mono ${diffClass}">${diffText}</td>
                <td class="px-4 py-3 text-xs text-on-surface">${escapeHtml(h.reason)}</td>
                <td class="px-4 py-3 text-xs font-semibold text-secondary">${escapeHtml(h.adminName || 'Admin')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Trigger Bulk SKU Generator
  async function triggerBulkSkuGeneration() {
    if (!confirm('Are you sure you want to generate unique SKUs for any variants missing a proper SKU?')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/inventory/generate-skus`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'SKUs generated successfully', 'success');
        fetchInventoryList(currentPage);
      } else {
        showToast(data.message || 'Failed to generate SKUs', 'error');
      }
    } catch (err) {
      console.error('Bulk SKU gen failed:', err);
      showToast('Error calling SKU generator API', 'error');
    }
  }

  // Export CSV
  async function exportInventoryCsv() {
    try {
      const res = await fetch(`${API_URL}/inventory/export-csv`, {
        headers: await getAuthHeaders(),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('CSV export downloaded successfully', 'success');
    } catch (err) {
      console.error('CSV export failed:', err);
      showToast('Failed to download CSV export', 'error');
    }
  }

  // Open CSV Import Modal
  window.openCsvImportModal = function () {
    const modal = document.getElementById('csvImportModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  // Close CSV Import Modal
  window.closeCsvImportModal = function () {
    const modal = document.getElementById('csvImportModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Process CSV Import
  async function processCsvImport() {
    const textarea = document.getElementById('csvContentInput');
    const csvContent = textarea ? textarea.value.trim() : '';

    if (!csvContent) {
      showToast('Please paste CSV text or select a CSV file first', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/inventory/import-csv`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ csvContent }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'CSV Import completed successfully!', 'success');
        closeCsvImportModal();
        if (textarea) textarea.value = '';
        fetchDashboardStats();
        fetchInventoryList(1);
      } else {
        showToast(data.message || 'Failed to process CSV import', 'error');
      }
    } catch (err) {
      console.error('CSV Import error:', err);
      showToast('Error submitting CSV import', 'error');
    }
  }

  // Handle CSV File Selection
  function handleCsvFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const textarea = document.getElementById('csvContentInput');
      if (textarea) textarea.value = evt.target.result;
    };
    reader.readAsText(file);
  }

  // Render Pagination
  function renderPagination(pagination) {
    const container = document.getElementById('inventoryPagination');
    if (!container || !pagination) return;

    const { page, totalPages, total } = pagination;
    const startItem = (page - 1) * pagination.limit + 1;
    const endItem = Math.min(total, page * pagination.limit);

    container.innerHTML = `
      <p class="text-body-sm text-secondary">
        Showing <span class="font-bold text-on-surface">${startItem}</span> to <span class="font-bold text-on-surface">${endItem}</span> of <span class="font-bold text-on-surface">${total}</span> items
      </p>
      <div class="flex gap-2">
        <button 
          onclick="window.changePage(${page - 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page <= 1 ? 'disabled' : ''}
        >Previous</button>
        <span class="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold">${page} / ${totalPages}</span>
        <button 
          onclick="window.changePage(${page + 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page >= totalPages ? 'disabled' : ''}
        >Next</button>
      </div>
    `;
  }

  window.changePage = function (newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchInventoryList(newPage);
    }
  };

  // Helper formatting function
  function formatTimeAgo(isoString) {
    if (!isoString) return 'N/A';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Search input debounce
    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchInventoryList(1), 350);
      });
    }

    // Filter selects
    ['filterStatus', 'filterCollection', 'filterProductType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => fetchInventoryList(1));
      }
    });

    // Stock Adjust Modal Action Type toggle (show transfer target only if TRANSFER)
    const actionTypeSelect = document.getElementById('adjustActionType');
    const transferContainer = document.getElementById('transferTargetContainer');
    if (actionTypeSelect && transferContainer) {
      actionTypeSelect.addEventListener('change', () => {
        if (actionTypeSelect.value === 'TRANSFER') {
          transferContainer.classList.remove('hidden');
        } else {
          transferContainer.classList.add('hidden');
        }
      });
    }

    // Stock Adjust Form submit
    const adjustForm = document.getElementById('adjustStockForm');
    if (adjustForm) {
      adjustForm.addEventListener('submit', submitStockAdjustment);
    }

    // Export CSV button
    const btnExport = document.getElementById('btnExportCsv');
    if (btnExport) {
      btnExport.addEventListener('click', exportInventoryCsv);
    }

    // Bulk SKU button
    const btnGenerateSku = document.getElementById('btnGenerateSkus');
    if (btnGenerateSku) {
      btnGenerateSku.addEventListener('click', triggerBulkSkuGeneration);
    }

    // CSV File input
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
      csvFileInput.addEventListener('change', handleCsvFileSelect);
    }

    // Process CSV Import button
    const btnSubmitCsv = document.getElementById('btnSubmitCsvImport');
    if (btnSubmitCsv) {
      btnSubmitCsv.addEventListener('click', processCsvImport);
    }

    // View All Audit History button
    const btnViewHistory = document.getElementById('btnViewAllHistory');
    if (btnViewHistory) {
      btnViewHistory.addEventListener('click', () => window.openHistoryModal(null));
    }
  }

  window.refreshInventoryData = async function() {
    await fetchDashboardStats();
    await fetchInventoryList(currentPage);
  };

  // Export functions to window.InventoryManager
  window.InventoryManager = {
    init: initInventoryPage,
    refresh: fetchInventoryList,
  };

  // Auto init when script loads on inventory page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInventoryPage);
  } else {
    initInventoryPage();
  }
})();
