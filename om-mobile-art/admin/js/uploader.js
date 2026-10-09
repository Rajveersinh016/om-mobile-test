/**
 * OM Mobile Art — Production Image Uploader & Gallery Management System (uploader.js)
 * Replaces plain image URL text inputs across the Admin Panel with a Cloudinary Drag & Drop Uploader.
 */
(function() {
  'use strict';

  window.AdminUploader = {
    /**
     * Helper: Generates Cloudinary auto-optimized and responsive URLs
     */
    optimizeUrl: function(url, options = {}) {
      if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
      const { width, quality = 'auto', format = 'auto' } = options;
      const transform = `f_${format},q_${quality}${width ? `,w_${width}` : ''}`;
      return url.replace('/upload/', `/upload/${transform}/`);
    },

    /**
     * Extracts public_id from a Cloudinary URL if available
     */
    extractPublicId: function(url) {
      if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
      try {
        const parts = url.split('/upload/');
        if (parts.length < 2) return null;
        let path = parts[1].replace(/^v\d+\//, ''); // Strip version prefix
        return path.replace(/\.[^/.]+$/, ''); // Strip extension
      } catch (e) {
        return null;
      }
    },

    /**
     * Single Image Uploader Component
     */
    create: function(options) {
      const {
        container,
        input,
        label = 'Image',
        value = '',
        folder = 'general',
        accept = 'image/png, image/jpeg, image/jpg, image/webp, image/svg+xml',
        maxSizeMB = 10,
        onChange = null
      } = options;

      const targetContainer = typeof container === 'string' ? document.getElementById(container) : container;
      const targetInput = typeof input === 'string' ? document.getElementById(input) : input;

      if (!targetContainer && !targetInput) return null;

      if (targetInput) {
        targetInput.type = 'hidden';
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'admin-image-uploader-wrapper space-y-2';

      let currentData = {
        url: value || (targetInput ? targetInput.value : ''),
        publicId: '',
        width: 0,
        height: 0,
        format: '',
        bytes: 0
      };

      if (currentData.url && currentData.url.includes('cloudinary.com')) {
        currentData.publicId = window.AdminUploader.extractPublicId(currentData.url) || '';
      }

      function renderUI() {
        wrapper.innerHTML = '';

        if (label) {
          const labelEl = document.createElement('label');
          labelEl.className = 'block text-xs font-extrabold uppercase tracking-wider text-gray-600 mb-1';
          labelEl.textContent = label;
          wrapper.appendChild(labelEl);
        }

        if (currentData.url) {
          // ── PREVIEW STATE ──────────────────────────────────────────────────
          const previewCard = document.createElement('div');
          previewCard.className = 'p-3.5 bg-white border border-[#E5EEF8] rounded-2xl shadow-xs space-y-3';

          const imgBox = document.createElement('div');
          imgBox.className = 'relative max-h-44 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center p-2 group';
          imgBox.innerHTML = `
            <img src="${window.AdminUploader.optimizeUrl(currentData.url, { width: 500 })}" alt="Preview" loading="lazy" class="max-h-40 object-contain rounded-lg shadow-2xs"/>
          `;

          const metaRow = document.createElement('div');
          metaRow.className = 'flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100';
          metaRow.innerHTML = `
            <div class="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
              <span class="material-symbols-outlined text-xs">cloud_done</span>
              <span>Cloudinary Secured</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="btn-replace-img px-3 py-1.5 bg-gray-100 hover:bg-[#CAF0F8] text-[#0077B6] rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-xs">sync</span> Replace
              </button>
              <button type="button" class="btn-remove-img px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-xs">delete</span> Remove
              </button>
            </div>
          `;

          previewCard.appendChild(imgBox);
          previewCard.appendChild(metaRow);
          wrapper.appendChild(previewCard);

          metaRow.querySelector('.btn-replace-img').addEventListener('click', () => triggerFileInput());
          metaRow.querySelector('.btn-remove-img').addEventListener('click', async () => {
            if (confirm("Delete this image asset from Cloudinary?")) {
              const pubId = currentData.publicId || window.AdminUploader.extractPublicId(currentData.url);
              if (pubId && window.API && window.API.deleteImage) {
                await window.API.deleteImage(pubId);
              }
              currentData = { url: '', publicId: '', width: 0, height: 0, format: '', bytes: 0 };
              if (targetInput) targetInput.value = '';
              if (onChange) onChange('');
              if (window.showToast) window.showToast("Image removed.", "info");
              renderUI();
            }
          });
        } else {
          // ── DROPZONE STATE ────────────────────────────────────────────────
          const dropzone = document.createElement('div');
          dropzone.className = 'border-2 border-dashed border-[#0077B6]/40 hover:border-[#0077B6] bg-[#CAF0F8]/20 hover:bg-[#CAF0F8]/40 transition-all rounded-2xl p-5 text-center cursor-pointer relative group';
          dropzone.innerHTML = `
            <div class="space-y-1.5 pointer-events-none">
              <div class="w-10 h-10 rounded-xl bg-white border border-[#90E0EF] flex items-center justify-center text-[#0077B6] mx-auto group-hover:scale-110 transition-transform shadow-xs">
                <span class="material-symbols-outlined text-xl">cloud_upload</span>
              </div>
              <p class="text-xs font-extrabold text-[#03045E]">Drag & Drop image here or <span class="text-[#0077B6] underline">Browse</span></p>
              <p class="text-[10px] text-gray-400 font-medium">Supports PNG, JPG, JPEG, WEBP, SVG (Max ${maxSizeMB}MB)</p>
            </div>
          `;

          dropzone.addEventListener('click', () => triggerFileInput());
          dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-[#0077B6]', 'bg-[#CAF0F8]/60');
          });
          dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-[#0077B6]', 'bg-[#CAF0F8]/60');
          });
          dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-[#0077B6]', 'bg-[#CAF0F8]/60');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
              handleFile(files[0]);
            }
          });

          wrapper.appendChild(dropzone);
        }
      }

      function triggerFileInput() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = accept;
        fileInput.onchange = (e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        };
        fileInput.click();
      }

      async function handleFile(file) {
        if (!file.type.startsWith('image/')) {
          if (window.showToast) window.showToast("Invalid file format. Please select an image.", "warning");
          return;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
          if (window.showToast) window.showToast(`File size exceeds ${maxSizeMB}MB limit.`, "warning");
          return;
        }

        wrapper.innerHTML = `
          <div class="p-5 bg-white border border-[#90E0EF] rounded-2xl shadow-xs text-center space-y-3">
            <div class="flex items-center justify-center gap-2 text-xs font-extrabold text-[#0077B6]">
              <span class="animate-spin material-symbols-outlined text-base">sync</span>
              <span>Uploading to Cloudinary...</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
              <div class="bg-[#0077B6] h-full transition-all duration-300 animate-pulse" style="width: 75%"></div>
            </div>
          </div>
        `;

        try {
          const res = await window.API.uploadImage(file, folder);
          if (res && res.url) {
            currentData = {
              url: res.url,
              publicId: res.publicId || '',
              width: res.width || 0,
              height: res.height || 0,
              format: res.format || '',
              bytes: res.bytes || 0
            };
            if (targetInput) targetInput.value = currentData.url;
            if (onChange) onChange(currentData.url, currentData);
            if (window.showToast) window.showToast("Uploaded to Cloudinary!", "success");
          } else {
            throw new Error("Upload response missing URL");
          }
        } catch (err) {
          console.error('[AdminUploader Error]', err);
          const errMsg = err && err.message ? err.message : "Cloudinary image upload failed.";
          if (window.showToast) window.showToast(`Upload Error: ${errMsg}`, "error");
        } finally {
          renderUI();
        }
      }

      renderUI();

      if (targetContainer) {
        targetContainer.appendChild(wrapper);
      } else if (targetInput && targetInput.parentNode) {
        targetInput.parentNode.insertBefore(wrapper, targetInput);
      }

      return {
        getValue: () => currentData.url,
        getData: () => currentData,
        setValue: (val) => {
          if (typeof val === 'object' && val !== null) {
            currentData = { ...val };
          } else {
            currentData.url = val || '';
            currentData.publicId = window.AdminUploader.extractPublicId(currentData.url) || '';
          }
          if (targetInput) targetInput.value = currentData.url;
          renderUI();
        }
      };
    },

    /**
     * Multi-Image Product Gallery Uploader Component
     */
    createGallery: function(options) {
      const {
        container,
        images = [],
        folder = 'products',
        onChange = null
      } = options;

      const targetContainer = typeof container === 'string' ? document.getElementById(container) : container;
      if (!targetContainer) return null;

      let galleryList = Array.isArray(images) ? [...images] : [];

      function renderGalleryUI() {
        targetContainer.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-extrabold uppercase tracking-wider text-gray-600">Product Image Gallery (${galleryList.length} Images)</label>
              <button type="button" class="btn-add-gallery-img px-3 py-1.5 bg-[#0077B6] hover:bg-[#03045E] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-sm">add_photo_alternate</span> Add Gallery Images
              </button>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3" id="gallery-grid-items">
              ${galleryList.map((img, idx) => {
                const imgUrl = typeof img === 'string' ? img : img.url;
                const isPrimary = idx === 0;
                return `
                  <div class="relative group bg-white border ${isPrimary ? 'border-2 border-[#0077B6] shadow-sm' : 'border-gray-200'} rounded-2xl overflow-hidden p-1.5 flex flex-col justify-between">
                    <div class="aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center relative">
                      <img src="${window.AdminUploader.optimizeUrl(imgUrl, { width: 250 })}" alt="Gallery Image" class="w-full h-full object-cover"/>
                      ${isPrimary ? `<span class="absolute top-1.5 left-1.5 bg-[#0077B6] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">Primary</span>` : ''}
                    </div>

                    <div class="pt-2 flex items-center justify-between gap-1 text-xs">
                      ${!isPrimary ? `
                        <button type="button" onclick="window.AdminUploader._setGalleryPrimary(${idx}, '${targetContainer.id}')" title="Set as Primary" class="p-1 text-gray-500 hover:text-[#0077B6] hover:bg-gray-100 rounded-lg cursor-pointer">
                          <span class="material-symbols-outlined text-xs">star</span>
                        </button>
                      ` : `<div></div>`}
                      
                      <div class="flex items-center gap-0.5">
                        ${idx > 0 ? `
                          <button type="button" onclick="window.AdminUploader._moveGalleryItem(${idx}, -1, '${targetContainer.id}')" title="Move Left" class="p-1 text-gray-500 hover:text-gray-900 rounded-lg cursor-pointer">
                            <span class="material-symbols-outlined text-xs">arrow_back</span>
                          </button>
                        ` : ''}
                        ${idx < galleryList.length - 1 ? `
                          <button type="button" onclick="window.AdminUploader._moveGalleryItem(${idx}, 1, '${targetContainer.id}')" title="Move Right" class="p-1 text-gray-500 hover:text-gray-900 rounded-lg cursor-pointer">
                            <span class="material-symbols-outlined text-xs">arrow_forward</span>
                          </button>
                        ` : ''}
                        <button type="button" onclick="window.AdminUploader._deleteGalleryItem(${idx}, '${targetContainer.id}')" title="Delete Image" class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer">
                          <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        targetContainer.querySelector('.btn-add-gallery-img').addEventListener('click', () => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.multiple = true;
          fileInput.accept = 'image/png, image/jpeg, image/jpg, image/webp, image/svg+xml';
          fileInput.onchange = async (e) => {
            if (e.target.files && e.target.files.length > 0) {
              const files = Array.from(e.target.files);
              for (const file of files) {
                try {
                  const res = await window.API.uploadImage(file, folder);
                  if (res && res.url) {
                    galleryList.push({ url: res.url, publicId: res.publicId || '' });
                  }
                } catch (err) {
                  console.error('Gallery image upload failed:', err);
                }
              }
              if (onChange) onChange(galleryList);
              renderGalleryUI();
            }
          };
          fileInput.click();
        });
      }

      // Store global reference for dynamic onclick actions
      window.AdminUploader['_gallery_' + targetContainer.id] = {
        getList: () => galleryList,
        setList: (newList) => {
          galleryList = [...newList];
          renderGalleryUI();
        },
        onChange
      };

      renderGalleryUI();

      return {
        getImages: () => galleryList,
        setImages: (newList) => {
          galleryList = Array.isArray(newList) ? [...newList] : [];
          renderGalleryUI();
        }
      };
    },

    _setGalleryPrimary: function(index, containerId) {
      const ref = window.AdminUploader['_gallery_' + containerId];
      if (!ref) return;
      const list = ref.getList();
      if (index > 0 && index < list.length) {
        const item = list.splice(index, 1)[0];
        list.unshift(item);
        ref.setList(list);
        if (ref.onChange) ref.onChange(list);
      }
    },

    _moveGalleryItem: function(index, direction, containerId) {
      const ref = window.AdminUploader['_gallery_' + containerId];
      if (!ref) return;
      const list = ref.getList();
      const newIdx = index + direction;
      if (newIdx >= 0 && newIdx < list.length) {
        const temp = list[index];
        list[index] = list[newIdx];
        list[newIdx] = temp;
        ref.setList(list);
        if (ref.onChange) ref.onChange(list);
      }
    },

    _deleteGalleryItem: async function(index, containerId) {
      const ref = window.AdminUploader['_gallery_' + containerId];
      if (!ref) return;
      const list = ref.getList();
      const item = list[index];
      if (confirm("Delete this gallery image asset from Cloudinary?")) {
        const pubId = typeof item === 'object' ? item.publicId : window.AdminUploader.extractPublicId(item);
        if (pubId && window.API && window.API.deleteImage) {
          await window.API.deleteImage(pubId);
        }
        list.splice(index, 1);
        ref.setList(list);
        if (ref.onChange) ref.onChange(list);
        if (window.showToast) window.showToast("Gallery image deleted.", "info");
      }
    },

    /**
     * Automatically converts a standard input element into a Cloudinary Uploader
     */
    attach: function(inputId, options = {}) {
      const input = document.getElementById(inputId);
      if (!input) return null;
      return window.AdminUploader.create({
        input: input,
        label: options.label || '',
        folder: options.folder || 'general',
        onChange: options.onChange
      });
    }
  };
})();
