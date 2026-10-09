/**
 * OM Mobile Art — Order Management (orders.js)
 * Full Shopify-grade Admin Order Management Controller.
 */

(function () {
  'use strict';

  const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

  let currentOrders = [];
  let activeOrder = null;
  let selectedOrderIds = [];
  let currentPage = 1;
  let totalPages = 1;

  function resolveImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
      return clean;
    }
    const backendBase = (API_URL || 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '');
    return `${backendBase}${clean.startsWith('/') ? '' : '/'}${clean}`;
  }

  function formatDeviceDisplay(item) {
    if (!item) return '-';
    let brand = (item.deviceBrand || item.brandName || '').trim();
    let model = (item.customModelName || item.deviceModel || item.deviceName || '').trim();

    // Never use store name as hardware device brand
    if (brand.toLowerCase() === 'om mobile art') {
      brand = '';
    }

    if (!brand && !model) return '-';

    if (brand && model) {
      if (model.toLowerCase().startsWith(brand.toLowerCase())) {
        return model;
      }
      return `${brand} ${model}`;
    }
    return brand || model;
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

  async function fetchWithAuthRetry(url, options = {}) {
    let headers = await getAuthHeaders();
    options.headers = { ...(options.headers || {}), ...headers };
    let res = await fetch(url, options);
    if ((res.status === 401 || res.status === 403) && !options._isRetry) {
      options._isRetry = true;
      headers = await getAuthHeaders(true);
      options.headers = { ...(options.headers || {}), ...headers };
      res = await fetch(url, options);
    }
    return res;
  }

  // Initialize Page
  async function initOrdersPage() {
    console.log('Initializing Order Management System...');
    setupEventListeners();
    await Promise.all([
      fetchDashboardMetrics(),
      fetchOrdersList(1),
    ]);
    startAutoPolling();
  }

  let autoPollTimer = null;
  function startAutoPolling() {
    if (autoPollTimer) clearInterval(autoPollTimer);
    autoPollTimer = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardMetrics();
        fetchOrdersList(currentPage, true);
      }
    }, 10000);
  }

  // Fetch Dashboard Metrics Cards
  async function fetchDashboardMetrics() {
    try {
      const res = await fetchWithAuthRetry(`${API_URL}/orders/dashboard`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        renderMetrics(data.data);
      } else if (data.data) {
        renderMetrics(data.data);
      } else {
        console.error('Order metrics endpoint error:', data);
      }
    } catch (err) {
      console.error('Backend order dashboard fetch failed:', err);
    }
  }

  function renderMetrics(m) {
    const elPending = document.getElementById('statPendingOrders');
    const elProcessing = document.getElementById('statProcessingOrders');
    const elPacked = document.getElementById('statPackedOrders');
    const elReadyToShip = document.getElementById('statReadyToShipOrders');
    const elTodaysCount = document.getElementById('statTodaysOrdersCount');
    const elTodaysRev = document.getElementById('statTodaysRevenue');
    const elAov = document.getElementById('statAverageOrderValue');

    if (elPending) elPending.textContent = (m.pendingOrders || 0).toLocaleString();
    if (elProcessing) elProcessing.textContent = (m.processingOrders || 0).toLocaleString();
    if (elPacked) elPacked.textContent = (m.packedOrders || 0).toLocaleString();
    if (elReadyToShip) elReadyToShip.textContent = (m.readyToShipOrders || 0).toLocaleString();
    if (elTodaysCount) elTodaysCount.textContent = (m.todaysOrdersCount || 0).toLocaleString();
    if (elTodaysRev) elTodaysRev.textContent = '₹' + (m.todaysRevenue || 0).toLocaleString('en-IN');
    if (elAov) elAov.textContent = '₹' + (m.averageOrderValue || 0).toLocaleString('en-IN');
  }

  // Fetch Orders List with Filters & Pagination
  async function fetchOrdersList(page = 1, isSilent = false) {
    currentPage = page;
    const search = document.getElementById('orderSearchInput')?.value || '';
    const status = document.getElementById('filterOrderStatus')?.value || 'ALL';
    const paymentStatus = document.getElementById('filterPaymentStatus')?.value || 'ALL';
    const fulfillmentStatus = document.getElementById('filterFulfillmentStatus')?.value || 'ALL';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '15',
      search,
      status,
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
    });

    const tbody = document.getElementById('ordersTableBody');
    if (tbody && !isSilent) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
            <p class="mt-2 text-sm">Loading order records...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetchWithAuthRetry(`${API_URL}/orders?${params.toString()}`);
      const data = await res.json();

      const list = Array.isArray(data.data) ? data.data : (data.data?.orders || data.data?.items || []);
      const pagination = data.data?.pagination || data.pagination || { page: page, totalPages: Math.ceil(list.length / 15) || 1, total: list.length, limit: 15 };
      if (res.ok && data.success && Array.isArray(list)) {
        currentOrders = list;
        totalPages = pagination.totalPages || 1;
        renderOrdersTable(currentOrders);
        renderPagination(pagination);
        return;
      } else {
        console.error('Fetch orders endpoint failed:', data);
        renderOrdersTable([]);
        renderPagination({ page: 1, totalPages: 1, total: 0, limit: 15 });
      }
    } catch (err) {
      console.error('Error fetching orders from backend:', err);
      renderOrdersTable([]);
      renderPagination({ page: 1, totalPages: 1, total: 0, limit: 15 });
    }
  }

  // Render Orders Table
  function renderOrdersTable(items) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined text-[40px] text-outline mb-2">local_shipping</span>
            <p class="font-bold text-on-surface">No orders found</p>
            <p class="text-xs text-secondary mt-1">Adjust search parameters or status filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(o => {
      const orderId = o.id || 'OM-1000';
      const orderNum = o.orderNumber || o.id || 'OM-1000';
      const name = o.customerName || (o.shippingAddress ? (o.shippingAddress.fullName || o.shippingAddress.name || `${o.shippingAddress.firstName || ''} ${o.shippingAddress.lastName || ''}`.trim()) : '') || 'Customer';
      const email = o.customerEmail || o.userEmail || o.email || (o.shippingAddress ? o.shippingAddress.email : '') || '';
      const rawDate = o.orderDate || o.date || o.createdAt || new Date().toISOString();
      const dt = new Date(rawDate).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const itemsList = Array.isArray(o.items) ? o.items : [];
      const firstItem = itemsList.length > 0 ? itemsList[0] : {};
      let deviceBrand = (firstItem.deviceType || firstItem.deviceBrand || firstItem.brandName || o.deviceBrand || '').trim();
      if (deviceBrand.toLowerCase() === 'om mobile art') deviceBrand = (firstItem.deviceType || '').trim();
      const deviceModel = firstItem.deviceModel || firstItem.customModelName || firstItem.deviceName || o.deviceModel || '-';
      const productName = firstItem.productName || firstItem.name || 'Device Skin';
      const extraText = itemsList.length > 1 ? ` (+${itemsList.length - 1} more)` : '';

      const itemsCount = o.itemsCount || itemsList.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1;
      const total = Number(o.total || o.grandTotal || o.totalAmount || 0);
      const payStatus = o.paymentStatus || (o.paymentMethod ? 'PAID' : 'PENDING');
      const fulStatus = o.fulfillmentStatus || (o.status === 'SHIPPED' || o.status === 'DELIVERED' ? 'FULFILLED' : 'UNFULFILLED');
      const orderStatus = o.status || 'CONFIRMED';
      const isChecked = selectedOrderIds.includes(orderId);

      // Status Badges
      const orderBadgeClass = getOrderStatusBadge(orderStatus);
      const paymentBadgeClass = getPaymentStatusBadge(payStatus);
      const fulfillmentBadgeClass = getFulfillmentStatusBadge(fulStatus);

      return `
        <tr class="hover:bg-gray-50/70 transition-colors group text-xs">
          <td class="px-2 py-2.5 text-center w-8">
            <input type="checkbox" onchange="window.toggleSelectOrder('${orderId}')" ${isChecked ? 'checked' : ''} class="rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6] h-3.5 w-3.5 cursor-pointer"/>
          </td>
          <td class="px-2.5 py-2.5 w-[110px]">
            <button onclick="window.openOrderDetailModal('${orderId}')" class="font-mono font-bold text-xs text-[#0077B6] hover:underline flex items-center gap-1 whitespace-nowrap">
              ${escapeHtml(orderNum)}
            </button>
          </td>
          <td class="px-2.5 py-2.5 w-[140px] max-w-[140px]" title="${escapeHtml(name)}${email ? ` (${escapeHtml(email)})` : ''}">
            <a href="customers.html?id=${o.userId || ''}" class="font-bold text-[#111827] hover:text-[#0077B6] transition-colors block text-xs truncate">
              ${escapeHtml(name)}
            </a>
            <div class="text-[11px] text-gray-500 truncate mt-0.5">${escapeHtml(email)}</div>
          </td>
          <td class="px-2.5 py-2.5 w-[85px] font-semibold text-xs text-[#111827] truncate" title="${escapeHtml(deviceBrand)}">
            ${escapeHtml(deviceBrand)}
          </td>
          <td class="px-2.5 py-2.5 w-[105px] text-xs font-medium text-gray-500 truncate" title="${escapeHtml(deviceModel)}">
            ${escapeHtml(deviceModel)}
          </td>
          <td class="px-2.5 py-2.5 font-bold text-xs text-[#111827]" title="${escapeHtml(productName)}${extraText}">
            <div class="line-clamp-2 leading-snug">
              ${escapeHtml(productName)}${extraText}
            </div>
          </td>
          <td class="px-2.5 py-2.5 w-[95px] font-data-tabular font-bold text-[#03045E] text-xs text-right whitespace-nowrap">
            ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="px-2 py-2.5 w-[85px] text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentBadgeClass} whitespace-nowrap inline-block">
              ${payStatus}
            </span>
          </td>
          <td class="px-2 py-2.5 w-[95px] text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${fulfillmentBadgeClass} whitespace-nowrap inline-block">
              ${fulStatus}
            </span>
          </td>
          <td class="px-2 py-2.5 w-[110px] text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${orderBadgeClass} uppercase tracking-wider whitespace-nowrap inline-block">
              ${orderStatus.replace(/_/g, ' ')}
            </span>
          </td>
          <td class="px-2.5 py-2.5 w-[110px] font-data-tabular text-[11px] text-gray-500 whitespace-nowrap">
            ${dt}
          </td>
          <td class="px-3 py-2.5 text-right w-[95px]">
            <div class="flex items-center justify-end gap-1.5">
              <button 
                onclick="window.openOrderStatusModal('${orderId}')"
                title="Update Status"
                class="h-7 w-7 bg-[#03045E] text-white rounded-lg flex items-center justify-center hover:bg-[#0077B6] transition-all shadow-xs cursor-pointer"
              >
                <span class="material-symbols-outlined text-[15px]">edit</span>
              </button>

              <button 
                onclick="window.printPackingSlip('${o.id}')"
                title="Print Packing Slip"
                class="h-7 w-7 border border-gray-200 bg-white text-gray-600 hover:text-[#03045E] rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all shadow-xs cursor-pointer"
              >
                <span class="material-symbols-outlined text-[15px]">print</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Toggle order checkbox selection for bulk action
  window.toggleSelectOrder = function (id) {
    if (selectedOrderIds.includes(id)) {
      selectedOrderIds = selectedOrderIds.filter(i => i !== id);
    } else {
      selectedOrderIds.push(id);
    }
  };

  // Open Order Details Modal
  window.openOrderDetailModal = async function (id) {
    const modal = document.getElementById('orderDetailModal');
    const container = document.getElementById('orderDetailContent');
    if (!modal || !container) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    container.innerHTML = `
      <div class="py-16 text-center text-secondary">
        <span class="material-symbols-outlined animate-spin text-[36px] text-primary">sync</span>
        <p class="mt-2 text-sm">Fetching complete order details...</p>
      </div>
    `;

    try {
      const res = await fetch(`${API_URL}/orders/${id}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.data) {
        activeOrder = data.data;
        renderOrderDetailContent(activeOrder);
      } else {
        container.innerHTML = `<p class="text-center py-12 text-error">Failed to load order details.</p>`;
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
      container.innerHTML = `<p class="text-center py-12 text-error">Network error fetching order details.</p>`;
    }
  };

  window.closeOrderDetailModal = function () {
    const modal = document.getElementById('orderDetailModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Render Full Order Detail Content inside Modal
  function renderOrderDetailContent(o) {
    const container = document.getElementById('orderDetailContent');
    if (!container) return;

    const shipAddr = o.shippingAddress || {};
    const billAddr = o.billingAddress || shipAddr.billingAddress || shipAddr;
    const snapshot = o.customerSnapshot || {};

    const customerName = o.customerName || snapshot.fullName || shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || 'Customer';
    const customerEmail = o.customerEmail || snapshot.email || shipAddr.email || '';
    const customerPhone = o.customerPhone || snapshot.phone || shipAddr.phone || shipAddr.mobile || '';

    const items = o.items || [];
    const timeline = o.timelineEvents || [];
    const notes = o.notes || [];

    container.innerHTML = `
      <!-- Top Title Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold text-on-surface font-mono">${escapeHtml(o.orderNumber)}</h2>
            <span class="px-3 py-1 rounded-full text-xs font-bold ${getOrderStatusBadge(o.status)} uppercase">
              ${o.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p class="text-xs text-secondary mt-1">Placed on ${new Date(o.createdAt).toLocaleString('en-IN')}</p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="window.printPackingSlip('${o.id}')" class="px-3.5 py-2 border border-outline-variant bg-white text-xs font-bold rounded-lg hover:bg-surface-container-low flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">print</span> Packing Slip
          </button>
          <button onclick="window.openOrderStatusModal('${o.id}')" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">edit</span> Update Status
          </button>
        </div>
      </div>

      <!-- 2-Column Main Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

        <!-- Left 2 Cols: Items & Totals -->
        <div class="lg:col-span-2 space-y-6">
          
          <!-- Line Items Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-4">Purchased Items (${items.length})</h3>
            <div class="divide-y divide-outline-variant/60">
              ${items.map(item => {
                const hasCustomDesign = Boolean(
                  item.customDesign ||
                  (item.isCustomOrder && item.imageUrl) ||
                  (item.productName && item.productName.toLowerCase().includes('custom') && item.imageUrl)
                );
                const resolvedItemImg = resolveImageUrl(item.imageUrl);
                const artworkUrl = item.customDesign ? (resolveImageUrl(item.customDesign.previewUrl) || item.customDesign.previewUrl) : resolvedItemImg;
                const fileName = item.customDesign ? item.customDesign.fileName : `OM-${o.orderNumber || 'ORDER'}_${(item.deviceModel || 'Custom-Skin').replace(/\s+/g, '-')}_Artwork.png`;
                
                // Distinguish Device Type and Device Model
                const deviceType = (item.deviceTypeObj?.name || item.deviceType || '').trim();
                let modelName = (item.deviceModelObj?.name || item.customModelName || item.deviceModel || item.deviceName || '').trim();
                let brandName = (item.deviceBrand || item.brandName || '').trim();
                if (brandName.toLowerCase() === 'om mobile art') brandName = '';

                let modelDisplay = modelName;
                if (brandName && modelName && !modelName.toLowerCase().startsWith(brandName.toLowerCase())) {
                  modelDisplay = `${brandName} ${modelName}`;
                }

                const deviceDisplay = deviceType || brandName || '-';

                // Configuration / Specs
                const specsList = [item.finish, item.material, item.coverage].filter(Boolean);
                const specsDisplay = specsList.length > 0 ? specsList.join(' | ') : '';

                return `
                <div class="py-4 space-y-3">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-3">
                      <img src="${escapeHtml(resolvedItemImg || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Crect width='50' height='50' fill='%23F1F5F9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='9' font-weight='bold' fill='%2394A3B8'%3ENo Image%3C/text%3E%3C/svg%3E")}" alt="${escapeHtml(item.productName || 'Product')}" class="h-14 w-14 object-cover rounded-lg border border-outline-variant flex-shrink-0" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 50 50\'%3E%3Crect width=\'50\' height=\'50\' fill=\'%23F1F5F9\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'9\' font-weight=\'bold\' fill=\'%2394A3B8\'%3ENo Image%3C/text%3E%3C/svg%3E'"/>
                      <div>
                        <p class="font-bold text-sm text-on-surface">${escapeHtml(item.productName || 'Device Skin')}</p>
                        <div class="text-xs text-secondary mt-1 space-y-0.5">
                          ${deviceDisplay && deviceDisplay !== '-' ? `<p><span class="font-semibold text-on-surface">Device:</span> ${escapeHtml(deviceDisplay)}</p>` : ''}
                          ${modelDisplay && modelDisplay.toLowerCase() !== deviceDisplay.toLowerCase() ? `<p><span class="font-semibold text-on-surface">Model:</span> ${escapeHtml(modelDisplay)}</p>` : ''}
                          ${specsDisplay ? `<p><span class="font-semibold text-on-surface">Specs:</span> ${escapeHtml(specsDisplay)}</p>` : ''}
                          <p class="font-mono text-[11px] text-outline">SKU: ${escapeHtml(item.sku || 'N/A')}</p>
                        </div>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <p class="text-sm font-bold text-on-surface">₹${((item.pricePaid || item.unitPrice || 0) * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      <p class="text-xs text-secondary">Qty: ${item.quantity} × ₹${(item.pricePaid || item.unitPrice || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  ${hasCustomDesign && artworkUrl ? `
                    <div class="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div class="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span class="text-xs font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                          <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          Custom Artwork / Design File
                        </span>
                        <span class="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">${escapeHtml(fileName)}</span>
                      </div>

                      <div class="flex flex-col sm:flex-row items-center gap-4">
                        <div class="relative group cursor-pointer bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-shrink-0"
                             onclick="window.openDesignLightbox('${escapeHtml(artworkUrl)}', '${escapeHtml(fileName)}', '${escapeHtml(deviceDisplay)}')">
                          <img src="${escapeHtml(artworkUrl)}" alt="Artwork Preview" class="h-28 w-28 object-contain rounded transition-transform group-hover:scale-105" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23F1F5F9\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'10\' font-weight=\'bold\' fill=\'%2394A3B8\'%3EPreview Load Error%3C/text%3E%3C/svg%3E'"/>
                          <div class="absolute inset-0 bg-indigo-950/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path></svg>
                            View Full Artwork
                          </div>
                        </div>

                        <div class="flex-1 space-y-2 text-xs text-slate-600 w-full">
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-2.5 rounded-lg border border-slate-200/80">
                            <div><span class="font-bold text-slate-800">Target Device:</span> ${escapeHtml(deviceDisplay)} ${modelDisplay && modelDisplay !== deviceDisplay ? `(${escapeHtml(modelDisplay)})` : ''}</div>
                            <div><span class="font-bold text-slate-800">Finish:</span> ${escapeHtml(item.finish || 'Matte')}</div>
                            <div><span class="font-bold text-slate-800">Material:</span> ${escapeHtml(item.material || '3M Vinyl')}</div>
                            <div><span class="font-bold text-slate-800">Coverage:</span> ${escapeHtml(item.coverage || 'Full Back')}</div>
                          </div>
                          
                          <div class="flex flex-wrap gap-2 pt-1">
                            <button type="button" 
                                    onclick="window.openDesignLightbox('${escapeHtml(artworkUrl)}', '${escapeHtml(fileName)}', '${escapeHtml(deviceDisplay)}')" 
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors">
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                              View Design
                            </button>
                            
                            <a href="${escapeHtml(artworkUrl)}" 
                               download="${escapeHtml(fileName)}"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                              </svg>
                              Download High-Res Artwork
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                </div>
                `;
              }).join('')}
            </div>

            <!-- Financial Totals Summary -->
            <div class="border-t border-outline-variant pt-4 mt-4 space-y-2 text-sm">
              <div class="flex justify-between text-secondary">
                <span>Subtotal</span>
                <span class="font-mono">₹${o.subtotal.toLocaleString('en-IN')}</span>
              </div>
              ${o.discount > 0 ? `
                <div class="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount (${o.couponCode || 'Coupon'})</span>
                  <span class="font-mono">-₹${o.discount.toLocaleString('en-IN')}</span>
                </div>
              ` : ''}
              <div class="flex justify-between text-secondary">
                <span>Shipping Fee</span>
                <span class="font-mono">${o.shippingFee > 0 ? `₹${o.shippingFee}` : 'FREE'}</span>
              </div>
              <div class="flex justify-between font-bold text-base text-on-surface pt-2 border-t border-outline-variant">
                <span>Grand Total</span>
                <span class="font-mono text-primary">₹${o.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <!-- Timeline Events Stream -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-4">Order Audit Timeline</h3>
            <div class="space-y-4">
              ${timeline.length === 0 ? `<p class="text-xs text-secondary italic">No timeline records logged yet.</p>` :
                timeline.map(t => `
                  <div class="flex items-start gap-3 text-xs">
                    <div class="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold">
                      <span class="material-symbols-outlined text-[14px]">event</span>
                    </div>
                    <div class="flex-1">
                      <p class="font-bold text-on-surface">${escapeHtml(t.title)}</p>
                      <p class="text-secondary mt-0.5">${escapeHtml(t.description || '')}</p>
                      <p class="text-[10px] text-outline mt-0.5">${new Date(t.createdAt).toLocaleString('en-IN')} • By ${t.actorType || 'ADMIN'}</p>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>

        </div>

        <!-- Right 1 Col: Customer & Address Details -->
        <div class="space-y-6">

          <!-- Customer Info Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3 flex items-center justify-between">
              Checkout Customer Profile
              <a href="customers.html?id=${o.userId}" class="text-xs text-primary font-semibold hover:underline">View Account</a>
            </h3>
            <div class="text-xs space-y-1.5 text-secondary">
              <p class="font-bold text-sm text-on-surface">${escapeHtml(customerName)}</p>
              <p>Email: <span class="font-semibold text-on-surface">${escapeHtml(customerEmail)}</span></p>
              <p>Phone: <span class="font-semibold text-on-surface">${escapeHtml(customerPhone || 'N/A')}</span></p>
            </div>
          </div>

          <!-- Shipping Address Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Shipping Address (Checkout Snapshot)</h3>
            <div class="text-xs space-y-1 leading-relaxed text-secondary">
              <p class="font-bold text-on-surface">${escapeHtml(shipAddr.fullName || (shipAddr.firstName ? `${shipAddr.firstName} ${shipAddr.lastName || ''}`.trim() : null) || customerName)}</p>
              <p>${escapeHtml(shipAddr.addressLine1 || shipAddr.street || '')}</p>
              ${shipAddr.addressLine2 ? `<p>${escapeHtml(shipAddr.addressLine2)}</p>` : ''}
              <p>${escapeHtml(shipAddr.city || '')}${shipAddr.state ? `, ${escapeHtml(shipAddr.state)}` : ''} ${shipAddr.pincode || shipAddr.zip ? `- ${escapeHtml(shipAddr.pincode || shipAddr.zip)}` : ''}</p>
              <p>${escapeHtml(shipAddr.country || 'India')}</p>
              <p class="mt-2 font-semibold text-on-surface">Phone: ${escapeHtml(shipAddr.phone || shipAddr.mobile || customerPhone || 'N/A')}</p>
            </div>
          </div>

          <!-- Order Fulfillment & Shipping Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white space-y-4" id="order-fulfillment-card-${o.id}">
            <div class="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <h3 class="font-bold text-sm text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-base text-primary">local_shipping</span> Fulfillment & Shipping
              </h3>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                o.fulfillmentStatus === 'FULFILLED' || o.fulfillmentStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                o.fulfillmentStatus === 'SHIPPED' || o.fulfillmentStatus === 'DISPATCHED' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-100 text-slate-700'
              }">
                ${escapeHtml(o.fulfillmentStatus || 'UNFULFILLED')}
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div class="grid grid-cols-2 text-[11px] text-slate-700 gap-y-1">
                  <div><strong>Courier / Provider:</strong> ${escapeHtml(o.courierName || 'Not configured')}</div>
                  <div><strong>Tracking Number:</strong> <span class="font-mono font-bold">${escapeHtml(o.trackingNumber || '-')}</span></div>
                  <div><strong>Estimated Delivery:</strong> ${o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>Shipping Amount:</strong> ₹${(o.shippingAmount || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              ${o.courierLink ? `
                <div class="pt-1">
                  <a href="${escapeHtml(o.courierLink)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors">
                    <span class="material-symbols-outlined text-[14px]">open_in_new</span> Track Shipment
                  </a>
                </div>
              ` : ''}

              <div class="flex flex-wrap gap-2 pt-1">
                <button type="button" onclick="window.printShippingLabel('${o.id}')" class="flex-1 py-2 border border-slate-300 bg-white text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1">
                  <span class="material-symbols-outlined text-[15px]">print</span> Print Shipping Label
                </button>
              </div>
            </div>
          </div>

          <!-- Internal Admin Notes -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Internal Admin Notes</h3>
            <div class="space-y-3 max-h-40 overflow-y-auto mb-3">
              ${notes.length === 0 ? `<p class="text-xs text-secondary italic">No internal notes added.</p>` :
                notes.map(n => `
                  <div class="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/60 text-xs">
                    <p class="text-on-surface">${escapeHtml(n.content)}</p>
                    <p class="text-[10px] text-secondary mt-1">${escapeHtml(n.authorName || 'Admin')} • ${new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                `).join('')
              }
            </div>
            
            <div class="flex gap-2">
              <input id="orderNoteInput" type="text" placeholder="Add internal memo..." class="flex-1 border border-outline-variant rounded-lg p-2 text-xs focus:ring-primary"/>
              <button onclick="window.submitOrderNote('${o.id}')" class="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">Add</button>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // Submit Internal Order Note
  window.submitOrderNote = async function (orderId) {
    const input = document.getElementById('orderNoteInput');
    const content = input ? input.value.trim() : '';

    if (!content) {
      showToast('Please type note text first', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/notes`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ content, isInternal: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Internal note saved!', 'success');
        window.openOrderDetailModal(orderId);
      } else {
        showToast(data.message || 'Failed to save note', 'error');
      }
    } catch (err) {
      console.error('Note submit error:', err);
      showToast('Error saving note', 'error');
    }
  };

  window.openOrderStatusModal = function (orderId) {
    const modal = document.getElementById('updateStatusModal');
    if (!modal) return;

    const selectOrder = document.getElementById('modalStatusOrderId');
    if (selectOrder) selectOrder.value = orderId;

    const targetOrder = currentOrders.find(o => o.id === orderId || o.orderNumber === orderId) || (activeOrder && (activeOrder.id === orderId || activeOrder.orderNumber === orderId) ? activeOrder : null);
    if (targetOrder && targetOrder.status) {
      const selectStatus = document.getElementById('modalOrderStatusSelect');
      if (selectStatus) selectStatus.value = targetOrder.status;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeOrderStatusModal = function () {
    const modal = document.getElementById('updateStatusModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Submit Order Status Update Form
  async function submitStatusUpdate(e) {
    e.preventDefault();
    const orderId = document.getElementById('modalStatusOrderId')?.value;
    const status = document.getElementById('modalOrderStatusSelect')?.value;
    const comment = document.getElementById('modalStatusComment')?.value || '';

    if (!orderId) return;

    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ status, comment }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Order status changed to ${status}`, 'success');
        closeOrderStatusModal();
        fetchDashboardMetrics();
        fetchOrdersList(currentPage);
        if (activeOrder && activeOrder.id === orderId) {
          window.openOrderDetailModal(orderId);
        }
      } else {
        showToast(data.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      console.error('Status update error:', err);
      showToast('Error updating order status', 'error');
    }
  }

  // Printable Packing Slip
  window.printPackingSlip = async function (id) {
    try {
      const res = await fetch(`${API_URL}/orders/${id}/packing-slip`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();

      if (!data.success || !data.data) {
        showToast('Failed to load packing slip data', 'error');
        return;
      }

      const p = data.data;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Packing Slip - ${p.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { border-bottom: 2px solid #0077B6; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .title { font-size: 24px; font-weight: bold; color: #0077B6; }
            .section { margin-bottom: 20px; }
            table { w-full; border-collapse: collapse; width: 100%; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${p.storeName}</div>
              <p>${p.storeAddress} | Support: ${p.supportPhone}</p>
            </div>
            <div style="text-align: right;">
              <h2>PACKING SLIP</h2>
              <p>Order: <strong>${p.orderNumber}</strong></p>
              <p>Date: ${new Date(p.orderDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div class="section">
            <h3>Ship To:</h3>
            <p><strong>${p.customerName}</strong></p>
            <p>${p.shippingAddress?.addressLine1 || ''} ${p.shippingAddress?.addressLine2 || ''}</p>
            <p>${p.shippingAddress?.city || ''}, ${p.shippingAddress?.state || ''} - ${p.shippingAddress?.pincode || ''}</p>
            <p>Phone: ${p.customerPhone}</p>
          </div>

          <div class="section">
            <h3>Order Items:</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Device / Model</th>
                  <th>Specs</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${p.items.map(i => `
                  <tr>
                    <td><strong>${escapeHtml(i.productName || 'Device Skin')}</strong></td>
                    <td>${escapeHtml(formatDeviceDisplay(i))}</td>
                    <td>${escapeHtml(i.finish || 'Matte')} | ${escapeHtml(i.material || '3M Vinyl')} | ${escapeHtml(i.coverage || 'Full Back')}</td>
                    <td><code>${escapeHtml(i.sku || 'N/A')}</code></td>
                    <td>${i.quantity || 1}</td>
                    <td>₹${((Number(i.pricePaid || i.unitPrice || 0)) * (Number(i.quantity || 1))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; text-align: center;">
            Thank you for shopping with ${p.storeName}! Precision vinyl skins crafted with pride.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error('Packing slip error:', err);
      showToast('Error generating packing slip', 'error');
    }
  };

  // Export Orders CSV
  async function exportOrdersCsv() {
    try {
      const res = await fetch(`${API_URL}/orders/export-csv`, {
        headers: await getAuthHeaders(),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Orders CSV exported successfully', 'success');
    } catch (err) {
      console.error('CSV Export error:', err);
      showToast('Failed to export orders CSV', 'error');
    }
  }

  // Bulk Status Update Action
  async function bulkUpdateOrderStatus() {
    if (selectedOrderIds.length === 0) {
      showToast('Please select orders using checkboxes first', 'warning');
      return;
    }

    const status = prompt(`Enter target status for ${selectedOrderIds.length} selected orders:\n(e.g., CONFIRMED, PROCESSING, PRINTING, PACKED, READY_TO_SHIP, COMPLETED, CANCELLED)`);

    if (!status || !status.trim()) return;

    try {
      const res = await fetch(`${API_URL}/orders/bulk-status`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: status.trim().toUpperCase(),
          comment: 'Bulk status update from Admin UI',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Orders updated successfully!', 'success');
        selectedOrderIds = [];
        fetchDashboardMetrics();
        fetchOrdersList(currentPage);
      } else {
        showToast(data.message || 'Failed bulk update', 'error');
      }
    } catch (err) {
      console.error('Bulk update error:', err);
      showToast('Error updating orders in bulk', 'error');
    }
  }

  // Helper Badge Classes
  function getOrderStatusBadge(status) {
    const map = {
      'PENDING_PAYMENT': 'chip-warning',
      'PAID': 'chip-success',
      'CONFIRMED': 'chip-success',
      'PROCESSING': 'bg-blue-100 text-blue-800 border border-blue-200',
      'PRINTING': 'bg-purple-100 text-purple-800 border border-purple-200',
      'QUALITY_CHECK': 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      'PACKED': 'bg-amber-100 text-amber-800 border border-amber-200',
      'READY_TO_SHIP': 'bg-cyan-100 text-cyan-800 border border-cyan-200',
      'SHIPPED': 'bg-blue-100 text-blue-800 border border-blue-200',
      'DELIVERED': 'chip-success',
      'COMPLETED': 'chip-success',
      'CANCELLED': 'chip-danger',
      'FAILED': 'chip-danger',
      'REFUNDED': 'bg-gray-100 text-gray-800 border border-gray-200',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  }

  function getPaymentStatusBadge(status) {
    const map = {
      'PAID': 'bg-emerald-100 text-emerald-800',
      'PENDING': 'bg-amber-100 text-amber-800',
      'FAILED': 'bg-red-100 text-red-800',
      'REFUNDED': 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  }

  function getFulfillmentStatusBadge(status) {
    const map = {
      'FULFILLED': 'bg-emerald-100 text-emerald-800',
      'READY_TO_SHIP': 'bg-cyan-100 text-cyan-800',
      'PACKED': 'bg-indigo-100 text-indigo-800',
      'UNFULFILLED': 'bg-amber-100 text-amber-800',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  }

  // Render Pagination
  function renderPagination(pagination) {
    const container = document.getElementById('ordersPagination');
    if (!container || !pagination) return;

    const page = Number(pagination.page || pagination.currentPage || 1);
    const limit = Number(pagination.limit || 15);
    const total = Number(pagination.total || pagination.totalItems || 0);
    const totPages = Number(pagination.totalPages || Math.ceil(total / limit) || 1);

    const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
    const endItem = Math.min(total, page * limit);

    container.innerHTML = `
      <p class="text-body-sm text-secondary">
        Showing <span class="font-bold text-on-surface">${startItem}</span> to <span class="font-bold text-on-surface">${endItem}</span> of <span class="font-bold text-on-surface">${total}</span> orders
      </p>
      <div class="flex gap-2">
        <button 
          onclick="window.changeOrderPage(${page - 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page <= 1 ? 'disabled' : ''}
        >Previous</button>
        <span class="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold">${page} / ${totPages}</span>
        <button 
          onclick="window.changeOrderPage(${page + 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page >= totPages ? 'disabled' : ''}
        >Next</button>
      </div>
    `;
  }

  window.changeOrderPage = function (newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchOrdersList(newPage);
    }
  };

  // --- GENERIC SHIPPING / FULFILLMENT ACTIONS ---
  window.printShippingLabel = function (shipmentIdOrOrderId) {
    const labelUrl = `${API_URL}/shipping/label/${shipmentIdOrOrderId}`;
    window.open(labelUrl, '_blank', 'width=500,height=700');
  };

  window.dispatchOrder = async function (orderId) {
    try {
      showToast('Dispatching order...', 'info');
      const res = await fetch(`${API_URL}/shipping/dispatch`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Order #${data.data.orderNumber || orderId} Dispatched successfully!`, 'success');
        fetchDashboardMetrics();
        fetchOrdersList(currentPage);
        if (activeOrder && activeOrder.id === orderId) {
          window.openOrderDetailModal(orderId);
        }
      } else {
        showToast(data.message || 'Failed to dispatch order', 'error');
      }
    } catch (err) {
      console.error('Dispatch error:', err);
      showToast('Error dispatching order', 'error');
    }
  };

  window.cancelAndRestoreInventory = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order? This will cancel any active shipment and RESTORE inventory stock for all items.')) {
      return;
    }
    const reason = prompt('Enter cancellation reason:', 'Cancelled by Admin') || 'Cancelled by Admin';

    try {
      showToast('Cancelling order & restoring inventory...', 'info');
      const res = await fetch(`${API_URL}/shipping/cancel-order`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ orderId, reason }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Order cancelled and inventory stock restored!`, 'success');
        fetchDashboardMetrics();
        fetchOrdersList(currentPage);
        if (activeOrder && activeOrder.id === orderId) {
          window.openOrderDetailModal(orderId);
        }
      } else {
        showToast(data.message || 'Failed to cancel order', 'error');
      }
    } catch (err) {
      console.error('Cancel order error:', err);
      showToast('Error cancelling order', 'error');
    }
  };

  // Setup Event Listeners
  function setupEventListeners() {
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchOrdersList(1), 350);
      });
    }

    ['filterOrderStatus', 'filterPaymentStatus', 'filterFulfillmentStatus', 'filterStartDate', 'filterEndDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => fetchOrdersList(1));
    });

    const btnExport = document.getElementById('btnExportOrdersCsv');
    if (btnExport) btnExport.addEventListener('click', exportOrdersCsv);

    const btnBulkStatus = document.getElementById('btnBulkStatusUpdate');
    if (btnBulkStatus) btnBulkStatus.addEventListener('click', bulkUpdateOrderStatus);

    const statusForm = document.getElementById('updateStatusForm');
    if (statusForm) statusForm.addEventListener('submit', submitStatusUpdate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrdersPage);
  } else {
    initOrdersPage();
  }

  window.openDesignLightbox = function (url, fileName, deviceName) {
    let existingModal = document.getElementById('artwork-lightbox-modal');
    if (existingModal) existingModal.remove();

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const modalHtml = `
      <div id="artwork-lightbox-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Artwork Full Preview
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Target: <span class="font-bold text-slate-700">${escapeHtml(deviceName)}</span> | File: <span class="font-mono text-slate-700">${escapeHtml(fileName)}</span></p>
            </div>
            <button onclick="document.getElementById('artwork-lightbox-modal').remove()" class="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div class="flex-1 bg-slate-950 p-6 flex items-center justify-center overflow-auto min-h-[350px]">
            <img src="${escapeHtml(url)}" alt="Full Resolution Artwork" class="max-h-[65vh] max-w-full object-contain rounded-lg shadow-xl" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\' viewBox=\'0 0 200 200\'%3E%3Crect width=\'200\' height=\'200\' fill=\'%231E293B\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'12\' font-weight=\'bold\' fill=\'%2394A3B8\'%3EFailed to Load Artwork File%3C/text%3E%3C/svg%3E'"/>
          </div>

          <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span class="text-xs text-slate-500 font-medium">Production Note: Download original high-resolution artwork for high-DPI skin printing.</span>
            <div class="flex items-center gap-3">
              <button onclick="document.getElementById('artwork-lightbox-modal').remove()" class="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors">
                Close
              </button>
              <a href="${escapeHtml(url)}" download="${escapeHtml(fileName)}" target="_blank" rel="noopener noreferrer" class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition-colors inline-flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download High-Res Design
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

})();
