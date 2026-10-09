/**
 * OM Mobile Art - Checkout Page Controller (checkout.js)
 * Implements multi-step accordion flows, shipping validation, payment radios,
 * Postal Pincode API auto-fill, separate Address Line 1/2 storage,
 * order summary math (reflecting cart coupons), and payment success routing.
 */

let checkoutCart = [];
let checkoutCoupon = null;
let activeStep = 1;
let selectedPayment = "ONLINE"; // Default: Online Payment (Recommended)
let pincodeVerified = false;

function getMinOrderQty(item) {
    if (item.minOrderQuantity !== undefined) return item.minOrderQuantity;
    if (item.minOrderQty !== undefined) return item.minOrderQty;
    return 1;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.DB) return;

    // 1. Verify Cart has items & Validate min quantity
    let initialCart = window.DB.getCart() || [];
    let updatedAny = false;
    initialCart.forEach((item, idx) => {
        const minQty = getMinOrderQty(item);
        if (item.qty < minQty) {
            window.DB.updateCartQty(idx, minQty);
            updatedAny = true;
        }
    });
    if (updatedAny) {
        window.showToast("Quantities adjusted to meet minimum order requirements.", "info");
    }

    checkoutCart = window.DB.getCart() || [];
    if (checkoutCart.length === 0) {
        window.showToast("Your cart is empty. Redirecting to Shop...", "error");
        setTimeout(() => {
            window.location.href = 'shop.html';
        }, 1500);
        return;
    }

    // 2. Verify User is Logged In & Token is Valid
    const currentUser = window.DB.getCurrentUser();
    const token = localStorage.getItem('om_auth_token') || localStorage.getItem('om_customer_auth_token');
    const isExpired = window.isTokenExpired ? window.isTokenExpired(token) : !token;

    if (!currentUser || !token || isExpired) {
        if (token && isExpired) {
            localStorage.removeItem('om_auth_token');
            localStorage.removeItem('om_customer_auth_token');
            localStorage.removeItem('om_customer_session');
            localStorage.removeItem('om_user_session');
        }
        window.showToast("Please log in to complete your checkout.", "info");
        setTimeout(() => {
            window.location.href = 'login.html?redirect=checkout.html';
        }, 1200);
        return;
    }

    // 3. Pre-fill user shipping details from saved address book if available (Leave blank if none)
    setupShippingAddressForm(currentUser);

    // 4. Load coupon if any
    const savedCoupon = sessionStorage.getItem('om_active_coupon');
    if (savedCoupon) {
        checkoutCoupon = JSON.parse(savedCoupon);
    }

    // 5. Render checkout order items summary & calculate prices
    renderCheckoutSummary();

    // 6. Connect step confirmation handlers & payment radios
    initCheckoutFlowActions();
    initPaymentRadioListeners();
});

// Update Payment Option Radio Visual Selection & Button Text
function initPaymentRadioListeners() {
    const radios = document.querySelectorAll('input[name="payment"]');
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            updatePaymentButtonText();
        });
    });
    updatePaymentButtonText();
}

function updatePaymentButtonText() {
    const selectedRadio = document.querySelector('input[name="payment"]:checked');
    selectedPayment = selectedRadio ? selectedRadio.value : 'UPI';

    const step2Btn = document.getElementById('step-2-payment-btn');
    const step3Btn = document.querySelector('#step-3 button');
    const securityFooter = document.getElementById('payment-security-footer');

    const grandTotal = window.checkoutTotals ? window.checkoutTotals.grandTotal : 0;
    const formattedTotal = window.PricingEngine ? window.PricingEngine.format(grandTotal) : `₹${grandTotal}`;

    // Payment option card elements
    const optionKeys = ['upi', 'card', 'cod'];
    optionKeys.forEach(key => {
        const label = document.querySelector(`label[for="payment-${key}"]`);
        const radioInd = label?.querySelector('.radio-indicator');
        const radioDot = label?.querySelector('.radio-dot');
        const icon = label?.querySelector('.material-symbols-outlined');

        if (selectedPayment === key.toUpperCase()) {
            if (label) {
                label.className = "payment-card-label flex items-start p-6 bg-white border-2 border-[#0077B6] shadow-[0_0_15px_rgba(0,119,182,0.12)] rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-[2px] group";
            }
            if (radioInd) radioInd.className = "radio-indicator relative w-5 h-5 border-2 border-[#0077B6] rounded-full mr-4 flex-shrink-0 mt-0.5";
            if (radioDot) { radioDot.classList.remove('hidden'); radioDot.classList.add('block'); }
            if (icon) icon.className = "material-symbols-outlined text-2xl text-[#0077B6] flex-shrink-0 ml-2 pt-0.5 transition-colors";
        } else {
            if (label) {
                label.className = "payment-card-label flex items-start p-6 bg-white border border-[#E5E7EB] rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-[2px] hover:border-gray-300 group";
            }
            if (radioInd) radioInd.className = "radio-indicator relative w-5 h-5 border-2 border-gray-300 rounded-full mr-4 flex-shrink-0 mt-0.5";
            if (radioDot) { radioDot.classList.remove('block'); radioDot.classList.add('hidden'); }
            if (icon) icon.className = "material-symbols-outlined text-2xl text-gray-400 group-hover:text-gray-600 flex-shrink-0 ml-2 pt-0.5 transition-colors";
        }
    });

    if (selectedPayment === 'UPI' || selectedPayment === 'CARD') {
        if (step2Btn) step2Btn.innerHTML = `<span class="material-symbols-outlined text-xl">lock</span> Pay via Razorpay`;
        if (step3Btn) step3Btn.innerHTML = `<span class="material-symbols-outlined text-xl">lock</span> Pay via Razorpay — ${formattedTotal}`;
        if (securityFooter) {
            securityFooter.innerHTML = `<span class="material-symbols-outlined text-sm text-gray-400">shield</span><span>Powered by Razorpay • 100% Secure Payments</span>`;
            securityFooter.classList.remove('hidden');
        }
    } else {
        if (step2Btn) step2Btn.innerHTML = `<span class="material-symbols-outlined text-xl">local_shipping</span> Place Order`;
        if (step3Btn) step3Btn.innerHTML = `<span class="material-symbols-outlined text-xl">local_shipping</span> Place Order — ${formattedTotal}`;
        if (securityFooter) {
            securityFooter.innerHTML = `<span class="material-symbols-outlined text-sm text-gray-400">verified</span><span>Guaranteed Safe & Verified Delivery</span>`;
            securityFooter.classList.remove('hidden');
        }
    }
}

// Check COD Availability for Pincode
function updateCodAvailabilityForPincode(pin, isServiceable = true) {
    const codContainer = document.getElementById('cod-payment-option-container');
    if (!codContainer) return;

    // Show COD if valid Indian PIN code
    const isCodAvailable = /^\d{6}$/.test(pin) && isServiceable;

    if (isCodAvailable) {
        codContainer.classList.remove('hidden');
    } else {
        codContainer.classList.add('hidden');
        // If COD was selected, switch to UPI automatically
        const upiRadio = document.getElementById('payment-upi');
        if (upiRadio) {
            upiRadio.checked = true;
            updatePaymentButtonText();
        }
    }
}

// Setup Shipping Address Form (Clean empty state, Pincode API, Live Validation & Saved Addresses)
function setupShippingAddressForm(user) {
    const firstNameInput = document.getElementById('shipping-firstname');
    const lastNameInput = document.getElementById('shipping-lastname');
    const mobileInput = document.getElementById('shipping-mobile');
    const address1Input = document.getElementById('shipping-address1');
    const address2Input = document.getElementById('shipping-address2');
    const pincodeInput = document.getElementById('shipping-pincode');
    const cityInput = document.getElementById('shipping-city');
    const stateInput = document.getElementById('shipping-state');
    const deliverBtn = document.getElementById('deliver-here-btn');

    // Ensure all inputs start completely BLANK by default
    if (firstNameInput) firstNameInput.value = '';
    if (lastNameInput) lastNameInput.value = '';
    if (mobileInput) mobileInput.value = '';
    if (address1Input) address1Input.value = '';
    if (address2Input) address2Input.value = '';
    if (pincodeInput) pincodeInput.value = '';
    if (cityInput) cityInput.value = '';
    if (stateInput) stateInput.value = '';

    // Render Saved Addresses if user has any
    const savedWrapper = document.getElementById('saved-addresses-wrapper');
    const savedList = document.getElementById('saved-addresses-list');

    if (user.addresses && user.addresses.length > 0 && savedWrapper && savedList) {
        savedWrapper.classList.remove('hidden');
        savedList.innerHTML = user.addresses.map((addr, idx) => `
            <label class="flex items-start p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-[#0077B6] hover:bg-[#CAF0F8]/20 transition-all group relative">
                <input type="radio" name="saved_address_choice" value="${idx}" class="mt-1 accent-[#0077B6]" onchange="applySavedAddress(${idx})"/>
                <div class="ml-3 text-xs">
                    <span class="font-extrabold text-[#03045E] block">${addr.label || 'Saved Address ' + (idx + 1)}</span>
                    <p class="text-gray-600 mt-0.5 line-clamp-2">${addr.addressLine1 || addr.street || ''}, ${addr.city || ''}</p>
                    <p class="text-gray-400 text-[10px] mt-0.5">${addr.pincode || addr.zip || ''}</p>
                </div>
            </label>
        `).join('') + `
            <label class="flex items-center p-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#0077B6] hover:bg-gray-50 transition-all text-xs font-bold text-gray-600">
                <input type="radio" name="saved_address_choice" value="new" class="accent-[#0077B6]" onchange="clearShippingForm()"/>
                <span class="ml-2.5 text-[#0077B6]">+ Add New Address</span>
            </label>
        `;
    }

    // Attach Pincode Lookup Handler (6 Digits)
    if (pincodeInput) {
        pincodeInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val;
            if (val.length === 6) {
                lookupPincode(val);
            } else {
                pincodeVerified = false;
                hidePincodeErrors();
                document.getElementById('area-selector-wrapper')?.classList.add('hidden');
                checkFormValidity();
            }
        });
    }

    // Attach Mobile Input Restrictor (Numeric 10 digits)
    if (mobileInput) {
        mobileInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            checkFormValidity();
        });
    }

    // Attach Live Validation on all inputs
    const inputs = [firstNameInput, lastNameInput, mobileInput, address1Input, address2Input, pincodeInput, cityInput, stateInput];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', checkFormValidity);
            input.addEventListener('blur', checkFormValidity);
        }
    });
}

// Global helper to apply selected saved address
window.applySavedAddress = function(index) {
    const user = window.DB.getCurrentUser();
    if (!user || !user.addresses || !user.addresses[index]) return;

    const addr = user.addresses[index];
    const nameParts = (user.name || '').split(' ');
    
    document.getElementById('shipping-firstname').value = addr.firstName || nameParts[0] || '';
    document.getElementById('shipping-lastname').value = addr.lastName || nameParts.slice(1).join(' ') || '';
    document.getElementById('shipping-mobile').value = addr.mobile || user.phone || '';
    document.getElementById('shipping-address1').value = addr.addressLine1 || addr.street || '';
    document.getElementById('shipping-address2').value = addr.addressLine2 || '';
    document.getElementById('shipping-pincode').value = addr.pincode || addr.zip || '';
    document.getElementById('shipping-city').value = addr.city || '';
    document.getElementById('shipping-state').value = addr.state || '';

    pincodeVerified = true;
    checkFormValidity();
};

window.clearShippingForm = function() {
    document.getElementById('shipping-address-form')?.reset();
    pincodeVerified = false;
    document.getElementById('area-selector-wrapper')?.classList.add('hidden');
    checkFormValidity();
};

// Pincode Lookup API (Public Postal Directory)
async function lookupPincode(pin) {
    const spinner = document.getElementById('pincode-spinner');
    const cityInput = document.getElementById('shipping-city');
    const stateInput = document.getElementById('shipping-state');
    const areaWrapper = document.getElementById('area-selector-wrapper');
    const areaSelect = document.getElementById('shipping-area-select');
    const errPincode = document.getElementById('err-pincode');

    if (spinner) spinner.classList.remove('hidden');

    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();

        if (Array.isArray(data) && data[0] && data[0].Status === "Success" && Array.isArray(data[0].PostOffice)) {
            const offices = data[0].PostOffice;
            const primary = offices[0];

            if (cityInput) cityInput.value = primary.District || primary.Division || primary.Circle || '';
            if (stateInput) stateInput.value = primary.State || '';

            pincodeVerified = true;
            if (errPincode) errPincode.classList.add('hidden');
            updateCodAvailabilityForPincode(pin, true);

            // Populate Locality / Area dropdown if multiple post offices exist
            if (offices.length > 1 && areaWrapper && areaSelect) {
                areaWrapper.classList.remove('hidden');
                areaSelect.innerHTML = `<option value="">Select Area / Locality...</option>` + offices.map(o => `
                    <option value="${o.Name}">${o.Name}</option>
                `).join('');

                areaSelect.onchange = () => {
                    const selectedArea = areaSelect.value;
                    const addr2Input = document.getElementById('shipping-address2');
                    if (selectedArea && addr2Input) {
                        if (!addr2Input.value.includes(selectedArea)) {
                            addr2Input.value = addr2Input.value ? `${addr2Input.value}, ${selectedArea}` : selectedArea;
                        }
                    }
                    checkFormValidity();
                };
            } else if (offices.length === 1) {
                if (areaWrapper) areaWrapper.classList.add('hidden');
                const addr2Input = document.getElementById('shipping-address2');
                if (addr2Input && !addr2Input.value) {
                    addr2Input.value = primary.Name;
                }
            }
        } else {
            pincodeVerified = false;
            if (errPincode) {
                errPincode.textContent = "Invalid PIN code. Please enter a valid Indian PIN.";
                errPincode.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Pincode API error:", err);
        pincodeVerified = true; // allow manual input fallback
    } finally {
        if (spinner) spinner.classList.add('hidden');
        checkFormValidity();
    }
}

function hidePincodeErrors() {
    const errPincode = document.getElementById('err-pincode');
    if (errPincode) errPincode.classList.add('hidden');
}

// Live Validation Handler & Deliver Button Enabler
function checkFormValidity() {
    const firstName = (document.getElementById('shipping-firstname')?.value || '').trim();
    const lastName = (document.getElementById('shipping-lastname')?.value || '').trim();
    const mobile = (document.getElementById('shipping-mobile')?.value || '').trim();
    const address1 = (document.getElementById('shipping-address1')?.value || '').trim();
    const pincode = (document.getElementById('shipping-pincode')?.value || '').trim();
    const city = (document.getElementById('shipping-city')?.value || '').trim();
    const state = (document.getElementById('shipping-state')?.value || '').trim();
    const deliverBtn = document.getElementById('deliver-here-btn');

    const isFirstNameValid = firstName.length >= 2;
    const isLastNameValid = lastName.length >= 1;
    const isMobileValid = /^[6-9]\d{9}$/.test(mobile);
    const isAddress1Valid = address1.length >= 3;
    const isPincodeValid = /^\d{6}$/.test(pincode);
    const isCityValid = city.length >= 2;
    const isStateValid = state.length >= 2;

    const isValid = isFirstNameValid && isLastNameValid && isMobileValid && isAddress1Valid && isPincodeValid && isCityValid && isStateValid;

    if (deliverBtn) {
        deliverBtn.disabled = !isValid;
        if (isValid) {
            deliverBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'disabled:hover:bg-[#0077B6]');
        } else {
            deliverBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    return isValid;
}

// Render Order Summary
function renderCheckoutSummary() {
    const itemsListEl = document.getElementById('checkout-summary-items');
    const totals = window.PricingEngine ? window.PricingEngine.calculateTotals(checkoutCart, checkoutCoupon) : {
        items: checkoutCart, subtotal: 0, shippingFee: 0, tax: 0, discount: 0, grandTotal: 0
    };

    if (itemsListEl && totals.items) {
        let itemsHtml = '';
        totals.items.forEach(item => {
            const displayPrice = window.PricingEngine ? window.PricingEngine.format(item.itemTotal) : `₹${item.itemTotal}`;
            itemsHtml += `
                <div class="flex gap-4 items-center py-2 border-b border-gray-100">
                    <div class="w-12 h-12 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                        <a href="product_detail.html?id=${item.id}" class="block w-full h-full"><img class="w-full h-full object-contain" src="${item.image}"></a>
                    </div>
                    <div class="flex-grow min-w-0">
                        <h4 class="font-bold text-xs text-gray-800 truncate">${item.name}</h4>
                        <p class="text-gray-500 text-[10px] uppercase font-semibold">${item.device || ''} (x${item.qty})</p>
                    </div>
                    <div class="font-bold text-xs text-gray-900">${displayPrice}</div>
                </div>
            `;
        });
        itemsListEl.innerHTML = itemsHtml;
    }

    const subtotal = totals.subtotal;
    const shipping = totals.shippingFee;
    const discount = totals.discount;
    const grandTotal = totals.grandTotal;

    const subtotalEl = document.getElementById('checkout-summary-subtotal');
    if (subtotalEl) subtotalEl.textContent = window.PricingEngine ? window.PricingEngine.format(subtotal) : `₹${subtotal}`;

    const shippingEl = document.getElementById('checkout-summary-shipping');
    if (shippingEl) {
        shippingEl.textContent = shipping === 0 ? "FREE" : (window.PricingEngine ? window.PricingEngine.format(shipping) : `₹${shipping}`);
    }

    const container = document.getElementById('checkout-summary-subtotal')?.closest('.space-y-2');
    if (container) {
        let discountRow = container.querySelector('.checkout-coupon-discount');
        if (discount > 0 && checkoutCoupon) {
            if (!discountRow) {
                discountRow = document.createElement('div');
                discountRow.className = 'checkout-coupon-discount flex justify-between text-xs text-green-700 font-bold py-1';
                container.appendChild(discountRow);
            }
            discountRow.innerHTML = `
                <span>Discount (${checkoutCoupon.code})</span>
                <span>-${window.PricingEngine ? window.PricingEngine.format(discount) : `₹${discount}`}</span>
            `;
        } else if (discountRow) {
            discountRow.remove();
        }
    }

    const totalEl = document.getElementById('checkout-summary-total');
    if (totalEl) {
        totalEl.textContent = window.PricingEngine ? window.PricingEngine.format(grandTotal) : `₹${grandTotal}`;
    }

    const placeOrderBtn = document.querySelector('#step-3 button');
    if (placeOrderBtn) {
        placeOrderBtn.textContent = `Place Order — ${window.PricingEngine ? window.PricingEngine.format(grandTotal) : `₹${grandTotal}`}`;
        placeOrderBtn.className = "w-full bg-[#0077B6] hover:bg-[#03045E] text-white font-bold h-[56px] text-lg rounded-[10px] transition-all duration-200 transform active:scale-[0.98] shadow-md";
    }

    window.checkoutTotals = totals;
}

// Connect step navigation & placement (Using .onclick to prevent duplicate event listener attachments)
function initCheckoutFlowActions() {
    const deliverBtn = document.getElementById('deliver-here-btn');
    if (deliverBtn) {
        deliverBtn.onclick = (e) => {
            e.preventDefault();
            validateAndProgressAddress();
        };
    }

    const step2Btn = document.getElementById('step-2-payment-btn') || document.querySelector('#step-2 button');
    if (step2Btn) {
        step2Btn.onclick = (e) => {
            e.preventDefault();
            console.log("[PAYMENT] Pay clicked");
            handleRazorpayCheckout(step2Btn);
        };
    }

    const placeBtn = document.querySelector('#step-3 button');
    if (placeBtn) {
        placeBtn.onclick = (e) => {
            e.preventDefault();
            console.log("[PAYMENT] Pay clicked");
            handleRazorpayCheckout(placeBtn);
        };
    }
}

function validateAndProgressAddress() {
    if (!checkFormValidity()) {
        window.showToast("Please fix errors in the shipping address form.", "error");
        return;
    }

    const firstName = document.getElementById('shipping-firstname').value.trim();
    const lastName = document.getElementById('shipping-lastname').value.trim();
    const mobile = document.getElementById('shipping-mobile').value.trim();
    const addressLine1 = document.getElementById('shipping-address1').value.trim();
    const addressLine2 = document.getElementById('shipping-address2').value.trim();
    const pincode = document.getElementById('shipping-pincode').value.trim();
    const city = document.getElementById('shipping-city').value.trim();
    const state = document.getElementById('shipping-state').value.trim();

    // Store Address Line 1 and Address Line 2 SEPARATELY (Do not merge)
    const currentUser = window.DB ? window.DB.getCurrentUser() : null;
    const customerEmail = currentUser?.email || localStorage.getItem('om_user_email') || '';
    const customerName = `${firstName} ${lastName}`.trim() || currentUser?.name || 'Customer';

    // Store Address Line 1 and Address Line 2 SEPARATELY (Do not merge)
    window.checkoutAddress = {
        firstName,
        lastName,
        fullName: customerName,
        email: customerEmail,
        mobile,
        phone: mobile,
        addressLine1,
        addressLine2,
        pincode,
        zip: pincode,
        city,
        state,
        country: 'India',
        street: addressLine1 + (addressLine2 ? ', ' + addressLine2 : ''),
    };

    // Save to user address book in localStorage/DB if logged in
    if (currentUser) {
        if (!currentUser.addresses) currentUser.addresses = [];
        const existingIdx = currentUser.addresses.findIndex(a => a.addressLine1 === addressLine1 && a.pincode === pincode);
        if (existingIdx === -1) {
            currentUser.addresses.push({
                label: 'Saved Address',
                firstName,
                lastName,
                mobile,
                addressLine1,
                addressLine2,
                pincode,
                city,
                state,
                country: 'India'
            });
            window.DB.updateCurrentUser({ addresses: currentUser.addresses });
        }
    }

    // Show edit button on Step 1 header
    document.getElementById('edit-step-1-btn')?.classList.remove('hidden');

    nextStep(2);
}

let isProcessingPayment = false;

// Main Payment Handler - Uses POST /api/v1/checkout/prepare snapshot preparation
async function handleRazorpayCheckout(buttonEl) {
    if (isProcessingPayment) {
        console.warn("Payment processing already in progress. Ignoring duplicate click.");
        return;
    }

    // Set processing flag immediately upon button click
    isProcessingPayment = true;

    // Immediately disable pay button(s) to prevent duplicate clicks
    const allPayBtns = document.querySelectorAll('#step-2-payment-btn, #step-3 button, .pay-now-btn');
    allPayBtns.forEach(btn => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    });

    const originalText = buttonEl ? buttonEl.innerHTML : '';
    if (buttonEl) {
        buttonEl.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
        `;
    }

    const resetBtnState = () => {
        isProcessingPayment = false;
        allPayBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = '';
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
        });
        if (buttonEl && originalText) {
            buttonEl.innerHTML = originalText;
        }
    };

    // Step 1: Ensure shipping address is validated
    if (!window.checkoutAddress) {
        if (checkFormValidity()) {
            validateAndProgressAddress();
        } else {
            window.showToast("Please fill in all required shipping address fields.", "error");
            toggleStep(1);
            resetBtnState();
            return;
        }
    }

    try {
        let token = localStorage.getItem('om_auth_token') || localStorage.getItem('om_customer_auth_token');
        if ((!token || (window.isTokenExpired && window.isTokenExpired(token))) && window.getAuthToken) {
            token = await window.getAuthToken();
        }

        if (!token) {
            window.showToast("Your session has expired. Please log in again to complete checkout.", "error");
            setTimeout(() => {
                window.location.href = 'login.html?redirect=checkout.html';
            }, 1200);
            resetBtnState();
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

        const preparePayload = {
            shippingAddress: window.checkoutAddress,
            couponCode: checkoutCoupon ? (checkoutCoupon.code || checkoutCoupon.couponCode) : undefined,
            paymentMethod: selectedPayment,
            gateway: 'RAZORPAY',
            cartItems: (checkoutCart || []).map(item => ({
                id: item.id,
                productId: item.productId || item.id,
                productVariantId: item.productVariantId || item.variantId,
                deviceTypeId: item.deviceTypeId,
                deviceType: item.deviceType || item.device,
                modelId: item.modelId,
                deviceModel: item.deviceModel || item.customModelName,
                customModelName: item.customModelName || item.deviceModel,
                quantity: item.qty || item.quantity || 1,
                finish: item.finish,
                material: item.material
            }))
        };

        console.log("[CHECKOUT PREPARE] Initiating checkout prepare request");

        // Step A: Prepare Checkout Snapshot on Backend
        const res = await fetch(`${API_URL}/checkout/prepare`, {
            method: 'POST',
            headers,
            body: JSON.stringify(preparePayload)
        });

        if (res.status === 401 || res.status === 403) {
            console.warn("[CHECKOUT PREPARE] 401/403 Unauthorized. Token expired or invalid.");
            localStorage.removeItem('om_auth_token');
            localStorage.removeItem('om_customer_auth_token');
            localStorage.removeItem('om_customer_session');
            localStorage.removeItem('om_user_session');
            window.showToast("Your session has expired. Please log in again to complete checkout.", "error");
            setTimeout(() => {
                window.location.href = 'login.html?redirect=checkout.html';
            }, 1200);
            resetBtnState();
            return;
        }

        const data = await res.json();

        if (!res.ok || !data.success || !data.data) {
            const errorMsg = data.error?.message || data.message || 'Failed to prepare checkout.';
            throw new Error(errorMsg);
        }

        const snapshot = data.data;

        // If Cash on Delivery selected
        if (selectedPayment === 'COD') {
            if (window.DB) {
                window.DB.placeOrder(snapshot);
                window.DB.clearCart();
            }
            sessionStorage.removeItem('om_active_coupon');
            window.dispatchEvent(new CustomEvent('orders-updated'));
            window.showToast(`Order #${snapshot.orderNumber || snapshot.id} placed successfully!`, "success");
            setTimeout(() => {
                window.location.href = `order_success.html?orderId=${snapshot.id || snapshot.orderNumber}&paymentMethod=COD`;
            }, 800);
            return;
        }

        // Update UI summary displaying exact backend returned totals
        const totalEl = document.getElementById('checkout-summary-total');
        if (totalEl) totalEl.textContent = `₹${snapshot.total}`;
        const subtotalEl = document.getElementById('checkout-summary-subtotal');
        if (subtotalEl) subtotalEl.textContent = `₹${snapshot.subtotal}`;
        const shippingEl = document.getElementById('checkout-summary-shipping');
        if (shippingEl) shippingEl.textContent = snapshot.shipping === 0 ? "FREE" : `₹${snapshot.shipping}`;

        // --- ONLINE RAZORPAY PAYMENT FLOW ---
        const razorpayOrderId = snapshot.razorpayOrderId;
        const razorpayAmount = snapshot.amount; // in paise

        // SECTION 1 & 23: Structured Safe Development Traces
        console.log('[CHECKOUT TOTAL DEBUG]', {
            cartSubtotal: snapshot.subtotal,
            shipping: snapshot.shipping,
            discount: snapshot.discount,
            tax: snapshot.tax || 0,
            grandTotal: snapshot.total,
            razorpayAmount: `${razorpayAmount} paise`
        });

        console.log(`[PAYMENT AMOUNT TRACE]
Cart subtotal: ₹${snapshot.subtotal}
Cart shipping: ₹${snapshot.shipping}
Cart discount: ₹${snapshot.discount}
Cart tax: ₹${snapshot.tax || 0}
Checkout total: ₹${snapshot.total}
Razorpay amount: ₹${Math.round(Number(razorpayAmount) / 100)}
Razorpay paise: ${razorpayAmount}`);

        // CORE RULE #8: Mandatory Payment Amount Consistency Check
        const expectedTotalPaise = Math.round(Number(snapshot.total) * 100);
        const razorpayOrderAmount = Math.round(Number(razorpayAmount));

        if (expectedTotalPaise !== razorpayOrderAmount) {
            console.error("[PAYMENT ERROR] Checkout total does not match payment amount.", {
                expectedTotalPaise,
                razorpayOrderAmount,
                checkoutTotal: snapshot.total
            });
            window.showToast("Payment amount changed. Please refresh your checkout.", "error");
            resetBtnState();
            return;
        }

        if (typeof window.Razorpay === 'undefined') {
            throw new Error("Razorpay Checkout SDK failed to load. Please refresh the page.");
        }

        let rzpLogo = window.SettingsManager ? window.SettingsManager.getLogoUrl() : undefined;
        if (rzpLogo && !rzpLogo.startsWith('https://')) {
            rzpLogo = undefined;
        }

        const cleanPhone = (snapshot.customerPhone || window.checkoutAddress.mobile || '').replace(/\D/g, '');
        let hasVerifiedSignature = false;

        const rzpOptions = {
            key: snapshot.keyId,
            amount: Math.round(Number(razorpayAmount)),
            currency: snapshot.currency || 'INR',
            name: "OM Mobile Art",
            description: `Payment for Checkout #${snapshot.checkoutId.slice(-8)}`,
            ...(rzpLogo ? { image: rzpLogo } : {}),
            order_id: razorpayOrderId,
            handler: async function (response) {
                if (hasVerifiedSignature) {
                    console.warn("Verify Payment Request already sent. Skipping duplicate verification.");
                    return;
                }
                hasVerifiedSignature = true;

                console.log("[RAZORPAY VERIFY] Verification request payload:", {
                    checkoutId: snapshot.checkoutId,
                    razorpayOrderId: response.razorpay_order_id || razorpayOrderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                });

                if (buttonEl) {
                    buttonEl.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">refresh</span> Verifying Payment...`;
                }

                try {
                    const verifyRes = await fetch(`${API_URL}/payments/verify`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            checkoutId: snapshot.checkoutId,
                            razorpayOrderId: response.razorpay_order_id || razorpayOrderId,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            paymentMethod: selectedPayment,
                        })
                    });

                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.success) {
                        console.log("[ORDER FINALIZE] Payment verified & business order created successfully");
                        const confirmedOrder = verifyData.data;
                        if (window.DB) {
                            window.DB.placeOrder(confirmedOrder);
                            window.DB.clearCart();
                        }
                        sessionStorage.removeItem('om_active_coupon');
                        window.dispatchEvent(new CustomEvent('orders-updated'));
                        window.showToast("Payment Successful! Order Confirmed.", "success");
                        setTimeout(() => {
                            window.location.href = `order_success.html?orderId=${confirmedOrder.orderId}&paymentId=${response.razorpay_payment_id}`;
                        }, 800);
                    } else {
                        console.log("[PAYMENT] Verification failed");
                        window.showToast(verifyData.message || "Payment verification failed.", "error");
                        resetBtnState();
                    }
                } catch (vErr) {
                    console.log("[PAYMENT] Verification failed");
                    console.error('Razorpay verification error:', vErr);
                    window.showToast("Payment verification failed. Please contact support.", "error");
                    resetBtnState();
                }
            },
            modal: {
                ondismiss: function () {
                    console.log("[PAYMENT] Checkout dismissed");
                    resetBtnState();
                    window.showToast?.("Payment window closed. You can click Pay again when ready.", "info");
                }
            },
            prefill: {
                name: snapshot.customerName || window.checkoutAddress.fullName || '',
                email: snapshot.customerEmail || window.checkoutAddress.email || '',
                contact: cleanPhone || '',
                ...(selectedPayment === 'UPI' ? { method: 'upi' } : (selectedPayment === 'CARD' ? { method: 'card' } : {}))
            },
            theme: {
                color: "#03045E"
            }
        };

        console.log("[PAYMENT] Opening Razorpay Checkout with options:", {
            key: rzpOptions.key,
            amount: rzpOptions.amount,
            currency: rzpOptions.currency,
            order_id: rzpOptions.order_id,
            prefillMethod: rzpOptions.prefill?.method
        });
        const razorpayInstance = new window.Razorpay(rzpOptions);

        razorpayInstance.on('payment.failed', function (resp) {
            console.error("[PAYMENT] Razorpay payment failed:", resp.error);
            resetBtnState();
            const errMsg = resp.error?.description || resp.error?.reason || "Transaction declined by bank.";
            if (selectedPayment === 'UPI') {
                window.showToast(`UPI payment could not be completed: ${errMsg}. Please try again or choose another payment method.`, "error");
            } else {
                window.showToast(`Payment Failed: ${errMsg}`, "error");
            }
        });

        razorpayInstance.open();

    } catch (err) {
        console.log("[PAYMENT] Payment failed");
        resetBtnState();
        window.showToast(err.message || "Order placement failed. Please check details.", "error");
    }
}

function updateStepIndicators(activeStep) {
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step-${i}-indicator`);
        if (indicator) {
            if (i <= activeStep) {
                indicator.className = "w-10 h-10 rounded-full bg-[#0077B6] text-white flex items-center justify-center font-bold text-base shadow-sm transition-all duration-200";
            } else {
                indicator.className = "w-10 h-10 rounded-full bg-[#90E0EF] text-white flex items-center justify-center font-bold text-base shadow-sm transition-all duration-200";
            }
        }
    }
}

function nextStep(stepNumber) {
    updateStepIndicators(stepNumber);
    toggleStep(stepNumber);
    
    const nextStepEl = document.getElementById(`step-${stepNumber}`);
    if (nextStepEl) {
        nextStepEl.querySelector('h2').classList.remove('text-on-surface-variant');
        setTimeout(() => {
            nextStepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
}

function toggleStep(stepNumber) {
    updateStepIndicators(stepNumber);
    const steps = document.querySelectorAll('.checkout-step');
    steps.forEach((step, idx) => {
        const content = step.querySelector('.step-content');
        if (!content) return;

        const isTarget = (idx + 1 === stepNumber);

        if (isTarget) {
            step.classList.add('active');
            content.style.display = 'block';
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            content.style.overflow = 'hidden';
            content.style.transition = 'max-height 400ms var(--ease-out-expo), opacity 400ms var(--ease-out-expo), padding 400ms var(--ease-out-expo)';
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    content.style.maxHeight = `${content.scrollHeight + 50}px`;
                    content.style.opacity = '1';
                    setTimeout(() => {
                        content.style.maxHeight = '';
                        content.style.overflow = '';
                    }, 400);
                });
            });
        } else {
            if (step.classList.contains('active')) {
                content.style.overflow = 'hidden';
                content.style.maxHeight = `${content.scrollHeight}px`;
                content.style.transition = 'max-height 350ms var(--ease-out-expo), opacity 350ms var(--ease-out-expo), padding 350ms var(--ease-out-expo)';
                
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        content.style.maxHeight = '0';
                        content.style.opacity = '0';
                        setTimeout(() => {
                            step.classList.remove('active');
                            content.style.display = 'none';
                        }, 350);
                    });
                });
            } else {
                step.classList.remove('active');
                content.style.display = 'none';
            }
        }
    });
}
