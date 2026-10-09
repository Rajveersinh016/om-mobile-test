/**
 * OM Mobile Art - Product Details Page Controller (product_detail.js)
 * Implements the normalized Product Type -> Device Type -> Brand -> Series (Optional) -> Model selection flow,
 * Material-to-Finish compatibility filtering, Device Preview Image switching, and dynamic Price Engine calculations.
 */

let currentProduct = null;
let allDeviceTypes = [];
let currentDeviceTypes = [];
let currentBrands = [];
let allMaterials = [];
let allFinishes = [];

let selectedDeviceTypeId = null;
let selectedBrandId = null;
let selectedSeriesId = null;
let selectedModelId = null;
let selectedModelName = '';
let isCustomModelSelected = false;
let customModelNameVal = null;

function isCameraOrLensDeviceType(dt) {
    if (!dt) return false;
    const name = typeof dt === 'string' ? dt : (dt.name || dt.slug || '');
    const clean = String(name).trim().toLowerCase();
    return clean === 'camera' || clean === 'camera lens' || clean === 'camera lenses' || clean.includes('camera') || clean.includes('lens');
}

let selectedMaterial = null; // Material object
let selectedFinish = null;   // Finish object
let selectedCoverage = null; // Coverage object
let quantity = 1;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch Product ID or Slug from URL parameters or path segments
    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id') || urlParams.get('slug');

    if (!productId && window.location.hash) {
        productId = window.location.hash.replace('#', '');
    }

    if (!productId) {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const lastSegment = pathSegments.pop() || '';
        if (lastSegment && !lastSegment.includes('product_detail') && !lastSegment.includes('.html')) {
            productId = lastSegment;
        }
    }

    if (!productId) {
        productId = localStorage.getItem('om_last_viewed_product_id');
    }

    if (productId) {
        productId = decodeURIComponent(productId).trim();
        try { localStorage.setItem('om_last_viewed_product_id', productId); } catch (e) {}
    }

    if (!productId || productId === 'undefined' || productId === 'null') {
        console.warn('[Product Details] No identifier in URL, attempting to load default product...');
        try {
            if (window.API && window.API.getProducts) {
                const prods = await window.API.getProducts({ limit: 1 });
                currentProduct = Array.isArray(prods) ? prods[0] : (prods.products ? prods.products[0] : null);
            }
            if (!currentProduct && window.DB && window.DB.getProducts) {
                const localProds = window.DB.getProducts();
                if (localProds && localProds.length > 0) currentProduct = localProds[0];
            }
        } catch (e) {
            console.error('[Product Details] Default product fallback failed:', e);
        }

        if (!currentProduct) {
            renderProductNotFound();
            return;
        }
        productId = currentProduct.id || currentProduct.slug;
    }

    console.log('[Product Details] Product Identifier Extracted:', productId);

    if (window.showLoader) window.showLoader();

    try {
        if (window.API && window.API.getProductById) {
            console.log('[Product Details] Fetching full product details via API for identifier:', productId);
            const fullProd = await window.API.getProductById(productId);
            if (fullProd) {
                currentProduct = fullProd;
                console.log('[Product Details] Full Product Details Response:', currentProduct);
            }
        }
        if (!currentProduct && window.DB && window.DB.getProductById) {
            console.log('[Product Details] Fetching product via Local DB for identifier:', productId);
            currentProduct = window.DB.getProductById(productId);
            console.log('[Product Details] DB Response:', currentProduct);
        }
    } catch (err) {
        console.error("[Product Details] Failed to load product:", err);
    } finally {
        if (window.hideLoader) window.hideLoader();
    }

    if (!currentProduct) {
        console.warn('[Product Details] Product not found for identifier:', productId);
        renderProductNotFound();
        return;
    }

    // 2. Render static & details layout
    renderProductDetails();
    initImageGallery();
    initQuantityStepper();
    initActionButtons();
    renderRelatedProducts();
    renderReviewsSection();

    // 3. Load Materials & Finishes matrix
    allMaterials = window.API && window.API.getMaterials ? await window.API.getMaterials() : [];
    allFinishes = window.API && window.API.getFinishes ? await window.API.getFinishes() : [];
    initMaterialAndFinishMatrix();

    // 4. Load Device Selection Hierarchy
    await initDeviceTypeSelector();
});

function renderProductNotFound() {
    document.title = "Product Not Found | OM Mobile Art";
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div class="py-20 text-center max-w-md mx-auto space-y-4">
                <span class="material-symbols-outlined text-6xl text-text-muted">search_off</span>
                <h1 class="text-2xl font-bold text-[#111827]">Product Not Found</h1>
                <p class="text-sm text-text-muted font-medium">The product you are looking for does not exist or may have been removed.</p>
                <div class="pt-4">
                    <a href="shop.html" class="px-6 py-3 bg-[#03045E] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#0077B6] transition-colors inline-block">Back to Shop</a>
                </div>
            </div>
        `;
    }
}

// Render general product information
function renderProductDetails() {
    document.title = `${currentProduct.name} | OM Mobile Art`;
    const h1 = document.querySelector('main h1');
    if (h1) h1.textContent = currentProduct.name;

    const ratingContainer = document.getElementById('product-rating-container');
    const reviewsCount = Number(currentProduct.reviewsCount || (currentProduct.reviews ? currentProduct.reviews.length : 0)) || 0;
    const ratingValue = Number(currentProduct.rating) || 0;

    if (ratingContainer) {
        ratingContainer.innerHTML = window.renderProductRatingHTML 
            ? window.renderProductRatingHTML(ratingValue, reviewsCount, { size: 'sm' })
            : `<span class="text-text-muted text-xs font-semibold">No reviews yet</span>`;
    }

    const tabReviewsBtn = document.getElementById('tab-btn-reviews');
    if (tabReviewsBtn) {
        tabReviewsBtn.textContent = `Reviews (${reviewsCount})`;
    }

    const activeBreadcrumb = document.getElementById('breadcrumb-product-title') || document.querySelector('nav.flex.items-center.space-x-2 span.text-on-surface');
    if (activeBreadcrumb) {
        activeBreadcrumb.textContent = currentProduct.name;
    }

    const descText = document.getElementById('product-long-description');
    if (descText) {
        descText.textContent = currentProduct.description || "Premium precision-cut 3M skin providing exceptional scratch protection, tactile feedback, and bubble-free installation.";
    }

    // Set Product Type Badge
    const ptBadge = document.getElementById('product-type-badge');
    if (ptBadge) {
        const ptName = currentProduct.productType 
            ? (typeof currentProduct.productType === 'object' ? currentProduct.productType.name : currentProduct.productType)
            : (currentProduct.category ? (typeof currentProduct.category === 'object' ? currentProduct.category.name : currentProduct.category) : 'Mobile Skin');
        ptBadge.textContent = ptName;
    }

    updatePriceUI();
}

// Tab Switching Controller (Description | Installation Guide | Reviews)
window.switchProductTab = function(tabName) {
    const tabs = ['description', 'installation', 'reviews'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = 'py-4 font-bold text-xs sm:text-sm uppercase tracking-widest active-tab border-b-2 border-[#03045E] text-[#03045E] transition-all cursor-pointer';
                content.classList.remove('hidden');
            } else {
                btn.className = 'py-4 font-bold text-xs sm:text-sm uppercase tracking-widest text-text-muted hover:text-primary transition-all cursor-pointer';
                content.classList.add('hidden');
            }
        }
    });
};

// Dynamic Price Engine Calculation (Canonical Single Source of Truth in INR)
function updatePriceUI() {
    let basePrice = Number(currentProduct.price) || 0;
    let pricePrefix = '';
    let isUnavailable = false;

    if (selectedDeviceTypeId && currentProduct.devicePrices && currentProduct.devicePrices.length > 0) {
        const dpMatch = currentProduct.devicePrices.find(dp => String(dp.deviceTypeId) === String(selectedDeviceTypeId));
        if (dpMatch && Number(dpMatch.price) > 0) {
            basePrice = Number(dpMatch.price);
            pricePrefix = '';
        } else {
            isUnavailable = true;
        }
    } else if (currentProduct.devicePrices && currentProduct.devicePrices.length > 0) {
        const validDPs = currentProduct.devicePrices.map(dp => Number(dp.price)).filter(p => p > 0);
        if (validDPs.length > 1) {
            basePrice = Math.min(...validDPs);
            pricePrefix = 'From ';
        } else if (validDPs.length === 1) {
            basePrice = validDPs[0];
            pricePrefix = '';
        }
    }

    const addCartBtn = document.getElementById('btn-add-to-cart');
    const buyNowBtn = document.getElementById('btn-buy-now');

    if (isUnavailable) {
        const priceContainer = document.getElementById('detail-price-container');
        if (priceContainer) {
            priceContainer.innerHTML = `<span class="text-[#EF4444] font-bold text-lg">Unavailable for selected device</span>`;
        }
        if (addCartBtn) {
            addCartBtn.disabled = true;
            addCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (buyNowBtn) {
            buyNowBtn.disabled = true;
            buyNowBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return;
    } else {
        if (addCartBtn) {
            addCartBtn.disabled = false;
            addCartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (buyNowBtn) {
            buyNowBtn.disabled = false;
            buyNowBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    const materialOffset = selectedMaterial ? Number(selectedMaterial.priceOffset || 0) : 0;
    const finishOffset = selectedFinish ? Number(selectedFinish.priceOffset || 0) : 0;

    const unitPrice = basePrice + materialOffset + finishOffset;
    const totalPrice = unitPrice * quantity;

    const rawOrig = Number(currentProduct.originalPrice) || basePrice;
    const originalPrice = (rawOrig + materialOffset + finishOffset) * quantity;

    const formattedPrice = pricePrefix + (window.PricingEngine ? window.PricingEngine.format(totalPrice) : `₹${Math.round(totalPrice).toLocaleString('en-IN')}`);
    const formattedOrig = window.PricingEngine ? window.PricingEngine.format(originalPrice) : `₹${Math.round(originalPrice).toLocaleString('en-IN')}`;

    const discountPercent = rawOrig > basePrice ? Math.round(((rawOrig - basePrice) / rawOrig) * 100) : 0;

    const priceContainer = document.getElementById('detail-price-container');
    if (priceContainer) {
        priceContainer.innerHTML = `
            <span class="text-headline-h2 font-bold text-badge-sale text-3xl">${formattedPrice}</span>
            ${(discountPercent > 0 && originalPrice > totalPrice) ? `<span class="text-headline-h3 text-text-muted line-through font-normal">${formattedOrig}</span>
            <span class="bg-badge-sale/10 text-badge-sale px-2 py-0.5 rounded text-label-caps font-bold">${discountPercent}% OFF</span>` : ''}
        `;
    }
}

// Material & Finish Compatibility Matrix
function initMaterialAndFinishMatrix() {
    const matContainer = document.getElementById('material-options-container');
    if (!matContainer) return;

    let availableMaterials = (currentProduct.supportedMaterials && currentProduct.supportedMaterials.length > 0)
        ? currentProduct.supportedMaterials.map((m, i) => typeof m === 'object' ? m : { id: String(i+1), name: m, priceOffset: 0 })
        : allMaterials;

    if (!availableMaterials || availableMaterials.length === 0) {
        availableMaterials = [
            { id: '1', name: 'Standard 3M', slug: 'standard-3m', priceOffset: 0, allowedFinishes: [{ id: 'f1', name: 'Matte' }, { id: 'f2', name: 'Gloss' }] },
            { id: '2', name: 'Carbon Fiber', slug: 'carbon-fiber', priceOffset: 100, allowedFinishes: [{ id: 'f1', name: 'Matte' }, { id: 'f2', name: 'Gloss' }] }
        ];
    }

    allMaterials = availableMaterials;
    selectedMaterial = allMaterials[0];
    renderMaterialButtons();
    updateAllowedFinishes();
}

function renderMaterialButtons() {
    const matContainer = document.getElementById('material-options-container');
    if (!matContainer) return;

    matContainer.innerHTML = allMaterials.map(mat => {
        const isSelected = selectedMaterial && (selectedMaterial.id === mat.id || selectedMaterial.name === mat.name);
        const matIdStr = String(mat.id || mat.name).replace(/'/g, "\\'");
        return `
            <button type="button" onclick="selectMaterial('${matIdStr}')" 
                class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${isSelected ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border-subtle hover:border-primary/50 text-on-surface'}">
                ${mat.name}
            </button>
        `;
    }).join('');
}

window.selectMaterial = function(matId) {
    const found = allMaterials.find(m => String(m.id) === String(matId) || m.name === matId);
    if (found) {
        selectedMaterial = found;
        renderMaterialButtons();
        updateAllowedFinishes();
        updatePriceUI();
    }
};

function updateAllowedFinishes() {
    const finContainer = document.getElementById('finish-options-container');
    if (!finContainer) return;

    let allowed = (selectedMaterial && selectedMaterial.allowedFinishes) 
        ? selectedMaterial.allowedFinishes 
        : (currentProduct.supportedFinishes && currentProduct.supportedFinishes.length > 0 
            ? currentProduct.supportedFinishes.map((f, i) => typeof f === 'object' ? f : { id: `f${i+1}`, name: f }) 
            : allFinishes);

    if (!allowed || allowed.length === 0) {
        allowed = [{ id: 'f1', name: 'Matte' }, { id: 'f2', name: 'Gloss' }];
    }
    
    if (!selectedFinish || !allowed.some(f => f.id === selectedFinish.id || f.name === selectedFinish.name)) {
        selectedFinish = allowed[0];
    }

    finContainer.innerHTML = allowed.map(fin => {
        const isSelected = selectedFinish && (selectedFinish.id === fin.id || selectedFinish.name === fin.name);
        const finIdStr = String(fin.id || fin.name).replace(/'/g, "\\'");
        return `
            <button type="button" onclick="selectFinish('${finIdStr}')" 
                class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${isSelected ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border-subtle hover:border-primary/50 text-on-surface'}">
                ${fin.name}
            </button>
        `;
    }).join('');
}

window.selectFinish = function(finId) {
    const allowed = (selectedMaterial && selectedMaterial.allowedFinishes) 
        ? selectedMaterial.allowedFinishes 
        : (currentProduct.supportedFinishes && currentProduct.supportedFinishes.length > 0 
            ? currentProduct.supportedFinishes.map((f, i) => typeof f === 'object' ? f : { id: `f${i+1}`, name: f }) 
            : allFinishes);

    const found = allFinishes.find(f => String(f.id) === String(finId) || f.name === finId) || allowed.find(f => String(f.id) === String(finId) || f.name === finId);
    if (found) {
        selectedFinish = found;
        updateAllowedFinishes();
        updatePriceUI();
    }
};

// Device Selection Hierarchy State Machine
async function initDeviceTypeSelector() {
    const dtSelect = document.getElementById('select-device-type');
    const brandSelect = document.getElementById('select-brand');
    const modelSelect = document.getElementById('select-model');

    if (!dtSelect || !currentProduct) return;

    const { isUniversal, deviceTypes, assignedBrands, assignedModels } = await window.ProductCompatibilityService.getCompatibility(currentProduct);
    
    console.log(`[Storefront Compatibility Trace] Product '${currentProduct.id}' (${currentProduct.name}) - Universal Mode: ${isUniversal}`);
    console.log('[Storefront Compatibility Trace] Compatibility Object:', { deviceTypes, assignedBrands, assignedModels });

    currentDeviceTypes = deviceTypes || [];
    currentBrands = assignedBrands || [];

    console.log(`[Storefront Compatibility Trace] Rendered Device Types count: ${deviceTypes.length}`, deviceTypes);

    if (deviceTypes && deviceTypes.length > 0) {
        selectedDeviceTypeId = deviceTypes[0].id;
        if (deviceTypes.length === 1) {
            dtSelect.innerHTML = deviceTypes.map(dt => `<option value="${dt.id}" selected>${dt.name}</option>`).join('');
        } else {
            dtSelect.innerHTML = '<option value="" disabled>Select Device Type</option>' +
                deviceTypes.map((dt, idx) => `<option value="${dt.id}" ${idx === 0 ? 'selected' : ''}>${dt.name}</option>`).join('');
        }
        dtSelect.value = selectedDeviceTypeId;
        
        // Auto-trigger initial device type selection and update price UI
        setTimeout(async () => {
            updatePriceUI();
            if (brandSelect) {
                brandSelect.disabled = false;
                brandSelect.innerHTML = '<option value="" disabled selected>Loading Brands...</option>';
            }
            const brandsForDt = await window.ProductCompatibilityService.getBrandsForDeviceType(selectedDeviceTypeId, isUniversal, assignedBrands);
            currentBrands = brandsForDt || [];
            if (brandSelect) {
                if (currentBrands.length > 0) {
                    brandSelect.innerHTML = '<option value="" disabled selected>Select Brand</option>' +
                        currentBrands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
                } else {
                    brandSelect.innerHTML = '<option value="" disabled selected>No Brands Available</option>';
                }
            }
        }, 0);
    } else {
        dtSelect.innerHTML = '<option value="" disabled selected>No Compatible Device Types</option>';
    }

    dtSelect.addEventListener('change', async (e) => {
        selectedDeviceTypeId = e.target.value;
        selectedBrandId = null;
        selectedModelId = null;
        selectedModelName = '';
        isCustomModelSelected = false;
        customModelNameVal = null;

        updatePriceUI();

        const customWrapper = document.getElementById('custom-model-input-wrapper');
        const customInput = document.getElementById('input-custom-model');
        if (customWrapper) customWrapper.classList.add('hidden');
        if (customInput) customInput.value = '';

        if (brandSelect) {
            brandSelect.disabled = false;
            brandSelect.innerHTML = '<option value="" disabled selected>Loading Brands...</option>';
        }
        if (modelSelect) {
            modelSelect.disabled = true;
            modelSelect.innerHTML = '<option value="" disabled selected>Select Model</option>';
        }

        const brandsForDt = await window.ProductCompatibilityService.getBrandsForDeviceType(selectedDeviceTypeId, isUniversal, assignedBrands);

        currentBrands = brandsForDt || [];
        console.log(`[Storefront Compatibility Trace] Rendered Brands for DeviceType '${selectedDeviceTypeId}': ${brandsForDt.length}`, brandsForDt);

        if (brandsForDt && brandsForDt.length > 0) {
            brandSelect.innerHTML = '<option value="" disabled selected>Select Brand</option>' +
                brandsForDt.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        } else {
            brandSelect.innerHTML = '<option value="" disabled selected>No Brands Available</option>';
        }
    });

    if (brandSelect) {
        brandSelect.addEventListener('change', async (e) => {
            selectedBrandId = e.target.value;
            selectedModelId = null;
            selectedModelName = '';
            isCustomModelSelected = false;
            customModelNameVal = null;

            const customWrapper = document.getElementById('custom-model-input-wrapper');
            const customInput = document.getElementById('input-custom-model');
            if (customWrapper) customWrapper.classList.add('hidden');
            if (customInput) customInput.value = '';

            if (modelSelect) {
                modelSelect.disabled = false;
                modelSelect.innerHTML = '<option value="" disabled selected>Loading Models...</option>';
            }

            await loadModelsForSelection(selectedBrandId, isUniversal, assignedModels);
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', async (e) => {
            const val = modelSelect.value;
            const customWrapper = document.getElementById('custom-model-input-wrapper');
            const customInput = document.getElementById('input-custom-model');

            if (val === 'CUSTOM_MODEL') {
                isCustomModelSelected = true;
                selectedModelId = null;
                selectedModelName = '';
                customModelNameVal = null;
                if (customWrapper) customWrapper.classList.remove('hidden');
                if (customInput) customInput.focus();

                const specsBlock = document.getElementById('model-specs-block');
                if (specsBlock) specsBlock.classList.add('hidden');
            } else {
                isCustomModelSelected = false;
                customModelNameVal = null;
                if (customWrapper) customWrapper.classList.add('hidden');
                if (customInput) customInput.value = '';
                selectedModelId = val;
                const selectedOpt = modelSelect.options[modelSelect.selectedIndex];
                selectedModelName = selectedOpt ? (selectedOpt.getAttribute('data-name') || selectedOpt.text) : '';
                await selectModel({ id: selectedModelId, name: selectedModelName });
            }
        });
    }
}

let loadedModels = [];

async function loadModelsForSelection(brandId, isUniversal = false, assignedModels = []) {
    const modelSelect = document.getElementById('select-model');
    if (!modelSelect) return;

    const models = await window.ProductCompatibilityService.getModelsForBrand(brandId, isUniversal, assignedModels, currentProduct ? currentProduct.id : null);

    console.log(`[Storefront Compatibility Trace] Rendered Models for Brand '${brandId}': ${models.length}`, models);

    const dtSelect = document.getElementById('select-device-type');
    const selectedDtObj = (currentDeviceTypes || []).find(d => String(d.id) === String(selectedDeviceTypeId) || d.name === selectedDeviceTypeId);
    const dtOpt = dtSelect && dtSelect.selectedIndex >= 0 ? dtSelect.options[dtSelect.selectedIndex] : null;
    const selectedDtName = selectedDtObj ? (selectedDtObj.name || selectedDtObj.slug) : (dtOpt && dtOpt.value ? dtOpt.text : '');

    const isCameraOrLens = isCameraOrLensDeviceType(selectedDtName) || 
                           isCameraOrLensDeviceType(currentProduct?.productType) || 
                           isCameraOrLensDeviceType(currentProduct?.category);

    if (models && models.length > 0) {
        modelSelect.disabled = false;
        let html = '<option value="" disabled selected>Select Model</option>' +
            models.map(m => `<option value="${m.id}" data-name="${m.name.replace(/"/g, '&quot;')}">${m.name}</option>`).join('');
        if (isCameraOrLens) {
            html += '<option value="CUSTOM_MODEL">Model not listed? Enter model name</option>';
        }
        modelSelect.innerHTML = html;
    } else if (isCameraOrLens) {
        modelSelect.disabled = false;
        modelSelect.innerHTML = '<option value="" disabled selected>Select Model</option>' +
            '<option value="CUSTOM_MODEL">Model not listed? Enter model name</option>';
    } else {
        modelSelect.disabled = true;
        modelSelect.innerHTML = '<option value="" disabled selected>No Models Available</option>';
    }
}

window.selectModel = async function(model) {
    if (!model || !model.id) return;
    selectedModelId = model.id;
    selectedModelName = model.name;

    // Check for Device Preview Image from backend
    try {
        const previews = await window.API.getProductPreviews(currentProduct.id, model.id);
        const mainImg = document.getElementById('main-product-image');
        if (previews && previews.length > 0 && mainImg) {
            mainImg.src = previews[0].imageUrl;
        } else if (mainImg && currentProduct) {
            mainImg.src = currentProduct.image || '';
        }
    } catch (err) {
        console.warn('Device preview fetch failed', err);
    }

    // Specs block
    const specsBlock = document.getElementById('model-specs-block');
    if (specsBlock) {
        specsBlock.classList.remove('hidden');
        specsBlock.innerHTML = `
            <div class="flex justify-between items-center py-1">
                <span class="font-semibold uppercase tracking-wider text-[10px] text-text-muted">Selected Device:</span>
                <span class="font-bold text-on-surface">${model.name}</span>
            </div>
            <div class="flex justify-between items-center py-1 border-t border-border-subtle/30">
                <span class="font-semibold uppercase tracking-wider text-[10px] text-text-muted">Availability:</span>
                <span class="font-bold text-emerald-600">In Stock (Dispatched in 24 Hours)</span>
            </div>
        `;
    }
};

function getProductGallerySequence(prod) {
    if (!prod) return [];
    const list = [];
    if (prod.image) list.push({ url: prod.image, label: 'Primary' });
    if (prod.hoverImage) list.push({ url: prod.hoverImage, label: 'Hover' });

    if (prod.images && prod.images.length > 0) {
        prod.images.forEach((img, i) => {
            const url = typeof img === 'string' ? img : img.url;
            if (url && url !== prod.image && url !== prod.hoverImage) {
                list.push({ url, label: `Gallery ${i + 1}` });
            }
        });
    }

    if (prod.defaultFrontMockup) list.push({ url: prod.defaultFrontMockup, label: 'Front Mockup' });
    if (prod.defaultBackMockup) list.push({ url: prod.defaultBackMockup, label: 'Back Mockup' });

    return list.length > 0 ? list : [{ url: prod.image, label: 'Primary' }];
}

// Gallery, Quantity & Actions
function initImageGallery() {
    const mainImg = document.getElementById('main-product-image');
    const grid = document.getElementById('product-thumbnails-grid');
    if (!mainImg || !grid) return;

    const gallerySeq = getProductGallerySequence(currentProduct);

    if (gallerySeq.length > 0) {
        mainImg.src = gallerySeq[0].url;
    }

    grid.innerHTML = gallerySeq.map((item, idx) => `
        <div onclick="switchGalleryImage(${idx})" class="aspect-square bg-[#F8FAFC] border border-border-subtle rounded-xl overflow-hidden cursor-pointer ${idx === 0 ? 'thumbnail-active border-[#0077B6] ring-2 ring-[#0077B6]/20' : ''} transition-all hover:border-[#0077B6] flex items-center justify-center p-1 shadow-sm">
            <img src="${item.url}" alt="${item.label}" class="max-w-full max-h-full object-contain p-1" />
        </div>
    `).join('');
}

window.switchGalleryImage = function(idx) {
    const mainImg = document.getElementById('main-product-image');
    const thumbs = document.querySelectorAll('#product-thumbnails-grid > div');
    const gallerySeq = getProductGallerySequence(currentProduct);

    if (mainImg && gallerySeq[idx]) {
        mainImg.src = gallerySeq[idx].url;
    }
    thumbs.forEach((t, i) => {
        if (i === idx) t.classList.add('thumbnail-active');
        else t.classList.remove('thumbnail-active');
    });
};

function initQuantityStepper() {
    quantity = currentProduct ? (currentProduct.minOrderQty || 1) : 1;
    const indicator = document.getElementById('qty-indicator');
    if (indicator) indicator.textContent = quantity;

    const updateMinusBtnState = () => {
        const minusBtn = document.querySelector('#quantity-stepper-container button:first-child');
        if (minusBtn) {
            const minQty = currentProduct ? (currentProduct.minOrderQty || 1) : 1;
            if (quantity <= minQty) {
                minusBtn.classList.add('opacity-30', 'cursor-not-allowed');
            } else {
                minusBtn.classList.remove('opacity-30', 'cursor-not-allowed');
            }
        }
    };
    updateMinusBtnState();

    window.adjustQty = function(delta) {
        const minQty = currentProduct ? (currentProduct.minOrderQty || 1) : 1;
        quantity = Math.max(minQty, quantity + delta);
        if (indicator) indicator.textContent = quantity;
        updateMinusBtnState();
        updatePriceUI();
    };
}

function initActionButtons() {
    const addCartBtn = document.getElementById('btn-add-to-cart');
    const buyNowBtn = document.getElementById('btn-buy-now');

    if (addCartBtn) {
        addCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleAddToCartFlow(false);
        });
    }

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleAddToCartFlow(true);
        });
    }
}

async function handleAddToCartFlow(isBuyNow) {
    if (!selectedDeviceTypeId) {
        if (window.showToast) window.showToast("Please select your Device Type.", "error");
        else alert("Please select your Device Type.");
        return;
    }
    if (!selectedBrandId) {
        if (window.showToast) window.showToast("Please select your Brand.", "error");
        else alert("Please select your Brand.");
        return;
    }

    const modelSelect = document.getElementById('select-model');
    const isCustom = isCustomModelSelected || (modelSelect && modelSelect.value === 'CUSTOM_MODEL');

    if (isCustom) {
        const customInput = document.getElementById('input-custom-model');
        const rawCustomVal = customInput ? customInput.value.trim() : '';
        if (!rawCustomVal) {
            if (window.showToast) window.showToast("Please enter the complete model name.", "error");
            else alert("Please enter the complete model name.");
            if (customInput) customInput.focus();
            return;
        }
        selectedModelId = null;
        selectedModelName = rawCustomVal; // Preserve exact full string entered by user
        customModelNameVal = rawCustomVal;
    } else {
        if (!selectedModelId || !selectedModelName) {
            if (window.showToast) window.showToast("Please select your device Model.", "error");
            else alert("Please select your device Model.");
            return;
        }
        customModelNameVal = null;
    }

    const dtSelect = document.getElementById('select-device-type');
    const brandSelect = document.getElementById('select-brand');

    const brandObj = (currentBrands || []).find(b => b.id === selectedBrandId || b.name === selectedBrandId);
    const brandOpt = brandSelect && brandSelect.selectedIndex >= 0 ? brandSelect.options[brandSelect.selectedIndex] : null;
    const brandName = brandObj ? brandObj.name : (brandOpt && brandOpt.value ? brandOpt.text : (selectedBrandId || 'Generic'));

    const deviceTypeObj = (currentDeviceTypes || []).find(d => d.id === selectedDeviceTypeId || d.name === selectedDeviceTypeId);
    const dtOpt = dtSelect && dtSelect.selectedIndex >= 0 ? dtSelect.options[dtSelect.selectedIndex] : null;
    const deviceTypeName = deviceTypeObj ? deviceTypeObj.name : (dtOpt && dtOpt.value ? dtOpt.text : 'Mobile');

    let calculatedDevicePrice = Number(currentProduct.price) || 0;
    if (selectedDeviceTypeId && currentProduct.devicePrices && currentProduct.devicePrices.length > 0) {
        const dpMatch = currentProduct.devicePrices.find(dp => String(dp.deviceTypeId) === String(selectedDeviceTypeId));
        if (dpMatch && Number(dpMatch.price) > 0) {
            calculatedDevicePrice = Number(dpMatch.price);
        }
    }

    console.log('[DEVICE PRICE]', {
        productId: currentProduct.id,
        deviceTypeId: selectedDeviceTypeId,
        calculatedPrice: calculatedDevicePrice
    });

    console.log('[ADD TO CART]', {
        productId: currentProduct.id,
        deviceTypeId: selectedDeviceTypeId,
        modelId: selectedModelId,
        customModelName: customModelNameVal
    });

    const item = {
        id: currentProduct.id,
        productId: currentProduct.id,
        name: currentProduct.name,
        price: calculatedDevicePrice,
        basePrice: calculatedDevicePrice,
        image: currentProduct.image,
        brand: brandName,
        deviceBrand: brandName,
        deviceModel: selectedModelName,
        customModelName: customModelNameVal,
        deviceType: deviceTypeName,
        deviceTypeId: selectedDeviceTypeId,
        modelId: selectedModelId,
        material: selectedMaterial ? selectedMaterial.name : 'Standard 3M',
        finish: selectedFinish ? selectedFinish.name : 'Matte',
        coverage: selectedCoverage ? selectedCoverage.name : 'Full Back',
        quantity
    };

    if (window.API && window.API.addToCart) {
        await window.API.addToCart(item);
    } else {
        window.DB.addToCart(item);
    }

    if (window.showToast) window.showToast(`${currentProduct.name} (${selectedModelName}) added to cart!`, "success");

    if (isBuyNow) {
        window.location.href = 'checkout.html';
    }
}

async function renderRelatedProducts() {
    const grid = document.getElementById('related-products-grid') || document.querySelector('#related-products-container');
    if (!grid || !currentProduct) return;

    let allProducts = [];
    try {
        if (window.API && window.API.getProducts) {
            allProducts = await window.API.getProducts({ limit: 8 });
        } else if (window.DB && window.DB.getProducts) {
            allProducts = window.DB.getProducts() || [];
        }
    } catch (err) {
        console.error('Failed to fetch related products:', err);
    }

    const related = allProducts
        .filter(p => String(p.id) !== String(currentProduct.id))
        .slice(0, 4);

    if (related.length > 0) {
        grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6";
        grid.innerHTML = related.map(p => window.renderProductCard(p, { detailPath: 'product_detail.html' })).join('');
        if (window.attachProductCardListeners) window.attachProductCardListeners(grid);
    } else {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-gray-500 font-medium"><p class="text-sm font-bold text-gray-700">No related products available.</p></div>`;
    }
}
async function renderReviewsSection() {
    const container = document.getElementById('reviews-section-container');
    const tabContainer = document.getElementById('reviews-tab-container');
    if (!container && !tabContainer) return;

    let googleData = null;
    try {
        if (window.API && window.API.fetchGoogleReviews) {
            googleData = await window.API.fetchGoogleReviews();
        }
    } catch (e) {
        console.warn('Failed to load Google Reviews:', e);
    }

    const ratingVal = googleData?.rating || 4.9;
    const totalCount = googleData?.userRatingsTotal || 256;
    const googlePlaceUrl = googleData?.googlePlaceUrl || 'https://maps.app.goo.gl/t14LWUswCdPH8ShVA';
    const reviewsList = googleData?.reviews || [];

    // Update Product Detail Header Rating Container
    const ratingContainer = document.getElementById('product-rating-container');
    if (ratingContainer) {
        ratingContainer.innerHTML = window.renderProductRatingHTML
            ? window.renderProductRatingHTML(ratingVal, totalCount, { size: 'sm' })
            : `<a href="${googlePlaceUrl}" target="_blank" class="text-xs font-bold text-[#1E293B]">${ratingVal} ★★★★★ (${totalCount} Google Reviews)</a>`;
    }

    const tabReviewsBtn = document.getElementById('tab-btn-reviews');
    if (tabReviewsBtn) {
        tabReviewsBtn.textContent = 'Customer Reviews';
    }

    let contentHTML = '';

    // Requirement 8: Fallback state if Google Reviews cannot be loaded
    if (!googleData || reviewsList.length === 0) {
        contentHTML = `
            <div class="space-y-6 max-w-2xl mx-auto py-8 text-center bg-[#F8FAFC] border border-gray-200 rounded-3xl p-8">
                <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto text-[#4285F4]">
                    <span class="material-symbols-outlined text-2xl">rate_review</span>
                </div>
                <h4 class="font-bold text-base text-gray-900">Google Reviews are temporarily unavailable.</h4>
                <p class="text-xs text-gray-600 max-w-md mx-auto">Please visit our official Google Business profile to read customer reviews and ratings for OM Mobile Art.</p>
                <div class="pt-2">
                    ${window.renderGoogleReviewButtonHTML ? window.renderGoogleReviewButtonHTML('⭐ Review us on Google') : `<a href="${googlePlaceUrl}" target="_blank" class="px-5 py-2.5 bg-[#4285F4] text-white font-bold text-xs rounded-xl shadow-sm">⭐ Review us on Google</a>`}
                </div>
            </div>
        `;
    } else {
        // Requirement 4: Google Reviews Tab Layout
        contentHTML = `
            <div class="space-y-8 max-w-4xl mx-auto">
                <!-- Header Summary -->
                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                    <div class="space-y-2">
                        <div class="flex items-center gap-3">
                            <h3 class="text-xl sm:text-2xl font-extrabold text-[#03045E]">Customer Reviews</h3>
                            ${window.renderGoogleBadgeHTML ? window.renderGoogleBadgeHTML() : ''}
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-3xl font-black text-[#1E293B]">★★★★★ ${ratingVal.toFixed(1)}</span>
                            <span class="text-xs font-semibold text-gray-500">Based on <strong>${totalCount} Google Reviews</strong></span>
                        </div>
                    </div>

                    <!-- Requirement 6: Review us on Google button -->
                    <div>
                        ${window.renderGoogleReviewButtonHTML ? window.renderGoogleReviewButtonHTML('⭐ Review us on Google') : `<a href="${googlePlaceUrl}" target="_blank" class="px-5 py-2.5 bg-[#4285F4] text-white font-bold text-xs rounded-xl">⭐ Review us on Google</a>`}
                    </div>
                </div>

                <!-- Google Reviews List -->
                <div class="grid md:grid-cols-2 gap-4">
                    ${reviewsList.map(r => `
                        <div class="p-5 bg-white border border-gray-200/80 rounded-2xl space-y-3 shadow-xs hover:border-[#4285F4]/40 transition-all flex flex-col justify-between">
                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <img src="${r.authorPhotoUrl}" alt="${r.authorName}" class="w-9 h-9 rounded-full object-cover border border-gray-200" onerror="this.src='https://lh3.googleusercontent.com/a/default-user'"/>
                                        <div>
                                            <h5 class="font-extrabold text-sm text-gray-900">${r.authorName}</h5>
                                            <span class="text-[10px] text-gray-400 font-medium">${r.relativeTimeDescription}</span>
                                        </div>
                                    </div>
                                    <svg class="w-4 h-4 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                                    </svg>
                                </div>
                                <div class="flex items-center gap-1 text-[#FFB800]">
                                    ${[1,2,3,4,5].map(s => `<span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' ${s <= r.rating ? 1 : 0};">star</span>`).join('')}
                                </div>
                                <p class="text-xs text-gray-700 leading-relaxed font-normal">${r.text}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Footer View More Link -->
                <div class="pt-4 text-center">
                    <a href="${googlePlaceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-xs font-extrabold text-gray-800 hover:bg-gray-50 transition-colors">
                        <span>View More Reviews on Google</span>
                        <span class="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                </div>
            </div>
        `;
    }

    if (tabContainer) tabContainer.innerHTML = contentHTML;
    if (container) container.innerHTML = contentHTML;
}
