/**
 * OM Mobile Art - Storefront Home Controller (home.js)
 * Redesigned for a premium, minimal, clean aesthetic similar to Apple, dbrand, Casetify, and Nothing.
 * Dynamically builds layout sections from backend APIs with high-performance loaders.
 */

document.addEventListener('DOMContentLoaded', async () => {
    initHomepageLoader();
});

function optimizeImageUrl(url, width = 400) {
    if (!url) return '';
    if (url.includes('cloudinary.com')) {
        return url.replace('/upload/', `/upload/q_auto,f_auto,w_${width}/`);
    }
    return url;
}

async function initHomepageLoader() {
    const skeleton = document.getElementById('homepage-skeleton');

    try {
        const response = await fetch('http://localhost:3000/api/v1/homepage/layout');
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data)) {
            if (skeleton) skeleton.remove();
            renderLayout(resData.data);
            return;
        }
    } catch (err) {
        console.warn('Backend connection failed. Loading local fallback database...', err);
    }

    if (skeleton) skeleton.remove();
    loadLocalFallbackLayout();
}

function renderLayout(layoutData, isFallback = false) {
    const sectionsContainer = document.getElementById('homepage-sections-container');
    if (!sectionsContainer) return;
    
    sectionsContainer.innerHTML = ''; // Clear container

    let renderedCount = 0;

    if (Array.isArray(layoutData) && layoutData.length > 0) {
        layoutData.forEach((section) => {
            // Skip if not active
            if (section.isActive === false) return;

            // Check date scheduling
            if (section.startDate || section.endDate) {
                const now = new Date();
                const start = section.startDate ? new Date(section.startDate) : null;
                const end = section.endDate ? new Date(section.endDate) : null;
                if (start && now < start) return;
                if (end && now > end) return;
            }

            if (section.settings && typeof section.settings === 'string') {
                try {
                    section.settings = JSON.parse(section.settings);
                } catch(e) {
                    console.error("Failed to parse settings JSON for section: " + section.sectionKey, e);
                }
            }

            try {
                const sectionHTML = buildSectionHTML(section.sectionKey, section.settings || {});
                if (sectionHTML) {
                    sectionsContainer.insertAdjacentHTML('beforeend', sectionHTML);
                    postRenderHook(section.sectionKey, section.settings || {});
                    renderedCount++;
                }
            } catch (err) {
                console.error("Error rendering section " + section.sectionKey + ":", err);
            }
        });
    }

    // Fallback if no sections were rendered
    if (renderedCount === 0 && !isFallback) {
        loadLocalFallbackLayout();
        return;
    }

    // Trigger scroll reveal observer for dynamic layout
    if (window.OM && window.OM.initScrollReveal) {
        window.OM.initScrollReveal();
    }
}

function buildProductCardHTML(p, currency) {
    if (window.renderProductCard) {
        return window.renderProductCard(p, { detailPath: 'product_detail.html' });
    }
    return '';
}

function buildSectionHTML(key, settings) {
    const currency = window.pageCurrency ? window.pageCurrency() : '₹';

    switch (key) {
        case 'announcement_bar':
            // Managed centrally by navbar.js at top of body to avoid duplicate bars
            return '';

        case 'hero':
            const heroVideos = settings.heroVideos || [];
            const sliderSettings = settings.sliderSettings || {};
            return buildHeroVideoCarouselSectionHTML(heroVideos, sliderSettings, settings);
        case 'categories':
            let rawCats = settings.categories || settings.featuredCategories;
            if (!Array.isArray(rawCats) || rawCats.length === 0) {
                rawCats = [
                    { name: 'Camera', displayName: 'Camera', productCount: 128, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera', isFeatured: true },
                    { name: 'Camera Lens', displayName: 'Camera Lens', productCount: 54, image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera%20Lens', isFeatured: true },
                    { name: 'Mobile', displayName: 'Mobile', productCount: 312, image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Mobile', isFeatured: false },
                    { name: 'Laptop', displayName: 'Laptop', productCount: 86, image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Laptop', isFeatured: false }
                ];
            }

            const targetCategoriesConfig = [
                {
                    key: 'camera',
                    displayName: 'Camera',
                    icon: '📷',
                    defaultImg: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop',
                    link: 'shop.html?category=Camera',
                    isFeatured: true,
                    priority: 1
                },
                {
                    key: 'camera-lens',
                    displayName: 'Camera Lens',
                    icon: '📸',
                    defaultImg: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=800&auto=format&fit=crop',
                    link: 'shop.html?category=Camera%20Lens',
                    isFeatured: true,
                    priority: 2
                },
                {
                    key: 'mobile',
                    displayName: 'Mobile',
                    icon: '📱',
                    defaultImg: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop',
                    link: 'shop.html?category=Mobile',
                    isFeatured: false,
                    priority: 3
                },
                {
                    key: 'laptop',
                    displayName: 'Laptop',
                    icon: '💻',
                    defaultImg: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop',
                    link: 'shop.html?category=Laptop',
                    isFeatured: false,
                    priority: 4
                }
            ];

            // Normalize and map items to target 4 allowed device categories
            let sortedCats = targetCategoriesConfig.map(cfg => {
                const found = rawCats.find(c => {
                    const nameStr = (c.displayName || c.name || '').toLowerCase();
                    if (cfg.key === 'camera-lens') {
                        return nameStr.includes('camera lens') || nameStr.includes('lens');
                    }
                    if (cfg.key === 'camera') {
                        return (nameStr.includes('camera') || nameStr.includes('dslr')) && !nameStr.includes('lens');
                    }
                    if (cfg.key === 'mobile') {
                        return nameStr.includes('mobile') || nameStr.includes('phone');
                    }
                    if (cfg.key === 'laptop') {
                        return nameStr.includes('laptop') || nameStr.includes('macbook');
                    }
                    return false;
                });

                const rawImg = found?.image || found?.imageUrl;
                const isInvalidOrPersonImg = !rawImg || rawImg === 'null' || rawImg === 'undefined' || rawImg.includes('lh3.googleusercontent.com') || rawImg.includes('photo-1494790108377') || rawImg.includes('AB6AXuAIl1RY');

                return {
                    displayName: found?.displayName || found?.name || cfg.displayName,
                    image: !isInvalidOrPersonImg ? rawImg : cfg.defaultImg,
                    link: found?.link || found?.destinationLink || cfg.link,
                    isFeatured: true,
                    icon: cfg.icon,
                    key: cfg.key,
                    priority: cfg.priority,
                    defaultImg: cfg.defaultImg
                };
            });

            // Ensure Priority Order: Camera -> Camera Lens -> Mobile -> Laptop
            sortedCats.sort((a, b) => a.priority - b.priority);

            let catsHTML = '';
            sortedCats.forEach((cat) => {
                const displayName = cat.displayName;
                const redirectUrl = cat.link;
                const imgUrl = optimizeImageUrl(cat.image || cat.defaultImg, 600);
                const showBadge = (cat.key === 'camera' || cat.key === 'camera-lens');

                catsHTML += `
                    <div class="group relative bg-gradient-to-b from-white via-[#F6FAFF] to-[#EDF5FF] border-2 border-[#0077B6]/35 rounded-3xl p-7 lg:p-8 flex flex-col items-center justify-between shadow-[0_12px_35px_rgba(0,119,182,0.12)] hover:shadow-[0_24px_55px_rgba(0,119,182,0.24)] hover:border-[#0077B6] hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden min-h-[300px] lg:min-h-[320px] snap-center flex-shrink-0 w-[85vw] sm:w-auto z-10"
                         onclick="window.location.href='${redirectUrl}'">
                        
                        <!-- Featured Badge for Prime Items -->
                        ${showBadge ? `
                        <div class="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-700 font-bold text-[11px] rounded-full shadow-xs tracking-wider uppercase backdrop-blur-md">
                            <span class="text-xs">⭐</span>
                            <span>Featured</span>
                        </div>
                        ` : ''}

                        <!-- Image Circle -->
                        <div class="relative w-[130px] h-[130px] lg:w-[145px] lg:h-[145px] rounded-full p-1 bg-gradient-to-tr from-[#0077B6] via-[#90E0EF] to-white shadow-lg group-hover:scale-105 transition-transform duration-300 my-2">
                            <div class="w-full h-full rounded-full overflow-hidden border-2 border-white bg-white">
                                <img src="${imgUrl}" alt="${displayName}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" onerror="this.src='${cat.defaultImg}'"/>
                            </div>
                        </div>

                        <!-- Name -->
                        <div class="flex-1 flex flex-col items-center justify-center text-center my-3">
                            <h3 class="text-2xl lg:text-3xl font-extrabold text-[#03045E] group-hover:text-[#0077B6] transition-colors tracking-tight flex items-center gap-2">
                                <span>${cat.icon}</span>
                                <span>${displayName}</span>
                            </h3>
                        </div>

                        <!-- Explore Button -->
                        <div class="w-full mt-3 pt-3 border-t border-[#0077B6]/15 flex items-center justify-center gap-2 text-xs font-extrabold text-[#0077B6] group-hover:text-[#03045E] transition-colors uppercase tracking-wider">
                            <span>Explore ${displayName}</span>
                            <span class="material-symbols-outlined text-sm transform group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </div>
                    </div>
                `;
            });

            return `
                <section class="py-16 md:py-24 bg-gradient-to-b from-white via-[#F8FCFF] to-white border-b border-gray-150 relative overflow-hidden">
                    <!-- Soft Background Blur Elements -->
                    <div class="absolute top-10 left-10 w-[350px] h-[350px] bg-[#90E0EF]/15 rounded-full blur-[100px] pointer-events-none"></div>
                    <div class="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#CAF0F8]/20 rounded-full blur-[120px] pointer-events-none"></div>
                    
                    <div class="store-container relative z-10">
                        <!-- Section Header -->
                        <div class="text-center mb-12 lg:mb-16 max-w-[700px] mx-auto">
                            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0077B6]/10 text-[#0077B6] text-xs font-extrabold uppercase tracking-widest mb-3">
                                <span>🎯 Core Product Focus</span>
                            </div>
                            <h2 class="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#03045E] leading-tight">Shop by Device</h2>
                            <p class="text-sm md:text-base lg:text-lg text-gray-500 mt-3 font-medium">Select your device category to explore precision-cut 3M skins tailored for your gear.</p>
                        </div>
                        
                        <!-- Cards Grid / Mobile Swipe Container -->
                        <div class="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar pb-6 md:pb-0" id="category-scroller">
                            ${catsHTML}
                        </div>

                        <!-- Mobile Swipe Helper -->
                        <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 mt-4 md:hidden">
                            <span class="material-symbols-outlined text-sm animate-pulse">swipe</span>
                            <span>Swipe horizontally to view all devices</span>
                        </div>
                    </div>
                </section>
            `;

        case 'brands':
            return '';

        case 'collections':
            let cols = settings.featuredCollections || [];
            if (cols.length === 0) {
                cols = [
                    { name: 'Carbon Fiber Series', description: 'Raw textured aerospace-grade carbon fiber styling.', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop', link: 'shop.html?collection=Carbon%20Fiber' },
                    { name: 'Classic LeatherWrap', description: 'Genuine leather wraps for organic luxury warmth.', image: 'https://images.unsplash.com/photo-1524295988350-019a58a7f920?q=80&w=600&auto=format&fit=crop', link: 'shop.html?collection=Leather' },
                    { name: 'Sandstone Grit', description: 'Ultra-textured sandstone wraps for superior tactile grip.', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop', link: 'shop.html?collection=Sandstone' }
                ];
            }
            let colsHTML = '';
            cols.forEach((col) => {
                const colImg = optimizeImageUrl(col.image, 600);
                const colId = col.id || col.collectionId || '';
                const clickUrl = colId ? `collection_detail.html?collectionId=${colId}` : (col.link || 'collections.html');
                colsHTML += `
                    <div class="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 flex-shrink-0 w-[290px] md:w-auto" onclick="window.location.href='${clickUrl}'">
                        <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style="background-image: url('${colImg}')"></div>
                        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                        <div class="absolute bottom-0 left-0 p-6 w-full flex flex-col justify-end z-20">
                            <h3 class="text-xl font-bold text-white mb-1.5">${col.name}</h3>
                            <p class="text-gray-300 text-xs line-clamp-2 mb-4 font-medium">${col.description || 'Premium curated collection'}</p>
                            <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 group-hover:underline">
                                View Collection 
                                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </span>
                        </div>
                    </div>
                `;
            });

            return `
                <section class="py-16 md:py-20 bg-white border-b border-gray-200">
                    <div class="store-container">
                        <div class="text-center mb-10">
                            <h2 class="text-3xl font-extrabold tracking-tight text-black">Featured Collections</h2>
                            <p class="text-gray-500 text-sm mt-2 font-medium">Premium curated aesthetics for a distinguished device style</p>
                        </div>
                        <div class="flex overflow-x-auto md:grid md:grid-cols-3 gap-6 no-scrollbar pb-4 md:pb-0" id="collections-scroller">
                            ${colsHTML}
                        </div>
                    </div>
                </section>
            `;

        case 'trending':
        case 'best_sellers':
        case 'new_arrivals':
            let products = settings.products || [];
            let productsHTML = '';

            if (!Array.isArray(products) || products.length === 0) {
                productsHTML = `
                    <div class="col-span-full py-12 text-center text-gray-500 font-medium bg-white rounded-2xl border border-gray-100 shadow-xs">
                        <p class="text-base font-bold text-gray-700">No products available.</p>
                        <p class="text-xs text-gray-400 mt-1">Check back soon for new drops and arrivals!</p>
                    </div>
                `;
            } else {
                products.forEach((p) => {
                    const optimizedProduct = { ...p, image: optimizeImageUrl(p.image, 500) };
                    productsHTML += buildProductCardHTML(optimizedProduct, currency);
                });
            }

            const titles = {
                trending: 'Trending Designs',
                best_sellers: 'Best Sellers',
                new_arrivals: 'New Arrivals'
            };
            const subtitles = {
                trending: 'The most popular skins chosen by our community',
                best_sellers: 'Top rated skins back in stock and ready to ship',
                new_arrivals: 'Freshly added limited drops and custom textures'
            };

            return `
                <section class="py-12 md:py-20 bg-[#F9F9FB] border-b border-gray-200 overflow-hidden">
                    <div class="store-container">
                        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-10 gap-2 sm:gap-4">
                            <div>
                                <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">${titles[key]}</h2>
                                <p class="text-gray-500 text-xs sm:text-sm mt-1 font-medium">${subtitles[key]}</p>
                            </div>
                            <a href="shop.html" class="text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1 hover:underline self-start sm:self-auto">
                                View All Products 
                                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </a>
                        </div>
                        <div class="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar gap-3 sm:gap-4 md:gap-6 px-4 sm:px-6 -mx-4 sm:-mx-6 pb-4 pt-1 md:grid md:grid-cols-4 md:px-0 md:mx-0 md:pb-0" id="${key}-scroller" style="-webkit-overflow-scrolling: touch;">
                            ${productsHTML}
                        </div>
                    </div>
                </section>
            `;

        case 'custom_print':
            const customPrintImg = optimizeImageUrl(settings.image || 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=800&auto=format&fit=crop', 800);
            return `
                <section class="py-16 md:py-20 bg-white border-b border-gray-200">
                    <div class="store-container grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div class="space-y-6 order-2 md:order-1">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest block">Personalize Your Gear</span>
                            <h2 class="text-4xl md:text-5xl font-extrabold text-black tracking-tight leading-tight">${settings.title || 'Design Your Own Skin'}</h2>
                            <p class="text-gray-600 text-sm md:text-base leading-relaxed">${settings.description || 'Upload your own design. Preview instantly. Premium print quality. Perfect fit.'}</p>
                            <div class="pt-4">
                                <a href="${settings.ctaLink || 'custom_skin.html'}" class="px-8 py-3.5 bg-black hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-md hover:shadow-lg inline-block transform hover:-translate-y-0.5">
                                    ${settings.ctaText || 'Create Now'}
                                </a>
                            </div>
                        </div>
                        <div class="order-1 md:order-2 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 aspect-[4/3] md:aspect-auto md:h-[400px]">
                            <img src="${customPrintImg}" alt="Custom Skin Preview" class="w-full h-full object-cover zoom-image"/>
                        </div>
                    </div>
                </section>
            `;

        case 'why_choose_us':
            let whyItems = settings.items || [];
            if (whyItems.length === 0) {
                whyItems = [
                    { icon: 'verified', title: 'Premium 3M Materials', description: 'Crafted exclusively with authentic bubble-free 3M vinyl wrappers for damage-free removal.' },
                    { icon: 'precision_manufacturing', title: '0.001mm Precision Cut', description: 'Laser cutting guarantees perfect fitment around camera lenses and speaker grilles.' },
                    { icon: 'local_shipping', title: 'Free Express Shipping', description: 'Dispatched within 24 hours with reliable nationwide delivery updates.' }
                ];
            }
            let whyHTML = '';
            whyItems.forEach((item) => {
                whyHTML += `
                    <div class="bg-white border border-gray-200 rounded-2xl p-8 text-center flex flex-col items-center shadow-sm hover:shadow-md transform hover:-translate-y-1 transition-all duration-300">
                        <div class="w-14 h-14 bg-gray-50 border border-gray-200 rounded-full flex items-center justify-center mb-6 text-black">
                            <span class="material-symbols-outlined text-[26px]">${item.icon}</span>
                        </div>
                        <h3 class="font-bold text-black text-sm mb-2">${item.title}</h3>
                        <p class="text-gray-500 text-xs leading-relaxed font-medium">${item.description}</p>
                    </div>
                `;
            });

            return `
                <section class="py-16 md:py-20 bg-white border-b border-gray-200">
                    <div class="store-container">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-extrabold tracking-tight text-black">Why Choose OM Mobile Art</h2>
                            <p class="text-gray-500 text-sm mt-2 font-medium">Engineered for perfection, crafted for style</p>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            ${whyHTML}
                        </div>
                    </div>
                </section>
            `;

        case 'testimonials':
            let reviewsList = settings.items || [];
            if (reviewsList.length === 0) {
                reviewsList = [
                    { name: 'Kunal Ruparel', rating: 5, review: 'Absolutely stunning quality! The carbon fiber wrap looks incredible on my iPhone 16 Pro and the camera bump template matches perfectly. Installation was super easy and bubble-free.', city: 'Mumbai' },
                    { name: 'Rohan Sharma', rating: 5, review: 'I ordered the custom print skin with my own artwork. The colors are very vibrant and the texture feels extremely premium. Dispatched in 24 hours just as advertised!', city: 'Delhi' },
                    { name: 'Priya Patel', rating: 5, review: 'Front screen lamination works perfectly on my Google Pixel. Extremely scratch resistant and self-healing. I will definitely be ordering again!', city: 'Ahmedabad' }
                ];
            }
            let reviewsHTML = '';

            reviewsList.forEach((item) => {
                let starsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const isFilled = i <= item.rating;
                    starsHTML += `<span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' ${isFilled ? '1' : '0'}; color: #FFB800;">star</span>`;
                }

                const optimizedAvatar = optimizeImageUrl(item.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop', 100);

                reviewsHTML += `
                    <div class="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transform hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <div class="flex items-center gap-1.5 mb-4 text-[#FFB800]">
                                ${starsHTML}
                            </div>
                            <p class="text-gray-700 text-sm italic leading-relaxed mb-6 font-medium">"${item.review}"</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <img src="${optimizedAvatar}" alt="${item.name}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'"/>
                            <div>
                                <h4 class="font-extrabold text-sm text-black leading-tight">${item.name}</h4>
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${item.city || 'Verified Buyer'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            return `
                <section class="py-16 md:py-20 bg-[#F9F9FB] border-b border-gray-200">
                    <div class="store-container">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-extrabold tracking-tight text-black">What Our Customers Say</h2>
                            <p class="text-gray-500 text-sm mt-2 font-medium">Hear directly from hundreds of satisfied smartphone owners</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="reviews-carousel-grid">
                            ${reviewsHTML}
                        </div>
                    </div>
                </section>
            `;

        case 'instagram':
            let instaList = settings.items || [];
            if (instaList.length === 0) {
                instaList = [
                    { image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' },
                    { image: 'https://images.unsplash.com/photo-1524295988350-019a58a7f920?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' },
                    { image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' },
                    { image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' },
                    { image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' },
                    { image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=400&auto=format&fit=crop', link: 'https://instagram.com' }
                ];
            }
            let instaHTML = '';

            instaList.forEach((item) => {
                instaHTML += `
                    <div class="relative overflow-hidden rounded-2xl aspect-square group cursor-pointer border border-gray-200 shadow-sm" onclick="window.open('${item.link}', '_blank')">
                        <img src="${item.image}" alt="Social Gallery Image" class="w-full h-full object-cover zoom-image transition-transform duration-500 group-hover:scale-105" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'"/>
                        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                            <span class="text-white font-extrabold text-xs uppercase tracking-widest flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px]">photo_camera</span> 
                                View Post
                            </span>
                        </div>
                    </div>
                `;
            });

            return `
                <section class="py-16 bg-white border-b border-gray-200">
                    <div class="store-container">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-extrabold tracking-tight text-black">Instagram Gallery</h2>
                            <p class="text-gray-500 text-sm mt-2 font-medium">Tag <span class="text-black font-bold">#OMMobileArt</span> to get featured on our gallery grid</p>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
                            ${instaHTML}
                        </div>
                    </div>
                </section>
            `;

        case 'newsletter':
            return `
                <section class="py-24 bg-white">
                    <div class="max-w-[650px] mx-auto px-6 text-center space-y-6 relative z-10">
                        <h2 class="text-3xl font-extrabold tracking-tight text-black">${settings.title || 'Join the Community'}</h2>
                        <p class="text-gray-500 text-sm font-medium leading-relaxed">${settings.description || 'Subscribe to get early access to new collection drops, exclusive offers, and styling tips.'}</p>
                        <form id="newsletter-cms-form" class="flex flex-col sm:flex-row gap-3 max-w-[500px] mx-auto pt-4">
                            <input class="flex-grow h-12 px-4 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:border-black shadow-sm" 
                                   placeholder="Your email address" type="email" required/>
                            <button class="h-12 px-8 bg-black hover:bg-gray-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors" type="submit">
                                ${settings.buttonText || 'Subscribe'}
                            </button>
                        </form>
                        <p class="text-[10px] text-gray-400 font-extrabold tracking-wider uppercase pt-2">By subscribing, you agree to our Terms of Service</p>
                    </div>
                </section>
            `;

        default:
            return '';
    }
}

// Post render initialization hooks
function postRenderHook(key, settings) {
    if (key === 'newsletter') {
        initNewsletterForm();
    }
    if (key === 'collections' && window.API && window.API.getCollections) {
        window.API.getCollections().then(cols => {
            const activeCols = (cols || []).filter(c => c.isActive !== false && c.isVisible !== false && !c.deletedAt);
            const container = document.getElementById('collections-scroller');
            if (container && activeCols.length > 0) {
                container.innerHTML = activeCols.map(col => {
                    const colImg = col.desktopBanner || col.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';
                    return `
                        <div class="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 flex-shrink-0 w-[290px] md:w-auto" onclick="window.location.href='collection_detail.html?collectionId=${col.id}'">
                            <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style="background-image: url('${colImg}')"></div>
                            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                            <div class="absolute bottom-0 left-0 p-6 w-full flex flex-col justify-end z-20">
                                <h3 class="text-xl font-bold text-white mb-1.5">${col.name}</h3>
                                <p class="text-gray-300 text-xs line-clamp-2 mb-4 font-medium">${col.description || 'Premium curated collection'}</p>
                                <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 group-hover:underline">
                                    View Collection 
                                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }).catch(err => console.error('Failed to update homepage collections hook:', err));
    }
}

// Wishlist heart toggle handler
window.toggleWishlistBtnHome = async function(productId, btnEl, event) {
    event.stopPropagation();
    event.preventDefault();
    if (!window.DB) return;

    await window.DB.toggleWishlist(productId);
    const isIn = await window.DB.isInWishlist(productId);
    const heart = btnEl.querySelector('.wishlist-heart');
    
    if (isIn) {
        heart.classList.add('filled');
        heart.style.fontVariationSettings = "'FILL' 1";
        heart.style.color = 'black';
        window.showToast("Added to Wishlist!", "success");
    } else {
        heart.classList.remove('filled');
        heart.style.fontVariationSettings = "'FILL' 0";
        heart.style.color = 'currentColor';
        window.showToast("Removed from Wishlist.", "info");
    }
};

// Quick Add Handler for home cards
window.quickAddHome = function(id, event) {
    if (window.handleProductQuickAdd) {
        window.handleProductQuickAdd(event, id);
    }
};

// Newsletter Form validator
function initNewsletterForm() {
    const form = document.getElementById('newsletter-cms-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        if (input) {
            const email = input.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (emailRegex.test(email)) {
                window.showToast("Thank you for subscribing! Welcome to the community.", "success");
                input.value = '';
            } else {
                window.showToast("Please enter a valid email address.", "error");
            }
        }
    });
}

// Dynamic Price Formatter
function formatPrice(val, currencySymbol) {
    if (currencySymbol === '₹') {
        return '₹' + Math.round(val * 80).toLocaleString('en-IN');
    }
    return '$' + parseFloat(val).toFixed(2);
}

// FALLBACK: Load mock/local database layout if offline
function loadLocalFallbackLayout() {
    if (!window.DB) return;

    const products = window.DB.getProducts() || [];
    const trendingList = products.slice(0, 4);

    const mockLayout = [
        {
            sectionKey: 'hero',
            settings: {
                badgeText: 'Premium Device Skins',
                title: 'Protect Your Device.',
                titleHighlight: 'Express Your Style.',
                description: 'Premium precision-cut skins for phones, tablets, cameras, laptops and more.',
                primaryBtnText: 'Shop Now',
                primaryBtnLink: 'shop.html',
                secondaryBtnText: 'Browse Collections',
                secondaryBtnLink: 'collections.html',
                mainImage: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop',
                skinImage1: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop',
                skinImage2: 'https://images.unsplash.com/photo-1524295988350-019a58a7f920?q=80&w=600&auto=format&fit=crop'
            }
        },
        {
            sectionKey: 'categories',
            settings: {
                showProductCount: true,
                featuredCategories: [
                    { id: 'a0000000-0000-0000-0000-000000000000', name: 'Camera', displayName: 'Camera', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop', position: 1, isActive: true, isFeatured: true, productCount: 128 },
                    { id: 'a0000000-0000-0000-0000-000000000010', name: 'Camera Lens', displayName: 'Camera Lens', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=800&auto=format&fit=crop', position: 2, isActive: true, isFeatured: true, productCount: 54 },
                    { id: 'a0000000-0000-0000-0000-000000000001', name: 'Mobile', displayName: 'Mobile', image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop', position: 3, isActive: true, isFeatured: false, productCount: products.length || 312 },
                    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Laptop', displayName: 'Laptop', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop', position: 4, isActive: true, isFeatured: false, productCount: 86 }
                ]
            }
        },
        {
            sectionKey: 'collections',
            settings: {
                featuredCollections: [
                    { id: '1', name: 'Anime Series', description: 'Legendary anime characters and iconic pop culture wraps.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA', link: 'collection_detail.html?collectionId=1' },
                    { id: '2', name: 'Marvel Edition', description: 'Earth\'s mightiest heroes printed in pristine high-resolution quality.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI', link: 'collection_detail.html?collectionId=2' },
                    { id: '5', name: 'Carbon Fiber', description: 'Raw carbon fiber weave textures providing premium tactile feedback.', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA', link: 'collection_detail.html?collectionId=5' }
                ]
            }
        },
        {
            sectionKey: 'trending',
            settings: {
                products: trendingList.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    image: p.image,
                    brand: p.brand || 'Skins',
                    isBestSeller: p.isBestSeller,
                    isNew: p.isNew
                }))
            }
        },
        {
            sectionKey: 'custom_print',
            settings: {
                title: 'CUSTOM PRINT skins',
                description: 'Upload your own images and build a custom mobile skin tailored precisely to your device.',
                image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIl1RY-CFqKqlm20yFwDzmVwT8vlSrbdyQ4pmXIcjPhMMzNsEESP0SOG1CUGHfTgyb9L3GsJm_KV_ddPfK-dEzPHx3MPmvNqFn9MBCW-gN14pseXuqL8CuGvVPUDwabpuQ4J9-kuKV9EA6cCMsJfI0fRzorWpP4o5hxrl28wT3mHmxf1MGR2FDz27fHVTe6Fj9VCWilv_R_9B-ZHPy611VTTP6amL6p6hMCzB0oxa9w_0fhWJ39KuE0zvetNA6NCWI-27nHBbqPGU',
                ctaText: 'Create Your Design',
                ctaLink: 'custom_skin.html'
            }
        },
        {
            sectionKey: 'why_choose_us',
            settings: {
                items: [
                    { title: 'Premium Materials', description: 'Authentic 3M vinyl textures providing ultimate style.', icon: 'shield' },
                    { title: 'Precision Cut', description: 'Meticulously measured to 0.01mm for precise wrap-around fit.', icon: 'precision_manufacturing' }
                ]
            }
        },
        {
            sectionKey: 'testimonials',
            settings: {
                items: [
                    { id: '1', name: 'David K.', review: 'The fit is absolutely perfect. Precision is on another level.', rating: 5, image: '' }
                ]
            }
        },
        {
            sectionKey: 'instagram',
            settings: {
                items: [
                    { image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=400&auto=format&fit=crop', link: '#' }
                ]
            }
        },
        {
            sectionKey: 'newsletter',
            settings: {
                title: 'Join the Community',
                description: 'Subscribe to get early access to new collection drops and exclusive offers.'
            }
        }
    ];

    renderLayout(mockLayout, true);
}

async function loadHomepageBrandsDynamic() {
    const container = document.getElementById('homepage-brands-dynamic-grid');
    if (!container) return;

    let brands = [];
    try {
        if (window.API && window.API.getBrands) {
            brands = await window.API.getBrands();
        } else if (window.DB && window.DB.getBrands) {
            brands = window.DB.getBrands();
        }
    } catch (err) {
        console.warn("Failed to fetch dynamic brands", err);
    }

    if (!brands || brands.length === 0) {
        brands = [
            { name: 'Apple', logo: '../../assets/logos/apple.png', isActive: true, sortOrder: 1 },
            { name: 'Samsung', logo: '../../assets/logos/samsung.png', isActive: true, sortOrder: 2 },
            { name: 'Google', logo: '../../assets/logos/google.png', isActive: true, sortOrder: 3 },
            { name: 'Nothing', logo: '../../assets/logos/nothing.png', isActive: true, sortOrder: 4 },
            { name: 'OnePlus', logo: '../../assets/logos/oneplus.png', isActive: true, sortOrder: 5 },
            { name: 'Motorola', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Motorola_logo.svg', isActive: true, sortOrder: 6 },
            { name: 'Xiaomi', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg', isActive: true, sortOrder: 7 },
            { name: 'Vivo', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Vivo_logo.svg', isActive: true, sortOrder: 8 },
            { name: 'Oppo', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/OPPO_Logo_2019.svg', isActive: true, sortOrder: 9 },
            { name: 'Realme', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Realme_logo.svg', isActive: true, sortOrder: 10 }
        ];
    }

    const normalizedBrands = brands.map((b, idx) => {
        const name = typeof b === 'string' ? b : (b.name || b.title || '');
        let logo = (typeof b === 'object' && b.logo) ? b.logo : '';
        const nameLower = name.toLowerCase();
        if (nameLower === 'apple') logo = '../../assets/logos/apple.png';
        else if (nameLower === 'samsung') logo = '../../assets/logos/samsung.png';
        else if (nameLower === 'google') logo = '../../assets/logos/google.png';
        else if (nameLower === 'nothing') logo = '../../assets/logos/nothing.png';
        else if (nameLower === 'oneplus') logo = '../../assets/logos/oneplus.png';
        else if (!logo) logo = 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg';

        return {
            name,
            logo,
            isActive: typeof b === 'object' && b.isActive !== undefined ? b.isActive : true,
            sortOrder: typeof b === 'object' && b.sortOrder !== undefined ? b.sortOrder : idx + 1
        };
    });

    const activeBrands = normalizedBrands.filter(b => b.isActive !== false && b.name.length > 0).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (activeBrands.length === 0) {
        container.innerHTML = `<div class="w-full py-12 text-center text-gray-400 font-medium text-base">No compatible brands available.</div>`;
        return;
    }

    container.innerHTML = activeBrands.map(brand => {
        return `
            <div class="brand-card-item" 
                  onclick="window.location.href='shop.html?brand=${encodeURIComponent(brand.name)}'"
                  title="${brand.name}">
                <div class="brand-logo-box">
                    <img src="${brand.logo}" alt="${brand.name}" class="brand-logo-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"/>
                    <span class="text-xs font-bold text-gray-800 hidden">${brand.name.substring(0, 3)}</span>
                </div>
                <span class="brand-name-text">${brand.name}</span>
            </div>
        `;
    }).join('');
}

function postRenderHook(key, settings) {
    if (key === 'hero') {
        const videos = settings.heroVideos || [];
        const sliderSt = settings.sliderSettings || {};
        initHeroVideoCarousel(videos, sliderSt);
    } else if (key === 'brands') {
        loadHomepageBrandsDynamic();
    } else if (key === 'newsletter') {
        initNewsletterForm();
    }
}

// ── Hero Video Carousel Component (Split Hero Design) ──
function buildHeroVideoCarouselSectionHTML(videos = [], settings = {}, textSettings = {}) {
    const badgeText = textSettings.badgeText || 'Premium Device Skins';
    const title = textSettings.title || 'Protect Your Device.';
    const titleHighlight = textSettings.titleHighlight || 'Express Your Style.';
    const description = textSettings.description || 'Premium precision-cut skins for phones, tablets, cameras, laptops and more.';
    const primaryBtnText = textSettings.primaryBtnText || 'Shop Now';
    const primaryBtnLink = textSettings.primaryBtnLink || 'shop.html';
    const secondaryBtnText = textSettings.secondaryBtnText || 'Browse Collections';
    const secondaryBtnLink = textSettings.secondaryBtnLink || 'collections.html';
    const trustFeature1 = textSettings.trustFeature1 || '3M Authentic Vinyl';
    const trustFeature2 = textSettings.trustFeature2 || '0.23mm Precision Fit';

    if (!videos || videos.length === 0) {
        videos = [
            {
                id: 'fallback-1',
                title: 'Precision 3M Mobile Skins',
                videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1688672570/samples/cld-sample-video.mp4',
                thumbnailUrl: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop',
                isActive: true
            },
            {
                id: 'fallback-2',
                title: 'Ultra-Thin Textured Skins',
                videoUrl: 'https://res.cloudinary.com/demo/video/upload/sp_auto/v1/samples/elephants.mp4',
                thumbnailUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop',
                isActive: true
            }
        ];
    }

    const firstVideo = videos[0];
    const showArrows = settings.showNavigationArrows !== false && videos.length > 1;
    const showDots = settings.showDots !== false && videos.length > 1;

    return `
        <section class="relative w-full bg-gradient-to-b from-[#F8FAFC] to-white py-12 lg:py-16 overflow-hidden border-b border-gray-200" id="homepage-hero-carousel-section">
            <div class="store-container grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                <!-- LEFT COLUMN: Hero Copy & Actions -->
                <div class="lg:col-span-6 space-y-6 text-center lg:text-left flex flex-col items-center lg:items-start">
                    
                    <!-- Small Badge -->
                    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0077B6]/10 border border-[#0077B6]/20 text-[#0077B6] text-xs font-bold uppercase tracking-wider">
                        <span class="w-2 h-2 rounded-full bg-[#00B4D8] animate-pulse"></span>
                        <span>${badgeText}</span>
                    </div>

                    <!-- Large Heading -->
                    <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#111827] tracking-tight leading-[1.1]">
                        ${title}<br>
                        <span class="text-[#0077B6]">${titleHighlight}</span>
                    </h1>

                    <!-- Subtitle / Description -->
                    <p class="text-gray-600 text-sm sm:text-base md:text-lg font-medium leading-relaxed max-w-[540px]">
                        ${description}
                    </p>

                    <!-- Buttons -->
                    <div class="flex flex-col sm:flex-row items-center gap-4 pt-2 w-full sm:w-auto">
                        <a href="${primaryBtnLink}" class="w-full sm:w-auto px-8 py-3.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-center">
                            ${primaryBtnText}
                        </a>
                        <a href="${secondaryBtnLink}" class="w-full sm:w-auto px-8 py-3.5 bg-white border-2 border-[#0077B6] text-[#0077B6] hover:bg-[#0077B6] hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-sm text-center">
                            ${secondaryBtnText}
                        </a>
                    </div>

                    <!-- Trust Indicators -->
                    <div class="pt-4 flex items-center justify-center lg:justify-start gap-6 text-gray-500 text-xs font-bold border-t border-gray-200/80 w-full">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[#0077B6] text-[18px]">verified</span>
                            <span>${trustFeature1}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[#0077B6] text-[18px]">precision_manufacturing</span>
                            <span>${trustFeature2}</span>
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Video Carousel Card -->
                <div class="lg:col-span-6 relative flex flex-col items-center justify-center w-full">
                    
                    <div class="flex items-center justify-center gap-2 sm:gap-4 w-full">
                        <!-- Circular Previous Button (Left of Video) -->
                        <button id="hero-prev-video-btn" aria-label="Previous Video" class="${showArrows ? '' : 'hidden '}w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-[#0077B6] hover:text-white border border-gray-200 shadow-md text-[#03045E] flex items-center justify-center transition-all duration-200 shrink-0 hover:scale-105 active:scale-95 cursor-pointer z-20">
                            <span class="material-symbols-outlined text-xl sm:text-2xl">arrow_back_ios_new</span>
                        </button>

                        <!-- Rounded Video Card -->
                        <div class="relative w-full max-w-[540px] aspect-[16/10] sm:h-[350px] bg-gray-900 rounded-2xl sm:rounded-[24px] overflow-hidden shadow-2xl border-4 border-white group" id="hero-carousel-player-box">
                            
                            <!-- HTML5 Video Element -->
                            <video id="hero-active-video-element"
                                   src="${firstVideo.videoUrl}"
                                   playsinline
                                   preload="auto"
                                   muted
                                   poster="${firstVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop'}"
                                   class="w-full h-full object-cover">
                            </video>

                            <!-- Video Title Overlay Badge -->
                            <div class="absolute top-4 left-4 z-20 pointer-events-none">
                                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-md" id="hero-video-title-badge">
                                    <span class="w-2 h-2 rounded-full bg-[#00B4D8] animate-pulse"></span>
                                    <span id="hero-video-title-text">${firstVideo.title}</span>
                                </div>
                            </div>

                            <!-- Bottom Controls Overlay Bar inside Video -->
                            <div class="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 z-20 transition-opacity duration-300" id="hero-video-controls-overlay">
                                
                                <!-- Real-time Seek Progress Bar -->
                                <div class="w-full bg-white/20 hover:bg-white/30 h-1.5 rounded-full overflow-hidden cursor-pointer transition-all ${settings.showProgressBar !== false ? '' : 'hidden'}" id="hero-video-progress-container" title="Seek video position">
                                    <div class="bg-[#00B4D8] h-full w-0 rounded-full transition-all duration-100" id="hero-video-progress-bar"></div>
                                </div>

                                <!-- Buttons Row -->
                                <div class="flex items-center justify-between text-xs text-white font-bold pt-1">
                                    <div class="flex items-center gap-3">
                                        <button id="hero-play-pause-btn" aria-label="Play or Pause" class="p-1 hover:text-[#00B4D8] transition-colors cursor-pointer flex items-center">
                                            <span class="material-symbols-outlined text-lg" id="hero-play-icon">pause</span>
                                        </button>
                                        <button id="hero-mute-btn" aria-label="Mute or Unmute" class="p-1 hover:text-[#00B4D8] transition-colors cursor-pointer flex items-center">
                                            <span class="material-symbols-outlined text-lg" id="hero-mute-icon">volume_off</span>
                                        </button>
                                        <span id="hero-video-timer" class="text-[11px] text-gray-300 font-mono">0:00 / 0:00</span>
                                    </div>

                                    <div class="flex items-center gap-3">
                                        <button id="hero-fullscreen-btn" aria-label="Toggle Fullscreen" class="p-1 hover:text-[#00B4D8] transition-colors cursor-pointer flex items-center">
                                            <span class="material-symbols-outlined text-lg">fullscreen</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Circular Next Button (Right of Video) -->
                        <button id="hero-next-video-btn" aria-label="Next Video" class="${showArrows ? '' : 'hidden '}w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white hover:bg-[#0077B6] hover:text-white border border-gray-200 shadow-md text-[#03045E] flex items-center justify-center transition-all duration-200 shrink-0 hover:scale-105 active:scale-95 cursor-pointer z-20">
                            <span class="material-symbols-outlined text-xl sm:text-2xl">arrow_forward_ios</span>
                        </button>
                    </div>

                    <!-- Pagination Dots Row (Below Video Card) -->
                    <div class="flex items-center justify-center gap-2 mt-4 ${showDots ? '' : 'hidden'}" id="hero-video-dots-wrapper">
                        ${videos.map((_, i) => `
                            <button onclick="jumpToHeroVideo(${i})" aria-label="Jump to Video ${i + 1}" class="hero-dot-item w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${i === 0 ? 'bg-[#0077B6] scale-125' : 'bg-gray-300 hover:bg-gray-400'}"></button>
                        `).join('')}
                    </div>

                </div>

            </div>
        </section>
    `;
}

let currentHeroVideoIdx = 0;
let currentHeroVideos = [];
let currentHeroSettings = {};

window.jumpToHeroVideo = function(idx) {
    if (!currentHeroVideos || currentHeroVideos.length === 0) return;
    if (idx < 0 || idx >= currentHeroVideos.length) return;
    currentHeroVideoIdx = idx;
    playCurrentHeroVideo();
};

function initHeroVideoCarousel(videos, settings) {
    currentHeroVideos = (videos && videos.length > 0) ? videos : [
        {
            id: 'fallback-1',
            title: 'Precision 3M Mobile Skins',
            videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1688672570/samples/cld-sample-video.mp4',
            thumbnailUrl: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop'
        },
        {
            id: 'fallback-2',
            title: 'Ultra-Thin Textured Skins',
            videoUrl: 'https://res.cloudinary.com/demo/video/upload/sp_auto/v1/samples/elephants.mp4',
            thumbnailUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop'
        }
    ];
    currentHeroSettings = settings || {};
    currentHeroVideoIdx = 0;

    const videoEl = document.getElementById('hero-active-video-element');
    if (!videoEl) return;

    // Apply Mute setting by default
    videoEl.muted = currentHeroSettings.muteByDefault !== false;
    updateMuteIcon(videoEl.muted);

    // Prev / Next button listeners
    const prevBtn = document.getElementById('hero-prev-video-btn');
    const nextBtn = document.getElementById('hero-next-video-btn');
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentHeroVideoIdx = (currentHeroVideoIdx - 1 + currentHeroVideos.length) % currentHeroVideos.length;
            playCurrentHeroVideo();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentHeroVideoIdx = (currentHeroVideoIdx + 1) % currentHeroVideos.length;
            playCurrentHeroVideo();
        };
    }

    // Play/Pause button listener
    const playPauseBtn = document.getElementById('hero-play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.onclick = () => {
            if (videoEl.paused) {
                videoEl.play().catch(() => {});
            } else {
                videoEl.pause();
            }
        };
    }

    // Mute/Unmute button listener
    const muteBtn = document.getElementById('hero-mute-btn');
    if (muteBtn) {
        muteBtn.onclick = () => {
            videoEl.muted = !videoEl.muted;
            updateMuteIcon(videoEl.muted);
        };
    }

    // Fullscreen button listener
    const fullScreenBtn = document.getElementById('hero-fullscreen-btn');
    if (fullScreenBtn) {
        fullScreenBtn.onclick = () => {
            const playerBox = document.getElementById('hero-carousel-player-box');
            if (!document.fullscreenElement) {
                if (playerBox.requestFullscreen) playerBox.requestFullscreen();
                else if (videoEl.requestFullscreen) videoEl.requestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        };
    }

    // Event Listeners for loaded metadata & progress updates
    videoEl.addEventListener('loadedmetadata', () => {
        const timerEl = document.getElementById('hero-video-timer');
        if (timerEl && !isNaN(videoEl.duration)) {
            timerEl.textContent = `0:00 / ${formatTime(videoEl.duration)}`;
        }
    });

    videoEl.addEventListener('timeupdate', () => {
        if (isNaN(videoEl.duration) || !videoEl.duration) return;
        const pct = (videoEl.currentTime / videoEl.duration) * 100;
        const progressBar = document.getElementById('hero-video-progress-bar');
        if (progressBar) progressBar.style.width = `${pct}%`;

        const timerEl = document.getElementById('hero-video-timer');
        if (timerEl) {
            timerEl.textContent = `${formatTime(videoEl.currentTime)} / ${formatTime(videoEl.duration)}`;
        }
    });

    const progressContainer = document.getElementById('hero-video-progress-container');
    if (progressContainer) {
        progressContainer.onclick = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (videoEl.duration) {
                videoEl.currentTime = pos * videoEl.duration;
            }
        };
    }

    videoEl.addEventListener('play', () => {
        const icon = document.getElementById('hero-play-icon');
        if (icon) icon.textContent = 'pause';
    });

    videoEl.addEventListener('pause', () => {
        const icon = document.getElementById('hero-play-icon');
        if (icon) icon.textContent = 'play_arrow';
    });

    // Auto-advance to next video on finish
    videoEl.addEventListener('ended', () => {
        if (currentHeroSettings.loop !== false || currentHeroVideoIdx < currentHeroVideos.length - 1) {
            currentHeroVideoIdx = (currentHeroVideoIdx + 1) % currentHeroVideos.length;
            playCurrentHeroVideo();
        }
    });

    // Handle Video load errors gracefully
    videoEl.addEventListener('error', (e) => {
        console.warn('Hero video player load warning:', e);
        const timerEl = document.getElementById('hero-video-timer');
        if (timerEl) timerEl.textContent = 'Preview';

        if (currentHeroVideos.length > 1) {
            setTimeout(() => {
                currentHeroVideoIdx = (currentHeroVideoIdx + 1) % currentHeroVideos.length;
                playCurrentHeroVideo();
            }, 3000);
        }
    });

    // Start initial playback
    playCurrentHeroVideo();
}

function playCurrentHeroVideo() {
    const videoEl = document.getElementById('hero-active-video-element');
    if (!videoEl || currentHeroVideos.length === 0) return;

    const v = currentHeroVideos[currentHeroVideoIdx];
    const isMobile = window.innerWidth < 768;
    const url = (isMobile && v.mobileVideoUrl) ? v.mobileVideoUrl : v.videoUrl;

    const titleEl = document.getElementById('hero-video-title-text');
    if (titleEl) titleEl.textContent = v.title || `Video #${currentHeroVideoIdx + 1}`;

    if (v.thumbnailUrl) {
        videoEl.poster = v.thumbnailUrl;
    }

    // Update dots indicator
    const dots = document.querySelectorAll('#hero-video-dots-wrapper button');
    dots.forEach((dot, idx) => {
        if (idx === currentHeroVideoIdx) {
            dot.className = 'hero-dot-item w-3 h-3 rounded-full transition-all duration-300 cursor-pointer bg-[#0077B6] scale-125';
        } else {
            dot.className = 'hero-dot-item w-3 h-3 rounded-full transition-all duration-300 cursor-pointer bg-gray-300 hover:bg-gray-400';
        }
    });

    if (videoEl.getAttribute('src') !== url) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        while (videoEl.firstChild) {
            videoEl.removeChild(videoEl.firstChild);
        }
        videoEl.setAttribute('src', url);
        videoEl.load();
    }

    if (currentHeroSettings.autoplay !== false) {
        const promise = videoEl.play();
        if (promise !== undefined) {
            promise.catch((err) => {
                console.warn('Hero video autoplay muted fallback:', err);
                videoEl.muted = true;
                updateMuteIcon(true);
                videoEl.play().catch(() => {});
            });
        }
    }
}

function updateMuteIcon(isMuted) {
    const icon = document.getElementById('hero-mute-icon');
    if (icon) icon.textContent = isMuted ? 'volume_off' : 'volume_up';
}

function formatTime(sec) {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}
