/**
 * OM Mobile Art - Collection Detail Controller (collection_detail.js)
 * Loads collection info, filters products by collection, sorts them, and renders storefront cards.
 */

let activeCollection = null;
let collectionProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.API) return;

    const urlParams = new URLSearchParams(window.location.search);
    const rawParam = urlParams.get('collectionId') || urlParams.get('id') || urlParams.get('slug') || urlParams.get('collection') || urlParams.get('name') || urlParams.get('col');

    if (!rawParam) {
        // No collection parameter provided in URL
        renderCollectionNotFound('No collection selected. Please choose a collection from our gallery.');
        return;
    }

    if (window.showLoader) window.showLoader();

    try {
        // 1. Fetch collection details
        const collections = await window.API.getCollections() || [];
        const cleanId = String(rawParam).trim().toLowerCase();
        const slugId = cleanId.replace(/[^a-z0-9]+/g, '-');

        activeCollection = collections.find(c => {
            if (!c) return false;
            const cId = String(c.id || '').toLowerCase();
            const cSlug = String(c.slug || '').toLowerCase();
            const cName = String(c.name || '').toLowerCase();
            const cNameSlug = cName.replace(/[^a-z0-9]+/g, '-');

            return cId === cleanId || 
                   cSlug === cleanId || 
                   cSlug === slugId || 
                   cName === cleanId || 
                   cNameSlug === slugId;
        });

        if (!activeCollection) {
            try {
                const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${encodeURIComponent(rawParam)}`);
                if (res.ok) {
                    const body = await res.json();
                    if (body && body.data) activeCollection = body.data;
                }
            } catch (e) {
                console.warn('Direct collection fetch failed:', e);
            }
        }

        // 2. Fetch all products
        const allProducts = await window.API.getProducts({ limit: 1000 }) || [];

        // If activeCollection still null, build a virtual collection if products match
        if (!activeCollection) {
            const matchingProducts = allProducts.filter(p => {
                if (!p) return false;
                const pColId = String(p.collectionId || '').toLowerCase();
                const pColStr = typeof p.collection === 'string' ? p.collection.toLowerCase() : '';
                const pColObjName = (p.collection && typeof p.collection === 'object' && p.collection.name) ? p.collection.name.toLowerCase() : '';
                
                return pColId === cleanId || pColStr.includes(cleanId) || pColObjName.includes(cleanId);
            });

            if (matchingProducts.length > 0) {
                const formattedTitle = rawParam.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                activeCollection = {
                    id: rawParam,
                    name: formattedTitle,
                    description: `Curated design collection featuring ${matchingProducts.length} custom skins.`,
                    desktopBanner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop'
                };
            }
        }

        if (!activeCollection) {
            console.error('Collection not found for query:', rawParam);
            renderCollectionNotFound(`We couldn't find the collection "${rawParam}".`);
            return;
        }

        // Update Hero UI
        document.title = `${activeCollection.name} | OM Mobile Art`;
        const titleEl = document.getElementById('collection-detail-title') || document.getElementById('collection-title-display');
        const descEl = document.getElementById('collection-detail-desc') || document.getElementById('collection-desc-display');
        if (titleEl) titleEl.textContent = activeCollection.name;
        if (descEl) descEl.textContent = activeCollection.description || 'Premium design collection.';
        
        const bannerImg = activeCollection.desktopBanner || activeCollection.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop';
        const bannerEl = document.getElementById('collection-banner-bg');
        if (bannerEl) bannerEl.style.backgroundImage = `url('${bannerImg}')`;
        collectionProducts = allProducts.filter(p => {
            if (!p || !activeCollection) return false;
            const targetId = String(activeCollection.id).toLowerCase();
            const targetSlug = activeCollection.slug ? String(activeCollection.slug).toLowerCase() : '';
            const targetName = activeCollection.name ? String(activeCollection.name).toLowerCase() : '';

            if (p.collectionId && String(p.collectionId).toLowerCase() === targetId) return true;

            if (p.collection) {
                if (typeof p.collection === 'string') {
                    const cStr = p.collection.toLowerCase();
                    if (cStr === targetName || cStr === targetSlug || cStr === targetId) return true;
                } else if (typeof p.collection === 'object') {
                    if (p.collection.id && String(p.collection.id).toLowerCase() === targetId) return true;
                    if (p.collection.slug && String(p.collection.slug).toLowerCase() === targetSlug) return true;
                    if (p.collection.name && String(p.collection.name).toLowerCase() === targetName) return true;
                }
            }

            if (p.collections && Array.isArray(p.collections)) {
                return p.collections.some(c => {
                    if (typeof c === 'string') {
                        const cStr = c.toLowerCase();
                        return cStr === targetName || cStr === targetSlug || cStr === targetId;
                    } else if (typeof c === 'object' && c) {
                        return (
                            (c.id && String(c.id).toLowerCase() === targetId) ||
                            (c.slug && String(c.slug).toLowerCase() === targetSlug) ||
                            (c.name && String(c.name).toLowerCase() === targetName)
                        );
                    }
                    return false;
                });
            }

            return false;
        });

        // 3. Bind sort change event
        const sortSelect = document.getElementById('collection-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                renderFilteredProducts();
            });
        }

        // 4. Initial render
        renderFilteredProducts();

    } catch (err) {
        console.error('Failed to load collection details:', err);
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
});

function renderFilteredProducts() {
    const grid = document.getElementById('collection-detail-products-grid');
    const countDisplay = document.getElementById('collection-count-display');
    if (!grid) return;

    let sorted = [...collectionProducts];
    const sortBy = document.getElementById('collection-sort-select')?.value || 'newest';

    // Apply Sorting logic
    if (sortBy === 'newest') {
        sorted.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    } else if (sortBy === 'popular') {
        sorted.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
    } else if (sortBy === 'price_asc') {
        sorted.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'price_desc') {
        sorted.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === 'rating') {
        sorted.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }

    if (countDisplay) countDisplay.textContent = sorted.length;

    if (sorted.length === 0) {
        grid.className = "col-span-full py-16 text-center w-full";
        grid.innerHTML = `
            <div class="space-y-4">
                <span class="material-symbols-outlined text-5xl text-gray-400">grid_off</span>
                <h3 class="text-xl font-bold text-gray-700">No Products in Collection</h3>
                <p class="text-gray-500 text-sm max-w-sm mx-auto">This collection doesn't have any designs associated with it yet.</p>
            </div>
        `;
    } else {
        grid.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8";
        grid.innerHTML = sorted.map(p => window.renderProductCard(p, { detailPath: 'product_detail.html' })).join('');
        if (window.attachProductCardListeners) window.attachProductCardListeners(grid);
    }
}

function renderCollectionNotFound(message) {
    const titleEl = document.getElementById('collection-detail-title') || document.getElementById('collection-title-display');
    const descEl = document.getElementById('collection-detail-desc') || document.getElementById('collection-desc-display');
    const countEl = document.getElementById('collection-count-display');
    const grid = document.getElementById('collection-detail-products-grid');

    if (titleEl) titleEl.textContent = 'Collection Not Found';
    if (descEl) descEl.textContent = message || 'We could not find the requested collection.';
    if (countEl) countEl.textContent = '0';

    if (grid) {
        grid.className = "col-span-full py-16 text-center w-full";
        grid.innerHTML = `
            <div class="space-y-4">
                <span class="material-symbols-outlined text-6xl text-gray-300">folder_off</span>
                <h3 class="text-xl font-bold text-gray-700">Collection Unavailable</h3>
                <p class="text-gray-500 text-sm max-w-md mx-auto">${message || 'Please check back later or explore our available collections.'}</p>
                <div class="pt-4">
                    <a href="/collections.html" class="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0077B6] text-white text-sm font-semibold rounded-lg shadow hover:bg-[#023E8A] transition-colors">
                        <span class="material-symbols-outlined text-lg">grid_view</span>
                        Browse All Collections
                    </a>
                </div>
            </div>
        `;
    }
}

