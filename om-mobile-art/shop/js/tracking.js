/**
 * OM Mobile Art — Order Tracking Controller (tracking.js)
 * Fetches live order data directly from MySQL backend.
 * Renders dynamic timeline stepper & complete audit history log.
 * Supports 3-second realtime auto-polling for instant status sync without refresh.
 */

const STATUS_STAGES = [
    { key: "PENDING_PAYMENT", label: "Payment Pending", aliases: [], desc: "Awaiting payment authorization" },
    { key: "PROCESSING", label: "Processing", aliases: ["PAID", "CONFIRMED"], desc: "Order confirmed and sent to production queue" },
    { key: "PRINTING", label: "Printing", aliases: [], desc: "Precision printing & cutting 3M vinyl material" },
    { key: "QUALITY_CHECK", label: "Quality Check", aliases: [], desc: "Inspecting texture, adhesive, and fit cuts" },
    { key: "PACKED", label: "Packed", aliases: [], desc: "Skins placed in protective archival sleeve" },
    { key: "READY_TO_SHIP", label: "Ready To Ship", aliases: [], desc: "Package sealed, shipping label generated" },
    { key: "SHIPPED", label: "Shipped", aliases: ["OUT_FOR_DELIVERY"], desc: "In transit with courier partner" },
    { key: "DELIVERED", label: "Delivered", aliases: ["COMPLETED"], desc: "Package delivered to destination address" }
];

let currentOrderData = null;
let autoPollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let orderId = urlParams.get('orderId') || urlParams.get('id');

    // Auto-detect recent order if orderId not specified
    if (!orderId && window.API && window.API.getOrders) {
        try {
            const orders = await window.API.getOrders();
            if (orders && orders.length > 0) {
                orderId = orders[0].id || orders[0].orderNumber;
            }
        } catch (err) {
            console.warn('Failed to load customer recent orders:', err);
        }
    }

    if (!orderId && window.DB && window.DB.getOrders) {
        const localOrders = window.DB.getOrders() || [];
        if (localOrders.length > 0) {
            orderId = localOrders[0].id || localOrders[0].orderNumber;
        }
    }

    if (!orderId) {
        renderOrderNotFound('OM-DEMO');
        return;
    }

    await loadAndRenderOrder(orderId);

    // Setup 3-second Realtime Auto-Polling for instant status synchronization
    startRealtimePolling(orderId);

    // Setup simulation button listeners for manual testing
    const btnPrev = document.getElementById('btn-prev-status');
    const btnNext = document.getElementById('btn-next-status');

    if (btnPrev && btnNext) {
        btnPrev.addEventListener('click', async () => {
            if (!currentOrderData) return;
            const currentIdx = getStageIndex(currentOrderData.status);
            if (currentIdx > 0) {
                const newStage = STATUS_STAGES[currentIdx - 1];
                const newStatus = newStage.key;
                try {
                    if (window.API && window.API.updateOrderStatus) {
                        await window.API.updateOrderStatus(currentOrderData.id || currentOrderData.orderNumber, newStatus, `Stage changed to ${newStage.label}`);
                    }
                } catch (e) {
                    console.warn('Backend update order status error:', e);
                }
                await loadAndRenderOrder(currentOrderData.id || orderId);
                if (window.showToast) window.showToast(`Order status set to "${newStage.label}"`, "info");
            }
        });

        btnNext.addEventListener('click', async () => {
            if (!currentOrderData) return;
            const currentIdx = getStageIndex(currentOrderData.status);
            if (currentIdx < STATUS_STAGES.length - 1) {
                const newStage = STATUS_STAGES[currentIdx + 1];
                const newStatus = newStage.key;
                try {
                    if (window.API && window.API.updateOrderStatus) {
                        await window.API.updateOrderStatus(currentOrderData.id || currentOrderData.orderNumber, newStatus, `Stage changed to ${newStage.label}`);
                    }
                } catch (e) {
                    console.warn('Backend update order status error:', e);
                }
                await loadAndRenderOrder(currentOrderData.id || orderId);
                if (window.showToast) window.showToast(`Order status set to "${newStage.label}"`, "info");
            } else {
                if (window.showToast) window.showToast("Order is already marked as Delivered!", "success");
            }
        });
    }
});

// Load order details from backend and render views
async function loadAndRenderOrder(orderId) {
    let order = null;
    if (window.API && window.API.getOrderDetails) {
        try {
            order = await window.API.getOrderDetails(orderId);
        } catch (err) {
            console.warn('Failed to load order via API.getOrderDetails:', err);
        }
    }

    if (!order && window.DB && window.DB.getOrders) {
        const localOrders = window.DB.getOrders() || [];
        order = localOrders.find(o => o.id === orderId || o.orderNumber === orderId);
    }

    if (!order) {
        renderOrderNotFound(orderId);
        return;
    }

    currentOrderData = order;
    renderOrderTracking(order);
}

// Start 3-second interval polling
function startRealtimePolling(orderId) {
    if (autoPollInterval) clearInterval(autoPollInterval);
    autoPollInterval = setInterval(async () => {
        if (!document.hidden && window.API && window.API.getOrderDetails) {
            try {
                const fresh = await window.API.getOrderDetails(orderId);
                if (fresh) {
                    const statusChanged = currentOrderData && fresh.status !== currentOrderData.status;
                    const historyChanged = currentOrderData && (fresh.statusHistory?.length !== currentOrderData.statusHistory?.length);

                    if (statusChanged || historyChanged) {
                        console.log(`[Realtime Sync] Status updated from "${currentOrderData?.status}" to "${fresh.status}"`);
                        currentOrderData = fresh;
                        renderOrderTracking(fresh);
                        if (statusChanged && window.showToast) {
                            const label = getStatusDisplayLabel(fresh.status);
                            window.showToast(`Order status updated to "${label}"`, "success");
                        }
                    }
                }
            } catch (e) {
                console.warn('Realtime polling check error:', e);
            }
        }
    }, 3000);
}

// Find stage index from status string
function getStageIndex(status) {
    if (!status) return 0;
    const stUpper = status.toUpperCase();

    const idx = STATUS_STAGES.findIndex(s => s.key === stUpper || (s.aliases && s.aliases.includes(stUpper)));
    if (idx >= 0) return idx;

    if (stUpper === 'CANCELLED' || stUpper === 'FAILED' || stUpper === 'REFUNDED') {
        return -1; // Cancelled state
    }

    return 0;
}

// Format status to human-readable string
function getStatusDisplayLabel(status) {
    if (!status) return 'Payment Pending';
    const stUpper = status.toUpperCase();
    const stage = STATUS_STAGES.find(s => s.key === stUpper || (s.aliases && s.aliases.includes(stUpper)));
    if (stage) return stage.label;
    if (stUpper === 'CANCELLED') return 'Cancelled';
    if (stUpper === 'REFUNDED') return 'Refunded';
    return status.replace(/_/g, ' ');
}

// Format date timestamp (e.g., "2 Aug 2026 4:10 PM")
function formatTimestamp(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);

    const day = d.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
}

window.searchOrderTracking = function() {
    const input = document.getElementById('order-search-input');
    if (!input || !input.value.trim()) return;
    const query = input.value.trim();
    window.location.href = `order_tracking.html?orderId=${encodeURIComponent(query)}`;
};

// Render error layout if order reference not found
function renderOrderNotFound(orderId) {
    const titleEl = document.getElementById('tracking-title');
    const subtitleEl = document.getElementById('tracking-subtitle');
    if (titleEl) titleEl.textContent = "Order Not Found";
    if (subtitleEl) subtitleEl.textContent = `We couldn't find an active order with reference "${orderId}".`;

    const stepperMount = document.getElementById('timeline-stepper-mount');
    if (stepperMount) {
        stepperMount.innerHTML = `
            <div class="text-center py-10 space-y-4">
                <span class="material-symbols-outlined text-5xl text-error">error</span>
                <h3 class="font-bold text-lg">Invalid Order Reference</h3>
                <p class="text-text-secondary text-xs max-w-md mx-auto">Please check your Order ID and try searching again above, or log in to view your orders in your profile.</p>
                <a href="profile.html" class="inline-block px-5 py-2 bg-[#03045E] text-white font-bold hover:bg-accent-hover transition-colors rounded-md text-xs">Go to My Orders</a>
            </div>
        `;
    }
}

// Render complete order tracking details
function renderOrderTracking(order) {
    const titleEl = document.getElementById('tracking-title');
    const subtitleEl = document.getElementById('tracking-subtitle');
    const orderNum = order.orderNumber || order.id || 'OM-1000';

    if (titleEl) titleEl.textContent = `Track Order: ${orderNum}`;

    const rawDate = order.createdAt || order.orderDate || order.date || new Date().toISOString();
    const formattedCreated = formatTimestamp(rawDate);
    if (subtitleEl) subtitleEl.textContent = `Ordered on ${formattedCreated}`;

    // 1. Render Dynamic Timeline Stepper & History Log
    renderTimelineStepperAndHistory(order);

    // 2. Render Order Items list
    const itemsListEl = document.getElementById('tracking-items-list');
    if (itemsListEl) {
        let itemsHtml = '';
        const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [{ productName: 'Custom Device Skin', quantity: 1, pricePaid: order.total || 399 }];

        items.forEach(item => {
            const unitPrice = Number(item.pricePaid || item.unitPrice || item.price || 0);
            const qty = Number(item.quantity || item.qty || 1);
            const itemTotal = unitPrice * qty;
            const displayPrice = `₹${itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            const prodName = item.productName || item.name || 'Custom Skin';
            const devBrand = item.deviceBrand || item.brandName || '';
            const devModel = item.deviceModel || item.deviceName || item.device || '';
            const mat = item.material || '3M Vinyl';
            const fin = item.finish || 'Matte';
            const cov = item.coverage || 'Full Back';
            const skuVal = item.sku || 'N/A';
            const imgUrl = item.imageUrl || item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';

            itemsHtml += `
                <div class="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <img src="${imgUrl}" class="w-14 h-14 object-contain p-1 rounded-xl bg-[#F8FAFC] border border-border-subtle flex-shrink-0" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'">
                    <div class="flex-grow min-w-0 space-y-0.5">
                        <h4 class="font-bold text-sm text-on-surface truncate">${prodName}</h4>
                        <p class="text-xs text-text-secondary font-medium"><span class="font-bold text-on-surface">Device:</span> ${devBrand} ${devModel}</p>
                        <p class="text-xs text-text-muted"><span class="font-semibold text-on-surface">Specs:</span> ${fin} | ${mat} | ${cov}</p>
                        <p class="text-[11px] text-text-muted font-mono">SKU: ${skuVal} • Qty: ${qty}</p>
                    </div>
                    <div class="font-bold text-sm text-right flex-shrink-0">${displayPrice}</div>
                </div>
            `;
        });
        itemsListEl.innerHTML = itemsHtml;
    }

    // 3. Render Delivery Address details
    const addressEl = document.getElementById('tracking-address');
    if (addressEl) {
        const addr = order.shippingAddress || {};
        const custName = order.customerName || addr.fullName || (addr.firstName ? `${addr.firstName} ${addr.lastName || ''}`.trim() : null) || 'Customer';
        const line1 = addr.addressLine1 || addr.street || '';
        const line2 = addr.addressLine2 || '';
        const city = addr.city || '';
        const state = addr.state || '';
        const pincode = addr.pincode || addr.zip || '';
        const country = addr.country || 'India';
        const phone = addr.phone || addr.mobile || order.customerPhone || 'N/A';

        addressEl.innerHTML = `
            <p class="font-bold text-on-surface text-sm">${custName}</p>
            <p>${line1}</p>
            ${line2 ? `<p>${line2}</p>` : ''}
            <p>${city}${state ? `, ${state}` : ''} - ${pincode}</p>
            <p>${country}</p>
            <p class="pt-2 text-xs font-semibold text-text-muted">Phone: ${phone}</p>
            <p class="pt-1 text-xs font-label-caps tracking-widest text-text-muted">Payment Status: <span class="font-bold text-primary">${order.paymentStatus || 'PAID'}</span></p>
        `;
    }
}

// Render dynamic stepper nodes and history stream
function renderTimelineStepperAndHistory(order) {
    const stepperMount = document.getElementById('timeline-stepper-mount');
    const historyMount = document.getElementById('timeline-history-mount');

    if (!stepperMount) return;

    const currentStatus = order.status || 'PENDING_PAYMENT';
    const activeIdx = getStageIndex(currentStatus);
    const isCancelled = activeIdx === -1;

    // Handle Cancelled / Refunded state
    if (isCancelled) {
        stepperMount.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-red-600">cancel</span>
                <h3 class="font-bold text-red-900 text-lg">Order ${currentStatus.replace(/_/g, ' ')}</h3>
                <p class="text-xs text-red-700 max-w-md mx-auto">This order has been cancelled or refunded. Please contact customer support if you need further assistance.</p>
            </div>
        `;
    } else {
        const totalStages = STATUS_STAGES.length;
        const progressPercentage = Math.min(100, Math.max(0, (activeIdx / (totalStages - 1)) * 100));

        let stepperNodesHtml = STATUS_STAGES.map((stage, idx) => {
            const isPassed = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            let circleClass = 'w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-500 step-circle ';
            let circleContent = '';

            if (isPassed) {
                circleClass += 'bg-[#03045E] text-white border-[#03045E] shadow-sm';
                circleContent = '✓';
            } else if (isCurrent) {
                circleClass += 'bg-[#03045E] text-white border-[#03045E] ring-4 ring-[#03045E]/20 shadow-md animate-pulse';
                circleContent = `${idx + 1}`;
            } else {
                circleClass += 'bg-white text-text-muted border-border-subtle';
                circleContent = `${idx + 1}`;
            }

            const labelClass = isCurrent ? 'text-[#03045E] font-extrabold' : (isPassed ? 'text-on-surface font-bold' : 'text-text-muted font-medium');

            return `
                <div class="relative z-10 flex flex-col items-center gap-1.5 select-none cursor-help tracking-step-node flex-1 min-w-[70px]" title="${stage.desc}">
                    <div class="${circleClass}">${circleContent}</div>
                    <span class="text-[10px] md:text-[11px] text-center tracking-tight leading-tight mt-1 ${labelClass}">${stage.label}</span>
                </div>
            `;
        }).join('');

        stepperMount.innerHTML = `
            <div class="relative flex justify-between items-start w-full pt-2 pb-4 overflow-x-auto no-scrollbar">
                <!-- Gray background line -->
                <div class="absolute left-6 right-6 h-1 bg-surface-container-high z-0 top-[22px] rounded-full"></div>
                <!-- Highlighted active line -->
                <div id="timeline-progress-line" class="absolute left-6 h-1 bg-primary z-0 top-[22px] rounded-full step-line" style="width: calc(${progressPercentage}% - 12px);"></div>

                ${stepperNodesHtml}
            </div>
        `;
    }

    // Render detailed timeline history log stream
    if (historyMount) {
        const rawHistory = Array.isArray(order.statusHistory) && order.statusHistory.length > 0
            ? order.statusHistory
            : [];

        // Build history records
        let historyItems = [...rawHistory];

        // If history is empty, synthesize records up to current status
        if (historyItems.length === 0) {
            const createdAt = order.createdAt || new Date().toISOString();
            if (activeIdx >= 0) {
                for (let i = 0; i <= activeIdx; i++) {
                    const st = STATUS_STAGES[i];
                    historyItems.push({
                        status: st.key,
                        comment: st.desc,
                        note: st.desc,
                        updatedBy: i === 0 ? 'Customer' : 'Admin',
                        createdAt: createdAt
                    });
                }
            }
        }

        // Sort history in reverse chronological order (newest first for timeline list display)
        historyItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        historyMount.innerHTML = historyItems.map((h, i) => {
            const displayLabel = getStatusDisplayLabel(h.status);
            const timeStr = formatTimestamp(h.createdAt);
            const updatedBy = h.updatedBy || 'Admin';
            const noteText = h.note || h.comment || `Status updated to ${displayLabel}`;
            const isLatest = i === 0;

            return `
                <div class="flex items-start gap-3 py-2.5 px-3 rounded-lg ${isLatest ? 'bg-[#03045E]/5 border border-[#03045E]/20' : 'bg-surface-container-low/60'} border border-border-subtle/50 transition-all">
                    <div class="w-7 h-7 rounded-full ${isLatest ? 'bg-[#03045E] text-white' : 'bg-surface-container-high text-text-muted'} flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                        <span class="material-symbols-outlined text-[15px]">${isLatest ? 'check_circle' : 'schedule'}</span>
                    </div>
                    <div class="flex-grow min-w-0">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <span class="font-bold text-xs md:text-sm text-on-surface">${displayLabel}</span>
                            <span class="text-[11px] font-semibold text-primary bg-white px-2 py-0.5 rounded border border-border-subtle">${timeStr}</span>
                        </div>
                        ${noteText ? `<p class="text-xs text-text-secondary mt-1 font-medium leading-relaxed">${noteText}</p>` : ''}
                        <p class="text-[10px] text-text-muted font-mono mt-1">Updated by: <span class="font-semibold text-on-surface">${updatedBy}</span></p>
                    </div>
                </div>
            `;
        }).join('');
    }
}
