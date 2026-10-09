/**
 * OM Mobile Art - Custom Skin Studio Controller
 * Device-Aware Studio (Mobile Back Skin ₹300 vs Laptop Back Skin ₹500)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Core State
    let studioConfig = null;
    let flowType = 'mobile'; // 'mobile' or 'laptop'

    let selectedBrand = null;
    let selectedModel = null;

    let qty = 1;

    // Active object tracking: 'artwork' or text layer ID
    let activeObject = 'artwork'; 
    let selectedLayerId = null;

    // Image manipulation parameters
    let scale = 0.35; 
    let rotation = 0;
    let opacity = 100;
    let translateX = 0;
    let translateY = 0;
    let flipH = 1;
    let flipV = 1;

    let uploadedImageUrl = "";
    
    // Drag state
    let isDragging = false;
    let startX = 0, startY = 0;

    // Text Editor Layers State
    let textLayers = [];

    // 2. DOM Elements Selection
    const serviceTabMobile = document.getElementById('service-tab-mobile');
    const serviceTabLaptop = document.getElementById('service-tab-laptop');
    const selectDeviceType = document.getElementById('select-device-type');

    // Device Selectors
    const selectBrand = document.getElementById('select-brand');
    const modelSearchInput = document.getElementById('model-search-input');
    const modelDropdownOptions = document.getElementById('model-dropdown-options');
    const badgeDeviceName = document.getElementById('badge-device-name');
    const badgeDeviceIcon = document.getElementById('badge-device-icon');

    // Artwork & Upload Elements
    const dropzone = document.getElementById('custom-skin-dropzone');
    const fileInput = document.getElementById('skin-file-input');
    const uploadHeadline = document.getElementById('upload-headline');
    const artworkActiveBar = document.getElementById('artwork-active-bar');
    const activeFileName = document.getElementById('active-file-name');
    const btnReplaceArtwork = document.getElementById('btn-replace-artwork');
    const btnRemoveArtwork = document.getElementById('btn-remove-artwork');
    const gallerySuggestions = document.getElementById('gallery-suggestions');

    // Canvas Viewport & Frame Elements
    const previewViewportContainer = document.getElementById('preview-viewport-container');
    const previewCanvasArea = document.getElementById('preview-canvas-area');
    const previewRotationWrapper = document.getElementById('preview-rotation-wrapper');
    const phoneMaskContainer = document.getElementById('phone-mask-container');
    const laptopMaskContainer = document.getElementById('laptop-mask-container');
    const previewImgMobile = document.getElementById('uploaded-skin-preview-mobile');
    const previewImgLaptop = document.getElementById('uploaded-skin-preview-laptop');
    const cameraBump = document.getElementById('phone-camera-bump');

    // Editor Sub-tabs & Panels
    const tabBtnAdjust = document.getElementById('tab-btn-adjust');
    const tabBtnTransform = document.getElementById('tab-btn-transform');
    const tabBtnText = document.getElementById('tab-btn-text');
    const panelAdjust = document.getElementById('panel-adjust');
    const panelTransform = document.getElementById('panel-transform');
    const panelText = document.getElementById('panel-text');

    // Image Sliders
    const sliderZoom = document.getElementById('slider-zoom');
    const sliderRotate = document.getElementById('slider-rotate');
    const sliderOpacity = document.getElementById('slider-opacity');
    const valZoom = document.getElementById('zoom-value');
    const valRotate = document.getElementById('rotate-value');
    const valOpacity = document.getElementById('opacity-value');

    const btnFlipH = document.getElementById('btn-flip-h');
    const btnFlipV = document.getElementById('btn-flip-v');
    const btnResetTransform = document.getElementById('btn-reset-transform');

    // Canvas Toolbars
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnResetLayout = document.getElementById('btn-reset-layout');
    const btnCanvasFit = document.getElementById('btn-canvas-fit');
    const btnCanvasCenter = document.getElementById('btn-canvas-center');
    const btnToggleGrid = document.getElementById('btn-toggle-grid');
    const btnRotate90 = document.getElementById('btn-rotate-90');

    // Text Tool Elements
    const btnAddTextLayer = document.getElementById('btn-add-text-layer');
    const textLayersList = document.getElementById('text-layers-list');
    const textPropertiesPanel = document.getElementById('text-properties-panel');
    const textLayerString = document.getElementById('text-layer-string');
    const textLayerFont = document.getElementById('text-layer-font');
    const textLayerSize = document.getElementById('text-layer-size');
    const textSizeVal = document.getElementById('text-size-val');
    const textLayerColor = document.getElementById('text-layer-color');
    const textLayerOpacity = document.getElementById('text-layer-opacity');
    const textOpacityVal = document.getElementById('text-opacity-val');
    const textLayerRotate = document.getElementById('text-layer-rotate');
    const textRotateVal = document.getElementById('text-rotate-val');
    const btnTextAlignLeft = document.getElementById('btn-text-align-left');
    const btnTextAlignCenter = document.getElementById('btn-text-align-center');
    const btnTextAlignRight = document.getElementById('btn-text-align-right');
    const btnDeleteTextLayer = document.getElementById('btn-delete-text-layer');

    // Selection Box Overlay
    const selectionBox = document.getElementById('selection-box');

    // Sticky Summary Elements
    const customSkinPriceLabel = document.getElementById('custom-skin-price');
    const inputQty = document.getElementById('input-qty');
    const btnNextReview = document.getElementById('btn-next-review');

    // Dynamic Helper Getters for Device-Aware Active Elements
    function getActivePreviewImg() {
        return flowType === 'laptop' ? previewImgLaptop : previewImgMobile;
    }
    function getActiveMaskContainer() {
        return flowType === 'laptop' ? laptopMaskContainer : phoneMaskContainer;
    }
    function getActiveTextOverlay() {
        return flowType === 'laptop' 
            ? document.getElementById('text-layers-overlay-laptop') 
            : document.getElementById('text-layers-overlay-mobile');
    }
    function getActiveGridOverlay() {
        return flowType === 'laptop'
            ? document.getElementById('align-grid-laptop')
            : document.getElementById('align-grid-mobile');
    }

    // 3. Service Selector & Flow Switching
    window.selectServiceFlow = function(type) {
        flowType = (type === 'laptop') ? 'laptop' : 'mobile';

        // Update Top Switcher Tabs Highlight
        if (flowType === 'laptop') {
            if (serviceTabLaptop) {
                serviceTabLaptop.className = "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#03045E] text-white shadow-sm flex items-center justify-center gap-2";
            }
            if (serviceTabMobile) {
                serviceTabMobile.className = "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2";
            }
            if (selectDeviceType) selectDeviceType.value = 'laptop';
            if (badgeDeviceIcon) badgeDeviceIcon.textContent = 'laptop';
        } else {
            if (serviceTabMobile) {
                serviceTabMobile.className = "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#03045E] text-white shadow-sm flex items-center justify-center gap-2";
            }
            if (serviceTabLaptop) {
                serviceTabLaptop.className = "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2";
            }
            if (selectDeviceType) selectDeviceType.value = 'mobile';
            if (badgeDeviceIcon) badgeDeviceIcon.textContent = 'smartphone';
        }

        // DEVICE-AWARE PREVIEW FRAME SWITCHING
        if (flowType === 'laptop') {
            phoneMaskContainer.classList.add('hidden');
            laptopMaskContainer.classList.remove('hidden');
        } else {
            laptopMaskContainer.classList.add('hidden');
            phoneMaskContainer.classList.remove('hidden');
        }

        // Reset Brand & Model Selection
        selectedBrand = null;
        selectedModel = null;
        if (badgeDeviceName) {
            badgeDeviceName.textContent = flowType === 'laptop' ? "Select Laptop Model" : "Select Mobile Model";
        }
        if (modelSearchInput) {
            modelSearchInput.value = "";
        }

        // Refresh Brand List & Specs for Active Flow
        populateBrandsList();
        renderCanvas();
        refreshPricing();
    };

    if (selectDeviceType) {
        selectDeviceType.addEventListener('change', () => {
            selectServiceFlow(selectDeviceType.value);
        });
    }

    // 4. API & Studio Config Loading
    const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

    async function loadStudioConfig() {
        try {
            const response = await fetch(`${API_URL}/custom-skin/config`);
            const result = await response.json();
            if (result.success && result.data) {
                studioConfig = result.data;
            } else {
                const fallbackRes = await fetch(`${API_URL}/custom-skin/settings`);
                const fallbackResult = await fallbackRes.json();
                if (fallbackResult.success && fallbackResult.data) {
                    studioConfig = fallbackResult.data;
                }
            }
        } catch (error) {
            console.error("Error connecting to API server for custom skin config:", error);
        } finally {
            initializeStudioUI();
        }
    }

    function initializeStudioUI() {
        renderFAQs();
        populateBrandsList();
        setupSuggestionsGallery();

        if (textLayerFont) {
            const supportedFonts = [
                { name: 'Inter', slug: 'Inter' },
                { name: 'Poppins', slug: 'Poppins' },
                { name: 'Montserrat', slug: 'Montserrat' },
                { name: 'Roboto', slug: 'Roboto' },
                { name: 'Open Sans', slug: 'Open Sans' },
                { name: 'Playfair Display', slug: 'Playfair Display' },
                { name: 'Lato', slug: 'Lato' },
                { name: 'Oswald', slug: 'Oswald' },
                { name: 'Pacifico', slug: 'Pacifico' }
            ];
            textLayerFont.innerHTML = supportedFonts.map(f => `<option value="${f.slug}">${f.name}</option>`).join('');
        }

        // Default to mobile flow
        selectServiceFlow('mobile');
    }

    function renderFAQs() {
        const accordion = document.getElementById('faq-accordion');
        if (!accordion || !studioConfig?.faqs) return;
        accordion.innerHTML = studioConfig.faqs.map((faq) => `
            <div class="py-3 border-b border-[#E8E8E8]">
                <button type="button" class="w-full flex justify-between items-center text-left font-bold text-xs uppercase tracking-wider text-[#111827] py-1 select-none" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    <span>${faq.q}</span>
                    <span class="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                </button>
                <div class="hidden text-xs text-[#6B7280] leading-relaxed mt-1.5 pl-1">${faq.a}</div>
            </div>
        `).join('');
    }

    function setupSuggestionsGallery() {
        if (!gallerySuggestions) return;
        const suggestionImages = [
            { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&fit=crop", name: "Abstract Fluid" },
            { url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=400&fit=crop", name: "Botanical Paint" },
            { url: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=400&fit=crop", name: "Cyber Terrain" },
            { url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=400&fit=crop", name: "Classic Lens" }
        ];

        gallerySuggestions.innerHTML = suggestionImages.map(img => `
            <div onclick="selectGallerySuggestion('${img.url}')" class="group relative aspect-[3/4] rounded-xl overflow-hidden border border-[#E8E8E8] cursor-pointer hover:border-[#03045E] transition-all duration-200 shadow-sm">
                <img src="${img.url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250">
                <div class="absolute inset-0 bg-black/40 flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="text-white text-[8px] font-bold uppercase tracking-wider">${img.name}</span>
                </div>
            </div>
        `).join('');
    }

    window.selectGallerySuggestion = function(url) {
        setUploadedArtwork(url, "Sample Artwork");
    };

    // 5. Artwork Upload & Manipulation
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('bg-[#03045E]/10');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('bg-[#03045E]/10');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('bg-[#03045E]/10');
            if (e.dataTransfer.files.length > 0) {
                handleUploadedFile(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleUploadedFile(fileInput.files[0]);
            }
        });
    }

    if (btnReplaceArtwork) {
        btnReplaceArtwork.addEventListener('click', () => fileInput.click());
    }

    if (btnRemoveArtwork) {
        btnRemoveArtwork.addEventListener('click', () => {
            uploadedImageUrl = "";
            previewImgMobile.src = "";
            previewImgLaptop.src = "";
            if (artworkActiveBar) artworkActiveBar.classList.add('hidden');
            if (uploadHeadline) uploadHeadline.textContent = "+ UPLOAD DESIGN";
            renderCanvas();
        });
    }

    function handleUploadedFile(file) {
        const maxSizeMB = studioConfig?.maxUploadSize || 10;
        if (file.size > maxSizeMB * 1024 * 1024) {
            if (window.showToast) window.showToast(`File size exceeds maximum limit of ${maxSizeMB}MB.`, "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            setUploadedArtwork(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    }

    function setUploadedArtwork(url, fileName) {
        uploadedImageUrl = url;
        previewImgMobile.src = url;
        previewImgLaptop.src = url;

        if (artworkActiveBar) artworkActiveBar.classList.remove('hidden');
        if (activeFileName) activeFileName.textContent = fileName || "Artwork Loaded";
        if (uploadHeadline) uploadHeadline.textContent = "✔ ARTWORK LOADED";

        // Default scale setup
        scale = flowType === 'laptop' ? 0.5 : 0.35;
        translateX = 0;
        translateY = 0;
        rotation = 0;

        renderCanvas();
    }

    // 6. Device & Brand Population
    let availableBrands = [];

    function populateBrandsList() {
        if (!selectBrand) return;
        const isLaptop = (flowType === 'laptop');

        if (isLaptop) {
            if (studioConfig && studioConfig.laptopBrands && studioConfig.laptopBrands.length > 0) {
                availableBrands = studioConfig.laptopBrands;
            } else if (studioConfig && studioConfig.deviceMatrix) {
                const brandMap = new Map();
                (studioConfig.deviceMatrix || [])
                    .filter(d => (d.category || d.deviceCategory || '').toLowerCase() === 'laptop' || (d.brand || '').toLowerCase().includes('laptop') || (d.brand || '').toLowerCase().includes('macbook'))
                    .forEach(d => {
                        const bName = d.brand;
                        if (!bName) return;
                        if (!brandMap.has(bName)) {
                            brandMap.set(bName, { id: d.brandId || bName, name: bName, models: [] });
                        }
                        brandMap.get(bName).models.push({ id: d.modelId || d.model, name: d.model, series: d.series || '' });
                    });
                availableBrands = Array.from(brandMap.values());
            }
            if (!availableBrands || availableBrands.length === 0) {
                availableBrands = [
                    { id: 'apple-macbook', name: 'Apple MacBook', models: [{ name: 'MacBook Pro 16" (M3)' }, { name: 'MacBook Air 15" (M2)' }, { name: 'MacBook Pro 14" (M3)' }] },
                    { id: 'dell', name: 'Dell', models: [{ name: 'Dell XPS 15' }, { name: 'Dell Inspiron 15' }] },
                    { id: 'hp', name: 'HP', models: [{ name: 'HP Spectre x360' }, { name: 'HP Pavilion 15' }] },
                    { id: 'lenovo', name: 'Lenovo', models: [{ name: 'Lenovo ThinkPad X1 Carbon' }, { name: 'Lenovo Yoga Slim 7' }] },
                    { id: 'asus', name: 'Asus', models: [{ name: 'Asus ROG Zephyrus' }, { name: 'Asus ZenBook 14' }] }
                ];
            }
        } else {
            if (studioConfig && studioConfig.mobileBrands && studioConfig.mobileBrands.length > 0) {
                availableBrands = studioConfig.mobileBrands;
            } else if (studioConfig && studioConfig.deviceMatrix) {
                const brandMap = new Map();
                (studioConfig.deviceMatrix || [])
                    .filter(d => (d.category || d.deviceCategory || 'mobile').toLowerCase() === 'mobile' || (! (d.brand || '').toLowerCase().includes('laptop')))
                    .forEach(d => {
                        const bName = d.brand;
                        if (!bName) return;
                        if (!brandMap.has(bName)) {
                            brandMap.set(bName, { id: d.brandId || bName, name: bName, models: [] });
                        }
                        brandMap.get(bName).models.push({ id: d.modelId || d.model, name: d.model, series: d.series || '' });
                    });
                availableBrands = Array.from(brandMap.values());
            }
        }

        const labelText = isLaptop ? "Select Laptop Brand" : "Select Mobile Brand";
        selectBrand.innerHTML = `<option value="" disabled selected>${labelText}</option>` +
            availableBrands.map(b => `<option value="${b.id || b.name}">${b.name}</option>`).join('');
        
        selectBrand.onchange = () => {
            const val = selectBrand.value;
            selectedBrand = availableBrands.find(b => (b.id === val || b.name === val)) || { id: val, name: val, models: [] };
            selectedModel = null;
            if (modelSearchInput) {
                modelSearchInput.value = "";
                modelSearchInput.disabled = false;
            }
            if (modelDropdownOptions) {
                modelDropdownOptions.innerHTML = "";
                modelDropdownOptions.classList.add('hidden');
            }
            filterAndDisplayModels();
        };
    }

    if (modelSearchInput) {
        modelSearchInput.addEventListener('input', () => filterAndDisplayModels());
        modelSearchInput.addEventListener('focus', () => filterAndDisplayModels());
    }

    function filterAndDisplayModels() {
        if (!modelDropdownOptions) return;
        const query = (modelSearchInput ? modelSearchInput.value : '').toLowerCase().trim();
        let modelsList = [];

        if (selectedBrand && selectedBrand.models && selectedBrand.models.length > 0) {
            modelsList = selectedBrand.models;
        } else if (studioConfig && studioConfig.deviceMatrix) {
            modelsList = (studioConfig.deviceMatrix || []).filter(d => {
                const devCat = (d.category || d.deviceCategory || 'Mobile').toLowerCase();
                if (flowType === 'laptop') {
                    return devCat === 'laptop' || (d.brand || '').toLowerCase().includes('laptop') || (d.brand || '').toLowerCase().includes('macbook');
                }
                return devCat === 'mobile' || (! (d.brand || '').toLowerCase().includes('laptop'));
            });
        }

        if (query) {
            modelsList = modelsList.filter(m => (m.name || m.model || '').toLowerCase().includes(query));
        }

        if (modelsList.length > 0) {
            modelDropdownOptions.innerHTML = modelsList.map(m => {
                const name = m.name || m.model;
                return `<div class="px-3.5 py-2 text-xs font-bold text-gray-900 hover:bg-[#03045E]/10 cursor-pointer transition-colors" onclick="selectDeviceModel('${name}')">${name}</div>`;
            }).join('');
            modelDropdownOptions.classList.remove('hidden');
        } else {
            modelDropdownOptions.innerHTML = `<div class="px-3.5 py-2 text-xs text-gray-400">No matching models found</div>`;
            modelDropdownOptions.classList.remove('hidden');
        }
    }

    window.selectDeviceModel = function(modelName) {
        selectedModel = (studioConfig?.deviceMatrix || []).find(d => d.model === modelName);
        if (!selectedModel) {
            selectedModel = { model: modelName, category: flowType === 'laptop' ? 'Laptop' : 'Mobile', series: 'Series' };
        }

        if (modelSearchInput) modelSearchInput.value = modelName;
        if (modelDropdownOptions) modelDropdownOptions.classList.add('hidden');
        if (badgeDeviceName) badgeDeviceName.textContent = modelName;

        // Camera bump customization for Mobile
        if (cameraBump) {
            if (flowType === 'laptop') {
                cameraBump.className = "hidden";
            } else if (selectedModel.cameraBump === 'apple') {
                cameraBump.className = "camera-bump rounded-3xl w-20 h-20";
            } else if (selectedModel.cameraBump === 'samsung') {
                cameraBump.className = "camera-bump rounded-full w-10 h-28";
            } else {
                cameraBump.className = "camera-bump rounded-xl w-24 h-9";
            }
        }

        refreshPricing();
    };

    // 7. Editor Sub-tabs Switching (Adjust / Transform / Text)
    window.switchEditorSubtab = function(tabName) {
        if (tabName === 'adjust') {
            if (tabBtnAdjust) tabBtnAdjust.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all bg-white text-[#03045E] shadow-sm text-center";
            if (tabBtnTransform) tabBtnTransform.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";
            if (tabBtnText) tabBtnText.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";
            
            if (panelAdjust) panelAdjust.classList.remove('hidden');
            if (panelTransform) panelTransform.classList.add('hidden');
            if (panelText) panelText.classList.add('hidden');
            activeObject = 'artwork';
            selectedLayerId = null;
        } else if (tabName === 'transform') {
            if (tabBtnTransform) tabBtnTransform.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all bg-white text-[#03045E] shadow-sm text-center";
            if (tabBtnAdjust) tabBtnAdjust.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";
            if (tabBtnText) tabBtnText.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";

            if (panelTransform) panelTransform.classList.remove('hidden');
            if (panelAdjust) panelAdjust.classList.add('hidden');
            if (panelText) panelText.classList.add('hidden');
            activeObject = 'artwork';
            selectedLayerId = null;
        } else if (tabName === 'text') {
            if (tabBtnText) tabBtnText.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all bg-white text-[#03045E] shadow-sm text-center";
            if (tabBtnAdjust) tabBtnAdjust.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";
            if (tabBtnTransform) tabBtnTransform.className = "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all text-gray-500 hover:text-gray-900 text-center";

            if (panelText) panelText.classList.remove('hidden');
            if (panelAdjust) panelAdjust.classList.add('hidden');
            if (panelTransform) panelTransform.classList.add('hidden');
            
            if (textLayers.length > 0 && !selectedLayerId) {
                selectTextLayer(textLayers[0].id);
            }
        }
        updateSelectionBox();
    };

    if (tabBtnAdjust) tabBtnAdjust.addEventListener('click', () => switchEditorSubtab('adjust'));
    if (tabBtnTransform) tabBtnTransform.addEventListener('click', () => switchEditorSubtab('transform'));
    if (tabBtnText) tabBtnText.addEventListener('click', () => switchEditorSubtab('text'));

    // 8. Responsive Viewport Mockup Containment Sizing Fix
    function fitMockupToViewport() {
        if (!previewCanvasArea || !previewRotationWrapper) return;

        const availableWidth = previewCanvasArea.clientWidth - 24;
        const availableHeight = previewCanvasArea.clientHeight - 24;
        const mask = getActiveMaskContainer();
        if (!mask) return;

        const baseWidth = flowType === 'laptop' ? 420 : 250;
        const baseHeight = flowType === 'laptop' ? 270 : 490;

        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;
        const fitScale = Math.min(1.0, scaleX, scaleY);

        previewRotationWrapper.style.transform = `scale(${fitScale.toFixed(3)})`;
    }

    window.addEventListener('resize', fitMockupToViewport);

    // 9. Canvas Rendering & Transformations
    function renderCanvas() {
        fitMockupToViewport();
        applyTransformations();
        refreshPricing();
        renderTextLayers();
    }

    function applyTransformations() {
        const activeImg = getActivePreviewImg();
        if (activeImg) {
            activeImg.style.transform = `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) rotate(${rotation}deg) scale(${scale}) scaleX(${flipH}) scaleY(${flipV})`;
            activeImg.style.opacity = opacity / 100;
        }
        updateSelectionBox();
    }

    function updateSelectionBox() {
        if (!selectionBox) return;
        const activeImg = getActivePreviewImg();
        const activeMask = getActiveMaskContainer();

        if (activeObject === 'artwork' && activeImg && activeMask && uploadedImageUrl) {
            selectionBox.classList.remove('hidden');
            const rect = activeImg.getBoundingClientRect();
            const parentRect = activeMask.getBoundingClientRect();
            
            selectionBox.style.width = `${rect.width}px`;
            selectionBox.style.height = `${rect.height}px`;
            selectionBox.style.left = `${rect.left - parentRect.left}px`;
            selectionBox.style.top = `${rect.top - parentRect.top}px`;
            selectionBox.style.transform = `rotate(${rotation}deg)`;
        } else if (selectedLayerId) {
            selectionBox.classList.remove('hidden');
            const node = document.getElementById(`layer-${selectedLayerId}`);
            if (node && activeMask) {
                const rect = node.getBoundingClientRect();
                const parentRect = activeMask.getBoundingClientRect();
                selectionBox.style.width = `${rect.width}px`;
                selectionBox.style.height = `${rect.height}px`;
                selectionBox.style.left = `${rect.left - parentRect.left}px`;
                selectionBox.style.top = `${rect.top - parentRect.top}px`;
                selectionBox.style.transform = `rotate(${node.getAttribute('data-rotate') || 0}deg)`;
            }
        } else {
            selectionBox.classList.add('hidden');
        }
    }

    // Sliders event bindings
    if (sliderZoom) {
        sliderZoom.addEventListener('input', () => {
            scale = parseFloat(sliderZoom.value) / 100;
            if (valZoom) valZoom.textContent = `${sliderZoom.value}%`;
            applyTransformations();
        });
    }

    if (sliderRotate) {
        sliderRotate.addEventListener('input', () => {
            rotation = parseInt(sliderRotate.value);
            if (valRotate) valRotate.textContent = `${rotation}°`;
            applyTransformations();
        });
    }

    if (sliderOpacity) {
        sliderOpacity.addEventListener('input', () => {
            opacity = parseInt(sliderOpacity.value);
            if (valOpacity) valOpacity.textContent = `${opacity}%`;
            applyTransformations();
        });
    }

    if (btnFlipH) {
        btnFlipH.addEventListener('click', () => {
            flipH = flipH === 1 ? -1 : 1;
            applyTransformations();
        });
    }

    if (btnFlipV) {
        btnFlipV.addEventListener('click', () => {
            flipV = flipV === 1 ? -1 : 1;
            applyTransformations();
        });
    }

    window.triggerFitFill = function() {
        scale = flowType === 'laptop' ? 0.65 : 0.45;
        if (sliderZoom) sliderZoom.value = Math.round(scale * 100);
        if (valZoom) valZoom.textContent = `${sliderZoom.value}%`;
        translateX = 0;
        translateY = 0;
        rotation = 0;
        if (sliderRotate) sliderRotate.value = 0;
        if (valRotate) valRotate.textContent = "0°";
        applyTransformations();
    };

    if (btnResetTransform) {
        btnResetTransform.addEventListener('click', () => {
            scale = flowType === 'laptop' ? 0.5 : 0.35;
            rotation = 0;
            opacity = 100;
            translateX = 0;
            translateY = 0;
            flipH = 1;
            flipV = 1;

            if (sliderZoom) sliderZoom.value = Math.round(scale * 100);
            if (valZoom) valZoom.textContent = `${sliderZoom.value}%`;
            if (sliderRotate) sliderRotate.value = 0;
            if (valRotate) valRotate.textContent = "0°";
            if (sliderOpacity) sliderOpacity.value = 100;
            if (valOpacity) valOpacity.textContent = "100%";

            applyTransformations();
        });
    }

    if (btnCanvasFit) btnCanvasFit.addEventListener('click', triggerFitFill);
    if (btnCanvasCenter) {
        btnCanvasCenter.addEventListener('click', () => {
            translateX = 0;
            translateY = 0;
            applyTransformations();
        });
    }
    if (btnResetLayout) btnResetLayout.addEventListener('click', triggerFitFill);

    if (btnRotate90) {
        btnRotate90.addEventListener('click', () => {
            rotation = (rotation + 90) % 360;
            if (sliderRotate) sliderRotate.value = rotation;
            if (valRotate) valRotate.textContent = `${rotation}°`;
            applyTransformations();
        });
    }

    if (btnToggleGrid) {
        btnToggleGrid.addEventListener('click', () => {
            const gridEl = getActiveGridOverlay();
            if (gridEl) gridEl.classList.toggle('hidden');
            btnToggleGrid.classList.toggle('bg-[#03045E]/10');
        });
    }

    // Mouse drag interaction on preview mask
    [phoneMaskContainer, laptopMaskContainer].forEach(container => {
        if (!container) return;
        container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.studio-text-layer')) return;
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
        });
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            translateX = Math.round(e.clientX - startX);
            translateY = Math.round(e.clientY - startY);
            applyTransformations();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) isDragging = false;
    });

    // 10. REAL FUNCTIONAL TEXT TOOL IMPLEMENTATION WITH PROPER FONT RENDERING
    if (btnAddTextLayer) {
        btnAddTextLayer.addEventListener('click', () => {
            const currentFont = (textLayerFont && textLayerFont.value) ? textLayerFont.value : 'Inter';
            const newLayer = {
                id: Date.now().toString(),
                text: "OM Mobile Art",
                fontFamily: currentFont,
                size: 24,
                align: 'center',
                color: "#03045E",
                opacity: 100,
                rotate: 0,
                translateX: 0,
                translateY: 0
            };

            textLayers.push(newLayer);
            renderTextLayers();
            selectTextLayer(newLayer.id);
        });
    }

    function selectTextLayer(id) {
        selectedLayerId = id;
        activeObject = 'text';
        
        document.querySelectorAll('.studio-text-layer').forEach(node => node.classList.remove('selected-layer'));
        const activeNode = document.getElementById(`layer-${id}`);
        if (activeNode) activeNode.classList.add('selected-layer');

        const layerObj = textLayers.find(l => l.id === id);
        if (layerObj && textPropertiesPanel) {
            textPropertiesPanel.classList.remove('hidden');
            if (textLayerString) textLayerString.value = layerObj.text;
            if (textLayerFont) textLayerFont.value = layerObj.fontFamily;
            if (textLayerSize) {
                textLayerSize.value = layerObj.size;
                if (textSizeVal) textSizeVal.textContent = `${layerObj.size}px`;
            }
            if (textLayerColor) textLayerColor.value = layerObj.color;
            if (textLayerOpacity) {
                textLayerOpacity.value = layerObj.opacity;
                if (textOpacityVal) textOpacityVal.textContent = `${layerObj.opacity}%`;
            }
            if (textLayerRotate) {
                textLayerRotate.value = layerObj.rotate;
                if (textRotateVal) textRotateVal.textContent = `${layerObj.rotate}°`;
            }
            updateAlignButtons(layerObj.align || 'center');
        }

        updateSelectionBox();
    }

    function updateAlignButtons(align) {
        [btnTextAlignLeft, btnTextAlignCenter, btnTextAlignRight].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('bg-[#03045E]', 'text-white');
            btn.classList.add('text-gray-700');
        });
        if (align === 'left' && btnTextAlignLeft) {
            btnTextAlignLeft.classList.add('bg-[#03045E]', 'text-white');
            btnTextAlignLeft.classList.remove('text-gray-700');
        } else if (align === 'right' && btnTextAlignRight) {
            btnTextAlignRight.classList.add('bg-[#03045E]', 'text-white');
            btnTextAlignRight.classList.remove('text-gray-700');
        } else if (btnTextAlignCenter) {
            btnTextAlignCenter.classList.add('bg-[#03045E]', 'text-white');
            btnTextAlignCenter.classList.remove('text-gray-700');
        }
    }

    window.selectTextLayer = selectTextLayer;

    function renderTextLayers() {
        const activeTextOverlay = getActiveTextOverlay();
        if (!activeTextOverlay || !textLayersList) return;

        activeTextOverlay.innerHTML = "";
        textLayersList.innerHTML = "";

        textLayers.forEach(l => {
            // Right Sidebar Layer Row
            const row = document.createElement('div');
            row.className = "flex items-center justify-between py-1.5 px-2.5 text-xs border rounded-xl cursor-pointer transition-all " + 
                (selectedLayerId === l.id ? "bg-[#03045E]/10 border-[#03045E] font-bold" : "bg-white border-gray-200 hover:border-gray-400");
            row.onclick = () => selectTextLayer(l.id);
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-md bg-[#03045E]/10 text-[#03045E] text-[10px] font-black flex items-center justify-center">T</span>
                    <span class="text-gray-900 truncate max-w-[120px]">${l.text || 'Untitled Text'}</span>
                </div>
                <button type="button" onclick="deleteTextLayerById('${l.id}')" class="text-gray-400 hover:text-red-600 transition-colors p-0.5" title="Delete layer">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            `;
            textLayersList.appendChild(row);

            // Canvas Text Element (DYNAMIC FONT RENDERING)
            const el = document.createElement('div');
            el.id = `layer-${l.id}`;
            el.className = "studio-text-layer pointer-events-auto " + (selectedLayerId === l.id ? "selected-layer" : "");
            el.textContent = l.text || '';
            el.style.fontFamily = `"${l.fontFamily}", sans-serif`;
            el.style.fontSize = `${l.size}px`;
            el.style.color = l.color;
            el.style.opacity = (l.opacity / 100);
            el.style.textAlign = l.align || 'center';
            el.style.left = `50%`;
            el.style.top = `50%`;
            el.style.transform = `translate(calc(-50% + ${l.translateX}px), calc(-50% + ${l.translateY}px)) rotate(${l.rotate}deg)`;
            el.setAttribute('data-rotate', l.rotate);

            let isTextDraggingLayer = false;
            let textStartX = 0, textStartY = 0;

            el.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                isTextDraggingLayer = true;
                selectTextLayer(l.id);
                textStartX = e.clientX - l.translateX;
                textStartY = e.clientY - l.translateY;

                const onMouseMove = (me) => {
                    if (isTextDraggingLayer) {
                        l.translateX = Math.round(me.clientX - textStartX);
                        l.translateY = Math.round(me.clientY - textStartY);
                        el.style.transform = `translate(calc(-50% + ${l.translateX}px), calc(-50% + ${l.translateY}px)) rotate(${l.rotate}deg)`;
                        updateSelectionBox();
                    }
                };
                const onMouseUp = () => {
                    isTextDraggingLayer = false;
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            activeTextOverlay.appendChild(el);
        });

        updateSelectionBox();
    }

    if (textLayerString) {
        textLayerString.addEventListener('input', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.text = textLayerString.value;
                renderTextLayers();
            }
        });
    }

    // FONT FAMILY SELECTION EVENT — VISUALLY UPDATES CANVAS TEXT IMMEDIATELY
    if (textLayerFont) {
        textLayerFont.addEventListener('change', () => {
            const newFont = textLayerFont.value;
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.fontFamily = newFont;
                
                // Pre-load font if Font Loading API is available
                if (document.fonts && document.fonts.load) {
                    document.fonts.load(`16px "${newFont}"`).then(() => {
                        renderTextLayers();
                    }).catch(() => {
                        renderTextLayers();
                    });
                } else {
                    renderTextLayers();
                }
            }
        });
    }

    if (textLayerSize) {
        textLayerSize.addEventListener('input', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.size = parseInt(textLayerSize.value);
                if (textSizeVal) textSizeVal.textContent = `${layerObj.size}px`;
                renderTextLayers();
            }
        });
    }

    if (textLayerColor) {
        textLayerColor.addEventListener('input', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.color = textLayerColor.value;
                renderTextLayers();
            }
        });
    }

    if (textLayerOpacity) {
        textLayerOpacity.addEventListener('input', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.opacity = parseInt(textLayerOpacity.value);
                if (textOpacityVal) textOpacityVal.textContent = `${layerObj.opacity}%`;
                renderTextLayers();
            }
        });
    }

    if (textLayerRotate) {
        textLayerRotate.addEventListener('input', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.rotate = parseInt(textLayerRotate.value);
                if (textRotateVal) textRotateVal.textContent = `${layerObj.rotate}°`;
                renderTextLayers();
            }
        });
    }

    if (btnTextAlignLeft) {
        btnTextAlignLeft.addEventListener('click', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.align = 'left';
                updateAlignButtons('left');
                renderTextLayers();
            }
        });
    }

    if (btnTextAlignCenter) {
        btnTextAlignCenter.addEventListener('click', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.align = 'center';
                updateAlignButtons('center');
                renderTextLayers();
            }
        });
    }

    if (btnTextAlignRight) {
        btnTextAlignRight.addEventListener('click', () => {
            const layerObj = textLayers.find(l => l.id === selectedLayerId);
            if (layerObj) {
                layerObj.align = 'right';
                updateAlignButtons('right');
                renderTextLayers();
            }
        });
    }

    window.deleteTextLayerById = function(id) {
        textLayers = textLayers.filter(l => l.id !== id);
        if (selectedLayerId === id) {
            selectedLayerId = null;
            if (textPropertiesPanel) textPropertiesPanel.classList.add('hidden');
        }
        renderTextLayers();
    };

    if (btnDeleteTextLayer) {
        btnDeleteTextLayer.addEventListener('click', () => {
            if (selectedLayerId) deleteTextLayerById(selectedLayerId);
        });
    }

    // 11. Pricing Math Calculations (STRICTLY BASED ON CUSTOMIZATION TYPE: Mobile ₹300 vs Laptop ₹500)
    function refreshPricing() {
        const basePrice = flowType === 'laptop' ? 500 : 300;
        const total = basePrice * qty;

        if (customSkinPriceLabel) customSkinPriceLabel.textContent = `₹${total}`;
        return total;
    }

    window.adjustQty = function(diff) {
        qty += diff;
        if (qty < 1) qty = 1;
        if (inputQty) inputQty.value = qty;
        refreshPricing();
    };

    if (inputQty) {
        inputQty.addEventListener('input', () => {
            qty = parseInt(inputQty.value) || 1;
            if (qty < 1) qty = 1;
            refreshPricing();
        });
    }

    // 12. Add to Cart Handler
    if (btnNextReview) {
        btnNextReview.addEventListener('click', async () => {
            const basePrice = flowType === 'laptop' ? 500 : 300;
            const totalPrice = basePrice * qty;
            const devBrandName = selectedModel?.brand || selectedModel?.brandName || (flowType === 'laptop' ? 'Laptop' : 'Mobile Device');
            const devModelName = selectedModel?.model || selectedModel?.name || (flowType === 'laptop' ? 'Laptop Custom Skin' : 'Mobile Custom Skin');

            const customProduct = {
                id: Date.now(),
                name: `Custom Skin (${flowType === 'laptop' ? 'Laptop Back Skin' : 'Mobile Back Skin'}) - ${devModelName}`,
                price: basePrice,
                unitPrice: basePrice,
                basePrice: basePrice,
                qty: qty,
                quantity: qty,
                minOrderQuantity: 1,
                minOrderQty: 1,
                brand: devBrandName,
                deviceBrand: devBrandName,
                deviceModel: devModelName,
                deviceType: selectedModel?.deviceType || (flowType === 'laptop' ? 'Laptop' : 'Mobile'),
                device: devModelName,
                image: uploadedImageUrl || previewImgMobile.src || previewImgLaptop.src,
                imageUrl: uploadedImageUrl || previewImgMobile.src || previewImgLaptop.src,
                scale: parseFloat(scale.toFixed(4)),
                rotation: parseInt(rotation),
                translateX: Math.round(translateX),
                translateY: Math.round(translateY),
                flipX: flipH,
                flipY: flipV,
                textLayers: textLayers,
                designJson: {
                    flowType,
                    selectedModel,
                    basePrice: basePrice,
                    totalPrice: totalPrice,
                    transformations: { scale, rotation, translateX, translateY, flipH, flipV },
                    textLayers,
                    artworkUrl: uploadedImageUrl
                }
            };

            if (window.DB) {
                btnNextReview.disabled = true;
                btnNextReview.innerHTML = `<span class="flex items-center justify-center gap-2"><div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Adding...</span>`;
                
                setTimeout(() => {
                    window.DB.addToCart(customProduct);
                    btnNextReview.innerHTML = `✓ Added`;
                    if (window.showToast) window.showToast("Custom skin added to cart!", "success");
                    
                    setTimeout(() => {
                        window.location.href = 'cart.html';
                    }, 600);
                }, 400);
            }
        });
    }

    // Initialize Studio Config & UI
    await loadStudioConfig();
});
