/**
 * OM Mobile Art - Store Settings Controller (settings.js)
 * Manages tabbed configuration forms, Cloudinary uploaders, and legal page editing.
 */

let currentTab = 'general';
let adminSettingsData = null;
let legalPagesList = [];
let activeLegalSlug = 'privacy-policy';
const apiBase = 'http://localhost:3000/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    initSettingsPage();
});

async function getHeaders() {
    let token = localStorage.getItem('om_admin_auth_token');
    if (!token && window.getAuthToken) {
        token = await window.getAuthToken();
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function initSettingsPage() {
    await fetchAdminSettings();
    switchTab('general');
}

async function fetchAdminSettings() {
    try {
        const res = await fetch(`${apiBase}/admin/settings`, { headers: await getHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                adminSettingsData = data.data;
                return;
            }
        }
    } catch (e) {
        console.warn('Could not fetch admin settings from backend:', e);
    }
}

function initUploaderHelpers() {
    if (!window.AdminUploader) return;
    const container = document.getElementById('tab-content-container');
    if (!container) return;

    container.querySelectorAll('input[data-uploader="true"]').forEach(input => {
        if (!input.dataset.uploaderAttached) {
            input.dataset.uploaderAttached = 'true';
            window.AdminUploader.create({
                input: input,
                label: input.dataset.label || 'Image Asset',
                value: input.value,
                folder: 'settings'
            });
        }
    });
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update tab button styles
    const buttons = document.querySelectorAll('#settings-tabs-nav button');
    buttons.forEach(btn => {
        btn.className = btn.id === `tab-btn-${tabName}` ?
            'nav-tab-active px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer' :
            'nav-tab-inactive px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer';
    });

    const canvas = document.getElementById('tab-content-container');

    if (tabName === 'general') renderGeneralTab(canvas);
    else if (tabName === 'branding') renderBrandingTab(canvas);
    else if (tabName === 'social') renderSocialTab(canvas);
    else if (tabName === 'seo') renderSeoTab(canvas);
    else if (tabName === 'legal') renderLegalTab(canvas);
    else if (tabName === 'smtp') renderSmtpTab(canvas);
    else if (tabName === 'features') renderFeaturesTab(canvas);
    else if (tabName === 'maintenance') renderMaintenanceTab(canvas);

    setTimeout(() => initUploaderHelpers(), 50);
}

// 1. General Tab
function renderGeneralTab(canvas) {
    const s = adminSettingsData?.store || {};
    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">General Business Profile</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Store Display Name *</label>
                    <input type="text" id="set-storeName" value="${s.storeName || 'OM Mobile Art'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Store Tagline</label>
                    <input type="text" id="set-storeTagline" value="${s.storeTagline || 'Precision-Fit Vinyl Skins'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Business Description</label>
                <textarea id="set-businessDescription" rows="3" class="w-full p-3 border rounded-xl text-sm">${s.businessDescription || ''}</textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Store Base URL</label>
                    <input type="text" id="set-storeUrl" value="${s.storeUrl || 'http://localhost:8080'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Default Currency Code</label>
                    <input type="text" id="set-currencyCode" value="${s.currencyCode || 'INR'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Currency Symbol</label>
                    <input type="text" id="set-currencySymbol" value="${s.currencySymbol || '₹'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Free Shipping Threshold (₹)</label>
                    <input type="number" id="set-shippingFreeThreshold" value="${s.shippingFreeThreshold || 999}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Flat Rate Shipping Fee (₹)</label>
                    <input type="number" id="set-shippingFlatRate" value="${s.shippingFlatRate || 49}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>
        </div>
    `;
}

// 2. Branding Tab
function renderBrandingTab(canvas) {
    const b = adminSettingsData?.brand || {};
    const primaryLogoUrl = b.primaryLogoUrl || '../../assets/logos/logo.png';
    const faviconUrl = b.faviconUrl || '../../assets/logos/favicon.png';
    const ogImageUrl = b.ogImageUrl || '';
    const placeholderImage = b.placeholderImage || '';

    canvas.innerHTML = `
        <div class="space-y-6 max-w-4xl">
            <div class="pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h3 class="font-extrabold text-base text-[#03045E]">Brand Assets & Logo Synchronization</h3>
                    <p class="text-xs text-gray-500 font-medium mt-0.5">Upload high-resolution logos and favicons. Changes immediately update across Navbar, Footer, Favicon, Page Headers, and Emails.</p>
                </div>
                <span class="px-3 py-1 bg-blue-50 text-[#0077B6] border border-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wider">Single Source of Truth</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Primary Store Logo Card -->
                <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-sm text-[#03045E] flex items-center gap-2">
                                <span class="material-symbols-outlined text-lg text-[#0077B6]">badge</span>
                                Primary Store Logo
                            </h4>
                            <span class="text-[10px] font-bold text-gray-400">Header & Footer</span>
                        </div>
                        <div class="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-center min-h-[120px] mb-3 relative overflow-hidden">
                            <img id="preview-primaryLogoUrl" src="${primaryLogoUrl}" alt="Primary Logo Preview" class="max-h-20 object-contain" onerror="if(window.handleLogoError) window.handleLogoError(this)" />
                        </div>
                        <input type="hidden" id="set-primaryLogoUrl" value="${primaryLogoUrl}" />
                        <input type="hidden" id="set-primaryLogoPublicId" value="${b.primaryLogoPublicId || ''}" />
                        <div id="uploader-primary-logo"></div>
                    </div>
                </div>

                <!-- Favicon Icon Card -->
                <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-sm text-[#03045E] flex items-center gap-2">
                                <span class="material-symbols-outlined text-lg text-[#0077B6]">tab</span>
                                Favicon Icon (.ico / .png)
                            </h4>
                            <span class="text-[10px] font-bold text-gray-400">Browser Tabs</span>
                        </div>
                        <div class="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-center min-h-[120px] mb-3 relative overflow-hidden">
                            <img id="preview-faviconUrl" src="${faviconUrl}" alt="Favicon Preview" class="w-12 h-12 object-contain" onerror="if(window.handleLogoError) window.handleLogoError(this)" />
                        </div>
                        <input type="hidden" id="set-faviconUrl" value="${faviconUrl}" />
                        <input type="hidden" id="set-faviconPublicId" value="${b.faviconPublicId || ''}" />
                        <div id="uploader-favicon"></div>
                    </div>
                </div>

                <!-- Social Sharing OG Image -->
                <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-sm text-[#03045E] flex items-center gap-2">
                                <span class="material-symbols-outlined text-lg text-[#0077B6]">share</span>
                                OpenGraph Share Banner
                            </h4>
                            <span class="text-[10px] font-bold text-gray-400">Social Media Cards</span>
                        </div>
                        <input type="text" id="set-ogImageUrl" data-uploader="true" data-label="OG Share Image" value="${ogImageUrl}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                </div>

                <!-- Default Product Placeholder -->
                <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-sm text-[#03045E] flex items-center gap-2">
                                <span class="material-symbols-outlined text-lg text-[#0077B6]">image</span>
                                Default Product Placeholder
                            </h4>
                            <span class="text-[10px] font-bold text-gray-400">Storefront Fallback</span>
                        </div>
                        <input type="text" id="set-placeholderImage" data-uploader="true" data-label="Placeholder Image" value="${placeholderImage}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Cloudinary Uploaders for Logo & Favicon
    if (window.AdminUploader) {
        window.AdminUploader.create({
            container: 'uploader-primary-logo',
            input: 'set-primaryLogoUrl',
            label: 'Upload / Replace Primary Logo',
            folder: 'branding',
            onChange: (url, publicId) => {
                const urlInp = document.getElementById('set-primaryLogoUrl');
                if (urlInp) urlInp.value = url;
                const pubInp = document.getElementById('set-primaryLogoPublicId');
                if (pubInp && publicId) pubInp.value = publicId;
                const prev = document.getElementById('preview-primaryLogoUrl');
                if (prev) prev.src = url;
            }
        });

        window.AdminUploader.create({
            container: 'uploader-favicon',
            input: 'set-faviconUrl',
            label: 'Upload / Replace Favicon',
            folder: 'branding',
            onChange: (url, publicId) => {
                const urlInp = document.getElementById('set-faviconUrl');
                if (urlInp) urlInp.value = url;
                const pubInp = document.getElementById('set-faviconPublicId');
                if (pubInp && publicId) pubInp.value = publicId;
                const prev = document.getElementById('preview-faviconUrl');
                if (prev) prev.src = url;
            }
        });
    }
}

// 3. Social & Contact Tab
function renderSocialTab(canvas) {
    const c = adminSettingsData?.contact || {};
    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">Contact Information & Social Links</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Support Email *</label>
                    <input type="email" id="set-supportEmail" value="${c.supportEmail || 'ommobileart09@gmail.com'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Support Phone</label>
                    <input type="text" id="set-supportPhone" value="${c.supportPhone || '+91 96386 52327'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">WhatsApp Business Number</label>
                    <input type="text" id="set-whatsappNumber" value="${c.whatsappNumber || '+91 96386 52327'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Customer Support Hours</label>
                    <input type="text" id="set-businessHours" value="${c.businessHours || 'Mon - Sat: 10:00 AM - 7:00 PM IST'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Office / Warehouse Address</label>
                <textarea id="set-officeAddress" rows="2" class="w-full p-3 border rounded-xl text-sm">${c.officeAddress || 'Mumbai, Maharashtra, India'}</textarea>
            </div>
        </div>
    `;
}

// 4. Global SEO Tab
function renderSeoTab(canvas) {
    const seo = adminSettingsData?.seo || {};
    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">Global Search Engine Optimization (SEO)</h3>
            
            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Default Meta Title</label>
                <input type="text" id="set-metaTitle" value="${seo.metaTitle || 'OM Mobile Art | Premium Mobile Skins'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Default Meta Description</label>
                <textarea id="set-metaDescription" rows="3" class="w-full p-3 border rounded-xl text-sm">${seo.metaDescription || 'Shop high-quality 3M vinyl skins for mobile phones, laptops, and tablets.'}</textarea>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Keywords (Comma separated)</label>
                <input type="text" id="set-keywords" value="${seo.keywords || 'mobile skins, laptop skins, vinyl wraps'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
        </div>
    `;
}

// 5. Legal Pages Tab
async function renderLegalTab(canvas) {
    canvas.innerHTML = `<div class="p-8 text-center text-gray-400"><div class="animate-spin w-8 h-8 border-4 border-[#0077B6] border-t-transparent rounded-full mx-auto mb-3"></div>Loading legal pages...</div>`;

    try {
        const res = await fetch(`${apiBase}/legal-pages`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) legalPagesList = data.data || [];
        }
    } catch (e) {}

    const defaultSlugs = [
        { slug: 'privacy-policy', title: 'Privacy Policy' },
        { slug: 'terms-conditions', title: 'Terms & Conditions' },
        { slug: 'refund-policy', title: 'Refund & Return Policy' },
        { slug: 'shipping-policy', title: 'Shipping & Delivery Policy' },
        { slug: 'about-us', title: 'About Us' },
        { slug: 'contact-us', title: 'Contact Us' },
    ];

    const activePage = legalPagesList.find(p => p.slug === activeLegalSlug) || {
        slug: activeLegalSlug,
        title: defaultSlugs.find(s => s.slug === activeLegalSlug)?.title || 'Legal Policy',
        content: `<h2>${activeLegalSlug.replace('-', ' ').toUpperCase()}</h2><p>Legal content details here...</p>`
    };

    canvas.innerHTML = `
        <div class="space-y-6 max-w-4xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">Legal Pages Content Editor</h3>
            
            <div class="flex items-center gap-2 overflow-x-auto pb-2">
                ${defaultSlugs.map(s => `
                    <button onclick="selectLegalPage('${s.slug}')" class="${s.slug === activeLegalSlug ? 'bg-[#03045E] text-white' : 'bg-gray-100 text-gray-700'} px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer">
                        ${s.title}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Page Title *</label>
                        <input type="text" id="lp-title" value="${activePage.title}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">URL Slug</label>
                        <input type="text" id="lp-slug" value="${activePage.slug}" readonly class="w-full px-3 py-2 border rounded-xl text-sm bg-gray-100 cursor-not-allowed" />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Page Content (HTML / Rich Text) *</label>
                    <textarea id="lp-content" rows="12" class="w-full p-4 border rounded-xl font-mono text-xs bg-white focus:outline-none focus:border-[#0077B6]">${activePage.content}</textarea>
                </div>

                <button onclick="saveActiveLegalPage()" class="px-5 py-2.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-xl shadow">Save Policy Page</button>
            </div>
        </div>
    `;
}

function selectLegalPage(slug) {
    activeLegalSlug = slug;
    const canvas = document.getElementById('tab-content-container');
    renderLegalTab(canvas);
}

async function saveActiveLegalPage() {
    const payload = {
        slug: document.getElementById('lp-slug').value,
        title: document.getElementById('lp-title').value.trim(),
        content: document.getElementById('lp-content').value.trim(),
        isPublished: true
    };

    try {
        const res = await fetch(`${apiBase}/admin/legal-pages`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            if (window.showToast) window.showToast('Legal page saved successfully!', 'success');
            const canvas = document.getElementById('tab-content-container');
            renderLegalTab(canvas);
        }
    } catch (e) {
        if (window.showToast) window.showToast('Failed to save legal page.', 'error');
    }
}

// 6. SMTP Email Tab
function renderSmtpTab(canvas) {
    const smtp = adminSettingsData?.smtp || {};
    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">SMTP Email Credentials</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">SMTP Host</label>
                    <input type="text" id="set-smtpHost" value="${smtp.host || 'smtp.mailtrap.io'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">SMTP Port</label>
                    <input type="number" id="set-smtpPort" value="${smtp.port || 587}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Sender Display Name</label>
                    <input type="text" id="set-senderName" value="${smtp.senderName || 'OM Mobile Art'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Sender Email Address</label>
                    <input type="email" id="set-senderEmail" value="${smtp.senderEmail || 'noreply@ommobileart.com'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
            </div>
        </div>
    `;
}

// 7. Feature Toggles Tab
function renderFeaturesTab(canvas) {
    const feats = adminSettingsData?.features || {};
    const featureList = [
        { key: 'announcementBar', name: 'Top Storefront Announcement Bar' },
        { key: 'WISHLIST', name: 'Wishlist Module' },
        { key: 'REVIEWS', name: 'Customer Product Reviews' },
        { key: 'COUPONS', name: 'Discount Coupons System' },
        { key: 'GUEST_CHECKOUT', name: 'Guest Checkout Support' },
        { key: 'CUSTOM_SKIN', name: 'Custom Skin Workshop' },
        { key: 'NEWSLETTER', name: 'Newsletter Subscription' },
        { key: 'SEARCH', name: 'Storefront Search Bar' },
        { key: 'RECENTLY_VIEWED', name: 'Recently Viewed Products' },
    ];

    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">Store Feature Flags & Modules</h3>
            
            <div class="space-y-3 divide-y divide-gray-100">
                ${featureList.map(f => {
                    const isEnabled = feats[f.key] !== false;
                    return `
                        <div class="pt-3 flex items-center justify-between">
                            <div>
                                <h4 class="font-bold text-sm text-gray-800">${f.name}</h4>
                                <p class="text-xs text-gray-400">Key: ${f.key}</p>
                            </div>
                            <input type="checkbox" id="ft-${f.key}" ${isEnabled ? 'checked' : ''} class="w-5 h-5 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6] cursor-pointer" />
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// 8. Maintenance Tab
function renderMaintenanceTab(canvas) {
    const m = adminSettingsData?.maintenance || {};
    canvas.innerHTML = `
        <div class="space-y-6 max-w-3xl">
            <h3 class="font-extrabold text-base text-[#03045E] pb-2 border-b border-gray-100">Maintenance Mode & Security</h3>
            
            <div class="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-sm text-amber-900">Enable Maintenance Mode</h4>
                    <p class="text-xs text-amber-700">Temporarily show maintenance page to storefront visitors.</p>
                </div>
                <input type="checkbox" id="set-maintActive" ${m.isActive ? 'checked' : ''} class="w-6 h-6 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer" />
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Maintenance Notice Message</label>
                <textarea id="set-maintMessage" rows="3" class="w-full p-3 border rounded-xl text-sm">${m.message || "We are currently upgrading our store. We'll be back shortly!"}</textarea>
            </div>
        </div>
    `;
}

// Save Handler for Active Tab
async function saveActiveSettingsTab() {
    let endpoint = '';
    let payload = {};

    if (currentTab === 'general') {
        endpoint = `${apiBase}/admin/settings/store`;
        payload = {
            storeName: document.getElementById('set-storeName').value.trim(),
            storeTagline: document.getElementById('set-storeTagline').value.trim(),
            businessDescription: document.getElementById('set-businessDescription').value.trim(),
            storeUrl: document.getElementById('set-storeUrl').value.trim(),
            currencyCode: document.getElementById('set-currencyCode').value.trim(),
            currencySymbol: document.getElementById('set-currencySymbol').value.trim(),
            shippingFreeThreshold: parseFloat(document.getElementById('set-shippingFreeThreshold').value) || 0,
            shippingFlatRate: parseFloat(document.getElementById('set-shippingFlatRate').value) || 0,
        };
    } else if (currentTab === 'branding') {
        endpoint = `${apiBase}/admin/settings/brand`;
        payload = {
            primaryLogoUrl: document.getElementById('set-primaryLogoUrl').value.trim(),
            primaryLogoPublicId: document.getElementById('set-primaryLogoPublicId')?.value.trim() || null,
            faviconUrl: document.getElementById('set-faviconUrl').value.trim(),
            faviconPublicId: document.getElementById('set-faviconPublicId')?.value.trim() || null,
            ogImageUrl: document.getElementById('set-ogImageUrl')?.value.trim() || null,
            placeholderImage: document.getElementById('set-placeholderImage')?.value.trim() || null,
        };
    } else if (currentTab === 'social') {
        endpoint = `${apiBase}/admin/settings/contact`;
        payload = {
            supportEmail: document.getElementById('set-supportEmail').value.trim(),
            supportPhone: document.getElementById('set-supportPhone').value.trim(),
            whatsappNumber: document.getElementById('set-whatsappNumber').value.trim(),
            businessHours: document.getElementById('set-businessHours').value.trim(),
            officeAddress: document.getElementById('set-officeAddress').value.trim(),
        };
    } else if (currentTab === 'seo') {
        endpoint = `${apiBase}/admin/settings/seo`;
        payload = {
            metaTitle: document.getElementById('set-metaTitle').value.trim(),
            metaDescription: document.getElementById('set-metaDescription').value.trim(),
            keywords: document.getElementById('set-keywords').value.trim(),
        };
    } else if (currentTab === 'smtp') {
        endpoint = `${apiBase}/admin/settings/smtp`;
        payload = {
            host: document.getElementById('set-smtpHost').value.trim(),
            port: parseInt(document.getElementById('set-smtpPort').value) || 587,
            senderName: document.getElementById('set-senderName').value.trim(),
            senderEmail: document.getElementById('set-senderEmail').value.trim(),
        };
    } else if (currentTab === 'features') {
        endpoint = `${apiBase}/admin/settings/features`;
        const toggles = {};
        ['announcementBar', 'WISHLIST', 'REVIEWS', 'COUPONS', 'GUEST_CHECKOUT', 'CUSTOM_SKIN', 'NEWSLETTER', 'SEARCH', 'RECENTLY_VIEWED'].forEach(key => {
            const el = document.getElementById(`ft-${key}`);
            if (el) toggles[key] = el.checked;
        });
        payload = { toggles };
    } else if (currentTab === 'maintenance') {
        endpoint = `${apiBase}/admin/settings/maintenance`;
        payload = {
            isActive: document.getElementById('set-maintActive').checked,
            message: document.getElementById('set-maintMessage').value.trim(),
        };
    }

    if (!endpoint) return;

    try {
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            sessionStorage.removeItem('om_settings_cache');
            localStorage.setItem('om_settings_timestamp', Date.now().toString());
            try {
                if ('BroadcastChannel' in window) {
                    const syncChannel = new BroadcastChannel('om_store_sync');
                    syncChannel.postMessage({ type: 'SETTINGS_UPDATED', timestamp: Date.now() });
                }
            } catch (e) {}
            window.dispatchEvent(new Event('settings-updated'));
            if (window.SettingsManager) {
                await window.SettingsManager.loadSettings(true);
            }
            if (window.showToast) window.showToast('Settings saved successfully!', 'success');
            await fetchAdminSettings();
        }
    } catch (e) {
        if (window.showToast) window.showToast('Failed to save settings.', 'error');
    }
}
