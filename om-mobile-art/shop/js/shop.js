/**
 * OM Mobile Art - Restructured Shop Page Controller (shop.js)
 * Implements clean top-level filters for Device Types, Brands, Models, Product Types,
 * Materials, Finishes, Promotions, and Price Range.
 * Also supports dynamic Grid/List view switching and full state synchronization.
 */

// Filter state
const state = {
    deviceTypeFilter: 'all', // all, mobile, laptop, camera
    deviceTypeId: '',
    brand: '',
    deviceId: '', // Maps to Model ID in database queries
    productTypeId: '',
    material: '',
    finish: '',
    maxPrice: null,
    availability: '',
    promotion: '', // best_seller, new_arrival, featured
    sortBy: 'newest',
    viewStyle: 'grid', // grid or list
    page: 1,
    limit: 100 // Load more products for instant responsive filtering
};

let loadedBrands = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.API) return;

    if (window.showLoader) window.showLoader();

    // 1. Initialize view switcher
    setupViewSwitcher();

    // 2. Load all filter dropdown options dynamically from APIs
    await initFilterOptions();

    // 3. Bind UI event change listeners
    bindFilterControls();

    // 3b. Setup collapsible panels logic
    setupCollapsibleFilters();

    // 4. Parse URL query params
    await parseUrlParams();

    // 5. Initial fetch and render
    await fetchAndRender();
});

function setupViewSwitcher() {
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    const container = document.getElementById('shop-products-grid');

    if (gridBtn && listBtn) {
        gridBtn.addEventListener('click', () => {
            state.viewStyle = 'grid';
            container?.classList.remove('list-view');
            gridBtn.className = "p-1.5 rounded-md bg-white shadow-sm text-[#0077B6] flex items-center justify-center transition-all";
            listBtn.className = "p-1.5 rounded-md text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all";
        });

        listBtn.addEventListener('click', () => {
            state.viewStyle = 'list';
            container?.classList.add('list-view');
            listBtn.className = "p-1.5 rounded-md bg-white shadow-sm text-[#0077B6] flex items-center justify-center transition-all";
            gridBtn.className = "p-1.5 rounded-md text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all";
        });
    }
}

// Collapsible Filters Panel Logic
function setupCollapsibleFilters() {
    const toggleBtn = document.getElementById('filters-toggle-btn');
    const closeBtn = document.getElementById('close-filters-btn');
    const backdrop = document.getElementById('filter-backdrop');
    const applyBtn = document.getElementById('apply-filters-btn');
    const clearAllBtn = document.getElementById('clear-all-filters-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFilterPanel();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleFilterPanel(true));
    }

    const wrapper = document.getElementById('filter-panel-wrapper');
    if (wrapper) {
        wrapper.addEventListener('click', (e) => {
            if (e.target === wrapper) toggleFilterPanel(true);
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => toggleFilterPanel(true));
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            toggleFilterPanel(true);
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            window.clearAllFilters();
        });
    }

    // ESC Key listener
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleFilterPanel(true);
    });
}

function toggleFilterPanel(forceClose = false) {
    const wrapper = document.getElementById('filter-panel-wrapper');
    const backdrop = document.getElementById('filter-backdrop');
    if (!wrapper) return;

    const isOpen = wrapper.classList.contains('open');
    const shouldOpen = forceClose ? false : !isOpen;

    if (shouldOpen) {
        wrapper.classList.remove('hidden');
        wrapper.offsetHeight; // trigger reflow
        wrapper.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        if (backdrop) {
            backdrop.classList.remove('hidden');
        }
    } else {
        wrapper.classList.remove('open');
        document.body.style.overflow = '';

        setTimeout(() => {
            if (!wrapper.classList.contains('open')) {
                wrapper.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
            }
        }, 200);
    }
}

function checkMobileCollapse() {
    if (window.innerWidth < 768) {
        toggleFilterPanel(true);
    }
}

async function initFilterOptions() {
    try {
        // A. Load Device Types
        const deviceTypes = await window.API.getDeviceTypes() || [];
        const dtSelect = document.getElementById('filter-device-type');
        if (dtSelect) {
            dtSelect.innerHTML = `<option value="">All Device Types</option>` + 
                deviceTypes.map(dt => `<option value="${dt.id}">${dt.name}</option>`).join('');
        }

        // B. Load Product Types
        const productTypes = await window.API.getProductTypes() || [];
        const ptSelect = document.getElementById('filter-product-type');
        if (ptSelect) {
            ptSelect.innerHTML = `<option value="">All Product Types</option>` + 
                productTypes.map(pt => `<option value="${pt.id}">${pt.name}</option>`).join('');
        }

        // C. Load Materials
        const materials = await window.API.getMaterials() || [];
        const matSelect = document.getElementById('filter-material');
        if (matSelect) {
            matSelect.innerHTML = `<option value="">All Materials</option>` + 
                materials.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
        }

        // D. Load Finishes
        const finishes = await window.API.getFinishes() || [];
        const finSelect = document.getElementById('filter-finish');
        if (finSelect) {
            finSelect.innerHTML = `<option value="">All Finishes</option>` + 
                finSelectOptions(finishes);
        }
    } catch (e) {
        console.error('Failed to load initial dropdown filters', e);
    }
}

function finSelectOptions(finishes) {
    return finishes.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
}

function bindFilterControls() {
    // Primary selectors
    const dtSelect = document.getElementById('filter-device-type');
    const brandSelect = document.getElementById('filter-brand');
    const modelSelect = document.getElementById('filter-model');
    const ptSelect = document.getElementById('filter-product-type');
    const matSelect = document.getElementById('filter-material');
    const finSelect = document.getElementById('filter-finish');
    const availSelect = document.getElementById('filter-availability');
    const promoSelect = document.getElementById('filter-promotion');
    const sortSelect = document.getElementById('filter-sort');
    const toolbarSort = document.getElementById('toolbar-sort');
    const priceSlider = document.getElementById('filter-price-slider');

    // A. Device Type change -> Load brands
    if (dtSelect) {
        dtSelect.addEventListener('change', async (e) => {
            state.deviceTypeId = e.target.value;
            state.brand = '';
            state.deviceId = '';
            state.page = 1;

            if (brandSelect) {
                brandSelect.value = '';
                brandSelect.disabled = !state.deviceTypeId;
            }
            if (modelSelect) {
                modelSelect.value = '';
                modelSelect.innerHTML = '<option value="">All Models</option>';
                modelSelect.disabled = true;
            }

            if (state.deviceTypeId) {
                try {
                    loadedBrands = await window.API.getBrands(state.deviceTypeId) || [];
                    if (brandSelect) {
                        brandSelect.innerHTML = `<option value="">All Brands</option>` + 
                            loadedBrands.map(b => `<option value="${b.name}" data-id="${b.id}">${b.name}</option>`).join('');
                    }
                } catch (err) {
                    console.error('Error fetching brands', err);
                }
            }
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // B. Brand change -> Load models
    if (brandSelect) {
        brandSelect.addEventListener('change', async (e) => {
            state.brand = e.target.value;
            state.deviceId = '';
            state.page = 1;

            if (modelSelect) {
                modelSelect.value = '';
                modelSelect.disabled = true;
            }

            const selectedOption = brandSelect.options[brandSelect.selectedIndex];
            const brandId = selectedOption?.getAttribute('data-id');

            if (brandId) {
                try {
                    const models = await window.API.getModelsSearch('', brandId) || [];
                    if (modelSelect) {
                        modelSelect.innerHTML = `<option value="">All Models</option>` + 
                            models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
                        modelSelect.disabled = false;
                    }
                } catch (err) {
                    console.error('Error fetching models', err);
                }
            }
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // C. Model change
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            state.deviceId = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // D. Product Type change
    if (ptSelect) {
        ptSelect.addEventListener('change', (e) => {
            state.productTypeId = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // E. Material change
    if (matSelect) {
        matSelect.addEventListener('change', (e) => {
            state.material = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // F. Finish change
    if (finSelect) {
        finSelect.addEventListener('change', (e) => {
            state.finish = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // G. Availability change
    if (availSelect) {
        availSelect.addEventListener('change', (e) => {
            state.availability = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // H. Promotion change
    if (promoSelect) {
        promoSelect.addEventListener('change', (e) => {
            state.promotion = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    // I. Sort By change (sync both)
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            if (toolbarSort) toolbarSort.value = e.target.value;
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }

    if (toolbarSort) {
        toolbarSort.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            if (sortSelect) sortSelect.value = e.target.value;
            state.page = 1;
            fetchAndRender();
        });
    }

    // J. Price range input & change
    if (priceSlider) {
        priceSlider.addEventListener('input', (e) => {
            state.maxPrice = parseFloat(e.target.value);
            const label = document.getElementById('price-range-label');
            if (label) label.textContent = `₹0 - ₹${e.target.value}`;
        });

        priceSlider.addEventListener('change', () => {
            state.page = 1;
            fetchAndRender();
            checkMobileCollapse();
        });
    }
}

async function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');
    const brand = urlParams.get('brand');
    const productTypeId = urlParams.get('productTypeId');
    
    const deviceTypeId = urlParams.get('deviceTypeId');
    const deviceId = urlParams.get('deviceId');
    const material = urlParams.get('material');
    const finish = urlParams.get('finish');
    const maxPrice = urlParams.get('maxPrice');
    const availability = urlParams.get('availability');
    const promotion = urlParams.get('promotion');
    const sortBy = urlParams.get('sortBy');

    if (search) state.search = search;
    if (brand) state.brand = brand;
    if (productTypeId) state.productTypeId = productTypeId;
    if (deviceTypeId) state.deviceTypeId = deviceTypeId;
    if (deviceId) state.deviceId = deviceId;
    if (material) state.material = material;
    if (finish) state.finish = finish;
    if (maxPrice) state.maxPrice = parseFloat(maxPrice);
    if (availability) state.availability = availability;
    if (promotion) state.promotion = promotion;
    if (sortBy) state.sortBy = sortBy;

    await syncStateToDropdowns();
}

async function syncStateToDropdowns() {
    const ptSelect = document.getElementById('filter-product-type');
    if (ptSelect && state.productTypeId) ptSelect.value = state.productTypeId;

    const matSelect = document.getElementById('filter-material');
    if (matSelect && state.material) matSelect.value = state.material;

    const finSelect = document.getElementById('filter-finish');
    if (finSelect && state.finish) finSelect.value = state.finish;

    const availSelect = document.getElementById('filter-availability');
    if (availSelect && state.availability) availSelect.value = state.availability;

    const promoSelect = document.getElementById('filter-promotion');
    if (promoSelect && state.promotion) promoSelect.value = state.promotion;

    const sortSelect = document.getElementById('filter-sort');
    if (sortSelect && state.sortBy) sortSelect.value = state.sortBy;

    const toolbarSort = document.getElementById('toolbar-sort');
    if (toolbarSort && state.sortBy) toolbarSort.value = state.sortBy;

    const priceSlider = document.getElementById('filter-price-slider');
    if (priceSlider && state.maxPrice !== null) {
        priceSlider.value = state.maxPrice;
        const label = document.getElementById('price-range-label');
        if (label) label.textContent = `₹0 - ₹${state.maxPrice}`;
    }

    const dtSelect = document.getElementById('filter-device-type');
    const brandSelect = document.getElementById('filter-brand');
    const modelSelect = document.getElementById('filter-model');

    if (dtSelect && state.deviceTypeId) {
        dtSelect.value = state.deviceTypeId;
        
        try {
            loadedBrands = await window.API.getBrands(state.deviceTypeId) || [];
            if (brandSelect) {
                brandSelect.innerHTML = `<option value="">All Brands</option>` + 
                    loadedBrands.map(b => `<option value="${b.name}" data-id="${b.id}">${b.name}</option>`).join('');
                brandSelect.disabled = false;
                
                if (state.brand) {
                    brandSelect.value = state.brand;
                    
                    const selectedOption = brandSelect.options[brandSelect.selectedIndex];
                    const brandId = selectedOption?.getAttribute('data-id');
                    if (brandId) {
                        const models = await window.API.getModelsSearch('', brandId) || [];
                        if (modelSelect) {
                            modelSelect.innerHTML = `<option value="">All Models</option>` + 
                                models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
                            modelSelect.disabled = false;
                            
                            if (state.deviceId) {
                                modelSelect.value = state.deviceId;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error syncing dependent dropdowns:', e);
        }
    }
}

function updateUrlParams() {
    const urlParams = new URLSearchParams();
    
    if (state.deviceTypeId) urlParams.set('deviceTypeId', state.deviceTypeId);
    if (state.brand) urlParams.set('brand', state.brand);
    if (state.deviceId) urlParams.set('deviceId', state.deviceId);
    if (state.productTypeId) urlParams.set('productTypeId', state.productTypeId);
    if (state.material) urlParams.set('material', state.material);
    if (state.finish) urlParams.set('finish', state.finish);
    if (state.maxPrice !== null && state.maxPrice < 2000) urlParams.set('maxPrice', state.maxPrice);
    if (state.availability) urlParams.set('availability', state.availability);
    if (state.promotion) urlParams.set('promotion', state.promotion);
    if (state.sortBy && state.sortBy !== 'newest') urlParams.set('sortBy', state.sortBy);
    
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('search')) {
        urlParams.set('search', currentParams.get('search'));
    }

    const newQuery = urlParams.toString();
    const newRelativePathQuery = window.location.pathname + (newQuery ? '?' + newQuery : '');
    window.history.pushState(null, '', newRelativePathQuery);
}

function renderActiveFilters() {
    const container = document.getElementById('active-filters-chips-container');
    const badge = document.getElementById('active-filter-count-badge');
    if (!container) return;

    container.innerHTML = '';
    let activeFilterCount = 0;
    const chips = [];

    if (state.deviceTypeId) {
        const dtSelect = document.getElementById('filter-device-type');
        const text = dtSelect?.options[dtSelect.selectedIndex]?.text;
        if (text && text !== 'All Device Types') {
            chips.push({ label: text, type: 'deviceType' });
            activeFilterCount++;
        }
    }
    if (state.brand) {
        chips.push({ label: state.brand, type: 'brand' });
        activeFilterCount++;
    }
    if (state.deviceId) {
        const modelSelect = document.getElementById('filter-model');
        const text = modelSelect?.options[modelSelect.selectedIndex]?.text;
        if (text && text !== 'All Models') {
            chips.push({ label: text, type: 'model' });
            activeFilterCount++;
        }
    }
    if (state.productTypeId) {
        const ptSelect = document.getElementById('filter-product-type');
        const text = ptSelect?.options[ptSelect.selectedIndex]?.text;
        if (text && text !== 'All Product Types') {
            chips.push({ label: text, type: 'productType' });
            activeFilterCount++;
        }
    }
    if (state.material) {
        chips.push({ label: state.material, type: 'material' });
        activeFilterCount++;
    }
    if (state.finish) {
        chips.push({ label: state.finish, type: 'finish' });
        activeFilterCount++;
    }
    if (state.maxPrice !== null && state.maxPrice < 2000) {
        chips.push({ label: `₹0–${state.maxPrice}`, type: 'price' });
        activeFilterCount++;
    }
    if (state.availability) {
        const label = state.availability === 'in_stock' ? 'In Stock' : 'Out of Stock';
        chips.push({ label: label, type: 'availability' });
        activeFilterCount++;
    }
    if (state.promotion) {
        const promoLabels = { best_seller: 'Best Seller', new_arrival: 'New Arrival', featured: 'Featured' };
        chips.push({ label: promoLabels[state.promotion] || state.promotion, type: 'promotion' });
        activeFilterCount++;
    }

    if (badge) {
        if (activeFilterCount > 0) {
            badge.textContent = activeFilterCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (chips.length > 0) {
        container.classList.remove('hidden');
        
        const chipsHtml = chips.map(chip => `
            <span class="inline-flex items-center gap-1 bg-[#CAF0F8] text-[#03045E] text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm transition-all hover:bg-[#90E0EF]">
                <span>${chip.label}</span>
                <button type="button" class="flex items-center justify-center p-0.5 rounded-full hover:bg-[#0077B6] hover:text-white transition-colors" onclick="window.clearSingleFilter('${chip.type}')">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            </span>
        `).join('');

        const clearAllHtml = `
            <button onclick="window.clearAllFilters()" class="text-xs font-bold text-red-500 hover:text-red-700 ml-2 py-1.5 px-3 rounded-lg border border-dashed border-red-200 hover:border-red-500 bg-red-50/50 transition-all flex items-center gap-1 shadow-sm">
                <span class="material-symbols-outlined text-[14px]">clear_all</span> Clear All
            </button>
        `;

        container.innerHTML = chipsHtml + clearAllHtml;
    } else {
        container.classList.add('hidden');
    }
}

window.clearSingleFilter = function(type) {
    if (type === 'deviceType') {
        state.deviceTypeId = '';
        state.brand = '';
        state.deviceId = '';
        
        const dtSelect = document.getElementById('filter-device-type');
        if (dtSelect) dtSelect.value = '';
        
        const brandSelect = document.getElementById('filter-brand');
        if (brandSelect) {
            brandSelect.value = '';
            brandSelect.disabled = true;
        }
        const modelSelect = document.getElementById('filter-model');
        if (modelSelect) {
            modelSelect.value = '';
            modelSelect.innerHTML = '<option value="">All Models</option>';
            modelSelect.disabled = true;
        }
    } else if (type === 'brand') {
        state.brand = '';
        state.deviceId = '';
        
        const brandSelect = document.getElementById('filter-brand');
        if (brandSelect) brandSelect.value = '';
        
        const modelSelect = document.getElementById('filter-model');
        if (modelSelect) {
            modelSelect.value = '';
            modelSelect.innerHTML = '<option value="">All Models</option>';
            modelSelect.disabled = true;
        }
    } else if (type === 'model') {
        state.deviceId = '';
        const modelSelect = document.getElementById('filter-model');
        if (modelSelect) modelSelect.value = '';
    } else if (type === 'productType') {
        state.productTypeId = '';
        const ptSelect = document.getElementById('filter-product-type');
        if (ptSelect) ptSelect.value = '';
    } else if (type === 'material') {
        state.material = '';
        const matSelect = document.getElementById('filter-material');
        if (matSelect) matSelect.value = '';
    } else if (type === 'finish') {
        state.finish = '';
        const finSelect = document.getElementById('filter-finish');
        if (finSelect) finSelect.value = '';
    } else if (type === 'price') {
        state.maxPrice = null;
        const priceSlider = document.getElementById('filter-price-slider');
        if (priceSlider) priceSlider.value = 2000;
        const label = document.getElementById('price-range-label');
        if (label) label.textContent = `₹0 - ₹2000`;
    } else if (type === 'availability') {
        state.availability = '';
        const availSelect = document.getElementById('filter-availability');
        if (availSelect) availSelect.value = '';
    } else if (type === 'promotion') {
        state.promotion = '';
        const promoSelect = document.getElementById('filter-promotion');
        if (promoSelect) promoSelect.value = '';
    }

    state.page = 1;
    fetchAndRender();
};

window.setShopDeviceFilter = function(filterKey) {
    state.deviceTypeFilter = filterKey || 'all';

    const filterKeys = ['all', 'mobile', 'laptop', 'camera'];
    filterKeys.forEach(k => {
        const btn = document.getElementById(`shop-device-filter-${k}`);
        if (btn) {
            if (k === state.deviceTypeFilter) {
                btn.className = "shop-device-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-[#0077B6] text-white shadow-sm cursor-pointer";
            } else {
                btn.className = "shop-device-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer";
            }
        }
    });

    state.page = 1;
    fetchAndRender();
};

async function fetchAndRender() {
    if (window.showLoader) window.showLoader();

    try {
        const payload = {
            productTypeId: state.productTypeId || undefined,
            deviceId: state.deviceId || undefined,
            material: state.material || undefined,
            finish: state.finish || undefined,
            brand: state.brand || undefined,
            availability: state.availability || undefined,
            sortBy: state.sortBy || undefined,
            deviceType: (state.deviceTypeFilter && state.deviceTypeFilter !== 'all') ? state.deviceTypeFilter : undefined,
            page: state.page,
            limit: state.limit,
            returnFullResponse: true
        };

        if (state.maxPrice !== null) {
            payload.maxPrice = state.maxPrice;
        }

        if (state.promotion === 'best_seller') {
            payload.isBestSeller = true;
        } else if (state.promotion === 'new_arrival') {
            payload.isNew = true;
        } else if (state.promotion === 'featured') {
            payload.sortBy = 'featured';
        }

        const res = await window.API.getProducts(payload);
        const products = res.products || [];
        const total = res.total || 0;

        const grid = document.getElementById('shop-products-grid');
        if (grid) {
            if (products.length === 0) {
                grid.className = "col-span-full py-16 text-center w-full";
                grid.innerHTML = `
                    <div class="space-y-4">
                        <span class="material-symbols-outlined text-5xl text-gray-400">grid_off</span>
                        <h3 class="text-xl font-bold text-gray-700">No Products Found</h3>
                        <p class="text-gray-500 text-sm max-w-md mx-auto">Try clearing active filters, adjusting price range, or selecting a different brand/model.</p>
                        <button onclick="window.clearAllFilters()" class="px-6 py-2 bg-[#0077B6] hover:bg-[#03045E] text-white rounded-lg font-semibold transition-all">Clear All Filters</button>
                    </div>
                `;
            } else {
                if (state.viewStyle === 'list') {
                    grid.className = "flex flex-col gap-6 list-view";
                } else {
                    grid.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";
                }
                const activeFilter = state.deviceTypeFilter;
                const displayProducts = products.filter(p => {
                    if (activeFilter && activeFilter !== 'all') {
                        if (p.devicePrices && p.devicePrices.length > 0) {
                            const matchDP = p.devicePrices.find(dp => {
                                const name = (dp.deviceType?.name || '').toLowerCase();
                                const slug = (dp.deviceType?.slug || '').toLowerCase();
                                const filter = activeFilter.toLowerCase();
                                return name.includes(filter) || slug.includes(filter) || (name && filter.includes(name));
                            });
                            return !!matchDP;
                        }
                    }
                    return true;
                });

                if (displayProducts.length === 0) {
                    grid.className = "col-span-full py-16 text-center w-full";
                    grid.innerHTML = `
                        <div class="space-y-4">
                            <span class="material-symbols-outlined text-5xl text-gray-400">grid_off</span>
                            <h3 class="text-xl font-bold text-gray-700">No Products Found for Selected Device</h3>
                            <p class="text-gray-500 text-sm max-w-md mx-auto">Try selecting a different device category or clearing active filters.</p>
                            <button onclick="window.clearAllFilters()" class="px-6 py-2 bg-[#0077B6] hover:bg-[#03045E] text-white rounded-lg font-semibold transition-all">Clear All Filters</button>
                        </div>
                    `;
                } else {
                    grid.innerHTML = displayProducts.map(p => {
                        let cardProd = { ...p };
                        if (activeFilter && activeFilter !== 'all') {
                            const matchDP = (p.devicePrices || []).find(dp => {
                                const name = (dp.deviceType?.name || '').toLowerCase();
                                const slug = (dp.deviceType?.slug || '').toLowerCase();
                                const filter = activeFilter.toLowerCase();
                                return name.includes(filter) || slug.includes(filter) || (name && filter.includes(name));
                            });
                            if (matchDP) {
                                cardProd.selectedDevicePrice = matchDP.price;
                            }
                        }
                        return window.renderProductCard(cardProd, { detailPath: 'product_detail.html' });
                    }).join('');
                    if (window.attachProductCardListeners) window.attachProductCardListeners(grid);
                }
            }
        }

        const countLabel = document.getElementById('shop-results-count');
        if (countLabel) countLabel.textContent = total;

        renderActiveFilters();
        updateUrlParams();

    } catch (err) {
        console.error('Failed to fetch and render shop products:', err);
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
}

window.clearAllFilters = function() {
    state.deviceTypeId = '';
    state.brand = '';
    state.deviceId = '';
    state.productTypeId = '';
    state.material = '';
    state.finish = '';
    state.maxPrice = null;
    state.availability = '';
    state.promotion = '';
    state.sortBy = 'newest';
    state.page = 1;

    const controls = [
        'filter-device-type',
        'filter-brand',
        'filter-model',
        'filter-product-type',
        'filter-material',
        'filter-finish',
        'filter-availability',
        'filter-promotion',
        'filter-sort',
        'toolbar-sort'
    ];

    controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'filter-sort' || id === 'toolbar-sort') {
                el.value = 'newest';
            } else {
                el.value = '';
                if (id === 'filter-brand' || id === 'filter-model') {
                    el.disabled = true;
                    if (id === 'filter-model') el.innerHTML = '<option value="">All Models</option>';
                }
            }
        }
    });

    const priceSlider = document.getElementById('filter-price-slider');
    if (priceSlider) {
        priceSlider.value = 2000;
        const label = document.getElementById('price-range-label');
        if (label) label.textContent = `₹0 - ₹2000`;
    }

    fetchAndRender();
};
