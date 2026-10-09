/**
 * OM Mobile Art - Shopping Cart Page Controller (cart.js)
 * Implements dynamic cart grid, stepper qty handlers, remove items, coupon code validator,
 * order pricing summary engine (subtotal, shipping, GST, discounts), and empty cart state.
 */

let cartItems = [];
let activeCoupon = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.DB) return;

    // 1. Load active coupon if saved in sessionStorage
    const savedCoupon = sessionStorage.getItem('om_active_coupon');
    if (savedCoupon) {
        activeCoupon = JSON.parse(savedCoupon);
        const couponInput = document.querySelector('main input[placeholder*="code"]');
        if (couponInput) couponInput.value = activeCoupon.code;
    }

    // 2. Initial render
    renderCart();

    // 3. Setup coupon application listener
    const applyCouponBtn = document.querySelector('main button[class*="bg-on-surface"]');
    const couponInput = document.querySelector('main input[placeholder*="code"]');
    if (applyCouponBtn && couponInput) {
        // Find container and replace with standard form to intercept submit
        const parentDiv = applyCouponBtn.closest('div');
        if (parentDiv) {
            applyCouponBtn.addEventListener('click', (e) => {
                e.preventDefault();
                applyCouponCode(couponInput.value.trim());
            });
            couponInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCouponCode(couponInput.value.trim());
                }
            });
        }
    }
});

function getMinOrderQty(item) {
    if (item.minOrderQuantity !== undefined) return item.minOrderQuantity;
    if (item.minOrderQty !== undefined) return item.minOrderQty;
    return 1;
}

// Render table and summary details
function renderCart() {
    cartItems = window.DB.getCart() || [];
    
    const cartTableBody = document.querySelector('main table.w-full tbody');
    const cartWrapper = document.querySelector('main div.flex-col.lg\\:flex-row');

    if (cartItems.length === 0) {
        // Toggle empty cart screen
        renderEmptyCartScreen();
        return;
    }

    if (cartTableBody) {
        let html = '';
        cartItems.forEach((item, idx) => {
            const unitPrice = window.PricingEngine ? window.PricingEngine.calculateItemUnitPrice(item) : (Number(item.price) || 0);
            const itemTotal = unitPrice * (item.qty || 1);
            const formattedUnitPrice = window.PricingEngine ? window.PricingEngine.format(unitPrice) : `₹${unitPrice}`;
            const formattedItemTotal = window.PricingEngine ? window.PricingEngine.format(itemTotal) : `₹${itemTotal}`;

            html += `
                <tr data-index="${idx}">
                    <td>
                        <div class="flex items-center gap-6">
                            <div class="w-20 h-20 sm:w-24 sm:h-24 bg-[#F8FAFC] border border-border-subtle rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center p-1.5 shadow-sm">
                                <a href="product_detail.html?id=${item.id}" class="block w-full h-full flex items-center justify-center"><img class="max-w-full max-h-full object-contain p-1" src="${item.image}"></a>
                            </div>
                            <div>
                                <h4 class="font-headline-h3 text-body-main font-semibold">${item.name}</h4>
                                <p class="text-text-muted text-xs mt-1 uppercase tracking-wider font-label-caps">${item.deviceType ? (item.deviceType.toUpperCase() + ' • ') : ''}${item.customModelName || item.deviceModel || item.device || ''} / ${item.finish || 'Matte'} / ${item.material || 'Standard 3M'}</p>
                                <button onclick="removeCartItem(${idx})" class="mt-3 flex items-center text-error hover:underline text-[11px] font-semibold gap-1 transition-all">
                                    <span class="material-symbols-outlined text-[14px]">delete</span> REMOVE
                                </button>
                            </div>
                        </div>
                    </td>
                    <td class="font-headline-h3 text-body-main">${formattedUnitPrice}</td>
                    <td>
                        <div class="flex flex-col items-center">
                            <div class="flex items-center border border-border-subtle w-max rounded-md overflow-hidden bg-white">
                                <button onclick="updateQtyStepper(${idx}, -1)" ${item.qty <= getMinOrderQty(item) ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center hover:bg-surface-container transition-colors ${item.qty <= getMinOrderQty(item) ? 'opacity-30 cursor-not-allowed' : ''}">
                                    <span class="material-symbols-outlined text-sm">remove</span>
                                </button>
                                <input class="w-12 text-center border-none text-sm font-bold focus:ring-0 p-0 qty-input-field" type="number" min="${getMinOrderQty(item)}" value="${item.qty}" data-index="${idx}"/>
                                <button onclick="updateQtyStepper(${idx}, 1)" class="w-8 h-8 flex items-center justify-center hover:bg-surface-container transition-colors">
                                    <span class="material-symbols-outlined text-sm">add</span>
                                </button>
                            </div>
                            ${getMinOrderQty(item) > 1 ? `<p class="text-[10px] text-gray-400 mt-1 text-center">Minimum order quantity is ${getMinOrderQty(item)}.</p>` : ''}
                        </div>
                    </td>
                    <td class="text-right font-headline-h3 text-body-main font-bold">${formattedItemTotal}</td>
                </tr>
            `;
        });
        cartTableBody.innerHTML = html;

        // Bind change listener for manual typing
        cartTableBody.querySelectorAll('.qty-input-field').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const minQty = getMinOrderQty(cartItems[index]);
                let val = parseInt(e.target.value) || minQty;
                if (val < minQty) {
                    val = minQty;
                    window.showToast(`Minimum order quantity is ${minQty}.`, "error");
                }
                window.DB.updateCartQty(index, val);
                renderCart();
            });
        });
    }

    // Update subtotal, shipping, coupon values
    updateOrderSummaryValues();

    // Link Proceed to Checkout button
    const checkoutBtn = document.querySelector('main button[class*="bg-badge-sale"]');
    if (checkoutBtn) {
        // Wrap or ensure link destination
        const parentLink = checkoutBtn.closest('a');
        if (parentLink) {
            parentLink.href = 'checkout.html';
        } else {
            // Replace with button click handler
            checkoutBtn.addEventListener('click', () => {
                window.location.href = 'checkout.html';
            });
        }
    }
}

// Render empty cart layout
function renderEmptyCartScreen() {
    const container = document.querySelector('main');
    if (container) {
        container.innerHTML = `
            <div class="store-container py-20 text-center space-y-6">
                <span class="material-symbols-outlined text-6xl text-text-muted animate-pulse">shopping_cart</span>
                <h1 class="font-headline-h1 text-headline-h2 font-bold">Your Shopping Cart is Empty</h1>
                <p class="text-text-muted text-sm max-w-md mx-auto">Explore our premium catalog of precision-cut 3M mobile skins to protect and style your devices.</p>
                <a href="shop.html" class="inline-block mt-4 px-8 py-3 bg-primary text-on-primary font-button-text rounded-md hover:bg-accent-hover transition-colors shadow-sm">
                    Start Shopping
                </a>
            </div>
        `;
    }
}

window.removeCartItem = function(index) {
    if (!window.DB) return;
    window.showConfirm("Remove Item?", "Are you sure you want to remove this item from your cart?", () => {
        const tr = document.querySelector(`main table.w-full tbody tr[data-index="${index}"]`);
        if (tr) {
            tr.style.transition = 'opacity 300ms var(--ease-out-expo), transform 300ms var(--ease-out-expo)';
            tr.style.opacity = '0';
            tr.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                window.DB.removeFromCart(index);
                window.showToast("Item removed from cart.", "info");
                
                // Recalculate coupon eligibility if subtotal drops
                if (activeCoupon) {
                    const subtotal = (window.DB.getCart() || []).reduce((sum, item) => sum + (item.price * item.qty), 0);
                    if (subtotal < activeCoupon.minPurchase) {
                        activeCoupon = null;
                        sessionStorage.removeItem('om_active_coupon');
                        window.showToast("Applied coupon removed: Minimum purchase required not met.", "error");
                    }
                }
                renderCart();
            }, 300);
        } else {
            window.DB.removeFromCart(index);
            window.showToast("Item removed from cart.", "info");
            renderCart();
        }
    });
};

window.updateQtyStepper = function(index, amount) {
    if (!window.DB) return;
    const cart = window.DB.getCart() || [];
    if (cart[index]) {
        const minQty = getMinOrderQty(cart[index]);
        const newQty = Math.max(minQty, cart[index].qty + amount);
        window.DB.updateCartQty(index, newQty);
        
        // Recalculate coupon eligibility if subtotal drops
        if (activeCoupon) {
            const subtotal = (window.DB.getCart() || []).reduce((sum, item) => sum + (item.price * item.qty), 0);
            if (subtotal < activeCoupon.minPurchase) {
                activeCoupon = null;
                sessionStorage.removeItem('om_active_coupon');
                window.showToast("Applied coupon removed: Minimum purchase required not met.", "error");
            }
        }
        
        renderCart();

        // Target active row input stepper and animate a quick pop
        const tr = document.querySelector(`main table.w-full tbody tr[data-index="${index}"]`);
        const input = tr ? tr.querySelector('input') : null;
        if (input) {
            input.classList.remove('heart-burst');
            void input.offsetWidth;
            input.classList.add('heart-burst');
        }
    }
};

// Pricing summary equations with animated count-up numbers
function updateOrderSummaryValues() {
    const currency = window.pageCurrency();
    const totals = window.PricingEngine ? window.PricingEngine.calculateTotals(cartItems, activeCoupon, currency) : {
        subtotal: 0, shippingFee: 0, tax: 0, discount: 0, grandTotal: 0
    };

    const subtotal = totals.subtotal;
    const shipping = totals.shippingFee;
    const discount = totals.discount;
    const grandTotal = totals.grandTotal;

    const animatePrice = (el, endVal) => {
        if (!el) return;
        const startVal = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || 0;
        if (window.OM && window.OM.animateCount) {
            window.OM.animateCount(el, startVal, endVal, 400, (v) => `${currency}${v.toFixed(currency === '₹' ? 0 : 2)}`);
        } else {
            el.textContent = `${currency}${endVal.toFixed(currency === '₹' ? 0 : 2)}`;
        }
    };

    // Update Subtotal on screen
    const subtotalEl = document.getElementById('cart-summary-subtotal');
    if (subtotalEl) animatePrice(subtotalEl, subtotal);

    // Update Shipping on screen
    const shippingEl = document.getElementById('cart-summary-shipping');
    if (shippingEl) {
        if (shipping === 0) {
            shippingEl.textContent = "FREE";
            shippingEl.className = "text-[#0077B6] font-bold";
        } else {
            shippingEl.textContent = `${currency}${shipping.toFixed(currency === '₹' ? 0 : 2)}`;
            shippingEl.className = "font-semibold text-gray-900";
        }
    }

    // Render discount coupon line if exists
    const container = document.getElementById('cart-summary-subtotal')?.closest('.space-y-3');
    if (container) {
        let discountRow = container.querySelector('.coupon-discount-row');
        if (discount > 0 && activeCoupon) {
            if (!discountRow) {
                discountRow = document.createElement('div');
                discountRow.className = 'coupon-discount-row flex justify-between items-center text-sm text-green-700 font-bold py-1';
                container.appendChild(discountRow);
            }
            discountRow.innerHTML = `
                <span>Discount (${activeCoupon.code})</span>
                <span class="discount-val">-${currency}${discount.toFixed(currency === '₹' ? 0 : 2)}</span>
            `;
        } else if (discountRow) {
            discountRow.remove();
        }
    }

    // Update Grand Total on screen
    const grandTotalEl = document.getElementById('cart-summary-total');
    if (grandTotalEl) animatePrice(grandTotalEl, grandTotal);
}

// Applying coupon
async function applyCouponCode(code) {
    const cleanCode = code ? code.trim() : '';
    if (!cleanCode) {
        window.showToast("Please enter a coupon code.", "error");
        return;
    }

    const totals = window.PricingEngine ? window.PricingEngine.calculateTotals(cartItems, null) : { subtotal: 0 };
    const cartSubtotal = totals.subtotal || 0;
    const userSession = (window.DB && window.DB.getCurrentUser) ? window.DB.getCurrentUser() : null;

    try {
        const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
        const response = await fetch(`${API_URL}/coupons/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: cleanCode,
                cartSubtotal: cartSubtotal,
                userId: userSession ? userSession.id : undefined,
                cartItems: cartItems.map(item => ({
                    productId: item.id || item.productId,
                    price: Number(item.price) || 0,
                    quantity: Number(item.qty || item.quantity) || 1,
                    categoryId: item.categoryId,
                    brandId: item.brandId
                }))
            })
        });

        const result = await response.json();
        const data = result.data || result;

        if (result.success && data && data.valid) {
            activeCoupon = {
                code: data.code || cleanCode.toUpperCase(),
                couponId: data.couponId,
                discountType: String(data.discountType || 'PERCENTAGE').toLowerCase(),
                discountValue: data.discountValue || 0,
                calculatedDiscount: data.calculatedDiscount || 0,
                minPurchase: data.minOrderValue || 0
            };

            sessionStorage.setItem('om_active_coupon', JSON.stringify(activeCoupon));
            window.showToast(data.message || `Coupon "${activeCoupon.code}" applied successfully!`, "success");
            renderCart();
        } else {
            activeCoupon = null;
            sessionStorage.removeItem('om_active_coupon');
            window.showToast((data && data.message) ? data.message : (result.message || "Invalid coupon code."), "error");
            renderCart();
        }
    } catch (err) {
        console.error("Error validating coupon via backend API:", err);
        if (window.DB && window.DB.validateCoupon) {
            const coupon = window.DB.validateCoupon(cleanCode);
            if (coupon) {
                activeCoupon = coupon;
                sessionStorage.setItem('om_active_coupon', JSON.stringify(coupon));
                window.showToast(`Coupon "${cleanCode.toUpperCase()}" applied successfully!`, "success");
                renderCart();
                return;
            }
        }
        window.showToast("Invalid coupon code.", "error");
    }
}
