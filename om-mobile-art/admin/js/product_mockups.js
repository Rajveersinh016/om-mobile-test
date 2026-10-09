/**
 * OM Mobile Art — Global Product Mockups Controller (product_mockups.js)
 * Controls default Front and Back reusable global mockups stored centrally in PostgreSQL.
 */

let globalMockupsData = {
  defaultFrontUrl: '',
  defaultFrontPublicId: '',
  defaultBackUrl: '',
  defaultBackPublicId: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadGlobalMockups();
  initMockupUploaders();
});

async function loadGlobalMockups() {
  try {
    if (window.API && window.API.getGlobalMockups) {
      const data = await window.API.getGlobalMockups();
      if (data) {
        globalMockupsData = {
          defaultFrontUrl: data.defaultFrontUrl || '',
          defaultFrontPublicId: data.defaultFrontPublicId || '',
          defaultBackUrl: data.defaultBackUrl || '',
          defaultBackPublicId: data.defaultBackPublicId || ''
        };
      }
    }
  } catch (err) {
    console.warn('Error loading global mockups:', err);
  }
  updateMockupUI('front');
  updateMockupUI('back');
}

function updateMockupUI(type) {
  const isFront = type === 'front';
  const url = isFront ? globalMockupsData.defaultFrontUrl : globalMockupsData.defaultBackUrl;
  const imgEl = document.getElementById(isFront ? 'front-mockup-img' : 'back-mockup-img');
  const placeholderEl = document.getElementById(isFront ? 'front-mockup-placeholder' : 'back-mockup-placeholder');
  const urlInput = document.getElementById(isFront ? 'mockup-front-url' : 'mockup-back-url');
  const publicIdInput = document.getElementById(isFront ? 'mockup-front-public-id' : 'mockup-back-public-id');

  if (urlInput) urlInput.value = url || '';
  if (publicIdInput) publicIdInput.value = isFront ? (globalMockupsData.defaultFrontPublicId || '') : (globalMockupsData.defaultBackPublicId || '');

  if (url && imgEl && placeholderEl) {
    imgEl.src = url;
    imgEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
  } else if (imgEl && placeholderEl) {
    imgEl.src = '';
    imgEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }
}

function initMockupUploaders() {
  if (window.AdminUploader) {
    window.frontMockupUploader = window.AdminUploader.create({
      container: 'front-mockup-uploader-wrapper',
      input: 'mockup-front-url',
      label: 'Upload / Replace Front Mockup',
      folder: 'mockups',
      onChange: (url, publicId) => {
        globalMockupsData.defaultFrontUrl = url;
        if (publicId) globalMockupsData.defaultFrontPublicId = publicId;
        updateMockupUI('front');
      }
    });

    window.backMockupUploader = window.AdminUploader.create({
      container: 'back-mockup-uploader-wrapper',
      input: 'mockup-back-url',
      label: 'Upload / Replace Back Mockup',
      folder: 'mockups',
      onChange: (url, publicId) => {
        globalMockupsData.defaultBackUrl = url;
        if (publicId) globalMockupsData.defaultBackPublicId = publicId;
        updateMockupUI('back');
      }
    });
  }
}

window.clearMockup = function (type) {
  if (type === 'front') {
    globalMockupsData.defaultFrontUrl = '';
    globalMockupsData.defaultFrontPublicId = '';
    updateMockupUI('front');
  } else if (type === 'back') {
    globalMockupsData.defaultBackUrl = '';
    globalMockupsData.defaultBackPublicId = '';
    updateMockupUI('back');
  }
  if (window.showToast) window.showToast(`Cleared ${type} mockup`, 'info');
};

window.saveProductMockups = async function () {
  const frontUrl = document.getElementById('mockup-front-url')?.value || '';
  const frontPublicId = document.getElementById('mockup-front-public-id')?.value || '';
  const backUrl = document.getElementById('mockup-back-url')?.value || '';
  const backPublicId = document.getElementById('mockup-back-public-id')?.value || '';

  const payload = {
    defaultFrontUrl: frontUrl,
    defaultFrontPublicId: frontPublicId,
    defaultBackUrl: backUrl,
    defaultBackPublicId: backPublicId
  };

  try {
    if (window.API && window.API.saveGlobalMockups) {
      await window.API.saveGlobalMockups(payload);
      if (window.showToast) window.showToast('Global product mockups updated successfully!', 'success');
      await loadGlobalMockups();
    }
  } catch (err) {
    console.error('Failed to save global product mockups:', err);
    if (window.showToast) window.showToast('Failed to save global product mockups', 'error');
  }
};
