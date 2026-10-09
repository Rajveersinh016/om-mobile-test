/**
 * OM Mobile Art - Admin Cloudinary Uploader Component (media_uploader.js)
 * Reusable Drag & Drop image uploader with progress bar, replacement, deletion, and Media Library picker.
 */

window.initCloudinaryUploader = function(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const folder = options.folder || 'general';
    let currentUrl = options.initialUrl || '';
    let currentPublicId = options.initialPublicId || '';
    const onSuccess = options.onSuccess || (() => {});
    const onDelete = options.onDelete || (() => {});

    function render() {
        if (currentUrl) {
            container.innerHTML = `
                <div class="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50 p-2 flex flex-col items-center justify-center">
                    <img src="${currentUrl}" class="max-h-40 object-contain rounded-lg shadow-sm bg-white" alt="Preview"/>
                    <div class="mt-2 flex gap-2 w-full justify-center">
                        <button type="button" class="btn-replace-img text-xs font-semibold px-3 py-1.5 bg-[#35567F] hover:bg-[#2C4A6B] text-white rounded-md transition-colors flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">swap_horiz</span> Replace
                        </button>
                        <button type="button" class="btn-delete-img text-xs font-semibold px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">delete</span> Delete
                        </button>
                    </div>
                </div>
            `;
            container.querySelector('.btn-replace-img').addEventListener('click', openFileSelect);
            container.querySelector('.btn-delete-img').addEventListener('click', handleDelete);
        } else {
            container.innerHTML = `
                <div class="uploader-dropzone border-2 border-dashed border-gray-300 hover:border-[#35567F] rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-[#35567F]/10">
                    <span class="material-symbols-outlined text-3xl text-gray-400 mb-1">cloud_upload</span>
                    <p class="text-xs font-bold text-gray-700">Drag & Drop Image or <span class="text-[#35567F] underline">Browse</span></p>
                    <p class="text-[10px] text-gray-400 mt-1">PNG, JPG, WEBP, AVIF up to 10MB (Auto WebP / AVIF optimized via Cloudinary)</p>
                    
                    <div class="mt-3 flex justify-center gap-2">
                        <button type="button" class="btn-open-medialib text-xs font-semibold px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">perm_media</span> Select from Media Library
                        </button>
                    </div>

                    <div class="upload-progress-bar hidden mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div class="progress-fill bg-[#35567F] h-2 w-0 transition-all duration-200"></div>
                    </div>
                </div>
            `;
            const dropzone = container.querySelector('.uploader-dropzone');
            dropzone.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-open-medialib')) openFileSelect();
            });
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-[#35567F]', 'bg-[#35567F]/10'); });
            dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('border-[#35567F]', 'bg-[#35567F]/10'); });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-[#35567F]', 'bg-[#35567F]/10');
                if (e.dataTransfer.files.length > 0) {
                    uploadFile(e.dataTransfer.files[0]);
                }
            });

            const btnMediaLib = container.querySelector('.btn-open-medialib');
            if (btnMediaLib) {
                btnMediaLib.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.openMediaLibraryModal) {
                        window.openMediaLibraryModal((selectedAsset) => {
                            currentUrl = selectedAsset.url;
                            currentPublicId = selectedAsset.publicId;
                            render();
                            onSuccess(selectedAsset);
                        }, folder);
                    }
                });
            }
        }
    }

    function openFileSelect() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                uploadFile(e.target.files[0]);
            }
        };
        input.click();
    }

    async function uploadFile(file) {
        const progressBar = container.querySelector('.upload-progress-bar');
        const progressFill = container.querySelector('.progress-fill');
        if (progressBar) progressBar.classList.remove('hidden');
        if (progressFill) progressFill.style.width = '40%';

        try {
            let uploadedAsset;
            if (currentPublicId) {
                uploadedAsset = await window.API.replaceImage(currentPublicId, file, folder);
            } else {
                uploadedAsset = await window.API.uploadImage(file, folder);
            }

            if (progressFill) progressFill.style.width = '100%';
            currentUrl = uploadedAsset.url;
            currentPublicId = uploadedAsset.publicId;
            render();
            onSuccess(uploadedAsset);
            if (window.showToast) window.showToast("Uploaded to Cloudinary successfully!", "success");
        } catch (err) {
            if (window.showToast) window.showToast(`Upload failed: ${err.message}`, "error");
            if (progressBar) progressBar.classList.add('hidden');
        }
    }

    async function handleDelete() {
        if (confirm("Are you sure you want to delete this image from Cloudinary?")) {
            if (currentPublicId) {
                await window.API.deleteImage(currentPublicId);
            }
            currentUrl = '';
            currentPublicId = '';
            render();
            onDelete();
            if (window.showToast) window.showToast("Image removed from Cloudinary.", "info");
        }
    }

    render();

    return {
        getValue: () => ({ url: currentUrl, publicId: currentPublicId }),
        setValue: (url, publicId = '') => {
            currentUrl = url;
            currentPublicId = publicId;
            render();
        }
    };
};
