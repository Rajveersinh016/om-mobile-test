/**
 * OM Mobile Art — API Adapter (api.js)
 * Thin adapter wrapping window.DB methods.
 * All frontend code calls window.API.* instead of window.DB.* directly.
 * When you move to a real backend, only replace this file — zero HTML/JS changes needed.
 */

const staticCache = {};
function clearStaticCache() {
  for (const key in staticCache) {
    delete staticCache[key];
  }
}

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

let refreshingPromise = null;

async function refreshAuthTokens() {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('om_refresh_token') || localStorage.getItem('om_customer_refresh_token');
      if (!refreshToken || isTokenExpired(refreshToken)) {
        return null;
      }

      const API_BASE = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) return null;
      const body = await res.json();
      if (body && body.success && body.data) {
        const newAccess = body.data.accessToken;
        const newRefresh = body.data.refreshToken;
        if (newAccess) {
          localStorage.setItem('om_auth_token', newAccess);
          localStorage.setItem('om_customer_auth_token', newAccess);
        }
        if (newRefresh) {
          localStorage.setItem('om_refresh_token', newRefresh);
          localStorage.setItem('om_customer_refresh_token', newRefresh);
        }
        console.log('[Auth Audit] Successfully refreshed access token via /auth/refresh');
        return newAccess;
      }
    } catch (e) {
      console.warn('[Auth Audit] Token refresh failed:', e);
    } finally {
      refreshingPromise = null;
    }
    return null;
  })();

  return refreshingPromise;
}

async function getAuthToken(forceRefresh = false) {
  const isAdminPage = window.location.pathname.includes('/admin/');
  const tokenKey = isAdminPage ? 'om_admin_auth_token' : 'om_auth_token';

  let token = localStorage.getItem(tokenKey);
  if (!isAdminPage && !token) {
    token = localStorage.getItem('om_customer_auth_token');
  }

  if (token && !isTokenExpired(token) && !forceRefresh) {
    return token;
  }

  if (!isAdminPage) {
    const refreshedToken = await refreshAuthTokens();
    if (refreshedToken) {
      return refreshedToken;
    }
  }

  if (token && isTokenExpired(token)) {
    console.log(`[Auth Audit] getAuthToken: Context=${isAdminPage ? 'ADMIN' : 'CUSTOMER'}, token is expired and refresh failed. Clearing expired token.`);
    localStorage.removeItem(tokenKey);
    if (!isAdminPage) localStorage.removeItem('om_customer_auth_token');
  }

  return null;
}

async function fetchWithAuth(url, options = {}) {
  const isAdminRequest = window.location.pathname.includes('/admin/') || url.includes('/admin/') || url.includes('/orders/dashboard');
  const tokenKey = isAdminRequest ? 'om_admin_auth_token' : 'om_auth_token';

  let token = localStorage.getItem(tokenKey);
  if (!isAdminRequest && !token) {
    token = localStorage.getItem('om_customer_auth_token');
  }

  options.headers = options.headers ? { ...options.headers } : {};
  if (token && !isTokenExpired(token)) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, options);

  if (res.status === 401 || res.status === 403) {
    console.warn(`[Auth Audit] ${res.status} HTTP encountered for ${url}. Clearing token for Context=${isAdminRequest ? 'ADMIN' : 'CUSTOMER'}.`);
    if (isAdminRequest) {
      localStorage.removeItem('om_admin_auth_token');
      localStorage.removeItem('om_admin_session');
    } else {
      localStorage.removeItem('om_auth_token');
      localStorage.removeItem('om_customer_auth_token');
      localStorage.removeItem('om_user_session');
      localStorage.removeItem('om_customer_session');
    }
  }

  return res;
}

window.getAuthToken = getAuthToken;
window.fetchWithAuth = fetchWithAuth;

const API = {
  getAuthToken: getAuthToken,

  // ── Products ────────────────────────────────────────────────────────────
  getProducts: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.collectionId) queryParams.append('collectionId', filters.collectionId);
      if (filters.categoryId) queryParams.append('categoryId', filters.categoryId);
      if (filters.productTypeId) queryParams.append('productTypeId', filters.productTypeId);
      if (filters.deviceType) queryParams.append('deviceType', filters.deviceType);
      if (filters.deviceTypeId) queryParams.append('deviceTypeId', filters.deviceTypeId);
      if (filters.deviceId) queryParams.append('deviceId', filters.deviceId);
      if (filters.material) queryParams.append('material', filters.material);
      if (filters.brand) queryParams.append('brand', filters.brand);
      if (filters.availability) queryParams.append('availability', filters.availability);
      if (filters.minPrice !== undefined) queryParams.append('minPrice', filters.minPrice);
      if (filters.maxPrice !== undefined) queryParams.append('maxPrice', filters.maxPrice);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      else queryParams.append('limit', '100');
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      
      const res = await fetch(`http://localhost:3000/api/v1/products?${queryParams.toString()}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      const productsList = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);
      if (filters.returnFullResponse) {
        return {
          products: productsList,
          total: body.pagination?.total || productsList.length,
          page: body.pagination?.page || 1,
          limit: body.pagination?.limit || 100
        };
      }
      return productsList;
    } catch (err) {
      console.warn('Backend products fetch failed, falling back to local DB', err);
      if (filters.returnFullResponse) {
        const localProds = window.DB.getProducts();
        return { products: localProds, total: localProds.length, page: 1, limit: 100 };
      }
      return window.DB.getProducts();
    }
  },
  getProductById: async (idOrSlug) => {
    if (!idOrSlug || idOrSlug === 'undefined' || idOrSlug === 'null') return null;
    const cleanIdOrSlug = String(idOrSlug).trim();
    try {
      let p = null;

      // 1. Try GET /api/v1/products/:idOrSlug
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/products/${encodeURIComponent(cleanIdOrSlug)}`);
      if (res.ok) {
        const body = await res.json();
        p = body.data || (body.id ? body : null);
      }

      // 2. If not found, try GET /api/v1/products/slug/:idOrSlug
      if (!p) {
        const slugRes = await fetchWithAuth(`http://localhost:3000/api/v1/products/slug/${encodeURIComponent(cleanIdOrSlug)}`);
        if (slugRes.ok) {
          const body = await slugRes.json();
          p = body.data || (body.id ? body : null);
        }
      }

      // 3. Search in /api/v1/products list by id, slug, or index
      if (!p) {
        const listRes = await fetchWithAuth(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = Array.isArray(listBody.products) ? listBody.products : (Array.isArray(listBody.data) ? listBody.data : []);
          const isPureInteger = /^\d+$/.test(cleanIdOrSlug);
          const numId = isPureInteger ? parseInt(cleanIdOrSlug, 10) : NaN;
          p = products.find(prod => String(prod.id) === cleanIdOrSlug || prod.slug === cleanIdOrSlug || prod.sku === cleanIdOrSlug) ||
              (!isNaN(numId) && numId > 0 && products[numId - 1] ? products[numId - 1] : null);
        }
      }

      // 4. Local DB fallback search by id or slug
      if (!p && window.DB && window.DB.getProducts) {
        const localProds = window.DB.getProducts() || [];
        p = localProds.find(prod => String(prod.id) === cleanIdOrSlug || prod.slug === cleanIdOrSlug || prod.sku === cleanIdOrSlug);
      }

      if (!p) return null;

      return {
        ...p,
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        devicePrices: p.devicePrices || [],
        minPrice: p.minPrice !== undefined ? p.minPrice : p.price,
        maxPrice: p.maxPrice !== undefined ? p.maxPrice : p.price,
        isMultiDevice: p.isMultiDevice !== undefined ? p.isMultiDevice : (p.devicePrices && p.devicePrices.length > 1),
        originalPrice: p.originalPrice || p.price,
        description: p.description,
        image: p.image,
        hoverImage: p.hoverImage || null,
        models: p.models || (p.compatibility ? p.compatibility.models : []),
        compatibility: p.compatibility || null,
        requiresDeviceSelection: p.requiresDeviceSelection !== undefined ? p.requiresDeviceSelection : true,
        variants: p.variants || [],
        defaultFrontMockup: p.defaultFrontMockup || null,
        defaultBackMockup: p.defaultBackMockup || null,
        isSale: p.isSale || false,
        isNew: p.isNew || false,
        isBestSeller: p.isBestSeller || false,
        isTrending: p.isTrending || false,
        productType: p.productType || null,
        category: p.category || null,
        brand: p.brand || (p.category ? p.category.name : 'OM MOBILE ART'),
        devices: p.models ? p.models.map(m => m.name) : (p.devices || []),
        material: p.supportedMaterials && p.supportedMaterials.length > 0 ? p.supportedMaterials[0] : (p.material || 'Standard 3M'),
        finish: p.supportedFinishes && p.supportedFinishes.length > 0 ? p.supportedFinishes[0] : (p.finish || 'Matte'),
        supportedMaterials: p.supportedMaterials && p.supportedMaterials.length > 0 ? p.supportedMaterials : [p.material || 'Standard 3M'],
        supportedFinishes: p.supportedFinishes && p.supportedFinishes.length > 0 ? p.supportedFinishes : [p.finish || 'Matte'],
        images: p.images ? p.images.map(img => typeof img === 'string' ? img : img.url) : [p.image],
        rawImages: p.images || [],
        rating: p.rating || 0,
        reviewsCount: p.reviewsCount || 0,
        minOrderQty: p.minOrderQty || 1
      };
    } catch (err) {
      console.error('Backend getProductById failed:', err);
      return null;
    }
  },
  getProduct: async (idOrSlug) => API.getProductById(idOrSlug),
  getProductBySlug: async (slug) => API.getProductById(slug),

  deleteProduct: async (id) => {
    try {
      const token = localStorage.getItem('om_admin_auth_token') || (window.getAuthToken ? await window.getAuthToken() : null);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:3000/api/v1/products/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        const body = await res.json();
        if (window.DB && window.DB.deleteProduct) {
          window.DB.deleteProduct(id);
        }
        return body;
      }
      throw new Error(`Server returned HTTP ${res.status}`);
    } catch (err) {
      console.warn('Backend delete product failed, deleting from local DB fallback:', err);
      if (window.DB && window.DB.deleteProduct) {
        window.DB.deleteProduct(id);
      }
      return { success: true, message: 'Product deleted from local storage' };
    }
  },
  getCategories: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/categories');
      if (res.ok) {
        const body = await res.json();
        return body.data || body;
      }
    } catch (err) {
      console.warn('API.getCategories fetch error:', err);
    }
    return [{ id: 'a0000000-0000-0000-0000-000000000001', name: 'Mobile Skins' }];
  },

  softDeleteProduct: async (id) => API.deleteProduct(id),
  permanentDeleteProduct: async (id) => API.deleteProduct(id),

  saveProduct: async (productData) => {
    try {
      const token = localStorage.getItem('om_admin_auth_token') || (window.getAuthToken ? await window.getAuthToken() : null);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const isUpdate = !!productData.id && String(productData.id).trim() !== '' && String(productData.id) !== 'undefined' && String(productData.id) !== 'null';
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `http://localhost:3000/api/v1/products/${productData.id}` : 'http://localhost:3000/api/v1/products';

      let categoryId = productData.categoryId;
      if (!categoryId && !isUpdate) {
        try {
          const cats = await API.getCategories();
          categoryId = cats && cats.length > 0 ? cats[0].id : 'a0000000-0000-0000-0000-000000000001';
        } catch (e) {
          categoryId = 'a0000000-0000-0000-0000-000000000001';
        }
      }

      let variants = productData.variants;
      if (!isUpdate && (!variants || variants.length === 0)) {
        const skuBase = (productData.name || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) + '-' + Date.now();
        variants = [{
          sku: skuBase,
          finish: productData.finish || 'Matte',
          material: productData.material || 'Standard 3M',
          priceOffset: 0,
          stockQuantity: Number(productData.stock) || 50
        }];
      }

      if (typeof clearStaticCache === 'function') clearStaticCache();

      const payload = {
        name: productData.name,
        description: productData.description,
        price: productData.price !== undefined ? Number(productData.price) : undefined,
        originalPrice: productData.originalPrice !== undefined ? Number(productData.originalPrice) : undefined,
        image: productData.image,
        hoverImage: productData.hoverImage,
        categoryId: categoryId,
        productTypeId: productData.productTypeId || undefined,
        collectionIds: productData.collectionIds || (productData.collectionId ? [productData.collectionId] : undefined),
        modelIds: productData.modelIds,
        requiresDeviceSelection: productData.requiresDeviceSelection,
        supportedMaterials: productData.supportedMaterials,
        supportedFinishes: productData.supportedFinishes,
        isPublished: productData.isPublished,
        images: productData.images,
        devicePrices: productData.devicePrices,
        variants: isUpdate ? (productData.variants || undefined) : variants
      };

      console.log('[API.saveProduct DEBUG] Sending save payload to backend:', payload);

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const body = await res.json();
        console.log('[API.saveProduct DEBUG] Backend save response:', body);
        if (window.DB && window.DB.saveProduct) {
          window.DB.saveProduct(body.data || productData);
        }
        return body.data || body;
      }
      const errBody = await res.json();
      console.error('[API.saveProduct ERROR] Server error response:', errBody);
      const msg = errBody.error?.message || errBody.message || `HTTP ${res.status}`;
      const detailsStr = errBody.error?.details ? `: ${JSON.stringify(errBody.error.details)}` : '';
      throw new Error(`${msg}${detailsStr}`);
    } catch (err) {
      console.warn('Backend saveProduct failed, falling back to local DB:', err);
      if (window.DB && window.DB.saveProduct) {
        return window.DB.saveProduct(productData);
      }
      throw err;
    }
  },

  bulkDeleteProducts: async (ids) => {
    try {
      const token = localStorage.getItem('om_admin_auth_token') || (window.getAuthToken ? await window.getAuthToken() : null);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('http://localhost:3000/api/v1/products/bulk-delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        const body = await res.json();
        if (window.DB && window.DB.deleteProduct) {
          ids.forEach(id => window.DB.deleteProduct(id));
        }
        return body;
      }
      throw new Error(`Server returned HTTP ${res.status}`);
    } catch (err) {
      console.warn('Backend bulk delete failed, clearing local DB fallbacks:', err);
      if (window.DB && window.DB.deleteProduct) {
        ids.forEach(id => window.DB.deleteProduct(id));
      }
      return { success: true, message: `Processed ${ids.length} products locally` };
    }
  },
  getGlobalMockups: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/mockups');
      if (!res.ok) throw new Error();
      const body = await res.json();
      return body.data || {};
    } catch (err) {
      console.warn('Backend mockups fetch failed', err);
      return JSON.parse(localStorage.getItem('om_global_mockups')) || {};
    }
  },
  saveGlobalMockups: async (mockupsData) => {
    try {
      const token = localStorage.getItem('om_admin_auth_token') || await getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('http://localhost:3000/api/v1/admin/mockups', {
        method: 'PUT',
        headers,
        body: JSON.stringify(mockupsData)
      });
      if (res.ok) {
        const body = await res.json();
        localStorage.setItem('om_global_mockups', JSON.stringify(body.data));
        return body.data;
      }
    } catch (err) {
      console.warn('Backend save global mockups failed', err);
    }
    localStorage.setItem('om_global_mockups', JSON.stringify(mockupsData));
    return mockupsData;
  },

  // ── Device Types, Brands & Models Compatibility APIs ────────────────────────
  getDeviceTypes: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/device-types');
      if (!res.ok) throw new Error();
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.warn('Backend device-types fetch failed', err);
      return window.DB ? (window.DB.getDeviceTypes ? window.DB.getDeviceTypes() : []) : [];
    }
  },
  getBrands: async (deviceTypeId) => {
    if (deviceTypeId) return API.getBrandsByDeviceType(deviceTypeId);
    try {
      const res = await fetch('http://localhost:3000/api/v1/brands');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.error('Backend brands fetch failed', err);
      return [];
    }
  },
  getBrandsByDeviceType: async (deviceTypeId) => {
    try {
      const url = deviceTypeId ? `http://localhost:3000/api/v1/device-types/${deviceTypeId}/brands` : 'http://localhost:3000/api/v1/brands';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const brands = body.data || [];
      if (brands.length > 0) return brands;

      if (deviceTypeId) {
        const allRes = await fetch('http://localhost:3000/api/v1/brands');
        if (allRes.ok) {
          const allBody = await allRes.json();
          return allBody.data || [];
        }
      }
      return [];
    } catch (err) {
      console.error('Backend brands by device type fetch failed', err);
      return [];
    }
  },
  getSeriesByBrand: async (brandId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/brands/${brandId}/series`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.error('Backend series by brand fetch failed', err);
      return [];
    }
  },
  getModels: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.error('Backend models fetch failed', err);
      return [];
    }
  },
  getAllModels: async (brandId, productId) => {
    if (brandId) return API.getModelsByBrand(brandId, productId);
    return API.getModels();
  },
  getModelsByBrand: async (brandId, productId) => {
    try {
      let url = `http://localhost:3000/api/v1/brands/${brandId}/models`;
      if (productId && typeof productId === 'string' && productId.length === 36) {
        url += `?productId=${productId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.error('Backend models by brand fetch failed', err);
      return [];
    }
  },


  deleteProduct: async (id) => {
    clearStaticCache();
    try {
      let productUuid = String(id);
      if (productUuid.length !== 36) {
        // Resolve UUID from product list search
        const listRes = await fetchWithAuth(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = listBody.products || [];
          const numId = parseInt(id, 10);
          const matched = products.find(p => p.id === id || p.slug === id) || (numId > 0 && products[numId - 1] ? products[numId - 1] : null);
          if (matched) productUuid = matched.id;
        }
      }

      const res = await fetchWithAuth(`http://localhost:3000/api/v1/products/${productUuid}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        window.DB.deleteProduct(id);
        return true;
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Backend deleteProduct failed:', err);
      throw err;
    }
  },

  softDeleteProduct: async (id) => {
    return window.API.deleteProduct(id);
  },

  permanentDeleteProduct: async (id) => {
    return window.API.deleteProduct(id);
  },

  restoreProduct: async (id) => {
    clearStaticCache();
    try {
      let productUuid = String(id);
      if (productUuid.length !== 36) {
        const listRes = await fetchWithAuth(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = listBody.products || [];
          const numId = parseInt(id, 10);
          const matched = products.find(p => p.id === id || p.slug === id) || (numId > 0 && products[numId - 1] ? products[numId - 1] : null);
          if (matched) productUuid = matched.id;
        }
      }
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/products/${productUuid}/restore`, { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.error('Backend restoreProduct failed:', err);
      return false;
    }
  },

  publishProduct: async (id) => {
    clearStaticCache();
    try {
      let productUuid = String(id);
      if (productUuid.length !== 36) {
        const listRes = await fetchWithAuth(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = listBody.products || [];
          const numId = parseInt(id, 10);
          const matched = products.find(p => p.id === id || p.slug === id) || (numId > 0 && products[numId - 1] ? products[numId - 1] : null);
          if (matched) productUuid = matched.id;
        }
      }
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/products/${productUuid}/publish`, { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.error('Backend publishProduct failed:', err);
      return false;
    }
  },

  unpublishProduct: async (id) => {
    clearStaticCache();
    try {
      let productUuid = String(id);
      if (productUuid.length !== 36) {
        const listRes = await fetchWithAuth(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = listBody.products || [];
          const numId = parseInt(id, 10);
          const matched = products.find(p => p.id === id || p.slug === id) || (numId > 0 && products[numId - 1] ? products[numId - 1] : null);
          if (matched) productUuid = matched.id;
        }
      }
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/products/${productUuid}/unpublish`, { method: 'POST' });
      return res.ok;
    } catch (err) {
      console.error('Backend unpublishProduct failed:', err);
      return false;
    }
  },

  // ── Collections ─────────────────────────────────────────────────────────
  getCollections: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.includeDeleted) query.append('includeDeleted', 'true');
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const list = body.data || [];
      if (!params.includeDeleted && window.DB && window.DB.saveCollections) {
        window.DB.saveCollections(list);
      }
      return list;
    } catch (err) {
      console.error('Backend collections fetch failed:', err);
      return [];
    }
  },
  saveCollection: async (col) => {
    clearStaticCache();
    try {
      const payload = {
        name: col.name,
        slug: col.slug || col.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: col.description || '',
        shortDescription: col.shortDescription || '',
        thumbnail: col.thumbnail || col.image || '',
        thumbnailPublicId: col.thumbnailPublicId || '',
        desktopBanner: col.desktopBanner || col.image || '',
        desktopBannerPublicId: col.desktopBannerPublicId || '',
        mobileBanner: col.mobileBanner || col.image || '',
        isActive: col.isActive !== undefined ? col.isActive : true,
        isVisible: col.isVisible !== undefined ? col.isVisible : true,
        isFeatured: col.isFeatured !== undefined ? col.isFeatured : false,
        isHomepage: col.isHomepage !== undefined ? col.isHomepage : false,
        isTrending: col.isTrending !== undefined ? col.isTrending : false,
        isSeasonal: col.isSeasonal !== undefined ? col.isSeasonal : false,
        status: col.status || 'PUBLISHED',
        sortOrder: col.sortOrder !== undefined ? parseInt(col.sortOrder) : 0,
        seoTitle: col.seoTitle || '',
        seoDescription: col.seoDescription || '',
        seoKeywords: col.seoKeywords || '',
        productIds: col.productIds || [],
      };

      let res;
      if (col.id) {
        res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${col.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetchWithAuth('http://localhost:3000/api/v1/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to save collection (${res.status})`);
      }
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.error('Backend save collection failed:', err);
      throw err;
    }
  },
  deleteCollection: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }
      return true;
    } catch (err) {
      console.error('Backend delete collection failed:', err);
      throw err;
    }
  },
  restoreCollection: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${id}/restore`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.error('Backend restore collection failed:', err);
      return null;
    }
  },
  permanentlyDeleteCollection: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${id}/permanent`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      console.error('Backend permanent delete collection failed:', err);
      return false;
    }
  },
  duplicateCollection: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/collections/${id}/duplicate`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.error('Backend duplicate collection failed:', err);
      return null;
    }
  },

  // ── Product Types ───────────────────────────────────────────────────────────
  getProductTypes: async () => {
    if (staticCache['productTypes']) return staticCache['productTypes'];
    try {
      const token = localStorage.getItem('om_auth_token') || localStorage.getItem('om_admin_auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('http://localhost:3000/api/v1/product-types', { headers });
      let rawList = [];
      if (res.ok) {
        const body = await res.json();
        rawList = body.data || [];
      }
      
      if (rawList.length > 0) {
        staticCache['productTypes'] = rawList.map(pt => ({
          id: pt.id,
          name: pt.name,
          slug: pt.slug || pt.name.toLowerCase().replace(/\s+/g, '-')
        }));
        return staticCache['productTypes'];
      }

      staticCache['productTypes'] = [
        { id: 'b0000000-0000-0000-0000-000000000001', name: 'Skin', slug: 'skin' },
        { id: 'b0000000-0000-0000-0000-000000000002', name: 'AirPods Skin', slug: 'airpods-skin' },
        { id: 'b0000000-0000-0000-0000-000000000003', name: 'Screen Lamination', slug: 'screen-lamination' },
        { id: 'b0000000-0000-0000-0000-000000000004', name: 'Magic Glass', slug: 'magic-glass' }
      ];
      return staticCache['productTypes'];
    } catch (err) {
      console.warn('Backend product types fetch failed, returning default product types', err);
      staticCache['productTypes'] = [
        { id: 'b0000000-0000-0000-0000-000000000001', name: 'Skin', slug: 'skin' },
        { id: 'b0000000-0000-0000-0000-000000000002', name: 'AirPods Skin', slug: 'airpods-skin' },
        { id: 'b0000000-0000-0000-0000-000000000003', name: 'Screen Lamination', slug: 'screen-lamination' },
        { id: 'b0000000-0000-0000-0000-000000000004', name: 'Magic Glass', slug: 'magic-glass' }
      ];
      return staticCache['productTypes'];
    }
  },
  saveProductType: async (pt) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const payload = {
        name: pt.name,
        slug: pt.slug || pt.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: pt.description || '',
        icon: pt.icon || '',
        thumbnail: pt.thumbnail || '',
        isActive: pt.isActive !== undefined ? pt.isActive : true,
        isVisible: pt.isVisible !== undefined ? pt.isVisible : true,
        sortOrder: pt.sortOrder !== undefined ? parseInt(pt.sortOrder) : 0,
      };

      let res;
      if (pt.id) {
        res = await fetch(`http://localhost:3000/api/v1/product-types/${pt.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('http://localhost:3000/api/v1/product-types', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.message || 'Failed to save product type');
      }
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.warn('Backend save product type failed', err);
      throw err;
    }
  },
  deleteProductType: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:3000/api/v1/product-types/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error();
      return true;
    } catch (err) {
      console.warn('Backend delete product type failed', err);
      throw err;
    }
  },

  // ── Device Types ─────────────────────────────────────────────────────────
  getDeviceTypes: async (includeDeleted) => {
    if (!includeDeleted && staticCache['deviceTypes']) return staticCache['deviceTypes'];
    try {
      const url = includeDeleted ? 'http://localhost:3000/api/v1/device-types?includeDeleted=true' : 'http://localhost:3000/api/v1/device-types';
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (!includeDeleted) staticCache['deviceTypes'] = body.data || [];
      return body.data || [];
    } catch (err) {
      console.warn('Backend getDeviceTypes failed, falling back to local DB', err);
      return window.DB.getDeviceTypes();
    }
  },
  saveDeviceType: async (dt) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_admin_auth_token') || (window.getAuthToken ? await window.getAuthToken() : null);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = dt.id && !String(dt.id).startsWith('dt-') ? `http://localhost:3000/api/v1/admin/device-types/${dt.id}` : 'http://localhost:3000/api/v1/admin/device-types';
      const method = dt.id && !String(dt.id).startsWith('dt-') ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, headers, body: JSON.stringify(dt) });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend saveDeviceType error, saving to local DB', err);
    }
    return window.DB.saveDeviceType(dt);
  },
  deleteDeviceType: async (id, force = false) => {
    clearStaticCache();
    try {
      if (id && !String(id).startsWith('dt-')) {
        const url = `http://localhost:3000/api/v1/admin/device-types/${id}${force ? '?force=true' : ''}`;
        const res = await fetchWithAuth(url, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          window.DB.deleteDeviceType(id);
        }
        return body;
      }
    } catch (err) {
      console.warn('Backend deleteDeviceType error', err);
    }
    return { success: window.DB.deleteDeviceType(id), message: 'Deleted locally' };
  },
  restoreDeviceType: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/device-types/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend restoreDeviceType error', err);
    }
    return null;
  },
  permanentDeleteDeviceType: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/device-types/${id}/permanent`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend permanentDeleteDeviceType error', err);
      return { success: false, message: 'Network or server error.' };
    }
  },
  bulkDeviceTypes: async (ids, action, force = false) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/device-types/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, force })
      });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend bulkDeviceTypes error', err);
      return { success: false, message: 'Bulk action failed' };
    }
  },

  getBrandsByDeviceType: async (deviceTypeId) => {
    const key = `brands_by_dt_${deviceTypeId}`;
    if (staticCache[key]) return staticCache[key];
    try {
      const res = await fetch(`http://localhost:3000/api/v1/device-types/${deviceTypeId}/brands`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      staticCache[key] = body.data || [];
      return staticCache[key];
    } catch (err) {
      console.warn('Backend getBrandsByDeviceType failed', err);
      return window.DB && window.DB.getBrandsByDeviceType ? window.DB.getBrandsByDeviceType(deviceTypeId) : (window.DB ? window.DB.getBrands() : []);
    }
  },

  // ── Brands ──────────────────────────────────────────────────────────────
  getBrands: async (deviceTypeId, includeDeleted, q) => {
    try {
      let url = 'http://localhost:3000/api/v1/brands?';
      if (deviceTypeId) url += `deviceTypeId=${deviceTypeId}&`;
      if (includeDeleted) url += 'includeDeleted=true&';
      if (q) url += `q=${encodeURIComponent(q)}&`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const body = await res.json();
      return body.data || body || [];
    } catch (err) {
      console.warn('Backend brands fetch failed, falling back to local DB', err);
      return window.DB.getBrands();
    }
  },
  saveBrand: async (brand) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_admin_auth_token') || await getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = brand.id && !String(brand.id).startsWith('b-') ? `http://localhost:3000/api/v1/admin/brands/${brand.id}` : 'http://localhost:3000/api/v1/admin/brands';
      const method = brand.id && !String(brand.id).startsWith('b-') ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, headers, body: JSON.stringify(brand) });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend saveBrand error, saving to local DB', err);
    }
    return window.DB.saveBrand(brand);
  },
  deleteBrand: async (id, force = false) => {
    clearStaticCache();
    try {
      if (id && !String(id).startsWith('b-')) {
        const url = `http://localhost:3000/api/v1/admin/brands/${id}${force ? '?force=true' : ''}`;
        const res = await fetchWithAuth(url, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          window.DB.deleteBrand(id);
        }
        return body;
      }
    } catch (err) {
      console.warn('Backend deleteBrand error', err);
    }
    return { success: window.DB.deleteBrand(id), message: 'Deleted locally' };
  },
  restoreBrand: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/brands/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend restoreBrand error', err);
    }
    return null;
  },
  permanentDeleteBrand: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/brands/${id}/permanent`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend permanentDeleteBrand error', err);
      return { success: false, message: 'Network or server error.' };
    }
  },
  bulkBrands: async (ids, action, targetId, force = false) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/brands/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, targetId, force })
      });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend bulkBrands error', err);
      return { success: false, message: 'Bulk action failed' };
    }
  },
  importBrandsCSV: async (csvText) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/brands/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend importBrandsCSV error', err);
    }
    return { success: false, message: 'CSV Import failed' };
  },

  // ── Models ──────────────────────────────────────────────────────────────
  getAllModels: async (brandId, q, deviceTypeId, includeDeleted, status) => {
    try {
      let url = 'http://localhost:3000/api/v1/models?';
      if (brandId) url += `brandId=${brandId}&`;
      if (q) url += `q=${encodeURIComponent(q)}&`;
      if (deviceTypeId) url += `deviceTypeId=${deviceTypeId}&`;
      if (includeDeleted) url += 'includeDeleted=true&';
      if (status) url += `status=${status}&`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.warn('Backend getAllModels failed, falling back to local DB', err);
      let list = window.DB.getModels();
      if (brandId) list = list.filter(m => String(m.brandId) === String(brandId) || m.brand === brandId);
      if (q) list = list.filter(m => m.name.toLowerCase().includes(q.toLowerCase()));
      return list;
    }
  },
  saveModel: async (model) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_admin_auth_token') || await getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = model.id && !String(model.id).startsWith('m-') ? `http://localhost:3000/api/v1/admin/models/${model.id}` : 'http://localhost:3000/api/v1/admin/models';
      const method = model.id && !String(model.id).startsWith('m-') ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, headers, body: JSON.stringify(model) });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend saveModel error, saving to local DB', err);
    }
    return window.DB.saveModel(model);
  },
  deleteModel: async (id, force = false) => {
    clearStaticCache();
    try {
      if (id && !String(id).startsWith('m-')) {
        const url = `http://localhost:3000/api/v1/admin/models/${id}${force ? '?force=true' : ''}`;
        const res = await fetchWithAuth(url, { method: 'DELETE' });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          window.DB.deleteModel(id);
        }
        return body;
      }
    } catch (err) {
      console.warn('Backend deleteModel error', err);
    }
    return { success: window.DB.deleteModel(id), message: 'Deleted locally' };
  },
  restoreModel: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/models/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend restoreModel error', err);
    }
    return null;
  },
  permanentDeleteModel: async (id) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth(`http://localhost:3000/api/v1/admin/models/${id}/permanent`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend permanentDeleteModel error', err);
      return { success: false, message: 'Network or server error.' };
    }
  },
  bulkModels: async (ids, action, targetId, force = false) => {
    clearStaticCache();
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/models/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, targetId, force })
      });
      const body = await res.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn('Backend bulkModels error', err);
      return { success: false, message: 'Bulk action failed' };
    }
  },
  importModelsCSV: async (csvText) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('http://localhost:3000/api/v1/admin/models/import-csv', {
        method: 'POST',
        headers,
        body: JSON.stringify({ csvText })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend importModelsCSV error', err);
    }
    return { success: false, message: 'CSV Import failed' };
  },

  duplicateProduct: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/v1/products/${id}/duplicate`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const body = await res.json();
        return body.data;
      }
    } catch (err) {
      console.warn('Backend duplicateProduct failed', err);
    }
    return null;
  },

  permanentDeleteProduct: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/v1/products/${id}/permanent`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('Backend permanentDeleteProduct failed', err);
    }
    return false;
  },

  publishProduct: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/v1/products/${id}/publish`, { method: 'POST', headers });
      if (res.ok) return true;
    } catch (err) {
      console.warn('Backend publishProduct failed', err);
    }
    return window.DB.publishProduct(id);
  },

  unpublishProduct: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/v1/products/${id}/unpublish`, { method: 'POST', headers });
      if (res.ok) return true;
    } catch (err) {
      console.warn('Backend unpublishProduct failed', err);
    }
    return window.DB.unpublishProduct(id);
  },

  restoreProduct: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`http://localhost:3000/api/v1/products/${id}/restore`, { method: 'POST', headers });
      if (res.ok) return true;
    } catch (err) {
      console.warn('Backend restoreProduct failed', err);
    }
    return window.DB.restoreProduct(id);
  },

  deleteModel: async (id) => {
    clearStaticCache();
    try {
      const token = localStorage.getItem('om_auth_token') || await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (id && !String(id).startsWith('m-')) {
        await fetch(`http://localhost:3000/api/v1/admin/models/${id}`, { method: 'DELETE', headers });
      }
    } catch (err) {
      console.warn('Backend deleteModel error', err);
    }
    return window.DB.deleteModel(id);
  },

  // ── Materials & Finishes ─────────────────────────────────────────────────
  getMaterials: async () => {
    if (staticCache['materials']) return staticCache['materials'];
    try {
      const res = await fetch('http://localhost:3000/api/v1/materials');
      if (!res.ok) throw new Error();
      const body = await res.json();
      staticCache['materials'] = body.data || [];
      return staticCache['materials'];
    } catch (err) {
      console.warn('Backend getMaterials failed', err);
      return [];
    }
  },

  getFinishes: async () => {
    if (staticCache['finishes']) return staticCache['finishes'];
    try {
      const res = await fetch('http://localhost:3000/api/v1/finishes');
      if (!res.ok) throw new Error();
      const body = await res.json();
      staticCache['finishes'] = body.data || [];
      return staticCache['finishes'];
    } catch (err) {
      console.warn('Backend getFinishes failed', err);
      return [];
    }
  },

  // ── Device Previews ──────────────────────────────────────────────────────
  getProductPreviews: async (productId, modelId) => {
    try {
      if (!productId || typeof productId !== 'string' || productId.length !== 36) {
        return [];
      }
      let url = `http://localhost:3000/api/v1/products/${productId}/previews`;
      if (modelId) url += `?modelId=${modelId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data || [];
    } catch (err) {
      console.warn('Backend getProductPreviews failed', err);
      return [];
    }
  },

  // ── Users ───────────────────────────────────────────────────────────────
  getUsers: ()                     => Promise.resolve(window.DB.getUsers()),
  registerUser: (user)             => Promise.resolve(window.DB.registerUser(user)),
  login: (email, password)         => Promise.resolve(window.DB.authenticateUser(email, password)),
  getCurrentUser: ()               => Promise.resolve(window.DB.getCurrentUser()),
  logout: ()                       => { window.DB.logoutUser(); return Promise.resolve(true); },
  updateCurrentUser: (fields)      => Promise.resolve(window.DB.updateCurrentUser(fields)),
  updateUser: (email, fields)      => Promise.resolve(window.DB.updateUser(email, fields)),
  deleteUser: (email)              => { window.DB.deleteUser(email); return Promise.resolve(true); },

  // ── Cart ────────────────────────────────────────────────────────────────
  getCart: ()                      => Promise.resolve(window.DB.getCart()),
  addToCart: async (item)          => {
    console.log('API.addToCart called with item:', item);
    try {
      let productData = null;
      let realProductId = item.id;

      if (typeof item.id === 'string' && item.id.length === 36) {
        const productRes = await fetch(`http://localhost:3000/api/v1/products/${item.id}`);
        if (productRes.ok) {
          const body = await productRes.json();
          productData = body.data;
        }
      }

      if (!productData) {
        const listRes = await fetch(`http://localhost:3000/api/v1/products?limit=100`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const products = listBody.products || [];
          const numId = parseInt(item.id, 10);
          productData = products.find(p => p.id === item.id || p.slug === item.id) ||
            (numId > 0 && products[numId - 1] ? products[numId - 1] : products[0]);
        }
      }

      if (productData) {
        realProductId = productData.id;
      }

      const variants = (productData && productData.variants) || [];
      const minQty = (productData && productData.minOrderQty) || 1;
      const finalQty = Math.max(minQty, item.quantity || item.qty || 1);
      item.qty = finalQty;
      
      const finish = item.finish || 'Matte';
      const material = item.material || 'Standard 3M';
      
      const variant = variants.find(v => 
        v.finish && v.finish.toLowerCase() === finish.toLowerCase() && 
        v.material && v.material.toLowerCase() === material.toLowerCase()
      ) || variants[0];

      let token = await getAuthToken();
      if (token && variant && realProductId && String(realProductId).length === 36) {
        let cartRes = await fetch('http://localhost:3000/api/v1/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            productId: realProductId,
            productVariantId: variant.id,
            deviceTypeId: item.deviceTypeId || null,
            quantity: finalQty,
            modelId: (item.modelId && item.modelId !== 'CUSTOM_MODEL') ? item.modelId : null,
            customModelName: item.customModelName || item.deviceModel || null
          })
        });

        if (!cartRes.ok && cartRes.status === 401) {
          localStorage.removeItem('om_auth_token');
          token = await getAuthToken();
          if (token) {
            await fetch('http://localhost:3000/api/v1/cart', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                productId: realProductId,
                productVariantId: variant.id,
                deviceTypeId: item.deviceTypeId || null,
                quantity: finalQty,
                modelId: (item.modelId && item.modelId !== 'CUSTOM_MODEL') ? item.modelId : null,
                customModelName: item.customModelName || item.deviceModel || null
              })
            });
          }
        }
      }

      window.DB.addToCart(item);
      window.dispatchEvent(new Event('cart-updated'));
      return true;
    } catch (error) {
      console.warn('API.addToCart backend sync failed, saved to local cart state:', error);
      window.DB.addToCart(item);
      window.dispatchEvent(new Event('cart-updated'));
      return true;
    }
  },
  removeFromCart: (index)          => { window.DB.removeFromCart(index); return Promise.resolve(true); },
  updateCartQty: (index, qty)      => { window.DB.updateCartQty(index, qty); return Promise.resolve(true); },
  clearCart: ()                    => { window.DB.clearCart(); return Promise.resolve(true); },

  // ── Wishlist ────────────────────────────────────────────────────────────
  getWishlist: ()                  => Promise.resolve(window.DB.getWishlist()),
  toggleWishlist: (productId)      => Promise.resolve(window.DB.toggleWishlist(productId)),
  isInWishlist: (productId)        => Promise.resolve(window.DB.isInWishlist(productId)),

  // ── Orders ──────────────────────────────────────────────────────────────
  getOrders: async (filters = {}) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('om_customer_session') || localStorage.getItem('om_user_session') || '{}');
      const dbUser = window.DB ? window.DB.getCurrentUser() : null;
      const email = currentUser.email || (dbUser ? dbUser.email : '') || '';

      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status && filters.status !== 'ALL') queryParams.append('status', filters.status);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (email) queryParams.append('email', email);

      const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
      const url = `${API_URL}/orders/my?${queryParams.toString()}`;

      const res = await fetchWithAuth(url);
      if (!res.ok) {
        console.warn(`[Auth Audit] API.getOrders returned HTTP ${res.status}`);
        return [];
      }
      const body = await res.json();
      const orders = Array.isArray(body.data?.orders) ? body.data.orders : (Array.isArray(body.data) ? body.data : []);
      console.log(`[Auth Audit] API.getOrders: Fetched ${orders.length} orders from backend for email="${email}".`);
      return orders;
    } catch (err) {
      console.warn('[Auth Audit] API.getOrders Exception:', err);
      return [];
    }
  },
  
  getOrderDetails: async (orderNumber) => {
    try {
      const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
      let token = await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // First attempt public order tracking endpoint
      let res = await fetch(`${API_URL}/orders/track/${encodeURIComponent(orderNumber)}`, { headers });
      if (!res.ok) {
        // Fallback to customer my orders endpoint
        res = await fetch(`${API_URL}/orders/my/${encodeURIComponent(orderNumber)}`, { headers });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.warn('Backend order details fetch failed, falling back to local DB', err);
      return window.DB ? window.DB.getOrders().find(o => o.id === orderNumber || o.orderNumber === orderNumber) : null;
    }
  },

  placeOrder: (order)              => Promise.resolve(window.DB ? window.DB.placeOrder(order) : order),
  updateOrderStatus: async (id, status, comment) => {
    try {
      const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
      const res = await window.fetchWithAuth(`${API_URL}/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data;
    } catch (err) {
      console.error('Failed to update order status on backend:', err);
      if (window.DB) {
        return window.DB.updateOrderStatus(id, status);
      }
      throw err;
    }
  },
  deleteOrder: (id)                => { if (window.DB) window.DB.deleteOrder(id); return Promise.resolve(true); },

  // ── Coupons ─────────────────────────────────────────────────────────────
  getCoupons: ()                   => Promise.resolve(window.DB.getCoupons()),
  validateCoupon: (code)           => Promise.resolve(window.DB.validateCoupon(code)),
  saveCoupon: (coupon)             => Promise.resolve(window.DB.saveCoupon(coupon)),
  deleteCoupon: (code)             => { window.DB.deleteCoupon(code); return Promise.resolve(true); },

  // ── Google Business Reviews ──────────────────────────────────────────────
  fetchGoogleReviews: async () => {
    try {
      const baseUrl = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
      const res = await fetch(`${baseUrl}/google-reviews`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) return json.data;
      }
    } catch (e) {
      console.warn('[API] Failed to fetch Google Business Reviews from backend:', e);
    }
    return {
      rating: 4.9,
      userRatingsTotal: 256,
      googlePlaceUrl: 'https://maps.app.goo.gl/t14LWUswCdPH8ShVA',
      reviews: [
        {
          id: 'g-rev-1',
          authorName: 'Kunal Ruparel',
          authorPhotoUrl: 'https://lh3.googleusercontent.com/a-/ALV-UjXq0Q5tN2q9zX1r8uJkM3vV4bN6yT7uI8oP9sL0=s120-c-rp-mo-br100',
          rating: 5,
          relativeTimeDescription: 'a month ago',
          text: 'Best mobile skin & art shop in Mota Varachha, Surat! Fits perfectly on iPhone 16 Pro and camera bump texture is top notch. Extremely precision cut and quick service.'
        },
        {
          id: 'g-rev-2',
          authorName: 'Rohan Sharma',
          authorPhotoUrl: 'https://lh3.googleusercontent.com/a-/ALV-UjW1mK2n3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8=s120-c-rp-mo-br100',
          rating: 5,
          relativeTimeDescription: '2 weeks ago',
          text: 'Got custom print skin for my laptop and mobile. The color vibrancy and 3M texture quality are outstanding. Dispatched fast and customer support on WhatsApp is very responsive.'
        },
        {
          id: 'g-rev-3',
          authorName: 'Priya Patel',
          authorPhotoUrl: 'https://lh3.googleusercontent.com/a-/ALV-UjZ8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1=s120-c-rp-mo-br100',
          rating: 5,
          relativeTimeDescription: '3 weeks ago',
          text: 'Front screen lamination and camera lens protection done here. Self-healing texture and smooth glass feel. 100% recommended store in Surat.'
        }
      ]
    };
  },

  // ── Banners ─────────────────────────────────────────────────────────────
  getBanners: ()                   => Promise.resolve(window.DB.getBanners()),
  saveBanner: (banner)             => Promise.resolve(window.DB.saveBanner(banner)),
  deleteBanner: (id)               => { window.DB.deleteBanner(id); return Promise.resolve(true); },

  // ── Settings ────────────────────────────────────────────────────────────
  getSettings: ()                  => Promise.resolve(window.DB.getSettings()),
  saveSettings: (s)                => { window.DB.saveSettings(s); return Promise.resolve(true); },

  // ── Cloudinary Media Management ──────────────────────────────────────────
  uploadImage: async (fileOrBase64, folder = 'general') => {
    try {
      let formData;
      let headers = {};
      if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
        formData = new FormData();
        formData.append('file', fileOrBase64);
        formData.append('folder', folder);
      } else {
        headers['Content-Type'] = 'application/json';
        formData = JSON.stringify({ source: fileOrBase64, folder });
      }

      const res = await fetch('http://localhost:3000/api/v1/media/upload', {
        method: 'POST',
        headers: headers,
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        return data.data; // { url, publicId, width, height, format, bytes }
      }
      throw new Error(data.message || data.error || `Upload failed with HTTP ${res.status}`);
    } catch (err) {
      console.error('[API.uploadImage Error]', err);
      throw err;
    }
  },

  uploadMultipleImages: async (filesArray, folder = 'general') => {
    try {
      const formData = new FormData();
      filesArray.forEach((file) => {
        if (file instanceof File || file instanceof Blob) {
          formData.append('files', file);
        }
      });
      const res = await fetch(`http://localhost:3000/api/v1/media/upload-multiple?folder=${encodeURIComponent(folder)}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
      throw new Error(data.message || 'Multiple upload failed');
    } catch (err) {
      console.error('Cloudinary Multiple Upload Error:', err);
      throw err;
    }
  },

  replaceImage: async (oldPublicId, newFileOrBase64, folder = 'general') => {
    try {
      let formData;
      let headers = {};
      if (newFileOrBase64 instanceof File || newFileOrBase64 instanceof Blob) {
        formData = new FormData();
        formData.append('file', newFileOrBase64);
        formData.append('folder', folder);
        if (oldPublicId) formData.append('oldPublicId', oldPublicId);
      } else {
        headers['Content-Type'] = 'application/json';
        formData = JSON.stringify({ oldPublicId, source: newFileOrBase64, folder });
      }

      const res = await fetch('http://localhost:3000/api/v1/media/replace', {
        method: 'POST',
        headers: headers,
        body: formData
      });
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
      throw new Error(data.message || 'Image replacement failed');
    } catch (err) {
      console.error('Cloudinary Replace Image Error:', err);
      throw err;
    }
  },

  deleteImage: async (publicId) => {
    if (!publicId) return true;
    try {
      const res = await fetch('http://localhost:3000/api/v1/media/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId })
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.warn('Cloudinary Delete Error:', err);
      return false;
    }
  },

  listMedia: async (folder = '', nextCursor = '') => {
    try {
      const url = `http://localhost:3000/api/v1/media/list?folder=${encodeURIComponent(folder)}&nextCursor=${encodeURIComponent(nextCursor)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        return { resources: data.data || [], nextCursor: data.nextCursor };
      }
      return { resources: [], nextCursor: null };
    } catch (err) {
      console.error('Cloudinary List Media Error:', err);
      return { resources: [], nextCursor: null };
    }
  },

  uploadImage: async (file, folder = 'uploads') => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetchWithAuth('http://localhost:3000/api/v1/media/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Upload failed with status ${res.status}`);
      }

      const body = await res.json();
      return body.data || body;
    } catch (err) {
      console.error('Backend image upload failed:', err);
      throw err;
    }
  },

  // ── Store Configuration & Settings ──────────────────────────────────────────
  getPublicSettings: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error('Backend getPublicSettings failed:', err);
      return window.SettingsManager ? window.SettingsManager.loadSettings() : {};
    }
  },

  getAdminSettings: async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error('Backend getAdminSettings failed:', err);
      return window.SettingsManager ? window.SettingsManager.loadSettings() : {};
    }
  },

  getLegalPage: async (slug) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/legal-pages/${slug}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error(`Backend getLegalPage '${slug}' failed:`, err);
      return window.SettingsManager ? window.SettingsManager.getLegalPage(slug) : null;
    }
  },

  getGlobalMockups: async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/mockups');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error('Backend getGlobalMockups failed:', err);
      return null;
    }
  },

  saveGlobalMockups: async (payload) => {
    try {
      const res = await fetchWithAuth('http://localhost:3000/api/v1/admin/mockups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error('Backend saveGlobalMockups failed:', err);
      throw err;
    }
  }
};

window.API = API;


