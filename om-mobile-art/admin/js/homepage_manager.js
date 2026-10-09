/**
 * OM Mobile Art - Homepage CMS controller (homepage_manager.js)
 * Production-ready CMS manager for 10 independent homepage section types.
 */

let homepageSections = [];
let activeSection = null;
const apiBase = 'http://localhost:3000/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    initHomepageManager();
});

function isTokenExpired(token) {
    if (!token || typeof token !== 'string') return true;
    if (token.startsWith('mock_') || token.startsWith('demo_') || token === 'admin_token') return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload.exp) return false;
        return (payload.exp * 1000) < (Date.now() + 30000);
    } catch (e) {
        return true;
    }
}

async function getHeaders(forceRefresh = false) {
    let token = localStorage.getItem('om_admin_auth_token');
    if ((!token || forceRefresh) && window.getAuthToken) {
        token = await window.getAuthToken(forceRefresh);
    }
    if (!token) {
        token = 'mock_admin_token_' + Date.now();
        localStorage.setItem('om_admin_auth_token', token);
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function fetchWithAuthRetry(url, options = {}) {
    options.headers = options.headers || await getHeaders();
    let res = await fetch(url, options);
    if ((res.status === 401 || res.status === 403) && !options._isRetry) {
        options._isRetry = true;
        options.headers = await getHeaders(true);
        res = await fetch(url, options);
    }
    return res;
}

async function initHomepageManager() {
    await fetchSections();
}

function initFileUploadHelper() {
    if (!window.AdminUploader) return;
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    const inputs = editorBody.querySelectorAll('input[data-uploader="true"]');
    inputs.forEach(input => {
        if (!input.dataset.uploaderAttached) {
            input.dataset.uploaderAttached = 'true';
            window.AdminUploader.create({
                input: input,
                label: input.dataset.label || 'Image',
                value: input.value,
                folder: 'homepage'
            });
        }
    });
}

async function fetchSections() {
    const container = document.getElementById('layout-sections-list');
    try {
        const res = await fetchWithAuthRetry(`${apiBase}/homepage/sections`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            homepageSections = data.data;
            renderSectionsList();
            if (homepageSections.length > 0 && !activeSection) {
                editSectionContent(homepageSections[0].id);
            }
            return;
        }
    } catch (err) {
        console.error('Error fetching homepage sections:', err);
        if (window.showToast) window.showToast('Failed to load sections from backend.', 'error');
        container.innerHTML = `<div class="p-6 text-center text-red-500 font-semibold">Could not connect to backend server. Please verify the service is active.</div>`;
    }
}

function renderSectionsList() {
    const container = document.getElementById('layout-sections-list');
    document.getElementById('sections-count').textContent = `${homepageSections.length} Sections`;

    if (homepageSections.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-gray-500">No sections found in database.</div>';
        return;
    }

    container.innerHTML = homepageSections.map((sec, index) => {
        const isEditing = activeSection && activeSection.id === sec.id;
        const activeClass = isEditing ? 'bg-[#CAF0F8]/40 border-l-4 border-l-[#03045E]' : 'hover:bg-gray-50';

        return `
            <div class="p-4 flex items-center justify-between transition-all duration-150 ${activeClass}">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-1">
                        <button onclick="moveSection(${index}, -1)" ${index === 0 ? 'disabled class="text-gray-200 cursor-not-allowed"' : 'class="text-gray-400 hover:text-[#03045E]"'}>
                            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
                        </button>
                        <button onclick="moveSection(${index}, 1)" ${index === homepageSections.length - 1 ? 'disabled class="text-gray-200 cursor-not-allowed"' : 'class="text-gray-400 hover:text-[#03045E]"'}>
                            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
                        </button>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-gray-800">${sec.displayName}</h3>
                        <p class="text-xs text-gray-400 mt-0.5">Key: ${sec.sectionKey} • Position: ${sec.position}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center">
                        <input type="checkbox" id="toggle-${sec.id}" ${sec.isActive ? 'checked' : ''} onchange="toggleSectionActive('${sec.id}', this.checked)" class="sr-only switch-checkbox">
                        <label for="toggle-${sec.id}" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>
                    
                    <button onclick="editSectionContent('${sec.id}')" class="px-3 py-1.5 border border-gray-300 hover:border-[#03045E] hover:text-[#03045E] rounded text-xs font-semibold bg-white transition-all">
                        Edit
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function moveSection(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= homepageSections.length) return;

    const temp = homepageSections[index];
    homepageSections[index] = homepageSections[targetIdx];
    homepageSections[targetIdx] = temp;

    homepageSections.forEach((sec, idx) => {
        sec.position = idx + 1;
    });

    renderSectionsList();
    if (window.showToast) window.showToast('Order adjusted locally. Click "Save Layout Order" to persist to DB.', 'info');
}

async function toggleSectionActive(id, isActive) {
    try {
        const sec = homepageSections.find(s => s.id === id);
        if (sec) sec.isActive = isActive;

        const res = await fetch(`${apiBase}/homepage/sections/${id}`, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify({ isActive })
        });
        if (res.ok) {
            if (window.showToast) window.showToast('Section visibility updated!', 'success');
            renderSectionsList();
        }
    } catch (err) {
        if (window.showToast) window.showToast('Failed to update section visibility.', 'error');
    }
}

async function saveAllLayoutChanges() {
    const orderedIds = homepageSections.map(s => s.id);
    try {
        const res = await fetch(`${apiBase}/homepage/sections/reorder`, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify({ orderedIds })
        });
        if (res.ok) {
            if (window.showToast) window.showToast('Layout order saved successfully!', 'success');
            await fetchSections();
        }
    } catch (err) {
        if (window.showToast) window.showToast('Failed to save layout order.', 'error');
    }
}

async function editSectionContent(id) {
    activeSection = homepageSections.find(s => s.id === id);
    renderSectionsList();

    const headingEl = document.getElementById('editor-heading');
    const bodyEl = document.getElementById('editor-body');

    if (headingEl) headingEl.textContent = `Configure Section: ${activeSection.displayName}`;

    bodyEl.innerHTML = `<div class="p-8 text-center text-gray-400"><div class="animate-spin w-8 h-8 border-4 border-[#0077B6] border-t-transparent rounded-full mx-auto mb-3"></div>Loading editor...</div>`;

    let html = '';
    const key = activeSection.sectionKey;

    if (key === 'hero') {
        html = await renderHeroEditor();
    } else if (key === 'announcement_bar') {
        html = await renderAnnouncementEditor();
    } else if (['trending', 'best_sellers', 'new_arrivals'].includes(key)) {
        html = await renderProductsEditor();
    } else if (key === 'promo_cards') {
        html = await renderPromoCardsEditor();
    } else if (key === 'categories') {
        html = await renderCategoriesEditor();
    } else if (key === 'brands') {
        html = await renderBrandsEditor();
    } else if (key === 'testimonials') {
        html = await renderTestimonialsEditor();
    } else if (key === 'why_choose_us') {
        html = await renderWhyChooseUsEditor();
    } else if (key === 'newsletter') {
        html = await renderNewsletterEditor();
    } else if (key === 'faq') {
        html = await renderFAQEditor();
    } else {
        html = renderVisualFallbackEditor();
    }

    bodyEl.innerHTML = html;
    setTimeout(() => initFileUploadHelper(), 50);
}

// ── Hero Section (Video Slider) Editor ──
let loadedHeroVideos = [];
let loadedHeroSettings = {
    isEnabled: true,
    autoplay: true,
    autoplayDelay: 5,
    showControls: true,
    showDots: true,
    showNavigationArrows: true,
    loop: true,
    showProgressBar: true,
    muteByDefault: true
};

async function renderHeroEditor() {
    try {
        const res = await fetchWithAuthRetry(`${apiBase}/homepage/admin/hero-videos`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
                loadedHeroVideos = data.data.videos || [];
                loadedHeroSettings = { ...loadedHeroSettings, ...(data.data.settings || {}) };
            }
        }
    } catch (e) {
        console.warn('Could not fetch hero videos:', e);
    }

    const st = loadedHeroSettings;

    return `
        <div class="space-y-6">
            <!-- Header & Save Button -->
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base uppercase tracking-wider">Storefront Hero (Video Slider) Configuration</h4>
                    <p class="text-xs text-gray-500 mt-1">Upload and manage videos for the homepage hero slider.</p>
                </div>
                <button id="save-hero-video-config-btn" onclick="saveHeroVideoSliderConfiguration()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Configuration
                </button>
            </div>

            <!-- SLIDER SETTINGS CARD -->
            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider flex items-center gap-2">
                    <span class="material-symbols-outlined text-base">tune</span> Slider Settings
                </h5>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <!-- Enable Section -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Enable Section</span>
                        <input type="checkbox" id="vsetting-isEnabled" ${st.isEnabled ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-isEnabled" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Autoplay -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Autoplay</span>
                        <input type="checkbox" id="vsetting-autoplay" ${st.autoplay ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-autoplay" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Autoplay Delay -->
                    <div class="p-3 bg-white rounded-xl border border-gray-200">
                        <label class="block text-xs font-bold text-gray-800 mb-1">Autoplay Delay (sec)</label>
                        <input type="number" id="vsetting-autoplayDelay" value="${st.autoplayDelay || 5}" min="1" max="60" class="w-full px-3 py-1 border rounded-lg text-xs font-bold text-gray-800" />
                    </div>

                    <!-- Show Controls -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Show Controls</span>
                        <input type="checkbox" id="vsetting-showControls" ${st.showControls ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-showControls" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Show Dots -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Show Dots</span>
                        <input type="checkbox" id="vsetting-showDots" ${st.showDots ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-showDots" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Show Navigation Arrows -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Show Navigation Arrows</span>
                        <input type="checkbox" id="vsetting-showNavigationArrows" ${st.showNavigationArrows ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-showNavigationArrows" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Loop -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Loop</span>
                        <input type="checkbox" id="vsetting-loop" ${st.loop ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-loop" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Show Progress Bar -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Show Progress Bar</span>
                        <input type="checkbox" id="vsetting-showProgressBar" ${st.showProgressBar ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-showProgressBar" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <!-- Mute By Default -->
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                        <span class="text-xs font-bold text-gray-800">Mute By Default</span>
                        <input type="checkbox" id="vsetting-muteByDefault" ${st.muteByDefault ? 'checked' : ''} class="sr-only switch-checkbox">
                        <label for="vsetting-muteByDefault" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- VIDEOS SECTION -->
            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider flex items-center gap-2">
                        <span class="material-symbols-outlined text-base">video_library</span> Videos
                    </h5>
                    <button onclick="addNewHeroVideoCard()" class="px-3.5 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Video
                    </button>
                </div>

                <div id="hero-videos-list-container" class="space-y-4">
                    ${renderHeroVideosListHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderHeroVideosListHTML() {
    if (loadedHeroVideos.length === 0) {
        return `
            <div class="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
                <span class="material-symbols-outlined text-4xl mb-1 text-gray-300">videocam_off</span>
                <p class="text-xs font-bold text-gray-600">No hero videos added yet.</p>
                <p class="text-[11px] text-gray-400 mt-1">Click "+ Add Video" above to upload your first MP4 or WebM video slider card.</p>
            </div>
        `;
    }

    return loadedHeroVideos.map((video, idx) => `
        <div class="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4 relative group" id="hero-vcard-${video.id || 'new-' + idx}">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                        <button onclick="moveHeroVideo(${idx}, -1)" ${idx === 0 ? 'disabled class="text-gray-200 cursor-not-allowed"' : 'class="text-gray-400 hover:text-[#03045E]"'}>
                            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                        </button>
                        <button onclick="moveHeroVideo(${idx}, 1)" ${idx === loadedHeroVideos.length - 1 ? 'disabled class="text-gray-200 cursor-not-allowed"' : 'class="text-gray-400 hover:text-[#03045E]"'}>
                            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                        </button>
                    </div>
                    <span class="font-extrabold text-xs text-[#03045E]">Video #${idx + 1}</span>
                </div>

                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-600">Active</span>
                        <input type="checkbox" id="hvideo-active-${idx}" ${video.isActive !== false ? 'checked' : ''} onchange="loadedHeroVideos[${idx}].isActive = this.checked" class="sr-only switch-checkbox">
                        <label for="hvideo-active-${idx}" class="w-9 h-5 bg-gray-300 rounded-full flex items-center p-0.5 cursor-pointer switch-label duration-300">
                            <span class="w-4 h-4 bg-white rounded-full shadow-md switch-dot duration-300 transform"></span>
                        </label>
                    </div>

                    <button onclick="deleteHeroVideoCard('${video.id}', ${idx})" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete Video">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>

            <!-- Fields Grid -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <!-- Video Preview Box (4 cols) -->
                <div class="md:col-span-4 bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
                    ${video.videoUrl ? `
                        <video src="${video.videoUrl}" controls class="w-full h-full object-cover"></video>
                    ` : `
                        <div class="text-center text-gray-400 p-4">
                            <span class="material-symbols-outlined text-3xl mb-1">movie</span>
                            <p class="text-[11px] font-medium">Video Preview</p>
                        </div>
                    `}
                </div>

                <!-- Inputs (8 cols) -->
                <div class="md:col-span-8 space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Video Title *</label>
                        <input type="text" value="${video.title || ''}" onchange="loadedHeroVideos[${idx}].title = this.value" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" placeholder="e.g. Premium Leather Skin" />
                    </div>

                    <!-- Desktop Video Upload / URL -->
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Desktop Video (.mp4, .webm, max 50MB) *</label>
                        <div class="flex items-center gap-2">
                            <input type="text" id="hvideo-desktourl-${idx}" value="${video.videoUrl || ''}" onchange="loadedHeroVideos[${idx}].videoUrl = this.value" class="flex-grow px-3.5 py-2 border rounded-xl text-xs font-medium text-gray-700" placeholder="https://res.cloudinary.com/... or upload" />
                            <label class="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs font-bold text-gray-700 rounded-xl cursor-pointer flex items-center gap-1 flex-shrink-0">
                                <span class="material-symbols-outlined text-[16px]">upload_file</span> Upload
                                <input type="file" accept="video/mp4,video/webm" class="hidden" onchange="uploadHeroVideoFile(this, ${idx}, 'desktop')" />
                            </label>
                        </div>
                    </div>

                    <!-- Mobile Video Upload / URL -->
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Mobile Video (Optional)</label>
                        <div class="flex items-center gap-2">
                            <input type="text" id="hvideo-mobileurl-${idx}" value="${video.mobileVideoUrl || ''}" onchange="loadedHeroVideos[${idx}].mobileVideoUrl = this.value" class="flex-grow px-3.5 py-2 border rounded-xl text-xs font-medium text-gray-700" placeholder="Optional mobile-optimized video URL" />
                            <label class="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs font-bold text-gray-700 rounded-xl cursor-pointer flex items-center gap-1 flex-shrink-0">
                                <span class="material-symbols-outlined text-[16px]">smartphone</span> Upload
                                <input type="file" accept="video/mp4,video/webm" class="hidden" onchange="uploadHeroVideoFile(this, ${idx}, 'mobile')" />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function addNewHeroVideoCard() {
    loadedHeroVideos.push({
        id: '',
        title: `Hero Video #${loadedHeroVideos.length + 1}`,
        videoUrl: '',
        mobileVideoUrl: '',
        thumbnailUrl: '',
        orderIndex: loadedHeroVideos.length,
        isActive: true
    });
    const container = document.getElementById('hero-videos-list-container');
    if (container) container.innerHTML = renderHeroVideosListHTML();
}

function moveHeroVideo(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= loadedHeroVideos.length) return;
    const temp = loadedHeroVideos[index];
    loadedHeroVideos[index] = loadedHeroVideos[target];
    loadedHeroVideos[target] = temp;
    loadedHeroVideos.forEach((v, i) => v.orderIndex = i);

    const container = document.getElementById('hero-videos-list-container');
    if (container) container.innerHTML = renderHeroVideosListHTML();
}

async function deleteHeroVideoCard(id, index) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    if (id) {
        try {
            const res = await fetchWithAuthRetry(`${apiBase}/homepage/hero-videos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (window.showToast) window.showToast('Hero video deleted successfully', 'success');
            }
        } catch (e) {
            console.error('Error deleting video:', e);
        }
    }
    loadedHeroVideos.splice(index, 1);
    loadedHeroVideos.forEach((v, i) => v.orderIndex = i);
    const container = document.getElementById('hero-videos-list-container');
    if (container) container.innerHTML = renderHeroVideosListHTML();
}

async function uploadHeroVideoFile(inputEl, index, targetType) {
    const file = inputEl.files?.[0];
    if (!file) return;

    // Validate video file extension & size (50MB limit)
    const allowed = ['video/mp4', 'video/webm'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.mp4') && !file.name.endsWith('.webm')) {
        if (window.showToast) window.showToast('Invalid file format. Please upload an MP4 or WebM video.', 'error');
        return;
    }
    const maxBytes = 50 * 1024 * 1024; // 50MB
    if (file.size > maxBytes) {
        if (window.showToast) window.showToast('File size exceeds the 50MB limit.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'homepage/videos');

    try {
        if (window.showToast) window.showToast(`Uploading ${file.name}... Please wait.`, 'info');
        const res = await fetchWithAuthRetry(`${apiBase}/media/upload`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': (await getHeaders()).Authorization }
        });
        const data = await res.json();
        if (res.ok && data.success && data.data?.url) {
            const videoUrl = data.data.url;
            if (targetType === 'desktop') {
                loadedHeroVideos[index].videoUrl = videoUrl;
            } else {
                loadedHeroVideos[index].mobileVideoUrl = videoUrl;
            }
            if (window.showToast) window.showToast('Video uploaded successfully!', 'success');
            const container = document.getElementById('hero-videos-list-container');
            if (container) container.innerHTML = renderHeroVideosListHTML();
        } else {
            throw new Error(data.message || data.error || 'Upload failed');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`Video upload failed: ${err.message}`, 'error');
    }
}

async function saveHeroVideoSliderConfiguration() {
    const saveBtn = document.getElementById('save-hero-video-config-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">sync</span> Saving...`;
    }

    try {
        // 1. Gather Slider Settings
        const settingsPayload = {
            isEnabled: document.getElementById('vsetting-isEnabled')?.checked ?? true,
            autoplay: document.getElementById('vsetting-autoplay')?.checked ?? true,
            autoplayDelay: parseInt(document.getElementById('vsetting-autoplayDelay')?.value || '5', 10),
            showControls: document.getElementById('vsetting-[#0077B6]') ? true : (document.getElementById('vsetting-showControls')?.checked ?? true),
            showDots: document.getElementById('vsetting-showDots')?.checked ?? true,
            showNavigationArrows: document.getElementById('vsetting-showNavigationArrows')?.checked ?? true,
            loop: document.getElementById('vsetting-loop')?.checked ?? true,
            showProgressBar: document.getElementById('vsetting-showProgressBar')?.checked ?? true,
            muteByDefault: document.getElementById('vsetting-muteByDefault')?.checked ?? true
        };

        // 2. Validate Videos
        const activeCount = loadedHeroVideos.filter(v => v.isActive !== false).length;
        if (settingsPayload.isEnabled && loadedHeroVideos.length === 0) {
            throw new Error('At least ONE video must exist when Hero Slider is enabled.');
        }

        for (let i = 0; i < loadedHeroVideos.length; i++) {
            const v = loadedHeroVideos[i];
            if (!v.title || !v.title.trim()) {
                throw new Error(`Video #${i + 1} requires a Title.`);
            }
            if (!v.videoUrl || !v.videoUrl.trim()) {
                throw new Error(`Video #${i + 1} ("${v.title}") requires a Desktop Video URL.`);
            }
        }

        // 3. Save Slider Settings
        await fetchWithAuthRetry(`${apiBase}/homepage/hero-slider/settings`, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify(settingsPayload)
        });

        // 4. Save/Update Videos
        for (let i = 0; i < loadedHeroVideos.length; i++) {
            const v = loadedHeroVideos[i];
            const payload = {
                title: v.title.trim(),
                videoUrl: v.videoUrl.trim(),
                mobileVideoUrl: v.mobileVideoUrl ? v.mobileVideoUrl.trim() : null,
                orderIndex: i,
                isActive: v.isActive !== false
            };

            if (v.id) {
                await fetchWithAuthRetry(`${apiBase}/homepage/hero-videos/${v.id}`, {
                    method: 'PUT',
                    headers: await getHeaders(),
                    body: JSON.stringify(payload)
                });
            } else {
                const res = await fetchWithAuthRetry(`${apiBase}/homepage/hero-videos`, {
                    method: 'POST',
                    headers: await getHeaders(),
                    body: JSON.stringify(payload)
                });
                const d = await res.json();
                if (d.success && d.data) {
                    v.id = d.data.id;
                }
            }
        }

        // 5. Update Hero Section active state
        if (activeSection) {
            await fetchWithAuthRetry(`${apiBase}/homepage/sections/${activeSection.id}`, {
                method: 'PUT',
                headers: await getHeaders(),
                body: JSON.stringify({ isActive: settingsPayload.isEnabled })
            });
        }

        if (window.showToast) window.showToast('Hero Video Slider configuration saved successfully!', 'success');
        fetchSections();
    } catch (err) {
        if (window.showToast) window.showToast(`Save failed: ${err.message}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">save</span> Save Configuration`;
        }
    }
}

async function showBannerModal(banner = null) {
    const isEdit = !!banner;
    const modalHtml = `
        <div id="banner-modal" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h3 class="font-extrabold text-lg text-[#03045E]">${isEdit ? 'Edit Hero Banner' : 'Create Hero Banner'}</h3>
                
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Banner Title *</label>
                        <input type="text" id="bm-title" value="${banner?.title || ''}" class="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Protect Your Device" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Subtitle</label>
                        <input type="text" id="bm-subtitle" value="${banner?.subtitle || ''}" class="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Premium precision-cut vinyl skins" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Desktop Image URL *</label>
                        <input type="text" id="bm-imageUrl" data-uploader="true" data-label="Desktop Image" value="${banner?.imageUrl || ''}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Mobile Image URL</label>
                        <input type="text" id="bm-mobileImageUrl" data-uploader="true" data-label="Mobile Image" value="${banner?.mobileImageUrl || ''}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">CTA Button Text</label>
                            <input type="text" id="bm-ctaText" value="${banner?.ctaText || 'Shop Now'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">CTA Button Link</label>
                            <input type="text" id="bm-linkUrl" value="${banner?.linkUrl || '/shop/pages/shop.html'}" class="w-full px-3 py-2 border rounded-xl text-sm" />
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <button onclick="document.getElementById('banner-modal').remove()" class="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900">Cancel</button>
                    <button onclick="saveBanner('${banner?.id || ''}')" class="px-5 py-2 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-xl shadow">Save Banner</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
        const modal = document.getElementById('banner-modal');
        if (modal && window.AdminUploader) {
            modal.querySelectorAll('input[data-uploader="true"]').forEach(inp => {
                window.AdminUploader.create({ input: inp, label: inp.dataset.label, value: inp.value, folder: 'homepage' });
            });
        }
    }, 50);
}

function editBanner(banner) {
    showBannerModal(banner);
}

async function saveBanner(id) {
    const payload = {
        title: document.getElementById('bm-title').value.trim(),
        subtitle: document.getElementById('bm-subtitle').value.trim() || null,
        imageUrl: document.getElementById('bm-imageUrl').value.trim(),
        mobileImageUrl: document.getElementById('bm-mobileImageUrl').value.trim() || null,
        ctaText: document.getElementById('bm-ctaText').value.trim() || null,
        linkUrl: document.getElementById('bm-linkUrl').value.trim() || null,
    };

    if (!payload.title || !payload.imageUrl) {
        if (window.showToast) window.showToast('Title and Desktop Image URL are required', 'error');
        return;
    }

    try {
        const url = id ? `${apiBase}/homepage/banners/${id}` : `${apiBase}/homepage/banners`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: await getHeaders(), body: JSON.stringify(payload) });
        if (res.ok) {
            document.getElementById('banner-modal').remove();
            if (window.showToast) window.showToast('Hero banner saved!', 'success');
            editSectionContent(activeSection.id);
        }
    } catch (e) {
        if (window.showToast) window.showToast('Failed to save hero banner.', 'error');
    }
}

async function deleteBanner(id) {
    if (!confirm('Are you sure you want to delete this hero banner?')) return;
    try {
        const res = await fetch(`${apiBase}/homepage/banners/${id}`, { method: 'DELETE', headers: await getHeaders() });
        if (res.ok) {
            if (window.showToast) window.showToast('Banner deleted!', 'success');
            editSectionContent(activeSection.id);
        }
    } catch (e) {}
}

// ── Announcement Bar Editor ──
async function renderAnnouncementEditor() {
    let ann = {};
    try {
        const res = await fetch(`${apiBase}/homepage/announcement`, { headers: await getHeaders() });
        const data = await res.json();
        if (data.success && data.data) ann = data.data;
    } catch (e) {}

    const isEnabled = ann.enabled !== undefined ? Boolean(ann.enabled) : true;

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Global Storefront Announcement Bar</h4>
                    <p class="text-xs text-gray-500">Single source of truth for announcement bar across all storefront pages.</p>
                </div>
                <button onclick="saveAnnouncementBar()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Announcement Bar
                </button>
            </div>
            
            <div class="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div class="flex items-center justify-between pb-3 border-b border-gray-200">
                    <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input type="checkbox" id="ab-enabled" ${isEnabled ? 'checked' : ''} class="w-4 h-4 text-[#0077B6] rounded" /> Enable Announcement Bar Across Website
                    </label>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">MySQL Live Sync</span>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Announcement Text *</label>
                    <input type="text" id="ab-text" value="${ann.text || '⚡ FREE SHIPPING ON ALL INDIA ORDERS OVER ₹999! USE CODE: WELCOME10'}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Material Symbol Icon</label>
                        <select id="ab-icon" class="w-full px-3.5 py-2 border rounded-xl text-sm bg-white font-medium text-gray-800">
                            <option value="campaign" ${ann.icon === 'campaign' ? 'selected' : ''}>Campaign Megaphone (campaign)</option>
                            <option value="local_shipping" ${ann.icon === 'local_shipping' ? 'selected' : ''}>Free Shipping Truck (local_shipping)</option>
                            <option value="local_offer" ${ann.icon === 'local_offer' ? 'selected' : ''}>Offer Tag (local_offer)</option>
                            <option value="star" ${ann.icon === 'star' ? 'selected' : ''}>Star (star)</option>
                            <option value="bolt" ${ann.icon === 'bolt' ? 'selected' : ''}>Lightning Bolt (bolt)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Destination Link URL</label>
                        <input type="text" id="ab-linkUrl" value="${ann.linkUrl || '/shop/pages/shop.html'}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Background Color</label>
                        <input type="color" id="ab-bgColor" value="${ann.bgColor || '#03045E'}" class="w-full h-10 p-1 border rounded-xl cursor-pointer" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Text Color</label>
                        <input type="color" id="ab-textColor" value="${ann.textColor || '#FFFFFF'}" class="w-full h-10 p-1 border rounded-xl cursor-pointer" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                    <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input type="checkbox" id="ab-isScrolling" ${ann.isScrolling ? 'checked' : ''} class="w-4 h-4 text-[#0077B6] rounded" /> Scrolling Marquee
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input type="checkbox" id="ab-closeButton" ${ann.closeButton ? 'checked' : ''} class="w-4 h-4 text-[#0077B6] rounded" /> Enable Dismiss Button
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input type="checkbox" id="ab-sticky" ${ann.sticky ? 'checked' : ''} class="w-4 h-4 text-[#0077B6] rounded" /> Sticky at Top
                    </label>
                </div>
            </div>
        </div>
    `;
}

async function saveAnnouncementBar() {
    const payload = {
        enabled: document.getElementById('ab-enabled').checked,
        text: document.getElementById('ab-text').value.trim(),
        bgColor: document.getElementById('ab-bgColor').value,
        textColor: document.getElementById('ab-textColor').value,
        linkUrl: document.getElementById('ab-linkUrl').value.trim() || null,
        isScrolling: document.getElementById('ab-isScrolling').checked,
        icon: document.getElementById('ab-icon').value,
        closeButton: document.getElementById('ab-closeButton').checked,
        sticky: document.getElementById('ab-sticky').checked
    };

    try {
        const res = await fetch(`${apiBase}/homepage/announcement`, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            sessionStorage.removeItem('om_settings_cache');
            sessionStorage.removeItem('om_announcement_dismissed');
            if (window.showToast) window.showToast('Announcement Bar configuration saved to MySQL!', 'success');
            editSectionContent(activeSection.id);
        } else {
            throw new Error(data.message || 'Failed to save announcement');
        }
    } catch (e) {
        if (window.showToast) window.showToast(`Error: ${e.message}`, 'error');
    }
}

// ── Generic Helper to Save Section Settings ──
async function saveSectionSettings(updatedSettings, successMsg = 'Section updated successfully!') {
    if (!activeSection) return;
    try {
        const res = await fetch(`${apiBase}/homepage/sections/${activeSection.id}`, {
            method: 'PUT',
            headers: await getHeaders(),
            body: JSON.stringify({ settings: updatedSettings })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (window.showToast) window.showToast(successMsg, 'success');
            activeSection.settings = updatedSettings;
            fetchSections();
        } else {
            throw new Error(data.message || 'Failed to save section');
        }
    } catch (e) {
        if (window.showToast) window.showToast(`Error: ${e.message}`, 'error');
    }
}

// ── 1. Shop by Category Visual Editor ──
async function renderCategoriesEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Shop By Category';
    const subtitle = s.subtitle || 'Explore precision vinyl skins for all your devices';
    let categories = Array.isArray(s.featuredCategories) ? s.featuredCategories : [
        { name: 'Camera', displayName: 'Camera', productCount: 128, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera', isFeatured: true },
        { name: 'Camera Lens', displayName: 'Camera Lens', productCount: 54, image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Camera%20Lens', isFeatured: true },
        { name: 'Mobile', displayName: 'Mobile', productCount: 312, image: 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Mobile', isFeatured: false },
        { name: 'Laptop', displayName: 'Laptop', productCount: 86, image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop', link: 'shop.html?category=Laptop', isFeatured: false }
    ];

    window._tempCategoriesList = JSON.parse(JSON.stringify(categories));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Shop By Category Configuration</h4>
                    <p class="text-xs text-gray-500">Manage category showcase title, subtitle, images, and links.</p>
                </div>
                <button onclick="saveCategoriesSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Categories
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="cat-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="cat-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Category Showcase Cards</h5>
                    <button onclick="addCategoryCardItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Category Card
                    </button>
                </div>

                <div id="category-cards-container" class="space-y-4">
                    ${renderCategoryCardsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderCategoryCardsHTML() {
    const list = window._tempCategoriesList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No category cards added. Click "Add Category Card" to begin.</div>';

    return list.map((cat, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> Category Card #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="moveCategoryCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="moveCategoryCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removeCategoryCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Display Name *</label>
                    <input type="text" value="${cat.displayName || cat.name || ''}" onchange="window._tempCategoriesList[${idx}].displayName = this.value; window._tempCategoriesList[${idx}].name = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Destination Link *</label>
                    <input type="text" value="${cat.link || 'shop.html'}" onchange="window._tempCategoriesList[${idx}].link = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Product Count Badge</label>
                    <input type="number" value="${cat.productCount || 0}" onchange="window._tempCategoriesList[${idx}].productCount = parseInt(this.value) || 0;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Category Image URL *</label>
                <input type="text" data-uploader="true" data-label="Category Image" value="${cat.image || ''}" id="cat-img-${idx}" onchange="window._tempCategoriesList[${idx}].image = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
            </div>
        </div>
    `).join('');
}

function addCategoryCardItem() {
    window._tempCategoriesList = window._tempCategoriesList || [];
    window._tempCategoriesList.push({ name: 'New Category', displayName: 'New Category', productCount: 0, image: '', link: 'shop.html' });
    const container = document.getElementById('category-cards-container');
    if (container) container.innerHTML = renderCategoryCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

function removeCategoryCard(idx) {
    if (window._tempCategoriesList && window._tempCategoriesList[idx]) {
        window._tempCategoriesList.splice(idx, 1);
        const container = document.getElementById('category-cards-container');
        if (container) container.innerHTML = renderCategoryCardsHTML();
        setTimeout(() => initFileUploadHelper(), 50);
    }
}

function moveCategoryCard(idx, delta) {
    const list = window._tempCategoriesList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('category-cards-container');
    if (container) container.innerHTML = renderCategoryCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

async function saveCategoriesSection() {
    const title = document.getElementById('cat-title').value.trim();
    const subtitle = document.getElementById('cat-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        featuredCategories: window._tempCategoriesList || []
    };
    await saveSectionSettings(updatedSettings, 'Shop By Category section updated!');
}

// ── 2. Browse by Brand Visual Editor ──
async function renderBrandsEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Browse By Brand';
    const subtitle = s.subtitle || 'Official precision fits engineered for top device manufacturers';
    let brands = Array.isArray(s.featuredBrands) ? s.featuredBrands : [
        { name: 'Apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', linkUrl: 'shop.html?brand=Apple' },
        { name: 'Samsung', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg', linkUrl: 'shop.html?brand=Samsung' },
        { name: 'OnePlus', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/OnePlus_logo.svg', linkUrl: 'shop.html?brand=OnePlus' }
    ];

    window._tempBrandsList = JSON.parse(JSON.stringify(brands));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Browse By Brand Configuration</h4>
                    <p class="text-xs text-gray-500">Manage brand showcase title, logos, and manufacturer links.</p>
                </div>
                <button onclick="saveBrandsSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Brands
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="brand-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="brand-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Brand Items</h5>
                    <button onclick="addBrandCardItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Brand
                    </button>
                </div>

                <div id="brand-cards-container" class="space-y-4">
                    ${renderBrandCardsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderBrandCardsHTML() {
    const list = window._tempBrandsList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No brands added. Click "Add Brand" to begin.</div>';

    return list.map((b, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> Brand #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="moveBrandCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="moveBrandCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removeBrandCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Brand Name *</label>
                    <input type="text" value="${b.name || ''}" onchange="window._tempBrandsList[${idx}].name = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Destination Link *</label>
                    <input type="text" value="${b.linkUrl || 'shop.html'}" onchange="window._tempBrandsList[${idx}].linkUrl = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Logo Image URL *</label>
                <input type="text" data-uploader="true" data-label="Brand Logo" value="${b.logoUrl || ''}" id="brand-logo-${idx}" onchange="window._tempBrandsList[${idx}].logoUrl = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
            </div>
        </div>
    `).join('');
}

function addBrandCardItem() {
    window._tempBrandsList = window._tempBrandsList || [];
    window._tempBrandsList.push({ name: 'New Brand', logoUrl: '', linkUrl: 'shop.html' });
    const container = document.getElementById('brand-cards-container');
    if (container) container.innerHTML = renderBrandCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

function removeBrandCard(idx) {
    if (window._tempBrandsList && window._tempBrandsList[idx]) {
        window._tempBrandsList.splice(idx, 1);
        const container = document.getElementById('brand-cards-container');
        if (container) container.innerHTML = renderBrandCardsHTML();
        setTimeout(() => initFileUploadHelper(), 50);
    }
}

function moveBrandCard(idx, delta) {
    const list = window._tempBrandsList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('brand-cards-container');
    if (container) container.innerHTML = renderBrandCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

async function saveBrandsSection() {
    const title = document.getElementById('brand-title').value.trim();
    const subtitle = document.getElementById('brand-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        featuredBrands: window._tempBrandsList || []
    };
    await saveSectionSettings(updatedSettings, 'Browse By Brand section updated!');
}

// ── 3. Featured Collections & Promo Cards Visual Editor ──
async function renderPromoCardsEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Featured Collections';
    const subtitle = s.subtitle || 'Discover hand-crafted skin series engineered for ultimate aesthetic protection';
    let promoCards = Array.isArray(s.promoCards) ? s.promoCards : [
        { title: 'Cyberpunk Series', subtitle: 'Neon Futurism', description: 'Glow-accented cyberpunk textures.', imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop', buttonText: 'Explore Collection', buttonLink: 'collections.html?slug=cyberpunk' }
    ];

    window._tempPromoCardsList = JSON.parse(JSON.stringify(promoCards));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Featured Collections Configuration</h4>
                    <p class="text-xs text-gray-500">Manage promotional collection banners, descriptions, and CTA links.</p>
                </div>
                <button onclick="savePromoCardsSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Collections
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="promo-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="promo-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Collection Promo Cards</h5>
                    <button onclick="addPromoCardItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Collection Card
                    </button>
                </div>

                <div id="promo-cards-container" class="space-y-4">
                    ${renderPromoCardsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderPromoCardsHTML() {
    const list = window._tempPromoCardsList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No promo cards added. Click "Add Collection Card" to begin.</div>';

    return list.map((c, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> Collection Card #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="movePromoCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="movePromoCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removePromoCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Card Title *</label>
                    <input type="text" value="${c.title || ''}" onchange="window._tempPromoCardsList[${idx}].title = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Subtitle / Badge</label>
                    <input type="text" value="${c.subtitle || ''}" onchange="window._tempPromoCardsList[${idx}].subtitle = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Description *</label>
                <textarea rows="2" onchange="window._tempPromoCardsList[${idx}].description = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs">${c.description || ''}</textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">CTA Button Text *</label>
                    <input type="text" value="${c.buttonText || 'Explore Collection'}" onchange="window._tempPromoCardsList[${idx}].buttonText = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">CTA Button Link *</label>
                    <input type="text" value="${c.buttonLink || 'collections.html'}" onchange="window._tempPromoCardsList[${idx}].buttonLink = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Card Image URL *</label>
                <input type="text" data-uploader="true" data-label="Collection Card Image" value="${c.imageUrl || ''}" id="promo-img-${idx}" onchange="window._tempPromoCardsList[${idx}].imageUrl = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
            </div>
        </div>
    `).join('');
}

function addPromoCardItem() {
    window._tempPromoCardsList = window._tempPromoCardsList || [];
    window._tempPromoCardsList.push({ title: 'New Collection', subtitle: 'Special Edition', description: 'Precision cut vinyl skin collection.', imageUrl: '', buttonText: 'Explore Collection', buttonLink: 'collections.html' });
    const container = document.getElementById('promo-cards-container');
    if (container) container.innerHTML = renderPromoCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

function removePromoCard(idx) {
    if (window._tempPromoCardsList && window._tempPromoCardsList[idx]) {
        window._tempPromoCardsList.splice(idx, 1);
        const container = document.getElementById('promo-cards-container');
        if (container) container.innerHTML = renderPromoCardsHTML();
        setTimeout(() => initFileUploadHelper(), 50);
    }
}

function movePromoCard(idx, delta) {
    const list = window._tempPromoCardsList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('promo-cards-container');
    if (container) container.innerHTML = renderPromoCardsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

async function savePromoCardsSection() {
    const title = document.getElementById('promo-title').value.trim();
    const subtitle = document.getElementById('promo-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        promoCards: window._tempPromoCardsList || []
    };
    await saveSectionSettings(updatedSettings, 'Featured Collections updated!');
}

// ── 4. Product Grids Visual Editor ──
async function renderProductsEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || (activeSection.sectionKey === 'trending' ? 'Trending Right Now' : activeSection.sectionKey === 'best_sellers' ? 'Best Sellers' : 'New Arrivals');
    const subtitle = s.subtitle || 'Handpicked premium vinyl skins crafted for perfection';
    const mode = s.mode || 'auto';
    const limit = s.limit || 4;
    const viewAllText = s.viewAllText || 'View All Products';
    const viewAllLink = s.viewAllLink || 'shop.html';

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">${activeSection.displayName} Product Grid Configuration</h4>
                    <p class="text-xs text-gray-500">Configure product grid headings, query selection mode, and item limits.</p>
                </div>
                <button onclick="saveProductsSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Product Grid
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="prod-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="prod-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Query Mode & Display Rules</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Product Selection Mode *</label>
                        <select id="prod-mode" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800">
                            <option value="auto" ${mode === 'auto' ? 'selected' : ''}>Automatic (Query database by product flags)</option>
                            <option value="manual" ${mode === 'manual' ? 'selected' : ''}>Manual (Select specific product IDs)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Product Limit Count *</label>
                        <input type="number" id="prod-limit" value="${limit}" min="1" max="16" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">View All Button Text</label>
                        <input type="text" id="prod-viewAllText" value="${viewAllText}" class="w-full px-3.5 py-2 border rounded-xl text-sm" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">View All Button Link</label>
                        <input type="text" id="prod-viewAllLink" value="${viewAllLink}" class="w-full px-3.5 py-2 border rounded-xl text-sm" />
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function saveProductsSection() {
    const title = document.getElementById('prod-title').value.trim();
    const subtitle = document.getElementById('prod-subtitle').value.trim();
    const mode = document.getElementById('prod-mode').value;
    const limit = parseInt(document.getElementById('prod-limit').value) || 4;
    const viewAllText = document.getElementById('prod-viewAllText').value.trim();
    const viewAllLink = document.getElementById('prod-viewAllLink').value.trim();

    const updatedSettings = {
        ...activeSection.settings,
        title,
        subtitle,
        mode,
        limit,
        viewAllText,
        viewAllLink
    };
    await saveSectionSettings(updatedSettings, `${activeSection.displayName} grid updated!`);
}

// ── 5. Why Choose Us / Features Grid Visual Editor ──
async function renderWhyChooseUsEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Why Choose OM Mobile Art';
    const subtitle = s.subtitle || 'Crafted with 0.23mm ultra-precision and 3M air-release adhesives';
    let features = Array.isArray(s.features) ? s.features : [
        { icon: 'verified', title: '3M Authentic Vinyl', description: 'Original 3M air-release vinyl engineered for clean 100% residue-free removal.' },
        { icon: 'precision_manufacturing', title: '0.23mm Precision Fit', description: 'Laser-cut to sub-millimeter precision guaranteeing perfect alignment around camera lenses.' }
    ];

    window._tempWhyChooseUsList = JSON.parse(JSON.stringify(features));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Why Choose Us Configuration</h4>
                    <p class="text-xs text-gray-500">Manage trust features, icons, titles, and benefit callouts.</p>
                </div>
                <button onclick="saveWhyChooseUsSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Features
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="wcu-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="wcu-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Trust Feature Cards</h5>
                    <button onclick="addWhyChooseUsItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Feature
                    </button>
                </div>

                <div id="wcu-cards-container" class="space-y-4">
                    ${renderWhyChooseUsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderWhyChooseUsHTML() {
    const list = window._tempWhyChooseUsList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No feature cards added. Click "Add Feature" to begin.</div>';

    return list.map((f, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> Feature Item #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="moveWhyChooseUsCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="moveWhyChooseUsCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removeWhyChooseUsCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Material Symbol Icon *</label>
                    <input type="text" value="${f.icon || 'verified'}" onchange="window._tempWhyChooseUsList[${idx}].icon = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs font-mono" placeholder="verified, shield, local_shipping" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Feature Title *</label>
                    <input type="text" value="${f.title || ''}" onchange="window._tempWhyChooseUsList[${idx}].title = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Feature Description *</label>
                <textarea rows="2" onchange="window._tempWhyChooseUsList[${idx}].description = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs">${f.description || ''}</textarea>
            </div>
        </div>
    `).join('');
}

function addWhyChooseUsItem() {
    window._tempWhyChooseUsList = window._tempWhyChooseUsList || [];
    window._tempWhyChooseUsList.push({ icon: 'verified', title: 'New Trust Feature', description: 'High quality precision vinyl protection.' });
    const container = document.getElementById('wcu-cards-container');
    if (container) container.innerHTML = renderWhyChooseUsHTML();
}

function removeWhyChooseUsCard(idx) {
    if (window._tempWhyChooseUsList && window._tempWhyChooseUsList[idx]) {
        window._tempWhyChooseUsList.splice(idx, 1);
        const container = document.getElementById('wcu-cards-container');
        if (container) container.innerHTML = renderWhyChooseUsHTML();
    }
}

function moveWhyChooseUsCard(idx, delta) {
    const list = window._tempWhyChooseUsList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('wcu-cards-container');
    if (container) container.innerHTML = renderWhyChooseUsHTML();
}

async function saveWhyChooseUsSection() {
    const title = document.getElementById('wcu-title').value.trim();
    const subtitle = document.getElementById('wcu-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        features: window._tempWhyChooseUsList || []
    };
    await saveSectionSettings(updatedSettings, 'Why Choose Us section updated!');
}

// ── 6. Testimonials & Reviews Visual Editor ──
async function renderTestimonialsEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Customer Reviews & Feedback';
    const subtitle = s.subtitle || 'Join over 25,000+ satisfied device owners who upgraded their style with OM Mobile Art';
    let testimonials = Array.isArray(s.testimonials) ? s.testimonials : [
        { customerName: 'Aarav Sharma', rating: 5, comment: 'The precision fit on my iPhone 15 Pro is unbelievable. No air bubbles at all!', profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' }
    ];

    window._tempTestimonialsList = JSON.parse(JSON.stringify(testimonials));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Customer Reviews Configuration</h4>
                    <p class="text-xs text-gray-500">Manage customer quotes, ratings, avatars, and verified badges.</p>
                </div>
                <button onclick="saveTestimonialsSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Testimonials
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="tst-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="tst-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Customer Testimonial Cards</h5>
                    <button onclick="addTestimonialItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Testimonial
                    </button>
                </div>

                <div id="testimonials-cards-container" class="space-y-4">
                    ${renderTestimonialsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderTestimonialsHTML() {
    const list = window._tempTestimonialsList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No testimonials added. Click "Add Testimonial" to begin.</div>';

    return list.map((t, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> Testimonial #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="moveTestimonialCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="moveTestimonialCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removeTestimonialCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Customer Name *</label>
                    <input type="text" value="${t.customerName || ''}" onchange="window._tempTestimonialsList[${idx}].customerName = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold" />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-600 mb-1">Rating Stars (1 to 5) *</label>
                    <input type="number" min="1" max="5" value="${t.rating || 5}" onchange="window._tempTestimonialsList[${idx}].rating = parseInt(this.value) || 5;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Customer Review Comment *</label>
                <textarea rows="2" onchange="window._tempTestimonialsList[${idx}].comment = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs">${t.comment || ''}</textarea>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Customer Photo / Avatar URL *</label>
                <input type="text" data-uploader="true" data-label="Customer Avatar Photo" value="${t.profileImage || ''}" id="tst-img-${idx}" onchange="window._tempTestimonialsList[${idx}].profileImage = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs" />
            </div>
        </div>
    `).join('');
}

function addTestimonialItem() {
    window._tempTestimonialsList = window._tempTestimonialsList || [];
    window._tempTestimonialsList.push({ customerName: 'Happy Customer', rating: 5, comment: 'Great quality and fast delivery!', profileImage: '' });
    const container = document.getElementById('testimonials-cards-container');
    if (container) container.innerHTML = renderTestimonialsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

function removeTestimonialCard(idx) {
    if (window._tempTestimonialsList && window._tempTestimonialsList[idx]) {
        window._tempTestimonialsList.splice(idx, 1);
        const container = document.getElementById('testimonials-cards-container');
        if (container) container.innerHTML = renderTestimonialsHTML();
        setTimeout(() => initFileUploadHelper(), 50);
    }
}

function moveTestimonialCard(idx, delta) {
    const list = window._tempTestimonialsList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('testimonials-cards-container');
    if (container) container.innerHTML = renderTestimonialsHTML();
    setTimeout(() => initFileUploadHelper(), 50);
}

async function saveTestimonialsSection() {
    const title = document.getElementById('tst-title').value.trim();
    const subtitle = document.getElementById('tst-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        testimonials: window._tempTestimonialsList || []
    };
    await saveSectionSettings(updatedSettings, 'Customer Testimonials section updated!');
}

// ── 7. Newsletter Visual Editor ──
async function renderNewsletterEditor() {
    const s = activeSection?.settings || {};
    const heading = s.heading || 'Stay in the Loop';
    const description = s.description || 'Subscribe to get exclusive skin releases, early access, and special offers.';
    const buttonText = s.buttonText || 'Subscribe';
    const bgImageUrl = s.bgImageUrl || '';

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">Newsletter Section Configuration</h4>
                    <p class="text-xs text-gray-500">Configure subscription banner heading, description, and callout imagery.</p>
                </div>
                <button onclick="saveNewsletterSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Newsletter
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Newsletter Heading *</label>
                    <input type="text" id="nl-heading" value="${heading}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Newsletter Description *</label>
                    <textarea id="nl-description" rows="2" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700">${description}</textarea>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Subscribe Button Text *</label>
                        <input type="text" id="nl-buttonText" value="${buttonText}" class="w-full px-3.5 py-2 border rounded-xl text-sm" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Background Accent Image URL</label>
                        <input type="text" id="nl-bgImageUrl" data-uploader="true" data-label="Newsletter Background" value="${bgImageUrl}" class="w-full px-3.5 py-2 border rounded-xl text-sm" />
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function saveNewsletterSection() {
    const heading = document.getElementById('nl-heading').value.trim();
    const description = document.getElementById('nl-description').value.trim();
    const buttonText = document.getElementById('nl-buttonText').value.trim();
    const bgImageUrl = document.getElementById('nl-bgImageUrl').value.trim();

    const updatedSettings = {
        heading,
        description,
        buttonText,
        bgImageUrl
    };
    await saveSectionSettings(updatedSettings, 'Newsletter section updated!');
}

// ── 8. FAQ Visual Editor ──
async function renderFAQEditor() {
    const s = activeSection?.settings || {};
    const title = s.title || 'Frequently Asked Questions';
    const subtitle = s.subtitle || 'Everything you need to know about our 3M vinyl skins and installation';
    let faqs = Array.isArray(s.faqs) ? s.faqs : [
        { question: 'Will removing the skin damage my device or leave residue?', answer: 'No! We use authentic 3M air-release vinyl that guarantees 100% residue-free removal.' },
        { question: 'How precise is the cut?', answer: 'Our skins are precision cut to 0.23mm accuracy around camera lenses, buttons, and ports.' }
    ];

    window._tempFAQsList = JSON.parse(JSON.stringify(faqs));

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">FAQ Section Configuration</h4>
                    <p class="text-xs text-gray-500">Manage frequently asked questions and answer accordions.</p>
                </div>
                <button onclick="saveFAQSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save FAQs
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Section Headings</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Title *</label>
                        <input type="text" id="faq-title" value="${title}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-semibold text-gray-800" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 mb-1">Section Subtitle *</label>
                        <input type="text" id="faq-subtitle" value="${subtitle}" class="w-full px-3.5 py-2 border rounded-xl text-sm font-medium text-gray-700" />
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between">
                    <h5 class="font-bold text-xs text-[#0077B6] uppercase tracking-wider">Questions & Answers List</h5>
                    <button onclick="addFAQItem()" class="px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[16px]">add</span> Add Question
                    </button>
                </div>

                <div id="faq-cards-container" class="space-y-4">
                    ${renderFAQCardsHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderFAQCardsHTML() {
    const list = window._tempFAQsList || [];
    if (list.length === 0) return '<div class="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">No FAQ items added. Click "Add Question" to begin.</div>';

    return list.map((f, idx) => `
        <div class="p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b pb-2">
                <span class="text-xs font-bold text-[#03045E] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-gray-400 cursor-grab">drag_indicator</span> FAQ #${idx + 1}
                </span>
                <div class="flex items-center gap-1">
                    ${idx > 0 ? `<button onclick="moveFAQCard(${idx}, -1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
                    ${idx < list.length - 1 ? `<button onclick="moveFAQCard(${idx}, 1)" class="p-1 text-gray-500 hover:text-black"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
                    <button onclick="removeFAQCard(${idx})" class="p-1 text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Question *</label>
                <input type="text" value="${f.question || ''}" onchange="window._tempFAQsList[${idx}].question = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold text-gray-800" />
            </div>
            <div>
                <label class="block text-[11px] font-bold text-gray-600 mb-1">Answer *</label>
                <textarea rows="2" onchange="window._tempFAQsList[${idx}].answer = this.value;" class="w-full px-3 py-1.5 border rounded-lg text-xs">${f.answer || ''}</textarea>
            </div>
        </div>
    `).join('');
}

function addFAQItem() {
    window._tempFAQsList = window._tempFAQsList || [];
    window._tempFAQsList.push({ question: 'New Question', answer: 'Detailed answer response.' });
    const container = document.getElementById('faq-cards-container');
    if (container) container.innerHTML = renderFAQCardsHTML();
}

function removeFAQCard(idx) {
    if (window._tempFAQsList && window._tempFAQsList[idx]) {
        window._tempFAQsList.splice(idx, 1);
        const container = document.getElementById('faq-cards-container');
        if (container) container.innerHTML = renderFAQCardsHTML();
    }
}

function moveFAQCard(idx, delta) {
    const list = window._tempFAQsList;
    if (!list) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(target, 0, item);
    const container = document.getElementById('faq-cards-container');
    if (container) container.innerHTML = renderFAQCardsHTML();
}

async function saveFAQSection() {
    const title = document.getElementById('faq-title').value.trim();
    const subtitle = document.getElementById('faq-subtitle').value.trim();
    const updatedSettings = {
        title,
        subtitle,
        faqs: window._tempFAQsList || []
    };
    await saveSectionSettings(updatedSettings, 'FAQ section updated!');
}

// ── 9. Visual Fallback Editor (NO RAW JSON EXPOSED) ──
function renderGenericSettingsEditor() {
    return renderVisualFallbackEditor();
}

function renderVisualFallbackEditor() {
    const s = activeSection?.settings || {};
    const keys = Object.keys(s);

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                    <h4 class="font-bold text-[#03045E] text-base">${activeSection.displayName} Settings</h4>
                    <p class="text-xs text-gray-500">Visual form settings editor for ${activeSection.displayName}.</p>
                </div>
                <button onclick="saveVisualFallbackSection()" class="px-5 py-2.5 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">save</span> Save Settings
                </button>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                ${keys.length === 0 ? '<div class="text-xs text-gray-500">No additional settings required for this section.</div>' : keys.map(k => {
                    const val = s[k];
                    const isImg = k.toLowerCase().includes('image') || k.toLowerCase().includes('logo') || k.toLowerCase().includes('photo');
                    const isLongText = typeof val === 'string' && val.length > 60;
                    return `
                        <div>
                            <label class="block text-xs font-bold text-gray-700 capitalize mb-1">${k.replace(/([A-Z])/g, ' $1')}</label>
                            ${isLongText ? `
                                <textarea id="vfb-${k}" rows="2" class="w-full px-3.5 py-2 border rounded-xl text-sm">${val || ''}</textarea>
                            ` : `
                                <input type="text" id="vfb-${k}" ${isImg ? 'data-uploader="true"' : ''} value="${typeof val === 'object' ? JSON.stringify(val) : val}" class="w-full px-3.5 py-2 border rounded-xl text-sm" />
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

async function saveVisualFallbackSection() {
    const s = activeSection?.settings || {};
    const keys = Object.keys(s);
    const updated = {};
    keys.forEach(k => {
        const inp = document.getElementById(`vfb-${k}`);
        if (inp) {
            let v = inp.value.trim();
            if (v === 'true') v = true;
            else if (v === 'false') v = false;
            else if (!isNaN(v) && v !== '') v = Number(v);
            updated[k] = v;
        }
    });
    await saveSectionSettings(updated, `${activeSection.displayName} settings updated!`);
}
