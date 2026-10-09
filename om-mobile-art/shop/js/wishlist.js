/**
 * OM Mobile Art - Wishlist Page Controller (wishlist.js)
 * Implements liked products grid, move to cart triggers, remove from wishlist,
 * and empty wishlist layout switches.
 */

document.addEventListener('DOMContentLoaded', () => {
    renderWishlist();
});

async function renderWishlist() {
    if (!window.DB) return;
    const wishlistIds = window.DB.getWishlist() || [];
    
    if (wishlistIds.length === 0) {
        showEmptyWishlistState();
        return;
    }

    let allProducts = [];
    try {
        if (window.API && window.API.getProducts) {
            allProducts = await window.API.getProducts({ limit: 500 });
        } else if (window.DB && window.DB.getProducts) {
            allProducts = window.DB.getProducts() || [];
        }
    } catch (err) {
        allProducts = (window.DB ? window.DB.getProducts() : null) || [];
    }

    const stringWishlistIds = wishlistIds.map(id => String(id).trim());

    const products = allProducts.filter(p => {
        const pId = String(p.id).trim();
        return stringWishlistIds.some(wId => {
            if (wId === pId) return true;
            if (wId.toLowerCase() === pId.toLowerCase()) return true;
            if (/^\d+$/.test(wId) && pId.startsWith(wId + '-')) return true;
            if (p.slug && (wId === p.slug || wId.toLowerCase() === p.slug.toLowerCase())) return true;
            return false;
        });
    });

    // Prune stale/invalid wishlist IDs from localStorage so header badge stays 100% in sync
    const validWishlistIds = products.map(p => String(p.id).trim());
    if (validWishlistIds.length !== wishlistIds.length) {
        window.DB.saveWishlist(validWishlistIds);
    }

    if (products.length === 0) {
        showEmptyWishlistState();
        return;
    }

    showGridState(products);
}

function showEmptyWishlistState() {
    const grid = document.getElementById('wishlist-products-grid') || document.querySelector('main .grid');
    if (!grid) return;

    grid.className = "w-full py-16 text-center space-y-6 col-span-full";
    grid.innerHTML = `
        <div class="max-w-md mx-auto space-y-4">
            <span class="material-symbols-outlined text-6xl text-gray-400">heart_broken</span>
            <h2 class="text-2xl font-bold text-[#111827]">Your Wishlist is Empty</h2>
            <p class="text-gray-500 text-sm">Save your favorite premium skin designs here while exploring. They will be saved to your device.</p>
            <a href="shop.html" class="inline-block mt-4 px-8 py-3 bg-[#03045E] text-white font-bold rounded-lg hover:bg-[#0077B6] transition-colors shadow-md text-xs uppercase tracking-wider">
                Browse Catalog
            </a>
        </div>
    `;
}

function showGridState(products) {
    const grid = document.getElementById('wishlist-products-grid') || document.querySelector('main .grid');
    if (!grid) return;

    grid.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";
    grid.innerHTML = products.map(product => window.renderProductCard(product, { detailPath: 'product_detail.html' })).join('');
    if (window.attachProductCardListeners) window.attachProductCardListeners(grid);
}

window.addEventListener('wishlist-updated', renderWishlist);
window.addEventListener('wishlistUpdated', renderWishlist);

// Remove liked product
window.removeWishlistItem = function(id) {
    if (!window.DB) return;
    window.DB.toggleWishlist(id);
    if (window.showToast) window.showToast("Product removed from wishlist.", "info");
    renderWishlist();
};

// Add to cart and remove from wishlist
window.moveWishlistToCart = function(id) {
    if (!window.DB) return;
    const product = window.DB.getProductById(id);
    if (product) {
        const item = {
            id: product.id,
            name: product.name,
            price: product.price,
            qty: 1,
            device: (product.devices && product.devices[0]) || "iPhone 16 Pro",
            finish: product.finish || "Matte",
            material: product.material || "Standard 3M",
            image: product.image
        };
        
        window.DB.addToCart(item);
        window.DB.toggleWishlist(id);
        
        if (window.showToast) window.showToast(`Moved ${product.name} to Cart!`, "success");
        renderWishlist();
    }
};
