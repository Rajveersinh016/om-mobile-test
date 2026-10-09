/**
 * OM Mobile Art - Collections Gallery Controller (collections.js)
 * Fetches all active collections and renders premium dbrand-style design gallery cards.
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.API) return;

    if (window.showLoader) window.showLoader();

    try {
        // 1. Fetch collections list
        const collections = await window.API.getCollections();
        const activeCollections = collections.filter(c => c.isActive !== false && c.isVisible !== false);

        // 2. Fetch all products to count designs in each collection
        const products = await window.API.getProducts({ limit: 1000 }) || [];

        // 3. Render gallery cards
        const container = document.getElementById('collections-gallery-grid');
        if (container) {
            if (activeCollections.length === 0) {
                container.className = "col-span-full py-16 text-center w-full";
                container.innerHTML = `
                    <div class="space-y-4">
                        <span class="material-symbols-outlined text-5xl text-gray-400">palette</span>
                        <h3 class="text-xl font-bold text-gray-700">No Collections Available</h3>
                        <p class="text-gray-500 text-sm max-w-sm mx-auto">Please check back later or contact support.</p>
                    </div>
                `;
            } else {
                container.className = "grid grid-cols-1 md:grid-cols-2 gap-10";
                container.innerHTML = activeCollections.map(col => {
                    // Count products in this collection
                    const designCount = products.filter(p => {
                        if (!p || !col) return false;
                        const targetId = String(col.id).toLowerCase();
                        const targetSlug = col.slug ? String(col.slug).toLowerCase() : '';
                        const targetName = col.name ? String(col.name).toLowerCase() : '';

                        if (p.collectionId && String(p.collectionId).toLowerCase() === targetId) return true;

                        if (p.collection) {
                            if (typeof p.collection === 'string') {
                                const cStr = p.collection.toLowerCase();
                                if (cStr === targetName || cStr === targetSlug || cStr === targetId) return true;
                            } else if (typeof p.collection === 'object') {
                                if (p.collection.id && String(p.collection.id).toLowerCase() === targetId) return true;
                                if (p.collection.slug && String(p.collection.slug).toLowerCase() === targetSlug) return true;
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
                    }).length;

                    const bannerImg = col.desktopBanner || col.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';
                    const thumbImg = col.thumbnail || col.desktopBanner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';

                    return `
                        <div class="group relative bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-[#90E0EF] hover:-translate-y-1 transition-all duration-300 flex flex-col h-[400px]">
                            <!-- Banner Image Background -->
                            <div class="absolute inset-0 z-0">
                                <img src="${bannerImg}" alt="${col.name} Banner" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                            </div>

                            <!-- Content Overlay (Aligns to Bottom) -->
                            <div class="relative z-10 mt-auto p-8 flex items-end gap-6 w-full">
                                <!-- Thumbnail Circular Indicator -->
                                <div class="w-16 h-16 rounded-full border-2 border-white overflow-hidden shadow-md bg-white flex-shrink-0 flex items-center justify-center p-0.5">
                                    <img src="${thumbImg}" alt="${col.name} Thumbnail" class="w-full h-full object-cover rounded-full" />
                                </div>

                                <!-- Text Details -->
                                <div class="flex-grow text-white space-y-2">
                                    <div class="flex items-center justify-between">
                                        <h2 class="text-2xl font-bold tracking-tight">${col.name}</h2>
                                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-sm text-white">
                                            ${designCount} Designs
                                        </span>
                                    </div>
                                    <p class="text-gray-300 text-xs line-clamp-2 max-w-md">${col.description || 'Curated design collection featuring premium textures and layouts.'}</p>
                                    
                                    <div class="pt-2">
                                        <a href="collection_detail.html?collectionId=${col.id}" class="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm">
                                            Explore Collection
                                            <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load collections gallery:', err);
    } finally {
        if (window.hideLoader) window.hideLoader();
    }
});
