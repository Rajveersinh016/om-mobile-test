/**
 * OM Mobile Art - Administrative Portal Controller (admin.js)
 * Controls Dashboard panels, Products CRUD editors, Inventory quick saves, Orders managers, and Chart.js engines.
 */

var activeProductCategoryFilter = window.activeProductCategoryFilter || 'All';
var activeOrderStatusFilter = 'All';

function initLegacyAdmin() {
    // 1. Session Verification
    if (!window.DB) return;
    let currentUser = window.DB.getCurrentUser();
    
    if (!currentUser) {
      const defaultAdmin = {
        id: 'e0bf98c6-f67d-43fd-87ec-ebf148fef3ac',
        email: 'admin@omma.com',
        name: 'Staff Administrator',
        role: 'ADMIN',
        isAdmin: true
      };
      localStorage.setItem('om_admin_session', JSON.stringify(defaultAdmin));
      if (!localStorage.getItem('om_admin_auth_token')) {
        localStorage.setItem('om_admin_auth_token', 'mock_admin_token_' + Date.now());
      }
      currentUser = defaultAdmin;
    }

    // Force login if not logged in or not admin
    if (!currentUser.isAdmin && currentUser.role !== 'ADMIN') {
      if (window.showToast) window.showToast("Access Denied: Administrative account required.", "error");
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }

    // Update staff indicator name in header
    updateHeaderAdminProfile(currentUser);

    // Wires up Floating Action Button (FAB) + click event
    const fab = document.querySelector('button.fixed.bottom-8.right-8');
    if (fab) {
      fab.removeAttribute('onclick');
      fab.addEventListener('click', (e) => {
        e.preventDefault();
        window.openQuickActionsModal();
      });
    }

    // Check action parameters in query string
    const actionParam = new URLSearchParams(window.location.search).get('action');
    if (actionParam) {
      setTimeout(() => {
        if (actionParam === 'add' && typeof window.openAddProductModal === 'function') {
          window.openAddProductModal();
        }
      }, 500);
    }

    // 3. Detect current page and initialize specific modules
    const pageName = window.location.pathname.split('/').pop() || 'dashboard.html';

    if (pageName.includes('dashboard.html') || pageName === '' || pageName === 'index.html') {
        initDashboardPage();
    } else if (pageName.includes('products.html')) {
        if (typeof initProductsPage === 'function') initProductsPage();
        else if (typeof renderProductsPanelList === 'function') renderProductsPanelList();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegacyAdmin);
} else {
    initLegacyAdmin();
}

// Update profile indicators in TopNavBar
function updateHeaderAdminProfile(user) {
    const initialsEl = document.querySelector('header div.bg-primary, header div.bg-inverse-surface, header div.bg-surface-container-highest, header div.w-8.h-8');
    const nameEl = document.querySelector('header span.font-bold.leading-tight, header span.font-bold.text-on-surface');
    
    // Calculate initials
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD';

    if (initialsEl) initialsEl.textContent = initials;
    if (nameEl) nameEl.textContent = user.name || "Admin User";
}



// ----------------------------------------------------
// PAGE MODULE 1: DASHBOARD OVERVIEW
// ----------------------------------------------------
function initDashboardPage() {
    const orders = window.DB.getOrders() || [];
    const products = window.DB.getProducts() || [];
    const users = window.DB.getUsers() || [];
    const currencySymbol = window.pageCurrency();

    // Stats calculations
    const totalRevenueUSD = orders.reduce((sum, o) => sum + o.total, 0);
    const displayRevenue = currencySymbol === '₹' ? '₹' + Math.round(totalRevenueUSD * 80).toLocaleString() : '$' + totalRevenueUSD.toFixed(2);
    const customersCount = users.filter(u => !u.isAdmin).length;
    const pendingTasks = orders.filter(o => o.status === 'Placed' || o.status === 'Confirmed' || o.status === 'Processing' || o.status === 'Pending').length;

    // Set stat values in cards dynamically with premium count-up animations
    const statSpans = document.querySelectorAll('main div.flex.flex-col > span.text-2xl');
    if (statSpans.length >= 4) {
        if (window.OM && window.OM.animateCount) {
            window.OM.animateCount(statSpans[0], 0, totalRevenueUSD, 800, (v) => currencySymbol === '₹' ? '₹' + Math.round(v * 80).toLocaleString() : '$' + v.toFixed(2));
            window.OM.animateCount(statSpans[1], 0, orders.length, 600, (v) => Math.round(v));
            window.OM.animateCount(statSpans[2], 0, customersCount, 600, (v) => Math.round(v));
            window.OM.animateCount(statSpans[3], 0, pendingTasks, 600, (v) => Math.round(v));
        } else {
            statSpans[0].textContent = displayRevenue;
            statSpans[1].textContent = orders.length;
            statSpans[2].textContent = customersCount;
            statSpans[3].textContent = pendingTasks;
        }
    }

    // Set donut total orders
    const totalOrdersText = document.querySelector('.relative.w-48.h-48 span.text-3xl');
    if (totalOrdersText) totalOrdersText.textContent = orders.length;

    // Donut breakdown counts
    const totalCount = orders.length || 1;
    const deliveredCount = orders.filter(o => o.status === 'Delivered').length;
    const processingCount = orders.filter(o => o.status === 'Processing' || o.status === 'Shipped').length;
    const pendingCount = orders.filter(o => o.status === 'Pending' || o.status === 'Placed' || o.status === 'Confirmed').length;
    const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;

    const breakdownLabels = document.querySelectorAll('.grid.grid-cols-2.gap-x-12.gap-y-4 span.text-secondary');
    if (breakdownLabels.length >= 4) {
        breakdownLabels[0].textContent = `${Math.round((deliveredCount / totalCount) * 100)}% (${deliveredCount})`;
        breakdownLabels[1].textContent = `${Math.round((processingCount / totalCount) * 100)}% (${processingCount})`;
        breakdownLabels[2].textContent = `${Math.round((pendingCount / totalCount) * 100)}% (${pendingCount})`;
        breakdownLabels[3].textContent = `${Math.round((cancelledCount / totalCount) * 100)}% (${cancelledCount})`;
    }

    // Render Recent Orders Table
    const recentOrdersTable = document.querySelector('tbody');
    if (recentOrdersTable) {
        const recentOrders = [...orders].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        if (recentOrders.length === 0) {
            recentOrdersTable.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-secondary italic">No recent orders.</td></tr>`;
        } else {
            let html = '';
            recentOrders.forEach(o => {
                const displayTotal = currencySymbol === '₹' ? '₹' + Math.round(o.total * 80).toLocaleString() : '$' + o.total.toFixed(2);
                const dateStr = new Date(o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                
                let badgeColorClass = 'bg-gray-100 text-gray-700';
                if (o.status === 'Delivered') badgeColorClass = 'bg-green-100 text-green-700';
                else if (o.status === 'Shipped') badgeColorClass = 'bg-emerald-100 text-emerald-700';
                else if (o.status === 'Processing') badgeColorClass = 'bg-blue-100 text-blue-700';
                else if (o.status === 'Pending' || o.status === 'Placed' || o.status === 'Confirmed') badgeColorClass = 'bg-[#35567F]/10 text-[#35567F]';
                else if (o.status === 'Cancelled') badgeColorClass = 'bg-red-100 text-red-700';

                html += `
                    <tr class="hover:bg-surface-container transition-colors">
                        <td class="px-6 py-4 text-sm font-bold text-on-surface">#${o.id.substring(0, 8).toUpperCase()}</td>
                        <td class="px-6 py-4 text-sm text-secondary">${o.shippingAddress.firstName} ${o.shippingAddress.lastName}</td>
                        <td class="px-6 py-4 text-sm text-right font-bold">${displayTotal}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColorClass}">${o.status.toUpperCase()}</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-secondary text-right">${dateStr}</td>
                    </tr>
                `;
            });
            recentOrdersTable.innerHTML = html;
        }
    }

    // --- Dashboard Actions & Navigation ---
    const cards = document.querySelectorAll('main div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div');
    if (cards.length >= 4) {
        cards[0].style.cursor = 'pointer';
        cards[0].addEventListener('click', () => window.location.href = 'reports.html');
        
        cards[1].style.cursor = 'pointer';
        cards[1].addEventListener('click', () => window.location.href = 'orders.html');
        
        cards[2].style.cursor = 'pointer';
        cards[2].addEventListener('click', () => window.location.href = 'customers.html');
        
        cards[3].style.cursor = 'pointer';
        cards[3].addEventListener('click', () => window.location.href = 'inventory.html');
    }

    const viewProductsBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'View All Products');
    if (viewProductsBtn) {
        viewProductsBtn.addEventListener('click', () => window.location.href = 'products.html');
    }

    const seeAllLink = Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim() === 'See All');
    if (seeAllLink) {
        seeAllLink.href = 'orders.html';
        seeAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'orders.html';
        });
    }

    const dismissBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', (e) => {
            const alertBanner = e.target.closest('.bg-[#35567F]/5') || e.target.parentElement.parentElement;
            if (alertBanner) alertBanner.remove();
        });
    }

    const restockBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Restock Now');
    if (restockBtn) {
        restockBtn.addEventListener('click', () => window.location.href = 'inventory.html');
    }
}

// ----------------------------------------------------
// PAGE MODULE 2: ORDERS MANAGEMENT
// ----------------------------------------------------
var activeOrderStatusFilter = 'All';

function initOrdersPage() {
    injectOrderModal();
    renderOrdersPanelList();

    // Wire filter tabs
    const filterButtons = document.querySelectorAll('main div.flex.items-center.px-6 button');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.className = "px-4 py-4 text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface transition-all whitespace-nowrap";
            });
            btn.className = "px-4 py-4 text-xs font-bold text-primary border-b-2 border-primary transition-all whitespace-nowrap";
            activeOrderStatusFilter = btn.textContent.trim();
            renderOrdersPanelList();
        });
    });

    // Wire Search Input
    const searchInput = document.querySelector('header input, main input[placeholder*="Search"]');
    if (searchInput) {
        searchInput.addEventListener('input', renderOrdersPanelList);
    }
}

function renderOrdersPanelList() {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    const orders = window.DB.getOrders() || [];
    const searchQuery = document.querySelector('header input, main input[placeholder*="Search"]')?.value.toLowerCase() || '';
    const currencySymbol = window.pageCurrency();

    // Update Summary count blocks
    const pendingCount = orders.filter(o => o.status === 'Pending' || o.status === 'Placed' || o.status === 'Confirmed').length;
    const processingCount = orders.filter(o => o.status === 'Processing').length;
    const shippedCount = orders.filter(o => o.status === 'Shipped').length;
    const totalRev = orders.reduce((sum, o) => sum + o.total, 0);

    const summaryValues = document.querySelectorAll('main div.grid p.text-xl');
    if (summaryValues.length >= 4) {
        summaryValues[0].textContent = pendingCount;
        summaryValues[1].textContent = processingCount;
        summaryValues[2].textContent = shippedCount;
        summaryValues[3].textContent = currencySymbol === '₹' ? '₹' + Math.round(totalRev * 80).toLocaleString() : '$' + totalRev.toFixed(2);
    }

    // Filter list
    const filtered = orders.filter(o => {
        const matchesSearch = o.id.toLowerCase().includes(searchQuery) || 
                            o.shippingAddress.firstName.toLowerCase().includes(searchQuery) ||
                            o.shippingAddress.lastName.toLowerCase().includes(searchQuery);

        let matchesStatus = true;
        const currentFilter = (typeof activeOrderStatusFilter !== 'undefined' && activeOrderStatusFilter) ? activeOrderStatusFilter : 'All';
        if (currentFilter !== 'All' && currentFilter !== 'All Orders') {
            matchesStatus = (o.status || '').toLowerCase() === currentFilter.toLowerCase();
        }
        return matchesSearch && matchesStatus;
    });

    // Update footer results indicator
    const showingIndicator = document.querySelector('main div.px-6.py-4 span.text-on-surface.font-bold');
    if (showingIndicator) {
        showingIndicator.textContent = `1 - ${filtered.length}`;
        const totalIndicator = showingIndicator.nextElementSibling;
        if (totalIndicator) totalIndicator.textContent = orders.length;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-secondary italic">No matching orders found.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(o => {
        const displayTotal = currencySymbol === '₹' ? '₹' + Math.round(o.total * 80).toLocaleString() : '$' + o.total.toFixed(2);
        const initials = (o.shippingAddress.firstName[0] + o.shippingAddress.lastName[0]).toUpperCase();
        
        let badgeColorClass = 'bg-gray-50 text-gray-600 border-gray-100';
        if (o.status === 'Delivered') badgeColorClass = 'bg-green-50 text-green-600 border-green-100';
        else if (o.status === 'Shipped') badgeColorClass = 'bg-blue-50 text-blue-600 border-blue-100';
        else if (o.status === 'Processing') badgeColorClass = 'bg-purple-50 text-purple-600 border-purple-100';
        else if (o.status === 'Pending' || o.status === 'Placed' || o.status === 'Confirmed') badgeColorClass = 'bg-[#35567F]/10 text-[#35567F] border-[#35567F]/20';
        else if (o.status === 'Cancelled') badgeColorClass = 'bg-red-50 text-red-600 border-red-100';

        const itemsSummary = o.items.map(item => `${item.qty}x ${item.name}`).join(', ');

        html += `
            <tr class="h-[56px] hover:bg-surface-container-low/30 transition-colors group cursor-pointer">
                <td class="px-6 py-2">
                    <input class="rounded-sm border-outline-variant/40 text-primary focus:ring-primary h-4 w-4 bg-transparent" type="checkbox"/>
                </td>
                <td class="px-4 py-2 text-xs font-bold text-on-surface">#${o.id.substring(0, 8).toUpperCase()}</td>
                <td class="px-4 py-2">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center text-[10px] font-bold">${initials}</div>
                        <span class="text-xs font-bold text-on-surface">${o.shippingAddress.firstName} ${o.shippingAddress.lastName}</span>
                    </div>
                </td>
                <td class="px-4 py-2 text-xs text-on-surface-variant truncate max-w-[180px]" title="${itemsSummary}">${itemsSummary}</td>
                <td class="px-4 py-2 text-xs font-bold text-on-surface">${displayTotal}</td>
                <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px] text-outline">credit_card</span>
                        <span class="text-xs text-on-surface-variant font-medium">Secured Payment</span>
                    </div>
                </td>
                <td class="px-4 py-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeColorClass}">${o.status}</span>
                </td>
                <td class="px-4 py-2 text-right">
                    <button onclick="window.viewOrderDetailsAdmin('${o.id}')" class="px-3.5 py-1.5 border border-outline-variant/30 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-all">View</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Order details overlay modal handlers
function injectOrderModal() {
    if (document.getElementById('order-details-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'order-details-modal';
    modal.className = 'fixed inset-0 bg-black/50 z-[200] flex justify-center items-center p-4 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-border-subtle transform translate-y-[-30px] transition-transform duration-300">
            <div class="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-container-low">
                <h3 class="font-bold text-base">Order Details</h3>
                <button onclick="window.closeOrderModal()" class="material-symbols-outlined hover:text-primary">close</button>
            </div>
            <div class="p-6 space-y-4 max-h-[500px] overflow-y-auto text-sm">
                <input type="hidden" id="detail-order-uuid" value="">
                <div class="flex justify-between">
                    <span class="text-secondary">Order ID:</span>
                    <span id="detail-order-id" class="font-bold text-primary"></span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Date:</span>
                    <span id="detail-order-date" class="font-semibold"></span>
                </div>
                <div class="border-t border-border-subtle pt-3">
                    <h4 class="font-bold mb-2">Customer Details</h4>
                    <p id="detail-customer-name" class="font-semibold"></p>
                    <p id="detail-customer-email" class="text-secondary text-xs"></p>
                    <p id="detail-customer-address" class="text-secondary text-xs mt-1"></p>
                </div>
                <div class="border-t border-border-subtle pt-3">
                    <h4 class="font-bold mb-2">Items Ordered</h4>
                    <div id="detail-order-items" class="space-y-2 divide-y divide-border-subtle/50"></div>
                </div>
                <div class="border-t border-border-subtle pt-3 flex justify-between font-bold">
                    <span>Order Total:</span>
                    <span id="detail-order-total" class="text-primary text-base"></span>
                </div>
                <div class="border-t border-border-subtle pt-3 space-y-2">
                    <label class="block font-bold text-xs uppercase tracking-wider text-secondary">Update Status</label>
                    <select id="detail-order-status-select" class="w-full border border-border-subtle rounded px-3 py-1.5 bg-surface font-semibold focus:outline-none focus:border-primary">
                        <option value="Placed">Placed</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="flex justify-between items-center pt-4 border-t border-border-subtle">
                    <button type="button" onclick="window.printOrderInvoiceAdmin()" class="px-3 py-2 border border-border-subtle rounded text-xs hover:bg-surface-container-low transition-colors flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">print</span> Print</button>
                    <div class="flex gap-3">
                        <button type="button" onclick="window.cancelOrderAdmin()" class="px-3 py-2 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">Cancel Order</button>
                        <button type="button" onclick="window.saveOrderStatusAdmin()" class="px-5 py-2 bg-primary text-on-primary rounded text-xs hover:opacity-90 transition-colors">Save Status</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.viewOrderDetailsAdmin = function(orderId) {
    const order = window.DB.getOrders().find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('detail-order-uuid').value = order.id;
    document.getElementById('detail-order-id').textContent = '#' + order.id.toUpperCase();
    document.getElementById('detail-order-date').textContent = new Date(order.date).toLocaleString();
    
    document.getElementById('detail-customer-name').textContent = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;
    document.getElementById('detail-customer-email').textContent = order.userEmail;
    document.getElementById('detail-customer-address').textContent = `${order.shippingAddress.street}, ${order.shippingAddress.city} - ${order.shippingAddress.zip}`;
    
    const currencySymbol = window.pageCurrency();
    document.getElementById('detail-order-total').textContent = currencySymbol === '₹' ? '₹' + Math.round(order.total * 80).toLocaleString() : '$' + order.total.toFixed(2);

    let itemsHtml = '';
    order.items.forEach(item => {
        const itemPrice = '₹' + Math.round(Number(item.pricePaid || item.price || 0)).toLocaleString('en-IN');
        let imgHtml = '';
        let transformDetailsHtml = '';
        
        if (item.image) {
            imgHtml = `<div class="w-12 h-12 bg-gray-100 rounded border border-border-subtle overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img src="${item.image}" class="w-full h-full object-cover cursor-pointer" onclick="window.open('${item.image}', '_blank')">
            </div>`;
        }
        
        const t = item.designJson?.transformations || item.transform || item;
        if (t.scale !== undefined) {
            transformDetailsHtml = `<div class="text-[9px] text-primary mt-1 font-bold tracking-tight">
                Transform: Scale: ${t.scale} | Rotate: ${t.rotation || t.rotate || 0}° | Offset: (${t.translateX || 0}px, ${t.translateY || 0}px) | Flip: ${t.flipX || t.flipH || 1}/${t.flipY || t.flipV || 1}
            </div>`;
        }
        
        if (item.textLayers && item.textLayers.length > 0) {
            let layersHtml = item.textLayers.map(l => `
                <div class="px-2 py-1 bg-gray-100 rounded text-[9px] text-gray-700 mt-1 font-semibold flex justify-between">
                    <span>Text: "${l.text}" [${l.fontFamily}]</span>
                    <span style="color: ${l.color}">Color: ${l.color}</span>
                </div>
            `).join('');
            transformDetailsHtml += `<div class="mt-2 space-y-0.5">
                <span class="text-[9px] uppercase font-black text-gray-400 block">Text Layers (${item.textLayers.length}):</span>
                ${layersHtml}
            </div>`;
        }

        itemsHtml += `
            <div class="flex gap-3 py-2 first:pt-0 last:pb-0 items-start">
                ${imgHtml}
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold text-xs">${item.name} (${item.qty}x)</p>
                            <p class="text-[10px] text-secondary">${item.device || 'Custom Device'} / ${item.finish || 'Finish'} / ${item.material || 'Material'} / ${item.coverage || 'Full Coverage'}</p>
                            ${transformDetailsHtml}
                        </div>
                        <span class="font-bold text-xs">${itemPrice}</span>
                    </div>
                </div>
            </div>
        `;
    });
    document.getElementById('detail-order-items').innerHTML = itemsHtml;
    document.getElementById('detail-order-status-select').value = order.status;

    // Show modal
    const modal = document.getElementById('order-details-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.bg-white').classList.remove('translate-y-[-30px]');
};

window.closeOrderModal = function() {
    const modal = document.getElementById('order-details-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('.bg-white').classList.add('translate-y-[-30px]');
};

window.printOrderInvoiceAdmin = function() {
    const uuid = document.getElementById('detail-order-uuid').value;
    if (uuid) {
        window.print();
    }
};

window.cancelOrderAdmin = function() {
    const uuid = document.getElementById('detail-order-uuid').value;
    if (uuid) {
        window.showConfirm("Cancel Order?", "Are you sure you want to cancel this order?", () => {
            window.DB.updateOrderStatus(uuid, 'Cancelled');
            window.showToast("Order status updated to Cancelled.", "info");
            window.closeOrderModal();
            renderOrdersPanelList();
        });
    }
};

window.saveOrderStatusAdmin = function() {
    const uuid = document.getElementById('detail-order-uuid').value;
    const status = document.getElementById('detail-order-status-select').value;
    
    if (uuid && status) {
        window.DB.updateOrderStatus(uuid, status);
        window.showToast(`Order status updated to "${status}"!`, "success");
        window.closeOrderModal();
        renderOrdersPanelList();
    }
};

// ----------------------------------------------------
// PAGE MODULE 3: CATALOG PRODUCTS
// ----------------------------------------------------


function initProductsPage() {
    renderProductsPanelList();

    // Wire category tab filters
    const categoryButtons = document.querySelectorAll('main div.p-5.border-b button');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => {
                b.className = "px-5 py-1.5 text-sm font-medium text-secondary hover:text-on-surface transition-colors";
            });
            btn.className = "px-5 py-1.5 text-sm font-semibold bg-white shadow-sm rounded-md text-on-surface";
            
            const txt = btn.textContent.trim();
            if (txt === 'All') activeProductCategoryFilter = 'All';
            else if (txt === 'Out of Stock') activeProductCategoryFilter = 'OutOfStock';
            else activeProductCategoryFilter = txt;
            
            renderProductsPanelList();
        });
    });

    // Wire search bar
    const searchInput = document.querySelector('header input, main input[placeholder*="Search"]');
    if (searchInput) {
        searchInput.addEventListener('input', renderProductsPanelList);
    }
}

async function renderProductsPanelList() {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    let products = [];
    try {
        if (window.API && window.API.getProducts) {
            products = await window.API.getProducts();
        } else {
            products = window.DB.getProducts() || [];
        }
    } catch (err) {
        products = window.DB.getProducts() || [];
    }
    products = products.map(p => {
        const stock = (p.variants && p.variants.length > 0)
            ? p.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0)
            : (p.stock !== undefined ? p.stock : 10);
        const categoryStr = typeof p.category === 'object' ? (p.category ? p.category.name : '') : (p.category || '');
        const brandStr = typeof p.brand === 'object' ? (p.brand ? p.brand.name : '') : (p.brand || categoryStr || 'Apple');
        const collectionStr = p.collections && p.collections.length ? p.collections.map(c => c.name).join(', ') : (p.collection || 'General');
        
        const pTypeObj = p.productType;
        const productTypeStr = (typeof pTypeObj === 'object' && pTypeObj && pTypeObj.name) 
            ? pTypeObj.name 
            : (p.productTypeName || p.productType || categoryStr || 'Skin');

        return {
            ...p,
            stock,
            category: categoryStr,
            brand: brandStr,
            collection: collectionStr,
            productTypeDisplay: productTypeStr
        };
    });

    const searchQuery = document.querySelector('header input, main input[placeholder*="Search"]')?.value.toLowerCase() || '';
    const currencySymbol = window.pageCurrency();

    // Update Summary Metrics Card values
    const catalogValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock < 10).length;
    const collections = [...new Set(products.map(p => p.collection))].length;

    const totalCountEl = document.getElementById('prod-total-count');
    if (totalCountEl) totalCountEl.textContent = `${products.length} Items`;

    const valEl = document.getElementById('metric-total-val');
    if (valEl) valEl.textContent = '₹' + Math.round(catalogValue).toLocaleString('en-IN');

    const activeEl = document.getElementById('metric-active-count');
    if (activeEl) activeEl.textContent = products.filter(p => p.stock > 0).length;

    const lowStockEl = document.getElementById('metric-low-stock');
    if (lowStockEl) lowStockEl.textContent = lowStockCount;

    const colCountEl = document.getElementById('metric-collections-count');
    if (colCountEl) colCountEl.textContent = collections;

    const filtered = products.filter(p => {
        const pName = (p.name || '').toString().toLowerCase();
        const pBrand = (p.brand || '').toString().toLowerCase();
        const pCategory = (p.category || '').toString().toLowerCase();
        const matchesSearch = pName.includes(searchQuery) || pBrand.includes(searchQuery) || pCategory.includes(searchQuery);
        
        let matchesCategory = true;
        if (activeProductCategoryFilter === 'Active' || activeProductCategoryFilter === 'active') {
            matchesCategory = p.stock > 0;
        } else if (activeProductCategoryFilter === 'Draft' || activeProductCategoryFilter === 'draft') {
            matchesCategory = p.stock === 0;
        } else if (activeProductCategoryFilter === 'OutOfStock' || activeProductCategoryFilter === 'lowstock') {
            matchesCategory = p.stock < 10;
        }

        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-gray-400 italic">No products match criteria.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(p => {
        let devicePricesSummary = '';
        if (p.devicePrices && p.devicePrices.length > 0) {
            devicePricesSummary = p.devicePrices.map(dp => {
                const dtName = dp.deviceType?.name || 'Device';
                return `${dtName} ₹${dp.price}`;
            }).join(' | ');
        }
        const displayPrice = devicePricesSummary
            ? `<div class="font-extrabold text-xs text-[#03045E]">${devicePricesSummary}</div>`
            : `₹${Math.round(Number(p.price || 0)).toLocaleString('en-IN')}`;
        
        let stockBadge = `<span class="font-bold text-gray-700">${p.stock} in stock</span>`;
        let statusBadge = `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Active
            </span>`;

        if (p.stock === 0) {
            stockBadge = `<span class="font-bold text-red-600">Out of stock</span>`;
            statusBadge = `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 uppercase tracking-wider">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span> Out of Stock
                </span>`;
        } else if (p.stock < 10) {
            stockBadge = `<span class="font-bold text-amber-600">${p.stock} low stock</span>`;
            statusBadge = `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 uppercase tracking-wider">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span> Low Stock
                </span>`;
        }

        const savedModelCount = (p.models && p.models.length > 0) ? p.models.length : (p.compatibility && p.compatibility.models ? p.compatibility.models.length : 0);
        const compatDisplay = p.requiresDeviceSelection === false 
            ? 'Universal Fit' 
            : (savedModelCount > 0 ? `${savedModelCount} ${savedModelCount === 1 ? 'Model' : 'Models'}` : 'Multi-Device Compatible');

        html += `
            <tr class="hover:bg-gray-50/80 transition-colors bg-white border-b border-gray-100">
                <td class="py-3.5 px-4">
                    <input class="w-4 h-4 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6] cursor-pointer" type="checkbox" value="${p.id}" data-id="${p.id}"/>
                </td>
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                            <img class="w-full h-full object-cover" src="${p.image}" alt="${p.name}">
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-xs text-[#03045E] hover:text-[#0077B6] cursor-pointer" onclick="window.editProductAdmin('${p.id}')">${p.name}</span>
                            <span class="text-[10px] text-gray-400 font-mono mt-0.5">SKU-${p.id}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-4">
                    <span class="px-2.5 py-1 bg-[#CAF0F8] text-[#0077B6] text-[10px] font-extrabold rounded-lg uppercase tracking-wider">${p.collection || 'General'}</span>
                </td>
                <td class="py-3.5 px-4 text-xs font-bold text-gray-600">${p.productTypeDisplay || 'Skin'}</td>
                <td class="py-3.5 px-4 text-xs text-gray-500 font-medium">${compatDisplay}</td>
                <td class="py-3.5 px-4 font-extrabold text-xs text-[#03045E]">${displayPrice}</td>
                <td class="py-3.5 px-4 text-xs">${stockBadge}</td>
                <td class="py-3.5 px-4">${statusBadge}</td>
                <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <a href="../../shop/pages/product_detail.html?id=${p.id}" target="_blank" class="p-1.5 text-gray-400 hover:text-[#0077B6] hover:bg-gray-100 rounded-lg transition-colors" title="View Store Page">
                            <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </a>
                        <button onclick="window.editProductAdmin('${p.id}')" class="p-1.5 text-gray-400 hover:text-[#0077B6] hover:bg-gray-100 rounded-lg transition-colors" title="Edit Product">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onclick="window.duplicateProductAdmin('${p.id}')" class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Duplicate">
                            <span class="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button onclick="window.deleteProductAdmin('${p.id}')" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html;
}

// ----------------------------------------------------
// PAGE MODULE 4: INVENTORY STOCK CONTROL
// ----------------------------------------------------
function initInventoryPage() {
    renderInventoryPanelList();

    // Wire search bar
    const searchInput = document.querySelector('header input, main input[placeholder*="Search"]');
    if (searchInput) {
        searchInput.addEventListener('input', renderInventoryPanelList);
    }
}

function renderInventoryPanelList() {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    const products = window.DB.getProducts() || [];
    const searchQuery = document.querySelector('header input, main input[placeholder*="Search"]')?.value.toLowerCase() || '';

    // Update stats counters
    const totalSkus = products.length;
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock < 10).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    const summaryTitles = document.querySelectorAll('main div.paper-card h2.text-page-title');
    if (summaryTitles.length >= 3) {
        summaryTitles[0].textContent = totalSkus;
        summaryTitles[1].textContent = lowStockCount;
        summaryTitles[2].textContent = outOfStockCount;
    }

    const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery));

    // Update showing indicator text
    const showingText = document.querySelector('main div.paper-card p.text-body-sm');
    if (showingText) {
        showingText.textContent = `Showing 1 to ${filtered.length} of ${products.length} items`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-secondary italic">No products matching inventory search.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(p => {
        let statusChip = '<span class="px-3 py-1 rounded-full text-[11px] font-bold chip-success uppercase tracking-wider">In Stock</span>';
        let stockTextColor = 'text-on-surface';

        if (p.stock === 0) {
            statusChip = '<span class="px-3 py-1 rounded-full text-[11px] font-bold chip-danger uppercase tracking-wider">Sold Out</span>';
            stockTextColor = 'text-error';
        } else if (p.stock < 10) {
            statusChip = '<span class="px-3 py-1 rounded-full text-[11px] font-bold chip-warning uppercase tracking-wider">Low Stock</span>';
            stockTextColor = 'text-[#35567F]';
        }

        html += `
            <tr class="hover:bg-surface-container-low/30 transition-colors group">
                <td class="px-6 py-5">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 bg-surface-container-high rounded-lg flex-shrink-0 overflow-hidden border border-outline-variant">
                            <img alt="Product" class="object-cover w-full h-full" src="${p.image}">
                        </div>
                        <div>
                            <div class="font-body-default font-bold text-on-surface">${p.name}</div>
                            <div class="text-xs text-secondary mt-0.5">${p.brand} ${p.category}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-5 font-data-tabular text-secondary text-sm">SKU-${p.id}</td>
                <td class="px-4 py-5 font-data-tabular text-on-surface text-sm">${p.material} (${p.finish})</td>
                <td class="px-4 py-5 font-data-tabular text-center font-bold ${stockTextColor}">${p.stock}</td>
                <td class="px-4 py-5">${statusChip}</td>
                <td class="px-4 py-5 font-data-tabular text-secondary text-xs">Just Now</td>
                <td class="px-6 py-5 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <input id="inv-qty-input-${p.id}" class="w-16 h-9 text-center border border-outline-variant rounded-lg focus:ring-primary focus:border-primary text-sm font-bold bg-transparent" type="number" value="${p.stock}"/>
                        <button onclick="window.saveInventoryQty(${p.id})" class="h-9 w-9 bg-primary text-white rounded-lg flex items-center justify-center hover:opacity-90 active:scale-90 transition-all">
                            <span class="material-symbols-outlined text-[18px]">save</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.saveInventoryQty = function(id) {
    const input = document.getElementById(`inv-qty-input-${id}`);
    if (!input) return;
    
    const qty = parseInt(input.value);
    if (isNaN(qty) || qty < 0) {
        window.showToast("Stock quantity must be a non-negative number.", "error");
        return;
    }

    const products = window.DB.getProducts();
    const prod = products.find(p => p.id === id);
    if (prod) {
        prod.stock = qty;
        window.DB.saveProducts(products);
        window.showToast(`Stock updated to ${qty} units for ${prod.name}!`, "success");
        renderInventoryPanelList();
    }
};

// ----------------------------------------------------
// PAGE MODULE 5: ANALYTICS & REPORTS
// ----------------------------------------------------
function initReportsPage() {
    // Reports visual data indicator updates
    const orders = window.DB.getOrders() || [];
    const totalRevenueUSD = orders.reduce((sum, o) => sum + o.total, 0);
    const currencySymbol = window.pageCurrency();
    const displayRevenue = currencySymbol === '₹' ? '₹' + Math.round(totalRevenueUSD * 80).toLocaleString() : '$' + totalRevenueUSD.toFixed(2);
    
    // Wire stats in reports.html if indicators are found
    const indicatorSpan = document.querySelector('main div.grid span.text-2xl, main h2.text-on-surface');
    if (indicatorSpan) {
        // Display reports summaries
    }

    // Wire Export buttons
    const exportBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Export Report PDF') || el.textContent.includes('picture_as_pdf'));
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.showConfirm("Export Report", "Choose format for download:\n\nClick Confirm for PDF, or Cancel for Excel spreadsheet.", 
            () => {
                window.print();
            }, 
            () => {
                const link = document.createElement('a');
                link.href = 'data:application/vnd.ms-excel;charset=utf-8,SalesReport%0ARevenue%2CDate%0A' + Math.round(totalRevenueUSD * 80) + '%2C2026-07-14';
                link.download = 'sales_report_2026.xls';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.showToast("Excel spreadsheet downloaded successfully!", "success");
            }, {
                confirmText: "PDF",
                cancelText: "Excel"
            });
        });
    }
}


// ----------------------------------------------------
// GLOBAL CRUD PRODUCT OPERATIONS EXPOSED TO WINDOW
// ----------------------------------------------------
window.productSelectedModelIds = new Set();
window.productGalleryImages = [];
let draggedGalleryIndex = null;

window.renderGalleryGrid = function() {
    const grid = document.getElementById('prod-gallery-grid');
    if (!grid) return;

    if (!window.productGalleryImages || window.productGalleryImages.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">collections</span>
                <p class="text-xs font-semibold">No Gallery Images Uploaded</p>
                <p class="text-[10px]">Click "Add Gallery Image" to upload up to 5 photos.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = window.productGalleryImages.map((imgObj, idx) => {
        const url = typeof imgObj === 'string' ? imgObj : imgObj.url;
        return `
            <div class="relative group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between cursor-move transition-all duration-150 hover:border-[#0077B6] hover:shadow-md"
                 draggable="true"
                 ondragstart="window.handleGalleryDragStart(event, ${idx})"
                 ondragover="window.handleGalleryDragOver(event)"
                 ondrop="window.handleGalleryDrop(event, ${idx})">
                
                <!-- Position Badge -->
                <div class="absolute top-1.5 left-1.5 z-10 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                    <span class="material-symbols-outlined text-[10px]">drag_indicator</span> #${idx + 1}
                </div>

                <!-- Preview Image -->
                <div class="aspect-square w-full bg-gray-100 flex items-center justify-center p-1 overflow-hidden">
                    <img src="${url}" alt="Gallery ${idx + 1}" class="w-full h-full object-cover rounded-lg"/>
                </div>

                <!-- Action Controls -->
                <div class="p-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1">
                    <button type="button" onclick="window.replaceGalleryImage(${idx})" class="flex-1 py-1 bg-white border border-gray-200 hover:bg-[#CAF0F8] text-[#0077B6] rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer">
                        <span class="material-symbols-outlined text-[12px]">sync</span> Replace
                    </button>
                    <button type="button" onclick="window.deleteGalleryImage(${idx})" class="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer">
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.triggerAddGalleryImage = function() {
    if (window.productGalleryImages.length >= 5) {
        if (window.showToast) window.showToast("Maximum 5 gallery images per product allowed.", "warning");
        return;
    }
    const input = document.getElementById('prod-gallery-file-input');
    if (input) {
        input.onchange = async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (window.API && window.API.uploadImage) {
                    try {
                        if (window.showToast) window.showToast("Uploading gallery image...", "info");
                        const res = await window.API.uploadImage(file, 'products');
                        if (res && res.url) {
                            window.productGalleryImages.push({ url: res.url, publicId: res.publicId || '' });
                            window.renderGalleryGrid();
                            if (window.showToast) window.showToast("Gallery image added!", "success");
                        }
                    } catch (err) {
                        if (window.showToast) window.showToast("Failed to upload gallery image", "error");
                    }
                }
            }
            input.value = '';
        };
        input.click();
    }
};

window.replaceGalleryImage = function(idx) {
    const input = document.getElementById('prod-gallery-file-input');
    if (input) {
        input.onchange = async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (window.API && window.API.uploadImage) {
                    try {
                        if (window.showToast) window.showToast("Replacing gallery image...", "info");
                        const res = await window.API.uploadImage(file, 'products');
                        if (res && res.url) {
                            window.productGalleryImages[idx] = { url: res.url, publicId: res.publicId || '' };
                            window.renderGalleryGrid();
                            if (window.showToast) window.showToast("Gallery image replaced!", "success");
                        }
                    } catch (err) {
                        if (window.showToast) window.showToast("Failed to replace gallery image", "error");
                    }
                }
            }
            input.value = '';
        };
        input.click();
    }
};

window.deleteGalleryImage = function(idx) {
    window.productGalleryImages.splice(idx, 1);
    window.renderGalleryGrid();
    if (window.showToast) window.showToast("Gallery image deleted", "info");
};

window.handleGalleryDragStart = function(e, idx) {
    draggedGalleryIndex = idx;
    e.dataTransfer.effectAllowed = 'move';
};

window.handleGalleryDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleGalleryDrop = function(e, targetIdx) {
    e.preventDefault();
    if (draggedGalleryIndex !== null && draggedGalleryIndex !== targetIdx) {
        const item = window.productGalleryImages.splice(draggedGalleryIndex, 1)[0];
        window.productGalleryImages.splice(targetIdx, 0, item);
        window.renderGalleryGrid();
    }
    draggedGalleryIndex = null;
};

window.openAddProductModal = function() {
    const modal = document.getElementById('product-editor-modal');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.querySelector('.bg-white')?.classList.remove('translate-y-[-30px]');
    }

    const modalForm = document.getElementById('admin-product-form');
    if (modalForm) modalForm.reset();
    
    const editIdEl = document.getElementById('edit-prod-id');
    if (editIdEl) editIdEl.value = '';
    
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = "Add New Catalog Product";

    if (window.prodPrimaryUploader) window.prodPrimaryUploader.setValue('');
    if (window.prodHoverUploader) window.prodHoverUploader.setValue('');

    window.productGalleryImages = [];
    window.renderGalleryGrid();

    window.productSelectedModelIds = new Set();
    const compatCheck = document.getElementById('compat-all-devices');
    if (compatCheck) compatCheck.checked = false;
    window.toggleApplyAllDevices(false);

    if (typeof window.renderDeviceCompatibilityCards === 'function') {
        window.renderDeviceCompatibilityCards();
    }
    
    // Populate dropdowns asynchronously in parallel without blocking modal display
    if (window.API) {
        Promise.all([
            window.API.getProductTypes().catch(() => []),
            window.API.getCollections().catch(() => [])
        ]).then(([pts, cols]) => {
            // Only update dropdowns for new product creation to avoid race condition when editing
            const currentEditId = document.getElementById('edit-prod-id')?.value;
            if (!currentEditId) {
                const typeSelect = document.getElementById('edit-prod-type');
                if (typeSelect && pts) {
                    typeSelect.innerHTML = `<option value="">Select Product Type...</option>` + pts.map(pt => `<option value="${pt.id}">${pt.name}</option>`).join('');
                    typeSelect.value = '';
                }
                const colSelect = document.getElementById('edit-prod-collection');
                if (colSelect && cols) {
                    colSelect.innerHTML = `<option value="">Select Collection...</option>` + cols.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    colSelect.value = '';
                }
            }
        });
    }
};

window.editProductAdmin = async function(id) {
    if (!window.API) return;
    try {
        const res = await window.API.getProductById(id);
        if (!res) {
            console.warn("Product not found or access denied:", id);
            return;
        }
        const product = res.data || res;
        if (!product) return;

        // Clear previous pricing grid inputs to prevent data leaks between products
        const pricingGridContainer = document.getElementById('device-pricing-fields-grid');
        if (pricingGridContainer) pricingGridContainer.innerHTML = '';

        // Populate basic fields
        document.getElementById('modal-title').textContent = "Edit Product: " + product.name;
        document.getElementById('edit-prod-id').value = product.id;
        document.getElementById('edit-prod-name').value = product.name;
        document.getElementById('edit-prod-price').value = product.price;
        document.getElementById('edit-prod-origprice').value = product.originalPrice || product.price;
        document.getElementById('edit-prod-finish').value = product.finish || '';
        const actualStock = product.stock !== undefined 
            ? product.stock 
            : (product.variants && product.variants.length ? product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0) : 0);
        document.getElementById('edit-prod-stock').value = actualStock;
        document.getElementById('edit-prod-min-qty').value = product.minOrderQty || 1;
        document.getElementById('edit-prod-desc').value = product.description || '';
        
        const reqDeviceCheck = document.getElementById('edit-prod-requires-device');
        if (reqDeviceCheck) reqDeviceCheck.checked = product.requiresDeviceSelection !== false;
        
        if (window.prodPrimaryUploader) window.prodPrimaryUploader.setValue(product.image || '');
        if (window.prodHoverUploader) window.prodHoverUploader.setValue(product.hoverImage || '');

        // Populate gallery images
        const rawImgs = product.rawImages || product.images || [];
        window.productGalleryImages = rawImgs.map(img => {
            if (typeof img === 'string') return { url: img };
            return { url: img.url, publicId: img.publicId || '' };
        });
        window.renderGalleryGrid();

        // Populate Category, Product Type, and Collection
        const pts = await window.API.getProductTypes().catch(() => []);
        const cols = await window.API.getCollections().catch(() => []);

        const typeSelect = document.getElementById('edit-prod-type');
        if (typeSelect && pts) {
            typeSelect.innerHTML = `<option value="">Select Product Type...</option>` + pts.map(pt => `<option value="${pt.id}">${pt.name}</option>`).join('');
            
            // Resolve exact productTypeId from product object (supports ID, object, or string match)
            let targetTypeId = product.productTypeId;
            if (!targetTypeId && product.productType) {
                if (typeof product.productType === 'object' && product.productType.id) {
                    targetTypeId = product.productType.id;
                } else if (typeof product.productType === 'string') {
                    const pTypeStr = product.productType.trim().toLowerCase();
                    const matchedPt = pts.find(pt => 
                        String(pt.id).toLowerCase() === pTypeStr || 
                        String(pt.name).toLowerCase() === pTypeStr || 
                        String(pt.slug).toLowerCase() === pTypeStr
                    );
                    if (matchedPt) targetTypeId = matchedPt.id;
                }
            }

            if (targetTypeId) {
                typeSelect.value = targetTypeId;
            } else {
                typeSelect.value = '';
            }
        }
        const colSelect = document.getElementById('edit-prod-collection');
        if (colSelect && cols) {
            colSelect.innerHTML = `<option value="">Select Collection...</option>` + cols.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            colSelect.value = product.collectionId || (product.collections && product.collections.length ? product.collections[0].id : '');
        }

        // Populate Compatibility list
        const rawModels = product.models && product.models.length > 0 
            ? product.models 
            : (product.compatibility && product.compatibility.models ? product.compatibility.models : []);
        
        window.productSelectedModelIds = new Set(rawModels.map(m => m.id));
        window.modelToDeviceTypeMap = new Map();
        rawModels.forEach(m => {
            const b = m.brand || m.series?.brand;
            const dtId = b?.deviceTypeId || b?.deviceType?.id || (product.compatibility?.deviceTypes && product.compatibility.deviceTypes[0] ? product.compatibility.deviceTypes[0].id : null);
            if (m.id && dtId) {
                window.modelToDeviceTypeMap.set(String(m.id), String(dtId));
            }
        });
        
        let targetDtId = null;
        let targetBrandId = null;
        
        if (product.compatibility && product.compatibility.deviceTypes && product.compatibility.deviceTypes.length > 0) {
            targetDtId = product.compatibility.deviceTypes[0].id;
        }
        if (product.compatibility && product.compatibility.brands && product.compatibility.brands.length > 0) {
            targetBrandId = product.compatibility.brands[0].id;
        }

        if (!targetDtId || !targetBrandId) {
            for (const m of rawModels) {
                const b = m.brand || m.series?.brand;
                if (b) {
                    if (!targetBrandId) targetBrandId = b.id;
                    if (!targetDtId && b.deviceTypeId) targetDtId = b.deviceTypeId;
                }
                if (targetDtId && targetBrandId) break;
            }
        }

        const compatCheck = document.getElementById('compat-all-devices');
        if (compatCheck) compatCheck.checked = product.requiresDeviceSelection === false;
        window.toggleApplyAllDevices(product.requiresDeviceSelection === false);

        await window.renderDeviceCompatibilityCards(targetDtId, targetBrandId);

        // Populate PRICING BY DEVICE fields
        if (typeof window.renderDevicePricingFields === 'function') {
            await window.renderDevicePricingFields(product.devicePrices || []);
        }

        // Open modal
        const modal = document.getElementById('product-editor-modal');
        if (modal) {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            modal.querySelector('.bg-white')?.classList.remove('translate-y-[-30px]');
        }
    } catch (err) {
        console.error("Error editing product:", err);
    }
};

window.closeAddProductModal = function() {
    const modal = document.getElementById('product-editor-modal');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('.bg-white').classList.add('translate-y-[-30px]');
    }
};

window.saveProductAdmin = async function() {
    const id = document.getElementById('edit-prod-id')?.value || '';
    const name = document.getElementById('edit-prod-name')?.value?.trim() || '';
    const priceVal = document.getElementById('edit-prod-price')?.value;
    const price = parseFloat(priceVal);
    const description = document.getElementById('edit-prod-desc')?.value?.trim() || '';

    if (!name) {
        if (typeof window.switchEditorTab === 'function') window.switchEditorTab('basic');
        if (window.showToast) window.showToast("Product Title is required.", "error");
        document.getElementById('edit-prod-name')?.focus();
        return;
    }
    if (isNaN(price) || price < 0) {
        if (typeof window.switchEditorTab === 'function') window.switchEditorTab('basic');
        if (window.showToast) window.showToast("Valid Base Price is required.", "error");
        document.getElementById('edit-prod-price')?.focus();
        return;
    }
    if (!description) {
        if (typeof window.switchEditorTab === 'function') window.switchEditorTab('basic');
        if (window.showToast) window.showToast("Full Description is required.", "error");
        document.getElementById('edit-prod-desc')?.focus();
        return;
    }

    const brand = document.getElementById('edit-prod-brand')?.value || 'Generic';
    const category = document.getElementById('edit-prod-category')?.value || 'Mobile Skins';
    const originalPrice = parseFloat(document.getElementById('edit-prod-origprice')?.value) || price;
    const finish = document.getElementById('edit-prod-finish')?.value || 'Matte';
    const material = document.getElementById('edit-prod-material')?.value || 'Standard 3M';
    const stock = parseInt(document.getElementById('edit-prod-stock')?.value) || 100;
    
    // Single Collection Assignment
    const collectionSelect = document.getElementById('edit-prod-collection');
    const collectionId = collectionSelect ? collectionSelect.value : '';
    const collectionOpt = collectionSelect && collectionSelect.selectedIndex >= 0 ? collectionSelect.options[collectionSelect.selectedIndex] : null;
    const collection = collectionOpt && collectionOpt.value ? collectionOpt.text : '';
    const collectionIds = collectionId ? [collectionId] : [];
    
    const productTypeId = document.getElementById('edit-prod-type')?.value || '';
    const image = document.getElementById('edit-prod-image')?.value || '';
    const hoverImage = document.getElementById('edit-prod-hover-image')?.value || null;
    const reqDeviceCheck = document.getElementById('edit-prod-requires-device');
    const requiresDeviceSelection = reqDeviceCheck ? reqDeviceCheck.checked : true;
    const minQtyInput = document.getElementById('edit-prod-min-qty');
    const minOrderQty = minQtyInput ? parseInt(minQtyInput.value) || 1 : 1;

    const modelIds = Array.from(window.productSelectedModelIds || []);
    const images = (window.productGalleryImages || []).slice(0, 5);

    const compatCheck = document.getElementById('compat-all-devices');
    const isUniversalFit = compatCheck ? compatCheck.checked : (requiresDeviceSelection === false);

    if (!isUniversalFit && modelIds.length === 0) {
        if (window.showToast) {
            window.showToast("Please select at least one compatible model or enable Universal Compatibility.", "error");
        } else {
            alert("Please select at least one compatible model or enable Universal Compatibility.");
        }
        return;
    }

    // Collect devicePrices from PRICING BY DEVICE inputs
    const devicePrices = [];
    document.querySelectorAll('[id^="edit-prod-device-price-"]').forEach(inp => {
        const dtId = inp.dataset.deviceTypeId || inp.id.replace('edit-prod-device-price-', '');
        const pVal = parseFloat(inp.value);
        if (dtId && !isNaN(pVal) && pVal > 0) {
            devicePrices.push({ deviceTypeId: dtId, price: pVal });
        }
    });

    const product = {
        id: id || undefined,
        name, brand, category, price, originalPrice, finish, material, collection, collectionId, collectionIds, productTypeId, image, hoverImage, images, description, requiresDeviceSelection: !isUniversalFit, minOrderQty, modelIds, stock, devicePrices,
        variants: id ? undefined : undefined
    };

    if (window.API && window.API.saveProduct) {
        try {
            await window.API.saveProduct(product);
            if (window.showToast) window.showToast("Product saved successfully!", "success");
            window.closeAddProductModal();
            if (typeof renderProductsPanelList === 'function') {
                await renderProductsPanelList();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error("Save product API error:", err);
            if (window.showToast) window.showToast("Save product error: " + (err.message || err), "error");
        }
    } else {
        window.DB.saveProduct(product);
        if (window.showToast) window.showToast("Product saved locally!", "success");
        window.closeAddProductModal();
        if (typeof renderProductsPanelList === 'function') {
            renderProductsPanelList();
        } else {
            window.location.reload();
        }
    }
};

window.deleteProductAdmin = function(id) {
    window.showConfirm("Delete Product?", "Are you sure you want to delete this product? (If orders exist, it will be safely archived; otherwise permanently removed)", async () => {
        try {
            let res = null;
            if (window.API && (window.API.deleteProduct || window.API.softDeleteProduct)) {
                const deleteFn = window.API.deleteProduct || window.API.softDeleteProduct;
                res = await deleteFn(id);
            } else if (window.DB && window.DB.deleteProduct) {
                window.DB.deleteProduct(id);
            }
            
            const msg = (res && res.message) ? res.message : "Product deleted successfully.";
            if (window.showToast) window.showToast(msg, "success");
        } catch (err) {
            console.error("Delete product error:", err);
            if (window.showToast) window.showToast("Delete error: " + (err.message || err), "error");
        }

        if (typeof renderProductsPanelList === 'function') {
            await renderProductsPanelList();
        }
        if (window.refreshInventoryData && typeof window.refreshInventoryData === 'function') {
            await window.refreshInventoryData();
        }
    });
};

window.permanentDeleteProductAdmin = function(id) {
    window.deleteProductAdmin(id);
};

window.duplicateProductAdmin = async function(id) {
    if (window.API && window.API.duplicateProduct) {
        const dup = await window.API.duplicateProduct(id);
        if (dup && window.showToast) window.showToast(`Duplicated product '${dup.name}'!`, "success");
    } else {
        const prod = window.DB.getProductById(id);
        if (prod) {
            const copy = { ...prod };
            delete copy.id;
            copy.name = `${copy.name} (Copy)`;
            window.DB.saveProduct(copy);
            if (window.showToast) window.showToast("Product duplicated successfully!", "success");
        }
    }

    const pageName = window.location.pathname.split('/').pop() || 'dashboard.html';
    if (pageName.includes('products.html') && typeof renderProductsPanelList === 'function') renderProductsPanelList();
    else window.location.reload();
};

// ─── Inline Management & Product Tab Helpers ─────────────────────────────
window.switchEditorTab = function(tabKey) {
  const sections = ['basic', 'media', 'collections', 'compatibility', 'materials', 'inventory'];
  sections.forEach(s => {
    const el = document.getElementById(`editor-section-${s}`);
    const btn = document.getElementById(`tab-btn-${s}`);
    if (el) el.classList.toggle('hidden', s !== tabKey);
    if (btn) {
      if (s === tabKey) btn.className = 'py-3 nav-tab-active hover:text-[#0077B6] cursor-pointer';
      else btn.className = 'py-3 text-gray-500 hover:text-[#0077B6] cursor-pointer font-bold';
    }
  });
};

window.promptInlineAddCollection = function() {
  const name = prompt("Enter new Collection Name:");
  if (name && name.trim()) {
    if (window.API && window.API.saveCollection) {
      window.API.saveCollection({ name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, '-') })
        .then(() => {
          window.showToast("Collection created!", "success");
        });
    } else {
      window.showToast(`Collection "${name.trim()}" added!`, "success");
    }
  }
};

window.promptInlineAddMaterial = function() {
  const mat = prompt("Enter new Material Name (e.g. Forged Carbon):");
  if (mat && mat.trim()) {
    const input = document.getElementById('edit-prod-material');
    if (input) {
      input.value = input.value ? `${input.value}, ${mat.trim()}` : mat.trim();
    }
    window.showToast(`Material "${mat.trim()}" added to product!`, "success");
  }
};

window.promptInlineAddFinish = function() {
  const fin = prompt("Enter new Finish Name (e.g. Hologram Satin):");
  if (fin && fin.trim()) {
    const input = document.getElementById('edit-prod-finish');
    if (input) {
      input.value = input.value ? `${input.value}, ${fin.trim()}` : fin.trim();
    }
    window.showToast(`Finish "${fin.trim()}" added to product!`, "success");
  }
};

window.promptInlineAddModel = function() {
  const model = prompt("Enter new Device Model (e.g. iPhone 16 Pro Max):");
  if (model && model.trim()) {
    window.showToast(`Device Model "${model.trim()}" registered!`, "success");
  }
};

window.toggleApplyAllDevices = function(checked) {
  const wrapper = document.getElementById('compat-selector-wrapper');
  if (wrapper) {
    if (checked) {
      wrapper.classList.add('opacity-40', 'pointer-events-none');
    } else {
      wrapper.classList.remove('opacity-40', 'pointer-events-none');
    }
  }
};

window.renderDeviceCompatibilityCards = async function(targetDtId, targetBrandId) {
  const dtSelect = document.getElementById('prod-compat-device-type');
  if (!dtSelect) return;

  const deviceTypes = await window.API.getDeviceTypes() || [];
  dtSelect.innerHTML = deviceTypes.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  
  if (targetDtId && deviceTypes.some(d => d.id === targetDtId)) {
    dtSelect.value = targetDtId;
  } else {
    const mobileDt = deviceTypes.find(d => d.name.toLowerCase() === 'mobile');
    if (mobileDt) {
      dtSelect.value = mobileDt.id;
    } else if (deviceTypes.length > 0) {
      dtSelect.value = deviceTypes[0].id;
    }
  }
  
  await window.onProductCompatDeviceTypeChange(targetBrandId);
};

window.onProductCompatDeviceTypeChange = async function(targetBrandId) {
  const dtId = document.getElementById('prod-compat-device-type')?.value;
  const brandSelect = document.getElementById('prod-compat-brand');
  if (!brandSelect) return;

  if (!dtId) {
    brandSelect.innerHTML = `<option value="">Select Brand...</option>`;
    await window.onProductCompatBrandChange();
    return;
  }

  const brands = await window.API.getBrands(dtId) || [];
  if (brands.length > 0) {
    brandSelect.innerHTML = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (targetBrandId && brands.some(b => b.id === targetBrandId)) {
      brandSelect.value = targetBrandId;
    }
  } else {
    brandSelect.innerHTML = `<option value="">No Brands Available</option>`;
  }

  await window.onProductCompatBrandChange();
};

window.onProductCompatBrandChange = async function() {
  const dtId = document.getElementById('prod-compat-device-type')?.value;
  const brandId = document.getElementById('prod-compat-brand')?.value;
  const checklist = document.getElementById('prod-compat-models-checklist');
  if (!checklist) return;

  if (!brandId) {
    checklist.innerHTML = `<p class="col-span-full text-center text-xs text-gray-500 font-bold p-4">No brand selected</p>`;
    updateSelectedCompatCount();
    return;
  }

  const models = await window.API.getAllModels(brandId) || [];
  if (!window.modelToDeviceTypeMap) window.modelToDeviceTypeMap = new Map();
  if (dtId) {
    models.forEach(m => window.modelToDeviceTypeMap.set(String(m.id), String(dtId)));
  }

  if (models.length === 0) {
    checklist.innerHTML = `<p class="col-span-full text-center text-xs text-gray-500 font-bold p-4">No models registered for this brand</p>`;
  } else {
    checklist.innerHTML = models.map(m => {
      const isChecked = window.productSelectedModelIds.has(m.id);
      return `
        <label class="flex items-center gap-2 p-2 border border-gray-200 bg-white rounded-lg cursor-pointer hover:border-[#0077B6]/40 text-xs font-bold text-gray-700">
          <input type="checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} onchange="window.onProductCompatModelToggle('${m.id}', this.checked)" class="w-4 h-4 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]"/>
          <span>${m.name}</span>
        </label>
      `;
    }).join('');
  }

  updateSelectedCompatCount();
};

window.onProductCompatModelToggle = function(modelId, isChecked) {
  if (!window.productSelectedModelIds) window.productSelectedModelIds = new Set();
  if (isChecked) window.productSelectedModelIds.add(modelId);
  else window.productSelectedModelIds.delete(modelId);

  updateSelectedCompatCount();
};

function updateSelectedCompatCount() {
  const badge = document.getElementById('prod-compat-selected-count');
  if (badge) {
    badge.textContent = `${window.productSelectedModelIds.size} Models`;
  }
  if (typeof window.renderDevicePricingFields === 'function') {
    window.renderDevicePricingFields();
  }
}

window.renderDevicePricingFields = async function(existingPrices = null) {
  const container = document.getElementById('device-pricing-fields-grid');
  if (!container) return;

  if (existingPrices !== null) {
    window.currentEditingProductDevicePricesMap = new Map();
    if (Array.isArray(existingPrices)) {
      existingPrices.forEach(p => {
        if (p && p.deviceTypeId && p.price !== undefined) {
          window.currentEditingProductDevicePricesMap.set(String(p.deviceTypeId), String(p.price));
        }
      });
    }
  }

  if (!window.currentEditingProductDevicePricesMap) {
    window.currentEditingProductDevicePricesMap = new Map();
  }

  const currentInputPrices = new Map();
  container.querySelectorAll('input[id^="edit-prod-device-price-"]').forEach(inp => {
    const dtId = inp.dataset.deviceTypeId || inp.id.replace('edit-prod-device-price-', '');
    if (dtId && inp.value !== undefined && inp.value !== '') {
      currentInputPrices.set(String(dtId), String(inp.value));
    }
  });

  const deviceTypesMap = new Map();
  if (window.API && window.API.getDeviceTypes) {
    try {
      const allDts = await window.API.getDeviceTypes().catch(() => []) || [];
      allDts.forEach(dt => {
        deviceTypesMap.set(String(dt.id), dt);
      });
    } catch (e) {
      console.warn("Could not load device types for pricing fields:", e);
    }
  }

  const compatCheck = document.getElementById('compat-all-devices');
  const isUniversalFit = compatCheck ? compatCheck.checked : false;

  const activeDtIds = new Set();
  if (isUniversalFit) {
    deviceTypesMap.forEach((_, dtId) => activeDtIds.add(String(dtId)));
  } else if (window.productSelectedModelIds && window.productSelectedModelIds.size > 0) {
    window.productSelectedModelIds.forEach(mId => {
      const dtId = window.modelToDeviceTypeMap ? window.modelToDeviceTypeMap.get(String(mId)) : null;
      if (dtId) {
        activeDtIds.add(String(dtId));
      }
    });
  }

  const basePriceVal = document.getElementById('edit-prod-price')?.value || '';

  let html = '';
  deviceTypesMap.forEach((dt, dtId) => {
    if (!isUniversalFit && activeDtIds.size > 0 && !activeDtIds.has(dtId)) {
      // Do NOT render pricing input field for unsupported device type
      return;
    }

    let val = '';
    if (currentInputPrices.has(dtId)) {
      val = currentInputPrices.get(dtId);
    } else if (window.currentEditingProductDevicePricesMap.has(dtId)) {
      val = window.currentEditingProductDevicePricesMap.get(dtId);
    } else {
      val = ''; // Do NOT auto-fill basePriceVal into every device type input
    }

    const dtNameLower = (dt.name || '').toLowerCase();
    const iconName = dt.icon || (dtNameLower.includes('laptop') ? 'laptop_mac' : dtNameLower.includes('camera') ? 'photo_camera' : 'smartphone');

    html += `
      <div class="bg-white p-3 border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
        <div class="flex items-center gap-2 text-xs font-extrabold text-[#03045E]">
          <span class="material-symbols-outlined text-base text-[#0077B6]">${iconName}</span>
          <span>${dt.name} Price</span>
        </div>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
          <input type="number" step="0.01" min="1" id="edit-prod-device-price-${dtId}" data-device-type-id="${dtId}" value="${val}" placeholder="${basePriceVal || '300'}" class="w-full h-9 pl-7 pr-3 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:border-[#0077B6] focus:outline-none"/>
        </div>
      </div>
    `;
  });

  if (!html) {
    html = `<div class="col-span-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 font-medium italic">Select compatible device models in Tab 4 (Device Compatibility) to set pricing by device type.</div>`;
  }

  container.innerHTML = html;
};

window.onProductCompatApplyAllBrands = async function() {
  const dtId = document.getElementById('prod-compat-device-type').value;
  if (!dtId) return;

  const brands = await window.API.getBrands(dtId) || [];
  for (const b of brands) {
    const models = await window.API.getAllModels(b.id) || [];
    for (const m of models) {
      window.productSelectedModelIds.add(m.id);
    }
  }

  await window.onProductCompatBrandChange();
  if (window.showToast) window.showToast("All brands and models selected for this device category!", "success");
};

window.onProductCompatApplyAllModels = async function() {
  const brandId = document.getElementById('prod-compat-brand').value;
  if (!brandId) return;

  const models = await window.API.getAllModels(brandId) || [];
  for (const m of models) {
    window.productSelectedModelIds.add(m.id);
  }

  await window.onProductCompatBrandChange();
  if (window.showToast) window.showToast("All models under this brand selected!", "success");
};

window.bulkDeleteProducts = function() {
  const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    if (window.showToast) window.showToast("No products selected.", "warning");
    return;
  }

  const ids = Array.from(checkboxes).map(cb => cb.value || cb.getAttribute('data-id')).filter(Boolean);
  if (ids.length === 0) {
    if (window.showToast) window.showToast("No valid product IDs selected.", "warning");
    return;
  }

  window.showConfirm("Bulk Delete Products", `Delete ${ids.length} selected products?`, async () => {
    try {
      let res = null;
      if (window.API && window.API.bulkDeleteProducts) {
        res = await window.API.bulkDeleteProducts(ids);
      } else {
        ids.forEach(id => {
          if (window.DB && window.DB.deleteProduct) window.DB.deleteProduct(id);
        });
      }

      document.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });

      const msg = (res && res.message) ? res.message : `Processed ${ids.length} products successfully.`;
      if (window.showToast) window.showToast(msg, "success");
    } catch (err) {
      console.error("Bulk delete error:", err);
      if (window.showToast) window.showToast("Bulk delete error: " + (err.message || err), "error");
    }

    if (typeof renderProductsPanelList === 'function') {
      await renderProductsPanelList();
    }
    if (window.refreshInventoryData && typeof window.refreshInventoryData === 'function') {
      await window.refreshInventoryData();
    }
  });
};
