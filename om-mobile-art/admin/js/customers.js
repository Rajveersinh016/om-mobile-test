/**
 * OM Mobile Art — Customer Management (customers.js)
 * Full Shopify-grade Admin Customer Management Controller.
 */

(function () {
  'use strict';

  const API_URL = 'http://localhost:3000/api/v1';

  let currentCustomers = [];
  let activeCustomer = null;
  let currentPage = 1;
  let totalPages = 1;

  async function getAuthHeaders() {
    let token = localStorage.getItem('om_admin_auth_token');
    if (!token && window.getAuthToken) {
      token = await window.getAuthToken();
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  // Initialize Page
  async function initCustomersPage() {
    console.log('Initializing Customer Management Module...');
    setupEventListeners();
    await Promise.all([
      fetchCustomerStats(),
      fetchCustomersList(1),
    ]);

    // Auto-open customer profile if ID passed in URL param
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');
    if (customerId) {
      window.openCustomerDrawer(customerId);
    }
  }

  // Fetch Dashboard Stats
  async function fetchCustomerStats() {
    try {
      const res = await fetch(`${API_URL}/customers/stats`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        renderStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch customer stats from backend:', err);
    }
  }

  function renderStats(s) {
    const elTotal = document.getElementById('statTotalCustomers');
    const elActive = document.getElementById('statActiveCustomers');
    const elSuspended = document.getElementById('statSuspendedCustomers');
    const elNewMonth = document.getElementById('statNewThisMonth');
    const elAvgSpend = document.getElementById('statAverageSpend');

    if (elTotal) elTotal.textContent = (s.totalCustomers || 0).toLocaleString();
    if (elActive) elActive.textContent = (s.activeCustomers || 0).toLocaleString();
    if (elSuspended) elSuspended.textContent = ((s.suspendedCustomers || 0) + (s.blockedCustomers || 0)).toLocaleString();
    if (elNewMonth) elNewMonth.textContent = (s.newThisMonthCount || 0).toLocaleString();
    if (elAvgSpend) elAvgSpend.textContent = '₹' + (s.averageLifetimeSpend || 0).toLocaleString('en-IN');
  }

  // Fetch Customers List with Filters & Pagination
  async function fetchCustomersList(page = 1) {
    currentPage = page;
    const search = document.getElementById('customerSearchInput')?.value || '';
    const status = document.getElementById('filterCustomerStatus')?.value || 'ALL';
    const tag = document.getElementById('filterCustomerTag')?.value || '';
    const startDate = document.getElementById('filterRegStartDate')?.value || '';
    const endDate = document.getElementById('filterRegEndDate')?.value || '';

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '15',
      search,
      status,
      tag,
      startDate,
      endDate,
    });

    const tbody = document.getElementById('customersTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
            <p class="mt-2 text-sm">Loading customer database...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetch(`${API_URL}/customers?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();

      if (data.success) {
        currentCustomers = data.data || [];
        totalPages = data.pagination?.totalPages || 1;
        renderCustomersTable(currentCustomers);
        renderPagination(data.pagination);
      } else {
        showToast(data.message || 'Failed to load customers', 'error');
      }
    } catch (err) {
      console.error('Error fetching customers from backend:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="px-6 py-12 text-center text-error">
              Failed to connect to backend server.
            </td>
          </tr>
        `;
      }
    }
  }

  // Render Customers Table
  function renderCustomersTable(items) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-12 text-center text-secondary">
            <span class="material-symbols-outlined text-[40px] text-outline mb-2">group_off</span>
            <p class="font-bold text-on-surface">No customers found</p>
            <p class="text-xs text-secondary mt-1">Try adjusting search query or filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(c => {
      const badgeClass = getStatusBadge(c.status);
      const joinedDate = new Date(c.registrationDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const lastLoginDisplay = formatTimeAgo(c.lastLoginDate);
      const avatarSrc = c.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0077B6&color=fff`;
      const tagsList = c.tags || [];

      return `
        <tr class="hover:bg-surface-container-low/40 transition-colors group">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <img src="${escapeHtml(avatarSrc)}" alt="Avatar" class="h-10 w-10 rounded-full object-cover border border-outline-variant flex-shrink-0"/>
              <div>
                <button onclick="window.openCustomerDrawer('${c.id}')" class="font-bold text-sm text-on-surface hover:text-primary transition-colors text-left block">
                  ${escapeHtml(c.name)}
                </button>
                <div class="text-xs text-secondary mt-0.5">${escapeHtml(c.email)}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-4 text-sm font-semibold text-on-surface">
            ${escapeHtml(c.phone)}
          </td>
          <td class="px-4 py-4 font-data-tabular text-xs text-secondary">
            ${joinedDate}
          </td>
          <td class="px-4 py-4 font-data-tabular text-xs text-secondary">
            ${lastLoginDisplay}
          </td>
          <td class="px-4 py-4 text-center font-bold text-sm text-on-surface">
            ${c.totalOrders}
          </td>
          <td class="px-4 py-4 font-data-tabular font-bold text-primary text-sm">
            ₹${c.totalSpent.toLocaleString('en-IN')}
          </td>
          <td class="px-4 py-4 text-center">
            <span class="px-3 py-1 rounded-full text-[11px] font-bold ${badgeClass} uppercase tracking-wider">
              ${c.status}
            </span>
          </td>
          <td class="px-4 py-4">
            <div class="flex flex-wrap gap-1">
              ${tagsList.length === 0 ? `<span class="text-xs text-outline italic">No tags</span>` :
                tagsList.map(t => `<span class="px-2 py-0.5 rounded bg-surface-container-high text-[10px] font-bold text-secondary border border-outline-variant">${escapeHtml(t)}</span>`).join('')
              }
            </div>
          </td>
          <td class="px-6 py-4 text-right">
            <div class="flex items-center justify-end gap-2">
              <button 
                onclick="window.openCustomerDrawer('${c.id}')"
                title="View Customer Profile"
                class="h-9 w-9 bg-primary text-white rounded-lg flex items-center justify-center hover:opacity-90 transition-all shadow-xs"
              >
                <span class="material-symbols-outlined text-[18px]">visibility</span>
              </button>

              <button 
                onclick="window.updateCustomerStatus('${c.id}', '${c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')"
                title="${c.status === 'ACTIVE' ? 'Suspend Account' : 'Restore Account'}"
                class="h-9 w-9 border border-outline-variant bg-white ${c.status === 'ACTIVE' ? 'text-amber-600' : 'text-emerald-600'} rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-all"
              >
                <span class="material-symbols-outlined text-[18px]">${c.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Open Customer Detail Profile Drawer
  window.openCustomerDrawer = async function (id) {
    const drawer = document.getElementById('customerProfileDrawer');
    const container = document.getElementById('customerProfileContent');
    if (!drawer || !container) return;

    drawer.classList.remove('hidden');
    drawer.classList.add('flex');

    container.innerHTML = `
      <div class="py-16 text-center text-secondary">
        <span class="material-symbols-outlined animate-spin text-[36px] text-primary">sync</span>
        <p class="mt-2 text-sm">Fetching customer profile...</p>
      </div>
    `;

    try {
      const res = await fetch(`${API_URL}/customers/${id}`, { headers: await getAuthHeaders() });
      const data = await res.json();

      if (data.success && data.data) {
        activeCustomer = data.data;
        renderCustomerProfileContent(activeCustomer);
      } else {
        container.innerHTML = `<p class="text-center py-12 text-error">Failed to load customer profile.</p>`;
      }
    } catch (err) {
      console.error('Error fetching customer profile:', err);
      container.innerHTML = `<p class="text-center py-12 text-error">Network error fetching profile.</p>`;
    }
  };

  window.closeCustomerDrawer = function () {
    const drawer = document.getElementById('customerProfileDrawer');
    if (!drawer) return;
    drawer.classList.add('hidden');
    drawer.classList.remove('flex');
  };

  // Render Customer Profile Drawer Content
  function renderCustomerProfileContent(c) {
    const container = document.getElementById('customerProfileContent');
    if (!container) return;

    const avatarSrc = c.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'C')}&background=0077B6&color=fff`;
    const addresses = c.addresses || [];
    const notes = c.notes || [];
    const activities = c.activities || [];
    const orders = c.orders || [];
    const tags = c.tags || [];

    container.innerHTML = `
      <!-- Header Info Banner -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-outline-variant">
        <div class="flex items-center gap-4">
          <img src="${escapeHtml(avatarSrc)}" class="h-16 w-16 rounded-full object-cover border-2 border-primary shadow-sm"/>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-on-surface">${escapeHtml(c.name || 'Customer')}</h2>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadge(c.status)} uppercase">${c.status}</span>
            </div>
            <p class="text-xs text-secondary mt-1">${escapeHtml(c.email)} • Phone: ${escapeHtml(c.phone || 'N/A')}</p>
            <p class="text-[11px] text-outline mt-0.5">Joined on ${new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <!-- Quick Status Control Buttons -->
        <div class="flex flex-wrap items-center gap-2">
          ${c.status === 'ACTIVE' ? `
            <button onclick="window.updateCustomerStatus('${c.id}', 'SUSPENDED')" class="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg hover:bg-amber-100">
              Suspend
            </button>
            <button onclick="window.updateCustomerStatus('${c.id}', 'BLOCKED')" class="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100">
              Block
            </button>
          ` : `
            <button onclick="window.updateCustomerStatus('${c.id}', 'ACTIVE')" class="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
              Restore Active Account
            </button>
          `}
        </div>
      </div>

      <!-- 2-Column Details Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

        <!-- Left 2 Cols: Notes & Addresses & Activity -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Customer Tags Control -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Customer Tags</h3>
            <div class="flex flex-wrap items-center gap-2 mb-3">
              ${tags.length === 0 ? `<p class="text-xs text-secondary italic">No tags assigned.</p>` :
                tags.map(t => `
                  <span class="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1 border border-primary/20">
                    ${escapeHtml(t)}
                    <button onclick="window.removeTag('${c.id}', '${escapeHtml(t)}')" class="hover:text-error">×</button>
                  </span>
                `).join('')
              }
            </div>

            <div class="flex gap-2">
              <select id="newTagSelect" class="border border-outline-variant rounded-lg p-2 text-xs focus:ring-primary">
                <option value="VIP">VIP Customer</option>
                <option value="Wholesale">Wholesale</option>
                <option value="Frequent Buyer">Frequent Buyer</option>
                <option value="Manual Review">Manual Review</option>
                <option value="Blocked">Blocked</option>
              </select>
              <button onclick="window.addTag('${c.id}')" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
                Add Tag
              </button>
            </div>
          </div>

          <!-- Address Management Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-sm text-on-surface">Addresses (${addresses.length})</h3>
              <button onclick="window.openAddAddressModal('${c.id}')" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">add</span> Add New Address
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${addresses.length === 0 ? `<p class="text-xs text-secondary italic col-span-2">No saved addresses for this customer.</p>` :
                addresses.map(a => `
                  <div class="p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low/30 relative text-xs space-y-1">
                    ${a.isDefaultShipping ? `<span class="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 inline-block border border-primary/20">Default Shipping</span>` : ''}
                    <p class="font-bold text-on-surface">${escapeHtml(a.fullName)} (${escapeHtml(a.type || 'HOME')})</p>
                    <p class="text-secondary">${escapeHtml(a.addressLine1)} ${a.addressLine2 ? escapeHtml(a.addressLine2) : ''}</p>
                    <p class="text-secondary">${escapeHtml(a.city)}, ${escapeHtml(a.state)} - ${escapeHtml(a.pincode)}</p>
                    <p class="text-secondary font-semibold">Phone: ${escapeHtml(a.phone)}</p>
                    
                    <div class="pt-2 flex items-center gap-3 border-t border-outline-variant/60 mt-2">
                      ${!a.isDefaultShipping ? `
                        <button onclick="window.setDefaultAddress('${c.id}', '${a.id}')" class="text-primary text-[11px] font-bold hover:underline">Set Default</button>
                      ` : ''}
                      <button onclick="window.deleteAddress('${c.id}', '${a.id}')" class="text-error text-[11px] font-bold hover:underline">Delete</button>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>

          <!-- Internal Admin Notes -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Internal Admin Notes</h3>
            <div class="space-y-3 max-h-48 overflow-y-auto mb-3">
              ${notes.length === 0 ? `<p class="text-xs text-secondary italic">No notes added.</p>` :
                notes.map(n => `
                  <div class="bg-surface-container-low p-3 rounded-lg border border-outline-variant/60 text-xs flex justify-between items-start">
                    <div>
                      <p class="text-on-surface font-medium">${escapeHtml(n.content)}</p>
                      <p class="text-[10px] text-secondary mt-1">${escapeHtml(n.authorName || 'Admin')} • ${new Date(n.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    <button onclick="window.deleteCustomerNote('${c.id}', '${n.id}')" class="text-secondary hover:text-error">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                `).join('')
              }
            </div>

            <div class="flex gap-2">
              <input id="customerNoteInput" type="text" placeholder="Type internal note (visible to admins only)..." class="flex-1 border border-outline-variant rounded-lg p-2.5 text-xs focus:ring-primary"/>
              <button onclick="window.submitCustomerNote('${c.id}')" class="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
                Add Note
              </button>
            </div>
          </div>

          <!-- Activity Audit Log -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Customer Activity Timeline</h3>
            <div class="space-y-3 max-h-48 overflow-y-auto text-xs">
              ${activities.length === 0 ? `<p class="text-secondary italic">No activity logs recorded yet.</p>` :
                activities.map(act => `
                  <div class="flex items-start gap-2 py-1.5 border-b border-outline-variant/40 last:border-b-0">
                    <span class="material-symbols-outlined text-primary text-sm mt-0.5">history</span>
                    <div>
                      <p class="font-semibold text-on-surface">${escapeHtml(act.action.replace(/_/g, ' '))}</p>
                      ${act.details ? `<p class="text-secondary">${escapeHtml(act.details)}</p>` : ''}
                      <p class="text-[10px] text-outline mt-0.5">${new Date(act.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>

        </div>

        <!-- Right 1 Col: Orders Summary & Key Stats -->
        <div class="space-y-6">

          <div class="border border-outline-variant rounded-xl p-5 bg-white space-y-4">
            <h3 class="font-bold text-sm text-on-surface border-b border-outline-variant pb-2">Customer Metrics</h3>

            <div>
              <p class="text-xs text-secondary uppercase font-bold">Total Spent</p>
              <p class="text-xl font-bold text-primary font-mono mt-0.5">₹${c.totalSpent.toLocaleString('en-IN')}</p>
            </div>

            <div>
              <p class="text-xs text-secondary uppercase font-bold">Total Orders Placed</p>
              <p class="text-lg font-bold text-on-surface mt-0.5">${c.totalOrdersCount}</p>
            </div>

            <div>
              <p class="text-xs text-secondary uppercase font-bold">Account Registration</p>
              <p class="text-xs font-semibold text-on-surface mt-0.5">${new Date(c.createdAt).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <!-- Recent Orders Card -->
          <div class="border border-outline-variant rounded-xl p-5 bg-white">
            <h3 class="font-bold text-sm text-on-surface mb-3">Recent Orders (${orders.length})</h3>
            <div class="space-y-2 text-xs">
              ${orders.length === 0 ? `<p class="text-secondary italic">No orders placed yet.</p>` :
                orders.map(o => `
                  <div class="flex items-center justify-between p-2.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low/40">
                    <div>
                      <a href="orders.html?id=${o.id}" class="font-mono font-bold text-primary hover:underline">${escapeHtml(o.orderNumber)}</a>
                      <p class="text-[10px] text-secondary">${new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-bold text-on-surface">₹${o.total.toLocaleString('en-IN')}</p>
                      <span class="text-[10px] font-bold text-emerald-600">${o.status}</span>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // Customer Status Update (Active, Suspended, Blocked, Deleted)
  window.updateCustomerStatus = async function (userId, newStatus) {
    const reason = prompt(`Reason for setting status to ${newStatus}:`, 'Admin maintenance');
    if (reason === null) return;

    try {
      const res = await fetch(`${API_URL}/customers/${userId}/status`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ status: newStatus, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Account status updated to ${newStatus}`, 'success');
        fetchCustomerStats();
        fetchCustomersList(currentPage);
        if (activeCustomer && activeCustomer.id === userId) {
          window.openCustomerDrawer(userId);
        }
      } else {
        showToast(data.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      console.error('Status error:', err);
      showToast('Error updating status', 'error');
    }
  };

  // Add Customer Tag
  window.addTag = async function (userId) {
    const select = document.getElementById('newTagSelect');
    const newTag = select ? select.value : '';
    if (!newTag || !activeCustomer) return;

    const existingTags = activeCustomer.tags || [];
    if (existingTags.includes(newTag)) {
      showToast(`Tag ${newTag} is already assigned`, 'info');
      return;
    }

    const updatedTags = [...existingTags, newTag];

    try {
      const res = await fetch(`${API_URL}/customers/${userId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ tags: updatedTags }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tag added successfully', 'success');
        window.openCustomerDrawer(userId);
      }
    } catch (err) {
      console.error('Tag add error:', err);
    }
  };

  // Remove Customer Tag
  window.removeTag = async function (userId, tagToRemove) {
    if (!activeCustomer) return;
    const updatedTags = (activeCustomer.tags || []).filter(t => t !== tagToRemove);

    try {
      const res = await fetch(`${API_URL}/customers/${userId}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ tags: updatedTags }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tag removed', 'info');
        window.openCustomerDrawer(userId);
      }
    } catch (err) {
      console.error('Tag remove error:', err);
    }
  };

  // Submit Internal Admin Note
  window.submitCustomerNote = async function (userId) {
    const input = document.getElementById('customerNoteInput');
    const content = input ? input.value.trim() : '';
    if (!content) {
      showToast('Please enter note text', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/customers/${userId}/notes`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Admin note saved!', 'success');
        window.openCustomerDrawer(userId);
      } else {
        showToast(data.message || 'Failed to save note', 'error');
      }
    } catch (err) {
      console.error('Note submit error:', err);
    }
  };

  // Delete Customer Note
  window.deleteCustomerNote = async function (userId, noteId) {
    try {
      const res = await fetch(`${API_URL}/customers/notes/${noteId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Note deleted', 'info');
        window.openCustomerDrawer(userId);
      }
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  // Address Actions
  window.setDefaultAddress = async function (userId, addressId) {
    try {
      const res = await fetch(`${API_URL}/customers/${userId}/addresses`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action: 'SET_DEFAULT', addressId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Default address updated!', 'success');
        window.openCustomerDrawer(userId);
      }
    } catch (err) {
      console.error('Set default address error:', err);
    }
  };

  window.deleteAddress = async function (userId, addressId) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      const res = await fetch(`${API_URL}/customers/${userId}/addresses`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action: 'DELETE', addressId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Address deleted', 'info');
        window.openCustomerDrawer(userId);
      }
    } catch (err) {
      console.error('Delete address error:', err);
    }
  };

  // Export Customer List CSV
  async function exportCustomersCsv() {
    try {
      const res = await fetch(`${API_URL}/customers/export-csv`, {
        headers: await getAuthHeaders(),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Customers CSV exported successfully', 'success');
    } catch (err) {
      console.error('CSV Export error:', err);
      showToast('Failed to export customers CSV', 'error');
    }
  }

  function getStatusBadge(status) {
    const map = {
      'ACTIVE': 'chip-success',
      'INACTIVE': 'chip-warning',
      'SUSPENDED': 'chip-warning',
      'BLOCKED': 'chip-danger',
      'DELETED': 'chip-danger',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return 'Never';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Render Pagination
  function renderPagination(pagination) {
    const container = document.getElementById('customerPagination');
    if (!container || !pagination) return;

    const { page, totalPages, total } = pagination;
    const startItem = (page - 1) * pagination.limit + 1;
    const endItem = Math.min(total, page * pagination.limit);

    container.innerHTML = `
      <p class="text-body-sm text-secondary">
        Showing <span class="font-bold text-on-surface">${startItem}</span> to <span class="font-bold text-on-surface">${endItem}</span> of <span class="font-bold text-on-surface">${total}</span> customers
      </p>
      <div class="flex gap-2">
        <button 
          onclick="window.changeCustomerPage(${page - 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page <= 1 ? 'disabled' : ''}
        >Previous</button>
        <span class="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold">${page} / ${totalPages}</span>
        <button 
          onclick="window.changeCustomerPage(${page + 1})"
          class="px-4 py-1.5 border border-outline-variant rounded-lg text-sm text-secondary hover:bg-surface-container-low disabled:opacity-40"
          ${page >= totalPages ? 'disabled' : ''}
        >Next</button>
      </div>
    `;
  }

  window.changeCustomerPage = function (newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchCustomersList(newPage);
    }
  };

  // Event Listeners
  function setupEventListeners() {
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchCustomersList(1), 350);
      });
    }

    ['filterCustomerStatus', 'filterCustomerTag', 'filterRegStartDate', 'filterRegEndDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => fetchCustomersList(1));
    });

    const btnExport = document.getElementById('btnExportCustomersCsv');
    if (btnExport) btnExport.addEventListener('click', exportCustomersCsv);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomersPage);
  } else {
    initCustomersPage();
  }
})();
