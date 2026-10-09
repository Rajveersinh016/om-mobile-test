/**
 * OM Mobile Art — Client Router (router.js)
 * Lightweight hash + query-param router for SPA-like navigation.
 * No full page reload needed for tab switching or filtered views.
 */

const Router = {

  /**
   * Navigate to a URL, optionally replacing browser history.
   * @param {string} url
   * @param {boolean} [replace=false]
   */
  navigate(url, replace = false) {
    if (replace) {
      history.replaceState(null, '', url);
    } else {
      history.pushState(null, '', url);
    }
    window.dispatchEvent(new Event('route-change'));
  },

  /**
   * Get a query parameter value from the current URL.
   * @param {string} key
   * @returns {string|null}
   */
  getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  },

  /**
   * Get all current query params as a plain object.
   * @returns {Object}
   */
  getAllParams() {
    const result = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { result[k] = v; });
    return result;
  },

  /**
   * Update a single query param without full navigation.
   * @param {string} key
   * @param {string|number} value
   */
  setParam(key, value) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    history.replaceState(null, '', '?' + params.toString());
  },

  /**
   * Remove a query param from the URL.
   * @param {string} key
   */
  removeParam(key) {
    const params = new URLSearchParams(window.location.search);
    params.delete(key);
    const qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
  },

  /**
   * Build a URL with query params.
   * @param {string} base - Base path
   * @param {Object} params - Params to append
   * @returns {string}
   */
  buildUrl(base, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return qs ? `${base}?${qs}` : base;
  },

  /**
   * Get the current page filename (e.g. 'home.html').
   * @returns {string}
   */
  currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  },

  /**
   * Check if currently on a given page.
   * @param {string} page - e.g. 'home.html'
   * @returns {boolean}
   */
  isPage(page) {
    return Router.currentPage() === page;
  },

  /**
   * Register a hash-change handler (for tab navigation).
   * @param {Object} routes - { '#tab-name': handlerFn, ... }
   */
  onHash(routes) {
    const handleHash = () => {
      const hash = window.location.hash || '';
      const handler = routes[hash] || routes[''] || routes['*'];
      if (handler) handler(hash);
    };
    window.addEventListener('hashchange', handleHash);
    handleHash(); // run on load
  },

  /**
   * Redirect with optional delay.
   * @param {string} url
   * @param {number} [delayMs=0]
   */
  redirect(url, delayMs = 0) {
    if (delayMs > 0) {
      setTimeout(() => { window.location.href = url; }, delayMs);
    } else {
      window.location.href = url;
    }
  },

  /**
   * Go back in browser history.
   */
  back() {
    history.back();
  }
};

window.Router = Router;
console.log('[OM Router] Loaded ✓');
