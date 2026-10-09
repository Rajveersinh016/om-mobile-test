/**
 * OM Mobile Art — Unified Product Card Component (productCard.js)
 * High-performance, pixel-identical reusable product card component.
 * Used by: Home, Shop, Collections, Search Results, Related Products, Wishlist, etc.
 */

/**
 * Renders a standardized Product Card HTML string.
 * @param {Object} product - Product data object
 * @param {Object} [opts]
 * @param {boolean} [opts.showWishlist=true] - Show wishlist button
 * @param {boolean} [opts.showQuickAdd=true] - Show quick add button
 * @param {string} [opts.detailPath='product_detail.html'] - Path to product detail
 * @returns {string} - HTML string
 */
function renderProductCard(product, opts = {}) {
    if (!product) return '';

    const {
        showWishlist = true,
        showQuickAdd = true,
        detailPath = 'product_detail.html'
    } = opts;

    const productId = product.id || product.slug || product._id || '';
    const name = product.name || 'OM Mobile Skin';
    const rawImage = product.image || product.imageUrl || (product.images && product.images[0] ? (typeof product.images[0] === 'object' ? product.images[0].url : product.images[0]) : 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=600&auto=format&fit=crop');
    const image = rawImage.includes('cloudinary.com') ? rawImage.replace('/upload/', '/upload/f_auto,q_auto,w_600/') : rawImage;

    // Currency & Price Formatting (Canonical Single Source of Truth in INR)
    const rawPrice = Number(product.price) || 0;
    const rawOrig = Number(product.originalPrice) || 0;

    let displayPriceVal = rawPrice;
    let pricePrefix = '';

    // Device-Type based pricing logic
    if (product.selectedDevicePrice !== undefined && product.selectedDevicePrice !== null) {
        displayPriceVal = Number(product.selectedDevicePrice);
        pricePrefix = '';
    } else if (product.devicePrices && product.devicePrices.length > 0) {
        const validDPs = product.devicePrices.map(dp => Number(dp.price)).filter(p => p > 0);
        if (validDPs.length > 1) {
            displayPriceVal = Math.min(...validDPs);
            pricePrefix = 'From ';
        } else if (validDPs.length === 1) {
            displayPriceVal = validDPs[0];
            pricePrefix = '';
        }
    } else if (product.isMultiDevice) {
        if (product.minPrice) displayPriceVal = Number(product.minPrice);
        pricePrefix = 'From ';
    }

    const formattedPrice = (pricePrefix ? pricePrefix : '') + (window.PricingEngine ? window.PricingEngine.format(displayPriceVal) : `₹${Math.round(displayPriceVal).toLocaleString('en-IN')}`);
    let formattedOriginalPrice = null;
    let discountPercent = 0;

    if (rawOrig > displayPriceVal) {
        formattedOriginalPrice = window.PricingEngine ? window.PricingEngine.format(rawOrig) : `₹${Math.round(rawOrig).toLocaleString('en-IN')}`;
        discountPercent = Math.round(((rawOrig - displayPriceVal) / rawOrig) * 100);
    }

    // 1. Badge Determination & Styling
    let badgeText = '';
    let badgeBg = '#0077B6';

    if (product.badgeText) {
        badgeText = String(product.badgeText).toUpperCase();
    } else if (product.isBestSeller) {
        badgeText = 'BEST SELLER';
        badgeBg = '#03045E';
    } else if (product.isNew) {
        badgeText = 'NEW';
        badgeBg = '#00B4D8';
    } else if (product.isSale || discountPercent > 0) {
        badgeText = 'SALE';
        badgeBg = '#0077B6';
    } else if (product.isTrending) {
        badgeText = 'TRENDING';
        badgeBg = '#0096C7';
    } else if (product.isHot) {
        badgeText = 'HOT';
        badgeBg = '#EF4444';
    } else if (product.isLimited) {
        badgeText = 'LIMITED';
        badgeBg = '#F59E0B';
    }

    // Exact Badge Color Mapping Rule
    if (badgeText === 'NEW') badgeBg = '#00B4D8';
    else if (badgeText === 'SALE') badgeBg = '#0077B6';
    else if (badgeText === 'BEST SELLER') badgeBg = '#03045E';
    else if (badgeText === 'TRENDING') badgeBg = '#0096C7';
    else if (badgeText === 'HOT') badgeBg = '#EF4444';
    else if (badgeText === 'LIMITED') badgeBg = '#F59E0B';
    else if (badgeText === 'EXCLUSIVE') badgeBg = '#03045E';
    else if (badgeText === 'FEATURED') badgeBg = '#0077B6';

    const badgeHTML = badgeText ? `
        <span class="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 inline-flex items-center justify-center h-[24px] sm:h-[28px] min-w-[56px] sm:min-w-[70px] w-fit px-2 sm:px-3 py-0.5 rounded-md sm:rounded-lg text-white font-bold text-[9px] sm:text-xs uppercase tracking-[0.5px] whitespace-nowrap shadow-sm" style="background-color: ${badgeBg};">
            ${badgeText}
        </span>
    ` : '';

    // 2. Wishlist Button (36px Circular Floating Button on Mobile, 44px on Desktop)
    const isWishlisted = window.DB && window.DB.isInWishlist ? window.DB.isInWishlist(productId) : false;
    const wishlistHTML = showWishlist ? `
        <button type="button" 
                onclick="window.handleProductWishlistToggle(event, '${productId}')"
                class="product-card-wishlist-btn absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-[36px] h-[36px] sm:w-[44px] sm:h-[44px] rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-90 ${
                    isWishlisted 
                        ? 'bg-[#0077B6] !text-white' 
                        : 'bg-white/90 backdrop-blur-sm text-[#111827] hover:bg-[#CAF0F8] hover:text-[#0077B6]'
                }"
                data-product-id="${productId}"
                aria-label="Toggle Wishlist">
            <span class="material-symbols-outlined text-[18px] sm:text-[22px] transition-transform duration-200" 
                  style="${isWishlisted ? "font-variation-settings: 'FILL' 1" : "font-variation-settings: 'FILL' 0"}">
                favorite
            </span>
        </button>
    ` : '';

    // 3. Quick Add Button Overlay
    const quickAddHTML = showQuickAdd ? `
        <button type="button"
                onclick="window.handleProductQuickAdd(event, '${productId}')"
                class="quick-add-btn absolute bottom-0 left-0 right-0 w-full py-2 sm:py-3 bg-[#03045E] hover:bg-[#0077B6] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10 text-center shadow-lg">
            Quick Add
        </button>
    ` : '';

    // 4. Rating Stars & Dynamic Review Display
    const rating = Number(product.rating) || 0;
    const reviewsCount = Number(product.reviewsCount || (product.reviews ? product.reviews.length : 0)) || 0;
    const ratingBlockHTML = window.renderProductRatingHTML 
        ? window.renderProductRatingHTML(rating, reviewsCount, { size: 'xs', isCard: true })
        : (reviewsCount > 0 
            ? `<span class="text-[10px] sm:text-xs text-[#6B7280] font-bold">★ ${rating.toFixed(1)} (${reviewsCount})</span>`
            : `<span class="text-[10px] text-[#9CA3AF] font-medium">No reviews yet</span>`);

    // 5. Discount Pill
    const discountPillHTML = (discountPercent > 0 && formattedOriginalPrice) ? `
        <span class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-[#CAF0F8] text-[#0077B6] whitespace-nowrap">
            -${discountPercent}%
        </span>
    ` : '';

    // 6. Brand Name & Display Helpers
    const getDisplayName = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            if (val.name) return val.name;
            if (val.title) return val.title;
        }
        return null;
    };

    const brandName = getDisplayName(product.brand) || 
                      (product.models && product.models[0]?.series?.brand?.name) || 
                      getDisplayName(product.category) || 
                      'OM MOBILE ART';

    return `
        <div class="product-card snap-start flex-shrink-0 w-[calc(45vw-12px)] min-w-[160px] max-w-[185px] sm:w-[220px] sm:min-w-[220px] sm:max-w-none md:w-full md:min-w-0 md:flex-shrink group relative bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-[#90E0EF] hover:-translate-y-[6px] transition-all duration-300 flex flex-col justify-between h-full" data-product-id="${productId}">
            
            <!-- Image Container -->
            <div class="aspect-square relative overflow-hidden bg-[#F8FAFC] rounded-t-2xl flex items-center justify-center p-1.5 sm:p-2">
                ${badgeHTML}
                ${wishlistHTML}
                <a href="${detailPath}?id=${encodeURIComponent(productId)}" onclick="try{localStorage.setItem('om_last_viewed_product_id','${productId}')}catch(e){}" class="block w-full h-full flex items-center justify-center">
                    <img src="${image}" 
                         alt="${name}" 
                         class="w-full h-full object-contain p-1.5 sm:p-2 transition-transform duration-250 group-hover:scale-105" 
                         loading="lazy" 
                         onerror="this.src='https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=600&auto=format&fit=crop'"/>
                </a>
                ${quickAddHTML}
            </div>

            <!-- Content Details -->
            <div class="p-3 sm:p-5 flex flex-col justify-between flex-grow">
                <div>
                    <!-- Brand -->
                    <span class="text-[10px] sm:text-xs font-bold text-[#6B7280] uppercase tracking-widest block mb-0.5 sm:mb-1 truncate">
                        ${brandName}
                    </span>
                    
                    <!-- Product Title -->
                    <a href="${detailPath}?id=${encodeURIComponent(productId)}" onclick="try{localStorage.setItem('om_last_viewed_product_id','${productId}')}catch(e){}" class="block">
                        <h3 class="text-xs sm:text-sm md:text-base font-semibold text-[#111827] line-clamp-2 leading-snug mb-1.5 sm:mb-2 hover:text-[#0077B6] transition-colors" title="${name}">
                            ${name}
                        </h3>
                    </a>

                    <!-- Rating -->
                    <div class="flex items-center gap-0.5 sm:gap-1 mb-2 sm:mb-3">
                        ${ratingBlockHTML}
                    </div>
                </div>

                <!-- Price Section -->
                <div class="flex flex-wrap items-baseline gap-1 sm:gap-2 pt-1.5 sm:pt-2 border-t border-gray-100 mt-auto">
                    <span class="font-extrabold text-[#03045E] text-sm sm:text-base md:text-lg whitespace-nowrap">${formattedPrice}</span>
                    ${formattedOriginalPrice ? `<span class="line-through text-[#6B7280] text-[10px] sm:text-xs font-normal whitespace-nowrap">${formattedOriginalPrice}</span>` : ''}
                    ${discountPillHTML}
                </div>
            </div>

        </div>
    `;
}

// Global Wishlist Click Handler
window.handleProductWishlistToggle = async function(event, productId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!window.DB) return;

    await window.DB.toggleWishlist(productId);
    const isWishlisted = await window.DB.isInWishlist(productId);

    // Synchronize all wishlist buttons matching this product ID on the page
    document.querySelectorAll(`.product-card-wishlist-btn[data-product-id="${productId}"]`).forEach(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (isWishlisted) {
            btn.className = 'product-card-wishlist-btn absolute top-3 right-3 z-20 w-[46px] h-[46px] rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-90 bg-[#0077B6] text-white';
            if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            btn.className = 'product-card-wishlist-btn absolute top-3 right-3 z-20 w-[46px] h-[46px] rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-90 bg-white text-[#111827] hover:bg-[#CAF0F8] hover:text-[#0077B6]';
            if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        }
    });

    if (window.showToast) {
        window.showToast(isWishlisted ? "Added to Wishlist!" : "Removed from Wishlist.", isWishlisted ? "success" : "info");
    }

    window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { productId, isWishlisted } }));
};

window.handleProductQuickAdd = function(event, productId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const triggerOpen = (prod) => {
        if (prod) window.openQuickAddModal(prod);
    };

    if (window.API && window.API.getProductById) {
        window.API.getProductById(productId).then(res => {
            const prod = res ? (res.data || res) : null;
            if (prod) {
                triggerOpen(prod);
            } else if (window.DB && window.DB.getProductById) {
                triggerOpen(window.DB.getProductById(productId));
            }
        }).catch(err => {
            console.error('Failed to fetch product for Quick Add:', err);
            if (window.DB && window.DB.getProductById) {
                triggerOpen(window.DB.getProductById(productId));
            }
        });
    } else if (window.DB && window.DB.getProductById) {
        triggerOpen(window.DB.getProductById(productId));
    }
};

window.openQuickAddModal = async function(product) {
    if (!product) return;

    // 1. Ensure modal markup exists in body
    let modalOverlay = document.getElementById('quick-add-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'quick-add-modal-overlay';
        modalOverlay.className = "fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300 opacity-0 pointer-events-none";
        modalOverlay.innerHTML = `
            <div id="quick-add-modal-card" class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[520px] relative scale-95 opacity-0 transition-all duration-300 flex flex-col gap-5 overflow-y-auto max-h-[90vh]">
                <!-- Header -->
                <div class="flex gap-4 items-center border-b pb-4 relative">
                    <div class="w-20 h-20 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                        <img id="qa-product-image" src="" class="w-full h-full object-contain" alt="">
                    </div>
                    <div class="flex-grow pr-8">
                        <h3 id="qa-product-name" class="text-base font-bold text-[#111827] line-clamp-2"></h3>
                        <p id="qa-product-price" class="text-[#03045E] font-extrabold text-base mt-1"></p>
                    </div>
                    <button onclick="window.closeQuickAddModal()" class="material-symbols-outlined text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-full hover:bg-gray-100 absolute top-0 right-0 cursor-pointer">close</button>
                </div>

                <!-- Form Steps -->
                <div class="space-y-4">
                    <!-- Step 1: Device Type -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Step 1: Select Device Type</label>
                        <select id="qa-device-type" class="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#0077B6] bg-white cursor-pointer">
                            <option value="" disabled selected>Loading Device Types...</option>
                        </select>
                    </div>

                    <!-- Step 2: Brand -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Step 2: Select Brand</label>
                        <select id="qa-brand" disabled class="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#0077B6] bg-white disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer">
                            <option value="" disabled selected>Select Brand</option>
                        </select>
                    </div>

                    <!-- Step 3: Model -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Step 3: Select Model</label>
                        <select id="qa-model" disabled class="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#0077B6] bg-white disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer">
                            <option value="" disabled selected>Select Model</option>
                        </select>
                    </div>

                    <!-- Step 4 & 5: Options Grid (Finish & Material) -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Step 4: Select Finish</label>
                            <select id="qa-finish" class="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#0077B6] bg-white cursor-pointer">
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Step 5: Select Material</label>
                            <select id="qa-material" class="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-[#0077B6] bg-white cursor-pointer">
                            </select>
                        </div>
                    </div>

                    <!-- Quantity Stepper -->
                    <div class="space-y-1.5 pt-1">
                        <label class="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">Quantity</label>
                        <div class="flex items-center border border-gray-300 w-max rounded-lg overflow-hidden bg-white">
                            <button id="qa-qty-minus" class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
                                <span class="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <input id="qa-qty-input" class="w-12 text-center border-none text-xs font-bold focus:ring-0 p-0" type="number" readonly value="1"/>
                            <button id="qa-qty-plus" class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
                                <span class="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                        <p id="qa-qty-helper" class="text-[10px] text-gray-400 mt-1 hidden">Minimum order quantity is 1.</p>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="flex gap-3 pt-3 border-t">
                    <button onclick="window.closeQuickAddModal()" class="px-4 h-11 border border-gray-300 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
                    <button id="qa-add-btn" disabled class="flex-1 h-11 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold transition-all shadow-none cursor-not-allowed flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-base">shopping_cart</span> Add to Cart
                    </button>
                    <button id="qa-buy-btn" disabled class="flex-1 h-11 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold transition-all shadow-none cursor-not-allowed flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-base">bolt</span> Buy Now
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) window.closeQuickAddModal();
        });
    }

    // Populate Product Info
    const imgEl = document.getElementById('qa-product-image');
    const nameEl = document.getElementById('qa-product-name');
    const priceEl = document.getElementById('qa-product-price');
    
    imgEl.src = product.image;
    imgEl.alt = product.name;
    nameEl.textContent = product.name;
    
    const currency = window.pageCurrency ? window.pageCurrency() : '₹';
    let formattedPrice = '';
    const rawPrice = product.price || 0;
    if (currency === '₹') {
        formattedPrice = '₹' + Math.round(rawPrice * (rawPrice < 200 ? 80 : 1)).toLocaleString('en-IN');
    } else {
        formattedPrice = '$' + parseFloat(rawPrice).toFixed(2);
    }
    priceEl.textContent = formattedPrice;

    // Element references
    const typeSelect = document.getElementById('qa-device-type');
    const brandSelect = document.getElementById('qa-brand');
    const modelSelect = document.getElementById('qa-model');
    const finishSelect = document.getElementById('qa-finish');
    const materialSelect = document.getElementById('qa-material');
    const addBtn = document.getElementById('qa-add-btn');
    const buyBtn = document.getElementById('qa-buy-btn');

    // Quantity setup
    const minQty = product.minOrderQty || 1;
    let currentQty = minQty;

    const qtyInput = document.getElementById('qa-qty-input');
    const qtyMinus = document.getElementById('qa-qty-minus');
    const qtyPlus = document.getElementById('qa-qty-plus');
    const qtyHelper = document.getElementById('qa-qty-helper');

    if (qtyHelper) {
        if (minQty > 1) {
            qtyHelper.textContent = `Minimum order quantity is ${minQty}.`;
            qtyHelper.classList.remove('hidden');
        } else {
            qtyHelper.classList.add('hidden');
        }
    }

    const updateQtyUI = () => {
        if (qtyInput) qtyInput.value = currentQty;
        if (qtyMinus) {
            if (currentQty <= minQty) {
                qtyMinus.disabled = true;
                qtyMinus.classList.add('opacity-30', 'cursor-not-allowed');
            } else {
                qtyMinus.disabled = false;
                qtyMinus.classList.remove('opacity-30', 'cursor-not-allowed');
            }
        }
        updateValidation();
    };

    updateQtyUI();

    if (qtyMinus) {
        qtyMinus.onclick = (e) => {
            e.preventDefault();
            if (currentQty > minQty) {
                currentQty--;
                updateQtyUI();
            }
        };
    }

    if (qtyPlus) {
        qtyPlus.onclick = (e) => {
            e.preventDefault();
            currentQty++;
            updateQtyUI();
        };
    }

    // Populate Finishes (Step 4)
    const finishes = product.supportedFinishes && product.supportedFinishes.length > 0 
        ? product.supportedFinishes 
        : (product.finish ? product.finish.split(',').map(f => f.trim()) : ["Matte", "Gloss", "Satin"]);
    finishSelect.innerHTML = '<option value="" disabled selected>Select Finish</option>' + finishes.map(f => `<option value="${f}">${f}</option>`).join('');

    // Populate Materials (Step 5)
    const materials = product.supportedMaterials && product.supportedMaterials.length > 0 
        ? product.supportedMaterials 
        : (product.material ? product.material.split(',').map(m => m.trim()) : ["Standard 3M", "Carbon Fiber", "Leather"]);
    materialSelect.innerHTML = '<option value="" disabled selected>Select Material</option>' + materials.map(m => `<option value="${m}">${m}</option>`).join('');

    if (finishes.length === 1) finishSelect.value = finishes[0];
    if (materials.length === 1) materialSelect.value = materials[0];

    // Device Compatibility & Selection Cascade via Single Source of Truth Service
    const { isUniversal, deviceTypes, assignedBrands, assignedModels } = await window.ProductCompatibilityService.getCompatibility(product);

    if (deviceTypes && deviceTypes.length > 0) {
        typeSelect.innerHTML = '<option value="" disabled selected>Select Device Type</option>' + 
            deviceTypes.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else {
        typeSelect.innerHTML = '<option value="" disabled selected>No Compatible Device Types</option>';
    }
    
    brandSelect.innerHTML = '<option value="" disabled selected>Select Brand</option>';
    brandSelect.disabled = true;
    modelSelect.innerHTML = '<option value="" disabled selected>Select Model</option>';
    modelSelect.disabled = true;

    function updateValidation() {
        const hasType = !!typeSelect.value;
        const hasBrand = !!brandSelect.value;
        const hasModel = !!modelSelect.value;
        const hasFinish = !!finishSelect.value;
        const hasMaterial = !!materialSelect.value;
        const isValidQty = currentQty >= minQty;

        const isValid = hasType && hasBrand && hasModel && hasFinish && hasMaterial && isValidQty;

        if (isValid) {
            addBtn.disabled = false;
            addBtn.className = "flex-1 h-11 bg-[#0077B6] hover:bg-[#03045E] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-95";
            buyBtn.disabled = false;
            buyBtn.className = "flex-1 h-11 bg-[#03045E] hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-95";
        } else {
            addBtn.disabled = true;
            addBtn.className = "flex-1 h-11 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold transition-all shadow-none cursor-not-allowed flex items-center justify-center gap-1.5";
            buyBtn.disabled = true;
            buyBtn.className = "flex-1 h-11 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold transition-all shadow-none cursor-not-allowed flex items-center justify-center gap-1.5";
        }
    }

    // Step 1 Change -> Step 2
    typeSelect.onchange = async () => {
        const selectedTypeId = typeSelect.value;
        if (!selectedTypeId) return;

        if (product.devicePrices && product.devicePrices.length > 0) {
            const dpMatch = product.devicePrices.find(dp => String(dp.deviceTypeId) === String(selectedTypeId));
            if (dpMatch && Number(dpMatch.price) > 0) {
                priceEl.textContent = '₹' + Math.round(Number(dpMatch.price)).toLocaleString('en-IN');
            }
        }

        brandSelect.disabled = false;
        brandSelect.innerHTML = '<option value="" disabled selected>Loading Brands...</option>';
        modelSelect.innerHTML = '<option value="" disabled selected>Select Model</option>';
        modelSelect.disabled = true;

        const brands = await window.ProductCompatibilityService.getBrandsForDeviceType(selectedTypeId, isUniversal, assignedBrands);
        
        if (brands && brands.length > 0) {
            brandSelect.innerHTML = '<option value="" disabled selected>Select Brand</option>' +
                brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        } else {
            brandSelect.innerHTML = '<option value="" disabled selected>No Brands Available</option>';
        }
        updateValidation();
    };

    // Step 2 Change -> Step 3
    brandSelect.onchange = async () => {
        const selectedBrandId = brandSelect.value;
        if (!selectedBrandId) return;

        modelSelect.disabled = false;
        modelSelect.innerHTML = '<option value="" disabled selected>Loading Models...</option>';

        const models = await window.ProductCompatibilityService.getModelsForBrand(selectedBrandId, isUniversal, assignedModels, product.id);

        if (models && models.length > 0) {
            modelSelect.innerHTML = '<option value="" disabled selected>Select Model</option>' +
                models.map(m => `<option value="${m.id}" data-name="${m.name.replace(/"/g, '&quot;')}">${m.name}</option>`).join('');
        } else {
            modelSelect.innerHTML = '<option value="" disabled selected>No Compatible Models</option>';
        }
        updateValidation();
    };

    modelSelect.onchange = updateValidation;
    finishSelect.onchange = updateValidation;
    materialSelect.onchange = updateValidation;

    // Submission Handler
    const handleAdd = (isBuyNow = false) => {
        const selectedTypeId = typeSelect.value;
        const selectedModelOpt = modelSelect.options[modelSelect.selectedIndex];
        const selectedModelId = modelSelect.value;
        const selectedModelName = selectedModelOpt ? (selectedModelOpt.getAttribute('data-name') || selectedModelOpt.text) : selectedModelId;
        const selectedFinish = finishSelect.value;
        const selectedMaterial = materialSelect.value;

        const item = {
            id: product.id,
            name: product.name,
            price: product.price,
            qty: currentQty,
            device: selectedModelName,
            deviceModel: selectedModelName,
            modelId: selectedModelId,
            deviceTypeId: selectedTypeId,
            finish: selectedFinish,
            material: selectedMaterial,
            image: product.image
        };

        window.closeQuickAddModal();

        const cartMethod = window.API && window.API.addToCart ? window.API.addToCart : (i => { window.DB.addToCart(i); return Promise.resolve(true); });
        cartMethod(item)
            .then(() => {
                if (window.showToast) window.showToast(`Added ${product.name} to Cart!`, "success");
                window.dispatchEvent(new Event('cart-updated'));
                if (isBuyNow) {
                    window.location.href = 'checkout.html';
                } else if (window.OM && window.OM.toggleCartDrawer) {
                    window.OM.toggleCartDrawer(true);
                }
            })
            .catch((err) => {
                window.DB.addToCart(item);
                if (window.showToast) window.showToast(`Added ${product.name} to Cart!`, "success");
                window.dispatchEvent(new Event('cart-updated'));
                if (isBuyNow) {
                    window.location.href = 'checkout.html';
                } else if (window.OM && window.OM.toggleCartDrawer) {
                    window.OM.toggleCartDrawer(true);
                }
            });
    };

    addBtn.onclick = () => handleAdd(false);
    buyBtn.onclick = () => handleAdd(true);

    updateValidation();

    // Show Modal
    modalOverlay.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        const card = document.getElementById('quick-add-modal-card');
        if (card) card.classList.remove('scale-95', 'opacity-0');
    }, 50);
};

window.closeQuickAddModal = function() {
    const modalOverlay = document.getElementById('quick-add-modal-overlay');
    const modalCard = document.getElementById('quick-add-modal-card');
    if (modalCard) {
        modalCard.classList.add('scale-95', 'opacity-0');
    }
    if (modalOverlay) {
        setTimeout(() => {
            modalOverlay.classList.add('opacity-0', 'pointer-events-none');
        }, 200);
    }
};

// Listen to ESC key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeQuickAddModal();
    }
});

/**
 * Attach listeners helper for backward compatibility
 */
function attachProductCardListeners(container) {
    // Handlers are bound inline via window.handleProductWishlistToggle and window.handleProductQuickAdd
    return;
}

// Export Global Component Methods
window.renderProductCard = renderProductCard;
window.buildProductCardHTML = renderProductCard; // Alias for home.js
window.attachProductCardListeners = attachProductCardListeners;
