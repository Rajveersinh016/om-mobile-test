/**
 * OM Mobile Art - Custom Skin Studio Admin Controller
 * Implements real-time configuration loading, mapping, tabbed switching, and saving.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('om_admin_auth_token') || '';
  const authHeader = token ? `Bearer ${token}` : '';

  function showToast(msg, type) {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      console.log(`[Toast ${type}] ${msg}`);
    }
  }

  if (window.AdminUploader) {
    window.guideUploader = window.AdminUploader.create({
      container: 'guide-uploader-container',
      input: 'installationGuideUrl',
      label: 'Installation Guide Template PDF / Image',
      folder: 'custom_skins'
    });
  }

  // Tabs navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('bg-[#03045E]/10', 'text-[#03045E]'));
      tabButtons.forEach(b => b.classList.add('text-gray-500'));
      btn.classList.remove('text-gray-500');
      btn.classList.add('bg-[#03045E]/10', 'text-[#03045E]');

      const target = btn.getAttribute('data-target');
      tabContents.forEach(content => {
        if (content.id === target) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });

  // Select DOM Elements references
  const deviceContainer = document.getElementById('device-rows-container');
  const materialsContainer = document.getElementById('materials-container');
  const finishesContainer = document.getElementById('finishes-container');
  const coveragesContainer = document.getElementById('coverages-container');
  const fontContainer = document.getElementById('font-rows-container');
  const faqsContainer = document.getElementById('faqs-container');

  // Input Fields
  const backPanelEnabledInput = document.getElementById('backPanelEnabled');
  const laptopBackEnabledInput = document.getElementById('laptopBackEnabled');
  const studioEnabledInput = document.getElementById('studioEnabled');
  const showFaqInput = document.getElementById('showFaq');

  const backPanelBasePriceInput = document.getElementById('backPanelBasePrice');
  const laptopBackBasePriceInput = document.getElementById('laptopBackBasePrice');
  const defaultCurrencyInput = document.getElementById('defaultCurrency');
  const taxPercentageInput = document.getElementById('taxPercentage');
  const shippingChargeInput = document.getElementById('shippingCharge');

  const lowQualityWarningInput = document.getElementById('lowQualityWarning');
  const sizeWarningInput = document.getElementById('sizeWarning');
  const maxUploadsInput = document.getElementById('maxUploads');
  const allowedAspectRatioInput = document.getElementById('allowedAspectRatio');
  const deliveryTimeInput = document.getElementById('deliveryTime');
  const orderNotesInput = document.getElementById('orderNotes');

  const enableGoogleFontsInput = document.getElementById('enableGoogleFonts');
  const textPricingExtraInput = document.getElementById('textPricingExtra');
  const maxTextLayersInput = document.getElementById('maxTextLayers');
  const maxCharactersPerLayerInput = document.getElementById('maxCharactersPerLayer');
  const allowedColorsInput = document.getElementById('allowedColors');

  const minResolutionInput = document.getElementById('minResolution');
  const maxUploadSizeInput = document.getElementById('maxUploadSize');
  const allowedFileTypesInput = document.getElementById('allowedFileTypes');
  const compressionQualityInput = document.getElementById('compressionQuality');
  const enableBackgroundRemovalInput = document.getElementById('enableBackgroundRemoval');
  const enableAutoCropInput = document.getElementById('enableAutoCrop');
  const enableSmartCenterInput = document.getElementById('enableSmartCenter');
  const enableWatermarkInput = document.getElementById('enableWatermark');

  const heroTitleInput = document.getElementById('heroTitle');
  const benefitsInput = document.getElementById('benefits');
  const heroSubtitleInput = document.getElementById('heroSubtitle');

  const videoUrlInput = document.getElementById('videoUrl');
  const installationGuideUrlInput = document.getElementById('installationGuideUrl');
  const chatLinkInput = document.getElementById('chatLink');
  const guidelinesLinkInput = document.getElementById('guidelinesLink');

  // Load configurations
  async function loadConfig() {
    try {
      const response = await fetch('http://localhost:3000/api/v1/custom-skin/settings');
      const result = await response.json();
      if (result.success && result.data) {
        settingsData = result.data;
        populateFormFields();
      } else {
        showToast("Failed to fetch custom skin settings.", "error");
      }
    } catch (error) {
      showToast("API server offline. Cannot fetch configurations.", "error");
    }
  }

  function populateFormFields() {
    if (!settingsData) return;

    backPanelEnabledInput.checked = settingsData.backPanelEnabled !== undefined ? settingsData.backPanelEnabled : true;
    laptopBackEnabledInput.checked = settingsData.laptopBackEnabled !== undefined ? settingsData.laptopBackEnabled : true;
    studioEnabledInput.checked = settingsData.studioEnabled !== undefined ? settingsData.studioEnabled : true;
    showFaqInput.checked = settingsData.showFaq !== undefined ? settingsData.showFaq : true;

    backPanelBasePriceInput.value = settingsData.backPanelBasePrice !== undefined ? settingsData.backPanelBasePrice : 300;
    laptopBackBasePriceInput.value = settingsData.laptopBackBasePrice !== undefined ? settingsData.laptopBackBasePrice : 500;
    defaultCurrencyInput.value = settingsData.defaultCurrency || "INR";
    if (taxPercentageInput) taxPercentageInput.value = 0;
    shippingChargeInput.value = settingsData.shippingCharge !== undefined ? settingsData.shippingCharge : 50;

    lowQualityWarningInput.value = settingsData.warningMessages?.lowQualityWarning || settingsData.lowQualityWarning || "";
    sizeWarningInput.value = settingsData.warningMessages?.sizeWarning || settingsData.sizeWarning || "";
    maxUploadsInput.value = settingsData.maxUploads !== undefined ? settingsData.maxUploads : 5;
    allowedAspectRatioInput.value = settingsData.allowedAspectRatio || "any";
    deliveryTimeInput.value = settingsData.deliveryTime || "Dispatched in 24 hours";
    orderNotesInput.value = settingsData.orderNotes || "";

    enableGoogleFontsInput.checked = settingsData.enableGoogleFonts !== undefined ? settingsData.enableGoogleFonts : true;
    textPricingExtraInput.value = settingsData.textPricingExtra !== undefined ? settingsData.textPricingExtra : 0;
    maxTextLayersInput.value = settingsData.maxTextLayers !== undefined ? settingsData.maxTextLayers : 10;
    maxCharactersPerLayerInput.value = settingsData.maxCharactersPerLayer !== undefined ? settingsData.maxCharactersPerLayer : 40;
    allowedColorsInput.value = (settingsData.allowedColors || []).join(', ');

    minResolutionInput.value = settingsData.minResolution || settingsData.recommendedResolution || "1200x2400";
    maxUploadSizeInput.value = settingsData.maxUploadSize !== undefined ? settingsData.maxUploadSize : 10;
    allowedFileTypesInput.value = (settingsData.allowedFileTypes || ["png", "jpg", "jpeg", "webp"]).join(', ');
    compressionQualityInput.value = settingsData.compressionQuality !== undefined ? settingsData.compressionQuality : 0.8;
    enableBackgroundRemovalInput.checked = settingsData.enableBackgroundRemoval !== undefined ? settingsData.enableBackgroundRemoval : true;
    enableAutoCropInput.checked = settingsData.enableAutoCrop !== undefined ? settingsData.enableAutoCrop : true;
    enableSmartCenterInput.checked = settingsData.enableSmartCenter !== undefined ? settingsData.enableSmartCenter : true;
    enableWatermarkInput.checked = settingsData.enableWatermark !== undefined ? settingsData.enableWatermark : false;

    heroTitleInput.value = settingsData.heroTitle || "";
    benefitsInput.value = (settingsData.benefits || []).join(', ');
    heroSubtitleInput.value = settingsData.heroSubtitle || "";

    videoUrlInput.value = settingsData.videoUrl || "";
    installationGuideUrlInput.value = settingsData.installationGuideUrl || "";
    chatLinkInput.value = settingsData.helpLinks?.chatLink || "";
    guidelinesLinkInput.value = settingsData.helpLinks?.guidelinesLink || "";

    // Load tables
    renderDevices();
    renderMaterials();
    renderFinishes();
    renderCoverages();
    renderFonts();
    renderFaqs();
  }

  // Upload Asset handler helper
  async function uploadAssetFile(file, elementInput) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      try {
        const response = await fetch('http://localhost:3000/api/v1/custom-skin/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            content: base64,
            filename: file.name
          })
        });
        const result = await response.json();
        if (result.success && result.data.url) {
          elementInput.value = result.data.url.startsWith('/') ? 'http://localhost:3000' + result.data.url : result.data.url;
          elementInput.dispatchEvent(new Event('change'));
          showToast("Mockup asset uploaded successfully!", "success");
        } else {
          showToast("Failed to upload asset.", "error");
        }
      } catch (err) {
        showToast("Error upload file request.", "error");
      }
    };
    reader.readAsDataURL(file);
  }

  // Devices Matrix
  function renderDevices() {
    deviceContainer.innerHTML = "";
    (settingsData.devices || []).forEach((dev, idx) => {
      const trMain = document.createElement('tr');
      trMain.className = "border-b border-[#E8E8E8] hover:bg-zinc-50 transition-all font-bold text-xs";
      trMain.innerHTML = `
        <td class="px-4 py-3"><input type="text" class="h-9 w-20 px-2 border rounded-xl text-xs font-bold" value="${dev.category || ''}" data-index="${idx}" data-field="category"></td>
        <td class="px-4 py-3"><input type="text" class="h-9 w-20 px-2 border rounded-xl text-xs font-bold" value="${dev.brand || ''}" data-index="${idx}" data-field="brand"></td>
        <td class="px-4 py-3"><input type="text" class="h-9 w-28 px-2 border rounded-xl text-xs font-bold" value="${dev.series || ''}" data-index="${idx}" data-field="series"></td>
        <td class="px-4 py-3"><input type="text" class="h-9 w-36 px-2 border rounded-xl text-xs font-bold" value="${dev.model || ''}" data-index="${idx}" data-field="model"></td>
        <td class="px-4 py-3">
          <select class="h-9 px-2 border rounded-xl text-xs bg-white font-bold" data-index="${idx}" data-field="cameraBump">
            <option value="apple" ${dev.cameraBump === 'apple' ? 'selected' : ''}>Apple Style</option>
            <option value="samsung" ${dev.cameraBump === 'samsung' ? 'selected' : ''}>Samsung Style</option>
            <option value="google" ${dev.cameraBump === 'google' ? 'selected' : ''}>Google Style</option>
            <option value="nothing" ${dev.cameraBump === 'nothing' ? 'selected' : ''}>Nothing Style</option>
          </select>
        </td>
        <td class="px-4 py-3"><input type="number" class="h-9 w-20 px-2 border rounded-xl text-xs font-bold" value="${dev.extraCharge || 0}" data-index="${idx}" data-field="extraCharge"></td>
        <td class="px-4 py-3 text-right space-x-2">
          <button type="button" class="btn-toggle-device-details text-[#03045E] font-bold hover:underline" data-index="${idx}">Assets</button>
          <button type="button" class="btn-delete-device text-red-500 hover:text-red-700" data-index="${idx}">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </td>
      `;

      const trDetails = document.createElement('tr');
      trDetails.id = `device-details-${idx}`;
      trDetails.className = "hidden bg-zinc-50 border-b border-[#E8E8E8]";
      trDetails.innerHTML = `
        <td colspan="7" class="px-6 py-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div class="space-y-2">
              <span class="text-xs font-bold text-gray-700 block">Phone mockup (Mockup URL)</span>
              <div class="flex gap-2">
                <input type="text" class="h-8 flex-1 px-2 border rounded text-xs" value="${dev.phoneMockup || ''}" data-index="${idx}" data-field="phoneMockup" id="input-mockup-${idx}">
                <input type="file" class="hidden file-upload-mockup" data-index="${idx}" data-field="phoneMockup" id="file-mockup-${idx}">
                <button type="button" class="btn-trigger-upload h-8 px-3 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold" data-target="file-mockup-${idx}">Upload</button>
              </div>
            </div>
            <div class="space-y-2">
              <span class="text-xs font-bold text-gray-700 block">Boundary Mask URL</span>
              <div class="flex gap-2">
                <input type="text" class="h-8 flex-1 px-2 border rounded text-xs" value="${dev.deviceMask || ''}" data-index="${idx}" data-field="deviceMask" id="input-mask-${idx}">
                <input type="file" class="hidden file-upload-mockup" data-index="${idx}" data-field="deviceMask" id="file-mask-${idx}">
                <button type="button" class="btn-trigger-upload h-8 px-3 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold" data-target="file-mask-${idx}">Upload</button>
              </div>
            </div>
            <div class="space-y-2">
              <span class="text-xs font-bold text-gray-700 block">Delivery status</span>
              <input type="text" class="h-8 w-full px-2 border rounded text-xs" value="${dev.stockStatus || 'In Stock'}" data-index="${idx}" data-field="stockStatus">
            </div>
          </div>
        </td>
      `;

      deviceContainer.appendChild(trMain);
      deviceContainer.appendChild(trDetails);
    });

    // Inputs change
    deviceContainer.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        if (settingsData.devices[idx]) {
          settingsData.devices[idx][field] = val;
        }
      });
    });

    // Upload triggers
    deviceContainer.querySelectorAll('.btn-trigger-upload').forEach(btn => {
      btn.addEventListener('click', () => {
        const fileId = btn.getAttribute('data-target');
        document.getElementById(fileId).click();
      });
    });

    deviceContainer.querySelectorAll('.file-upload-mockup').forEach(upload => {
      upload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const idx = parseInt(e.target.getAttribute('data-index'));
          const field = e.target.getAttribute('data-field');
          const targetInput = document.getElementById(`input-${field === 'phoneMockup' ? 'mockup' : 'mask'}-${idx}`);
          uploadAssetFile(e.target.files[0], targetInput);
        }
      });
    });

    // Toggle details
    deviceContainer.querySelectorAll('.btn-toggle-device-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-index');
        document.getElementById(`device-details-${idx}`).classList.toggle('hidden');
      });
    });

    // Delete
    deviceContainer.querySelectorAll('.btn-delete-device').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        settingsData.devices.splice(idx, 1);
        renderDevices();
      });
    });
  }

  document.getElementById('btn-add-device').addEventListener('click', () => {
    if (!settingsData.devices) settingsData.devices = [];
    settingsData.devices.push({
      category: "Mobile",
      brand: selectedBrand || "Brand Name",
      series: "Series Model",
      model: "New Device Pro",
      cameraBump: "apple",
      extraCharge: 0,
      phoneMockup: "",
      deviceMask: "",
      stockStatus: "In Stock"
    });
    renderDevices();
  });

  // Materials
  function renderMaterials() {
    materialsContainer.innerHTML = "";
    (settingsData.materials || []).forEach((mat, idx) => {
      const div = document.createElement('div');
      div.className = "bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 space-y-3 relative hover:shadow-sm transition-all";
      div.innerHTML = `
        <button type="button" class="btn-delete-material absolute top-4 right-4 text-red-500" data-index="${idx}">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Material Name</label>
            <input type="text" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${mat.name || ''}" data-index="${idx}" data-field="name">
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Surcharge Price (₹)</label>
            <input type="number" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${mat.extraCharge || 0}" data-index="${idx}" data-field="extraCharge">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Texture Color Hex / URL</label>
            <input type="text" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${mat.texture || ''}" data-index="${idx}" data-field="texture">
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Sort Order</label>
            <input type="number" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${mat.sortOrder || 0}" data-index="${idx}" data-field="sortOrder">
          </div>
        </div>
        <div class="flex gap-4 pt-1">
          <label class="flex items-center gap-1.5 text-xs font-bold">
            <input type="checkbox" class="w-4 h-4 text-[#03045E] border-gray-300 rounded" ${mat.isActive ? 'checked' : ''} data-index="${idx}" data-field="isActive"> Enabled
          </label>
          <label class="flex items-center gap-1.5 text-xs font-bold">
            <input type="checkbox" class="w-4 h-4 text-[#03045E] border-gray-300 rounded" ${mat.isAvailable !== false ? 'checked' : ''} data-index="${idx}" data-field="isAvailable"> Available
          </label>
        </div>
      `;
      materialsContainer.appendChild(div);
    });

    materialsContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value);
        if (settingsData.materials[idx]) {
          settingsData.materials[idx][field] = val;
        }
      });
    });

    materialsContainer.querySelectorAll('.btn-delete-material').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        settingsData.materials.splice(idx, 1);
        renderMaterials();
      });
    });
  }

  document.getElementById('btn-add-material').addEventListener('click', () => {
    if (!settingsData.materials) settingsData.materials = [];
    settingsData.materials.push({
      name: "New Custom Material",
      slug: "new-material-" + Date.now(),
      extraCharge: 100,
      texture: "#222222",
      sortOrder: settingsData.materials.length + 1,
      isActive: true,
      isAvailable: true
    });
    renderMaterials();
  });

  // Finishes
  function renderFinishes() {
    finishesContainer.innerHTML = "";
    (settingsData.finishes || []).forEach((fin, idx) => {
      const div = document.createElement('div');
      div.className = "bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 space-y-3 relative hover:shadow-sm transition-all";
      div.innerHTML = `
        <button type="button" class="btn-delete-finish absolute top-4 right-4 text-red-500" data-index="${idx}">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
        <div class="space-y-1">
          <label class="text-[9px] font-bold text-gray-500 uppercase block">Finish Name</label>
          <input type="text" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${fin.name || ''}" data-index="${idx}" data-field="name">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Extra Price (₹)</label>
            <input type="number" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${fin.extraCharge || 0}" data-index="${idx}" data-field="extraCharge">
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Sort Order</label>
            <input type="number" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${fin.sortOrder || 0}" data-index="${idx}" data-field="sortOrder">
          </div>
        </div>
        <label class="flex items-center gap-1.5 text-xs font-bold">
          <input type="checkbox" class="w-4 h-4 text-[#03045E] border-gray-300 rounded" ${fin.isActive ? 'checked' : ''} data-index="${idx}" data-field="isActive"> Enabled
        </label>
      `;
      finishesContainer.appendChild(div);
    });

    finishesContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value);
        if (settingsData.finishes[idx]) {
          settingsData.finishes[idx][field] = val;
        }
      });
    });

    finishesContainer.querySelectorAll('.btn-delete-finish').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        settingsData.finishes.splice(idx, 1);
        renderFinishes();
      });
    });
  }

  document.getElementById('btn-add-finish').addEventListener('click', () => {
    if (!settingsData.finishes) settingsData.finishes = [];
    settingsData.finishes.push({
      name: "New Surface Finish",
      slug: "new-finish-" + Date.now(),
      extraCharge: 50,
      sortOrder: settingsData.finishes.length + 1,
      isActive: true
    });
    renderFinishes();
  });

  // Coverages
  function renderCoverages() {
    coveragesContainer.innerHTML = "";
    (settingsData.coverages || settingsData.coverage || []).forEach((cov, idx) => {
      const div = document.createElement('div');
      div.className = "bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 space-y-3 relative hover:shadow-sm transition-all";
      div.innerHTML = `
        <button type="button" class="btn-delete-coverage absolute top-4 right-4 text-red-500" data-index="${idx}">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Coverage Name</label>
            <input type="text" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${cov.name || ''}" data-index="${idx}" data-field="name">
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-bold text-gray-500 uppercase block">Surcharge (₹)</label>
            <input type="number" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${cov.extraCharge || 0}" data-index="${idx}" data-field="extraCharge">
          </div>
        </div>
        <label class="flex items-center gap-1.5 text-xs font-bold">
          <input type="checkbox" class="w-4 h-4 text-[#03045E] border-gray-300 rounded" ${cov.isActive ? 'checked' : ''} data-index="${idx}" data-field="isActive"> Enabled
        </label>
      `;
      coveragesContainer.appendChild(div);
    });

    coveragesContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value);
        const list = settingsData.coverages || settingsData.coverage;
        if (list[idx]) {
          list[idx][field] = val;
        }
      });
    });

    coveragesContainer.querySelectorAll('.btn-delete-coverage').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        const list = settingsData.coverages || settingsData.coverage;
        list.splice(idx, 1);
        renderCoverages();
      });
    });
  }

  document.getElementById('btn-add-coverage').addEventListener('click', () => {
    let list = settingsData.coverages || settingsData.coverage;
    if (!list) {
      settingsData.coverages = [];
      list = settingsData.coverages;
    }
    list.push({
      name: "Full coverage",
      slug: "full-coverage-" + Date.now(),
      extraCharge: 50,
      isActive: true
    });
    renderCoverages();
  });

  // Fonts
  function renderFonts() {
    fontContainer.innerHTML = "";
    (settingsData.fonts || []).forEach((font, idx) => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-zinc-50 border-b";
      tr.innerHTML = `
        <td class="px-4 py-2"><input type="text" class="h-8 px-2 border rounded text-xs font-bold w-28" value="${font.name || ''}" data-index="${idx}" data-field="name"></td>
        <td class="px-4 py-2"><input type="text" class="h-8 px-2 border rounded text-xs font-bold w-32" value="${font.slug || ''}" data-index="${idx}" data-field="slug"></td>
        <td class="px-4 py-2"><input type="text" class="h-8 px-2 border rounded text-xs font-bold w-48" value="${font.fileUrl || ''}" data-index="${idx}" data-field="fileUrl"></td>
        <td class="px-4 py-2"><input type="text" class="h-8 px-2 border rounded text-xs font-bold w-20" value="${font.category || ''}" data-index="${idx}" data-field="category"></td>
        <td class="px-4 py-2"><input type="checkbox" class="w-4 h-4 text-[#03045E]" ${font.isDefault ? 'checked' : ''} data-index="${idx}" data-field="isDefault"></td>
        <td class="px-4 py-2"><input type="checkbox" class="w-4 h-4 text-[#03045E]" ${font.isActive ? 'checked' : ''} data-index="${idx}" data-field="isActive"></td>
        <td class="px-4 py-2 text-right">
          <button type="button" class="btn-delete-font text-red-500" data-index="${idx}"><span class="material-symbols-outlined text-sm">delete</span></button>
        </td>
      `;
      fontContainer.appendChild(tr);
    });

    fontContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (settingsData.fonts[idx]) {
          settingsData.fonts[idx][field] = val;
        }
      });
    });

    fontContainer.querySelectorAll('.btn-delete-font').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        settingsData.fonts.splice(idx, 1);
        renderFonts();
      });
    });
  }

  document.getElementById('btn-add-font').addEventListener('click', () => {
    if (!settingsData.fonts) settingsData.fonts = [];
    settingsData.fonts.push({
      name: "New Sans Font",
      slug: "NewFont",
      fileUrl: "",
      category: "Modern",
      isDefault: false,
      isActive: true
    });
    renderFonts();
  });

  // FAQs
  function renderFaqs() {
    faqsContainer.innerHTML = "";
    (settingsData.faqs || []).forEach((faq, idx) => {
      const div = document.createElement('div');
      div.className = "bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-2 relative hover:shadow-sm transition-all";
      div.innerHTML = `
        <button type="button" class="btn-delete-faq absolute top-4 right-4 text-red-500" data-index="${idx}">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
        <div class="space-y-1">
          <label class="text-[9px] font-bold text-gray-500 uppercase block">FAQ Question</label>
          <input type="text" class="w-full h-8 px-2 border rounded text-xs font-bold" value="${faq.q || ''}" data-index="${idx}" data-field="q">
        </div>
        <div class="space-y-1">
          <label class="text-[9px] font-bold text-gray-500 uppercase block">FAQ Answer</label>
          <textarea rows="2" class="w-full p-2 border rounded text-xs" data-index="${idx}" data-field="a">${faq.a || ''}</textarea>
        </div>
      `;
      faqsContainer.appendChild(div);
    });

    faqsContainer.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        if (settingsData.faqs[idx]) {
          settingsData.faqs[idx][field] = e.target.value;
        }
      });
    });

    faqsContainer.querySelectorAll('.btn-delete-faq').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        settingsData.faqs.splice(idx, 1);
        renderFaqs();
      });
    });
  }

  document.getElementById('btn-add-faq').addEventListener('click', () => {
    if (!settingsData.faqs) settingsData.faqs = [];
    settingsData.faqs.push({
      q: "New Custom FAQ Question?",
      a: "FAQ Answer text explanation."
    });
    renderFaqs();
  });

  // Save configurations trigger
  document.getElementById('btn-save-config').addEventListener('click', async (e) => {
    e.preventDefault();

    // Map inputs to settingsData
    settingsData.backPanelEnabled = backPanelEnabledInput.checked;
    settingsData.laptopBackEnabled = laptopBackEnabledInput.checked;
    settingsData.studioEnabled = studioEnabledInput.checked;
    settingsData.showFaq = showFaqInput.checked;

    settingsData.backPanelBasePrice = parseFloat(backPanelBasePriceInput.value) || 300;
    settingsData.laptopBackBasePrice = parseFloat(laptopBackBasePriceInput.value) || 500;
    settingsData.defaultCurrency = defaultCurrencyInput.value;
    settingsData.taxPercentage = 0;
    settingsData.shippingCharge = parseFloat(shippingChargeInput.value) || 50;

    settingsData.warningMessages = {
      lowQualityWarning: lowQualityWarningInput.value,
      sizeWarning: sizeWarningInput.value
    };
    settingsData.maxUploads = parseInt(maxUploadsInput.value) || 5;
    settingsData.allowedAspectRatio = allowedAspectRatioInput.value;
    settingsData.deliveryTime = deliveryTimeInput.value;
    settingsData.orderNotes = orderNotesInput.value;

    settingsData.enableGoogleFonts = enableGoogleFontsInput.checked;
    settingsData.textPricingExtra = parseFloat(textPricingExtraInput.value) || 0;
    settingsData.maxTextLayers = parseInt(maxTextLayersInput.value) || 10;
    settingsData.maxCharactersPerLayer = parseInt(maxCharactersPerLayerInput.value) || 40;
    settingsData.allowedColors = allowedColorsInput.value.split(',').map(c => c.trim()).filter(Boolean);

    settingsData.minResolution = minResolutionInput.value;
    settingsData.maxUploadSize = parseInt(maxUploadSizeInput.value) || 10;
    settingsData.allowedFileTypes = allowedFileTypesInput.value.split(',').map(f => f.trim()).filter(Boolean);
    settingsData.compressionQuality = parseFloat(compressionQualityInput.value) || 0.8;
    settingsData.enableBackgroundRemoval = enableBackgroundRemovalInput.checked;
    settingsData.enableAutoCrop = enableAutoCropInput.checked;
    settingsData.enableSmartCenter = enableSmartCenterInput.checked;
    settingsData.enableWatermark = enableWatermarkInput.checked;

    settingsData.heroTitle = heroTitleInput.value;
    settingsData.benefits = benefitsInput.value.split(',').map(b => b.trim()).filter(Boolean);
    settingsData.heroSubtitle = heroSubtitleInput.value;

    settingsData.videoUrl = videoUrlInput.value;
    settingsData.installationGuideUrl = installationGuideUrlInput.value;
    settingsData.helpLinks = {
      chatLink: chatLinkInput.value,
      guidelinesLink: guidelinesLinkInput.value
    };

    try {
      const response = await fetch('http://localhost:3000/api/v1/admin/custom-skin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(settingsData)
      });
      const result = await response.json();

      if (result.success) {
        showToast("Configurations saved successfully to the database!", "success");
      } else {
        showToast("Failed to save: " + (result.message || ''), "error");
      }
    } catch (error) {
      showToast("Network error trying to contact API server.", "error");
    }
  });

  // Init configurator
  await loadConfig();
});
