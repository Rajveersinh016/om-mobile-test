/**
 * OM Mobile Art — Utils (utils.js)
 * Pure utility functions. No DOM, no storage dependencies.
 * Import/use anywhere without side effects.
 */

// Clean SVG Brand Logo Fallback Data URI
const DEFAULT_BRAND_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="%2303045E"/><text x="50%" y="54%" font-family="sans-serif" font-weight="900" font-size="28" fill="%2390E0EF" text-anchor="middle" dominant-baseline="middle">OM</text></svg>`;

const DEFAULT_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23F8FAFC"/><path d="M70 120 L95 90 L120 120 L135 105 L155 130 Z" fill="%23CBD5E1"/><circle cx="85" cy="75" r="12" fill="%23CBD5E1"/></svg>`;

window.DEFAULT_BRAND_LOGO_SVG = DEFAULT_BRAND_LOGO_SVG;
window.DEFAULT_PLACEHOLDER_SVG = DEFAULT_PLACEHOLDER_SVG;

window.handleLogoError = function(img) {
  if (!img) return;
  img.onerror = null;
  img.src = DEFAULT_BRAND_LOGO_SVG;
};

window.handleImageError = function(img) {
  if (!img) return;
  img.onerror = null;
  img.src = DEFAULT_PLACEHOLDER_SVG;
};

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a price number as currency string.
 * @param {number} price - Price in USD
 * @param {string} [symbol='₹'] - Currency symbol
 * @returns {string}
 */
function formatPrice(price, symbol) {
  const sym = symbol || '₹';
  let val = parseFloat(price) || 0;
  if (sym === '₹') {
    if (val < 150) {
      val = Math.round(val * 80);
    } else {
      val = Math.round(val);
    }
    return '₹' + val.toLocaleString('en-IN');
  }
  return '$' + val.toFixed(2);
}

/**
 * Format ISO date string to human-readable format.
 * @param {string} isoString
 * @param {object} [opts] - Intl.DateTimeFormat options
 * @returns {string}
 */
function formatDate(isoString, opts) {
  const defaultOpts = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(isoString).toLocaleDateString(undefined, opts || defaultOpts);
}

/**
 * Format a number with commas.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return n.toLocaleString('en-IN');
}

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generate a simple unique ID string.
 * @param {string} [prefix='id']
 * @returns {string}
 */
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Get next integer ID from an array of objects with .id
 * @param {Array} arr
 * @returns {number}
 */
function nextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map(i => i.id || 0)) + 1 : 1;
}

// ─── String Helpers ───────────────────────────────────────────────────────────

/**
 * Convert a string to a URL slug.
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Truncate a string to a given length, appending ellipsis.
 * @param {string} str
 * @param {number} [len=100]
 * @returns {string}
 */
function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ─── URL / Query ──────────────────────────────────────────────────────────────

/**
 * Parse URL query parameters into an object.
 * @returns {Object}
 */
function parseQueryParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
  return params;
}

/**
 * Get a specific query param value by key.
 * @param {string} key
 * @returns {string|null}
 */
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Build a query string from an object of params.
 * @param {Object} params
 * @returns {string}
 */
function buildQueryString(params) {
  return '?' + new URLSearchParams(params).toString();
}

// ─── Function Helpers ─────────────────────────────────────────────────────────

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} [delay=300]
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Deep clone any JSON-safe object.
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

/**
 * Select a single element, with optional context.
 * @param {string} selector
 * @param {Element} [ctx=document]
 * @returns {Element|null}
 */
function $(selector, ctx = document) {
  return ctx.querySelector(selector);
}

/**
 * Select all matching elements.
 * @param {string} selector
 * @param {Element} [ctx=document]
 * @returns {NodeList}
 */
function $$(selector, ctx = document) {
  return ctx.querySelectorAll(selector);
}

/**
 * Generate star HTML for a rating value (1-5).
 * @param {number} rating
 * @returns {string}
 */
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = i <= Math.floor(rating) ? 1 : (i - rating < 1 && i - rating > 0 ? 0.5 : 0);
    html += `<span class="material-symbols-outlined text-[#FFB800] text-sm" style="font-variation-settings:'FILL' ${fill}">star</span>`;
  }
  return html;
}

/**
 * Get order status badge color classes.
 * @param {string} status
 * @returns {string}
 */
function getStatusBadgeClass(status) {
  const map = {
    'Delivered': 'bg-green-100 text-green-700',
    'Shipped': 'bg-blue-100 text-blue-700',
    'Printing': 'bg-purple-100 text-purple-700',
    'Placed': 'bg-yellow-100 text-yellow-700',
    'Confirmed': 'bg-yellow-100 text-yellow-700',
    'Cancelled': 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Determine current currency symbol from page content or settings.
 * @returns {string}
 */
function pageCurrency() {
  return '₹';
}

// ─── Export to window ─────────────────────────────────────────────────────────
window.OM = window.OM || {};
Object.assign(window.OM, {
  formatPrice, formatDate, formatNumber, generateId, nextId,
  slugify, truncate, capitalize, escapeHtml,
  parseQueryParams, getParam, buildQueryString,
  debounce, deepClone,
  $, $$,
  renderStars, getStatusBadgeClass, pageCurrency
});

// Legacy compatibility: ensure formatPrice and pageCurrency are available globally
window.formatPrice = formatPrice;
window.pageCurrency = pageCurrency;

// ─── Single Source of Truth Product Compatibility Service ───────────────────────
window.ProductCompatibilityService = {
  getCompatibility: async function(product) {
    if (!product) {
      return { isUniversal: false, deviceTypes: [], assignedBrands: [], assignedModels: [] };
    }

    const isUniversal = product.requiresDeviceSelection === false || 
      (product.compatibility && product.compatibility.requiresDeviceSelection === false);

    let deviceTypes = [];
    let assignedBrands = [];
    let assignedModels = [];

    if (isUniversal) {
      deviceTypes = window.API && window.API.getDeviceTypes ? await window.API.getDeviceTypes() : (window.DB ? window.DB.getDeviceTypes() : []);
    } else if (product.compatibility && product.compatibility.deviceTypes && product.compatibility.deviceTypes.length > 0) {
      deviceTypes = product.compatibility.deviceTypes || [];
      assignedBrands = product.compatibility.brands || [];
      assignedModels = product.compatibility.models || [];
    }

    const rawModels = (product.compatibility && product.compatibility.models && product.compatibility.models.length > 0)
      ? product.compatibility.models
      : (product.models || []);

    if (!isUniversal && deviceTypes.length === 0 && rawModels.length > 0) {
      let allBrands = [];
      let allDts = [];

      try {
        if (window.API) {
          if (window.API.getBrands) allBrands = (await window.API.getBrands()) || [];
          if (window.API.getDeviceTypes) allDts = (await window.API.getDeviceTypes()) || [];
        }
      } catch (err) {
        console.warn('[ProductCompatibilityService] Failed to fetch reference brands/deviceTypes:', err);
      }

      const brandById = new Map((allBrands || []).map(b => [b.id, b]));
      const dtById = new Map((allDts || []).map(d => [d.id, d]));

      const brandMap = new Map();
      const dtMap = new Map();

      rawModels.forEach(m => {
        const b = m.brand || m.series?.brand || brandById.get(m.brandId);
        if (b) {
          if (!brandMap.has(b.id)) brandMap.set(b.id, b);
          const dtId = b.deviceTypeId || b.deviceType?.id;
          const dt = b.deviceType || dtById.get(dtId);
          if (dt && !dtMap.has(dt.id)) dtMap.set(dt.id, dt);
        }
        assignedModels.push(m);
      });

      deviceTypes = Array.from(dtMap.values());
      assignedBrands = Array.from(brandMap.values());
    }

    const uniqueDeviceTypes = Array.from(
      new Map((deviceTypes || []).map(d => [d.id, d])).values()
    );

    return {
      isUniversal,
      deviceTypes: uniqueDeviceTypes,
      assignedBrands,
      assignedModels
    };
  },

  getBrandsForDeviceType: async function(selectedTypeId, isUniversal, assignedBrands) {
    if (isUniversal) {
      return window.API && window.API.getBrandsByDeviceType ? await window.API.getBrandsByDeviceType(selectedTypeId) : [];
    }
    return (assignedBrands || []).filter(b => {
      const dtId = b.deviceTypeId || b.deviceType?.id;
      return String(dtId) === String(selectedTypeId) || !dtId;
    });
  },

  getModelsForBrand: async function(selectedBrandId, isUniversal, assignedModels, productId) {
    if (isUniversal) {
      let models = window.API && window.API.getModelsByBrand ? await window.API.getModelsByBrand(selectedBrandId, productId) : [];
      if (!models || models.length === 0) {
        models = window.API && window.API.getModelsByBrand ? await window.API.getModelsByBrand(selectedBrandId, null) : [];
      }
      return models;
    }
    return (assignedModels || []).filter(m => {
      const bId = m.brandId || m.brand?.id || m.series?.brand?.id;
      return String(bId) === String(selectedBrandId) || !bId;
    });
  }
};

// ─── Dynamic Animations & Favicon Injection ───────────────────────────────────
(function() {
  const scripts = document.getElementsByTagName('script');
  let prefix = '';
  for (let s of scripts) {
    const src = s.getAttribute('src') || '';
    if (src.includes('shared/js/utils.js')) {
      prefix = src.split('shared/js/utils.js')[0];
      break;
    }
  }

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = prefix + 'shared/css/animations.css';
  document.head.appendChild(link);

  // Inject Favicon PNG
  const fav = document.createElement('link');
  fav.rel = 'icon';
  fav.type = 'image/png';
  fav.href = prefix + 'assets/logos/logo.png?v=2.0';
  document.head.appendChild(fav);

  // Inject script
  const script = document.createElement('script');
  script.src = prefix + 'shared/js/animations.js';
  script.defer = true;
  document.head.appendChild(script);
})();


