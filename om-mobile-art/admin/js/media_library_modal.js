/**
 * OM Mobile Art - Media Library Modal Component (media_library_modal.js)
 * Reusable modal allowing admins to browse, filter, search, copy URL, reuse, and delete Cloudinary assets.
 */

window.openMediaLibraryModal = async function(onSelectCallback, initialFolder = '') {
    let modal = document.getElementById('cloudinary-media-library-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cloudinary-media-library-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-fade-in">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[#35567F] text-2xl">photo_library</span>
                    <div>
                        <h3 class="font-extrabold text-gray-900 text-lg">Cloudinary Media Library</h3>
                        <p class="text-xs text-gray-500">Centralized Cloudinary Asset Repository for OM Mobile Art</p>
                    </div>
                </div>
                <button type="button" onclick="closeMediaLibraryModal()" class="text-gray-400 hover:text-gray-700 p-1 rounded-lg">
                    <span class="material-symbols-outlined text-xl">close</span>
                </button>
            </div>

            <!-- Toolbar & Folder Filters -->
            <div class="p-4 bg-gray-100/70 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
                <div class="flex items-center gap-2">
                    <select id="medialib-folder-select" class="text-xs font-bold border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#35567F]">
                        <option value="">All Folders</option>
                        <option value="homepage">Homepage</option>
                        <option value="products">Products</option>
                        <option value="collections">Collections</option>
                        <option value="brands">Brands</option>
                        <option value="device-types">Device Types</option>
                        <option value="custom-skins">Custom Skins</option>
                        <option value="general">General</option>
                    </select>

                    <input type="text" id="medialib-search-input" placeholder="Search by Public ID..." class="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white w-64 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#35567F]"/>
                </div>

                <div class="flex items-center gap-2">
                    <label class="btn-medialib-upload text-xs font-bold px-4 py-2 bg-[#35567F] hover:bg-[#2C4A6B] text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">cloud_upload</span> Upload New Image
                        <input type="file" id="medialib-direct-upload" accept="image/*" class="hidden"/>
                    </label>
                </div>
            </div>

            <!-- Grid & Inspector Container -->
            <div class="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="medialib-assets-grid">
                <div class="col-span-full py-16 text-center text-gray-400">
                    <span class="material-symbols-outlined text-4xl animate-spin text-[#35567F]">progress_activity</span>
                    <p class="text-xs mt-2 font-semibold">Fetching assets from Cloudinary...</p>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 text-xs text-gray-500">
                <span id="medialib-count-label">0 Assets</span>
                <button type="button" onclick="closeMediaLibraryModal()" class="px-4 py-2 font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg">Cancel</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    const folderSelect = document.getElementById('medialib-folder-select');
    const searchInput = document.getElementById('medialib-search-input');
    const fileInput = document.getElementById('medialib-direct-upload');

    if (initialFolder && folderSelect) {
        folderSelect.value = initialFolder;
    }

    async function loadAssets() {
        const grid = document.getElementById('medialib-assets-grid');
        const countLabel = document.getElementById('medialib-count-label');
        const folderVal = folderSelect ? folderSelect.value : '';
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-400">
                <span class="material-symbols-outlined text-4xl animate-spin text-[#35567F]">progress_activity</span>
                <p class="text-xs mt-2 font-semibold">Fetching assets from Cloudinary...</p>
            </div>
        `;

        try {
            const data = await window.API.listMedia(folderVal);
            let assets = data.resources || [];

            if (searchVal) {
                assets = assets.filter(a => a.publicId.toLowerCase().includes(searchVal) || a.url.toLowerCase().includes(searchVal));
            }

            countLabel.textContent = `${assets.length} Cloudinary Asset${assets.length === 1 ? '' : 's'}`;

            if (assets.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-16 text-center text-gray-400">
                        <span class="material-symbols-outlined text-4xl text-gray-300">image_not_supported</span>
                        <p class="text-xs mt-2 font-bold">No Cloudinary assets found in this folder.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = assets.map(asset => `
                <div class="group relative aspect-square border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex flex-col items-center justify-center p-2 hover:border-[#35567F] hover:shadow-md transition-all cursor-pointer">
                    <img src="${asset.url}" class="max-h-24 max-w-full object-contain" alt="${asset.publicId}"/>
                    
                    <div class="mt-2 text-center w-full px-1">
                        <p class="text-[10px] font-bold text-gray-800 truncate" title="${asset.publicId}">${asset.publicId.split('/').pop()}</p>
                        <p class="text-[9px] text-gray-400">${asset.width}x${asset.height} • ${asset.format.toUpperCase()}</p>
                    </div>

                    <!-- Overlay Action Hover Buttons -->
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <button type="button" onclick="selectCloudinaryAsset('${encodeURIComponent(JSON.stringify(asset))}')" 
                            class="w-full text-[11px] font-bold py-1.5 bg-[#35567F] hover:bg-[#2C4A6B] text-white rounded-md flex items-center justify-center gap-1 shadow">
                            <span class="material-symbols-outlined text-xs">check_circle</span> Use Image
                        </button>
                        <div class="flex gap-1 w-full">
                            <button type="button" onclick="copyAssetUrl('${asset.url}')" class="flex-1 text-[10px] py-1 bg-gray-800 hover:bg-black text-white rounded text-center">Copy URL</button>
                            <button type="button" onclick="deleteAssetFromMediaLib('${asset.publicId}')" class="flex-1 text-[10px] py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-center">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            grid.innerHTML = `
                <div class="col-span-full py-16 text-center text-rose-500">
                    <span class="material-symbols-outlined text-4xl">error</span>
                    <p class="text-xs mt-2 font-bold">Failed to load Cloudinary media assets.</p>
                </div>
            `;
        }
    }

    if (folderSelect) folderSelect.addEventListener('change', loadAssets);
    if (searchInput) searchInput.addEventListener('input', loadAssets);

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const folderVal = folderSelect.value || 'general';
                try {
                    await window.API.uploadImage(e.target.files[0], folderVal);
                    if (window.showToast) window.showToast("Uploaded to Cloudinary!", "success");
                    loadAssets();
                } catch (err) {
                    if (window.showToast) window.showToast("Upload failed", "error");
                }
            }
        });
    }

    window.selectCloudinaryAsset = function(encodedAsset) {
        const asset = JSON.parse(decodeURIComponent(encodedAsset));
        if (onSelectCallback) onSelectCallback(asset);
        closeMediaLibraryModal();
    };

    window.copyAssetUrl = function(url) {
        navigator.clipboard.writeText(url);
        if (window.showToast) window.showToast("Cloudinary URL copied to clipboard!", "info");
    };

    window.deleteAssetFromMediaLib = async function(publicId) {
        if (confirm("Delete this asset permanently from Cloudinary?")) {
            await window.API.deleteImage(publicId);
            if (window.showToast) window.showToast("Deleted from Cloudinary", "info");
            loadAssets();
        }
    };

    loadAssets();
};

window.closeMediaLibraryModal = function() {
    const modal = document.getElementById('cloudinary-media-library-modal');
    if (modal) modal.classList.add('hidden');
};
