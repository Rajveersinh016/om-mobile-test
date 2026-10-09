/**
 * OM Mobile Art - Device Selector Page Controller (device_selector.js)
 * Implements dynamic step filtering: Category -> Brand -> Model -> Compatible Skins,
 * and adds skins directly to cart.
 */

let selectedDeviceTypeId = "";
let selectedBrandId = "";
let selectedModelId = "";
let selectedModelName = "";

document.addEventListener('DOMContentLoaded', async () => {
    await initDeviceSelectorFlow();
});

async function initDeviceSelectorFlow() {
    try {
        const deviceTypes = await window.API.getDeviceTypes() || [];
        if (deviceTypes.length === 0) {
            document.getElementById('device-type-pills').innerHTML = `<p class="text-xs text-text-muted italic">No categories available.</p>`;
            return;
        }

        renderDeviceTypePills(deviceTypes);
        await selectDeviceType(deviceTypes[0].id);
    } catch (err) {
        console.error("Error loading categories:", err);
    }
}

function renderDeviceTypePills(deviceTypes) {
    const container = document.getElementById('device-type-pills');
    if (!container) return;

    container.innerHTML = deviceTypes.map((dt, idx) => {
        return `
            <button onclick="selectDeviceType('${dt.id}', this)" class="whitespace-nowrap px-5 py-2 rounded-full border text-xs font-bold transition-all device-type-pill-btn ${
                idx === 0
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-subtle bg-surface-container-lowest text-on-surface hover:border-primary'
            }">
                ${dt.name}
            </button>
        `;
    }).join('');
}

window.selectDeviceType = async function(dtId, buttonEl) {
    selectedDeviceTypeId = dtId;

    if (buttonEl) {
        document.querySelectorAll('.device-type-pill-btn').forEach(btn => {
            btn.className = "whitespace-nowrap px-5 py-2 rounded-full border text-xs font-bold transition-all device-type-pill-btn border-border-subtle bg-surface-container-lowest text-on-surface hover:border-primary";
        });
        buttonEl.className = "whitespace-nowrap px-5 py-2 rounded-full border text-xs font-bold transition-all device-type-pill-btn border-primary bg-primary text-on-primary";
    }

    // Load brands
    try {
        const brands = await window.API.getBrands(dtId) || [];
        renderBrandCards(brands);
        if (brands.length > 0) {
            await selectBrand(brands[0].id);
        } else {
            document.getElementById('model-pills-container').innerHTML = `<p class="text-xs text-text-muted italic">No models available.</p>`;
            document.getElementById('compatible-products-grid').innerHTML = `<p class="text-xs text-text-muted italic">No products available.</p>`;
        }
    } catch (err) {
        console.error("Error loading brands:", err);
    }
};

function renderBrandCards(brands) {
    const container = document.getElementById('brand-cards-grid');
    if (!container) return;

    if (brands.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-xs text-text-muted italic">No brands found for this category.</p>`;
        return;
    }

    container.innerHTML = brands.map((b, idx) => {
        return `
            <button onclick="selectBrand('${b.id}', this)" class="group p-6 bg-surface-container-lowest border flex flex-col items-center justify-center gap-3 rounded-lg transition-all brand-card-btn ${
                idx === 0
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border-subtle hover:border-primary'
            }">
                <div class="w-12 h-12 flex items-center justify-center overflow-hidden">
                    ${b.logo ? `<img src="${b.logo}" class="w-full h-full object-contain"/>` : `<span class="font-bold text-lg text-on-surface">${b.name.substring(0, 2).toUpperCase()}</span>`}
                </div>
                <span class="font-button-text text-button-text font-bold text-xs">${b.name}</span>
            </button>
        `;
    }).join('');
}

window.selectBrand = async function(brandId, buttonEl) {
    selectedBrandId = brandId;

    if (buttonEl) {
        document.querySelectorAll('.brand-card-btn').forEach(btn => {
            btn.className = "group p-6 bg-surface-container-lowest border border-border-subtle flex flex-col items-center justify-center gap-3 rounded-lg hover:border-primary transition-all brand-card-btn";
        });
        buttonEl.className = "group p-6 bg-surface-container-lowest border border-primary ring-1 ring-primary flex flex-col items-center justify-center gap-3 rounded-lg transition-all brand-card-btn";
    }

    // Load models
    try {
        const models = await window.API.getAllModels(brandId) || [];
        renderModelPills(models);
        if (models.length > 0) {
            await selectModel(models[0].id, models[0].name);
        } else {
            document.getElementById('compatible-products-grid').innerHTML = `<p class="col-span-full text-center text-xs text-text-muted italic">No compatible models registered.</p>`;
        }
    } catch (err) {
        console.error("Error loading models:", err);
    }
};

function renderModelPills(models) {
    const container = document.getElementById('model-pills-container');
    if (!container) return;

    if (models.length === 0) {
        container.innerHTML = `<p class="text-xs text-text-muted italic">No models registered for this brand.</p>`;
        return;
    }

    container.innerHTML = models.map((m, idx) => {
        return `
            <button onclick="selectModel('${m.id}', '${m.name}', this)" class="whitespace-nowrap px-5 py-2 rounded-full border text-xs font-bold transition-all model-pill-btn ${
                idx === 0
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-subtle bg-surface-container-lowest text-on-surface hover:border-primary'
            }">
                ${m.name}
            </button>
        `;
    }).join('');
}

window.selectModel = async function(modelId, modelName, buttonEl) {
    selectedModelId = modelId;
    selectedModelName = modelName;

    if (buttonEl) {
        document.querySelectorAll('.model-pill-btn').forEach(btn => {
            btn.className = "whitespace-nowrap px-5 py-2 rounded-full border border-border-subtle bg-surface-container-lowest text-on-surface hover:border-primary font-bold text-xs transition-all model-pill-btn";
        });
        buttonEl.className = "whitespace-nowrap px-5 py-2 rounded-full border border-primary bg-primary text-on-primary font-bold text-xs transition-all model-pill-btn";
    }

    document.getElementById('selected-device-title').textContent = `Step 4: Compatible Skins for ${modelName}`;

    // Load products filtered by modelId
    try {
        const products = await window.API.getProducts({ deviceId: modelId }) || [];
        renderCompatibleSkins(products);
    } catch (err) {
        console.error("Error loading compatible products:", err);
    }
};

function renderCompatibleSkins(products) {
    const container = document.getElementById('compatible-products-grid');
    if (!container) return;

    if (products.length === 0) {
        container.className = 'w-full py-12 text-center col-span-full';
        container.innerHTML = `
            <span class="material-symbols-outlined text-4xl text-text-muted">grid_off</span>
            <p class="text-sm text-text-muted mt-2">No skins currently available in catalog for ${selectedModelName}.</p>
        `;
        return;
    }

    container.className = "grid grid-cols-1 md:grid-cols-3 gap-6";

    container.innerHTML = products.map(p => {
        const rawPrice = Number(p.price) || 0;
        const rawOrigPrice = Number(p.originalPrice) || 0;
        const formattedPrice = window.PricingEngine ? window.PricingEngine.format(rawPrice) : `₹${Math.round(rawPrice)}`;
        const formattedOrigPrice = window.PricingEngine ? window.PricingEngine.format(rawOrigPrice) : `₹${Math.round(rawOrigPrice)}`;

        let badge = '';
        if (p.isNew) badge = `<span class="px-2 py-1 bg-badge-new text-on-primary font-label-caps text-[10px] rounded">NEW</span>`;
        else if (p.isBestSeller) badge = `<span class="px-2 py-1 bg-badge-best text-on-surface font-label-caps text-[10px] rounded">BEST SELLER</span>`;
        else if (p.isSale) badge = `<span class="px-2 py-1 bg-badge-sale text-on-primary font-label-caps text-[10px] rounded">SALE</span>`;

        let priceHtml = `<p class="font-headline-h3 text-headline-h3 text-primary">${formattedPrice}</p>`;
        if (p.isSale && rawOrigPrice > rawPrice) {
            priceHtml = `
                <div class="flex items-center gap-2">
                    <span class="font-headline-h3 text-headline-h3 text-primary">${formattedPrice}</span>
                    <span class="text-sm text-text-muted line-through">${formattedOrigPrice}</span>
                </div>
            `;
        }

        return `
            <div class="group relative bg-surface-container-lowest border border-border-subtle rounded-lg overflow-hidden flex flex-col justify-between transition-all hover:border-primary p-2">
                <div class="absolute top-3 left-3 z-10">
                    ${badge}
                </div>
                <div class="aspect-square w-full overflow-hidden relative rounded bg-surface-container-low">
                    <a href="product_detail.html?id=${p.id}" class="block w-full h-full overflow-hidden">
                        <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${p.image}" alt="${p.name}">
                    </a>
                    <div class="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 p-4 bg-white/90 backdrop-blur-sm">
                        <button onclick="selectSkinFromSelector('${p.id}')" class="w-full h-11 bg-primary text-on-primary font-button-text text-button-text rounded-lg hover:bg-accent-hover transition-colors cursor-pointer">Select Skin</button>
                    </div>
                </div>
                <div class="p-4 flex flex-col gap-1">
                    <a href="product_detail.html?id=${p.id}" class="hover:text-primary transition-colors"><h3 class="font-body-main text-body-main text-on-surface font-semibold truncate">${p.name}</h3></a>
                    ${priceHtml}
                </div>
            </div>
        `;
    }).join('');
}

window.selectSkinFromSelector = async function(productId) {
    if (!window.API) return;
    try {
        const product = await window.API.getProductById(productId);
        if (product) {
            const item = {
                id: product.id,
                name: product.name,
                price: product.price,
                qty: 1,
                device: selectedModelName,
                deviceId: selectedModelId,
                finish: product.finish || "Matte",
                material: product.material || "Standard 3M",
                image: product.image
            };
            window.DB.addToCart(item);
            if (window.showToast) window.showToast(`Selected ${product.name} for ${selectedModelName}! Added to cart.`, "success");
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 1200);
        }
    } catch (err) {
        console.error("Error adding to cart:", err);
    }
};
