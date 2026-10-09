/**
 * OM Mobile Art — Loader Component (loader.js)
 * Page and section loading overlays.
 */

const Loader = {
  _overlay: null,

  /**
   * Show full-page loading overlay.
   * @param {string} [message='Loading...']
   */
  show(message = 'Loading...') {
    if (this._overlay) return;
    this._overlay = document.createElement('div');
    this._overlay.id = 'om-page-loader';
    this._overlay.className = 'fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-4';
    this._overlay.innerHTML = `
      <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p class="text-sm font-medium text-on-surface-variant">${message}</p>
    `;
    document.body.appendChild(this._overlay);
    document.body.style.overflow = 'hidden';
  },

  /**
   * Hide the full-page loading overlay.
   */
  hide() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
      document.body.style.overflow = '';
    }
  },

  /**
   * Show skeleton loading placeholders inside a container.
   * @param {string|Element} container - CSS selector or Element
   * @param {string} skeletonHtml - Skeleton HTML to repeat
   * @param {number} [count=4]
   */
  showSkeleton(container, skeletonHtml, count = 4) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
    el.innerHTML = Array(count).fill(skeletonHtml).join('');
  },

  /**
   * Restore a container's original content after skeleton.
   * @param {string|Element} container
   */
  hideSkeleton(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (el && el.dataset.originalHtml !== undefined) {
      el.innerHTML = el.dataset.originalHtml;
      delete el.dataset.originalHtml;
    }
  },

  /**
   * Standard product grid skeleton card HTML.
   */
  PRODUCT_SKELETON: `
    <div class="bg-surface-container-lowest border border-border-subtle rounded-[8px] overflow-hidden animate-pulse">
      <div class="aspect-square bg-surface-container"></div>
      <div class="p-4 space-y-2">
        <div class="h-4 bg-surface-container rounded w-3/4"></div>
        <div class="h-3 bg-surface-container rounded w-1/2"></div>
        <div class="h-5 bg-surface-container rounded w-1/3"></div>
      </div>
    </div>
  `,

  /**
   * Standard table row skeleton HTML.
   */
  TABLE_ROW_SKELETON: `
    <tr class="animate-pulse">
      <td class="px-6 py-4"><div class="h-4 bg-surface-container rounded w-full"></div></td>
      <td class="px-6 py-4"><div class="h-4 bg-surface-container rounded w-3/4"></div></td>
      <td class="px-6 py-4"><div class="h-4 bg-surface-container rounded w-1/2"></div></td>
      <td class="px-6 py-4"><div class="h-4 bg-surface-container rounded w-1/4"></div></td>
    </tr>
  `
};

// Legacy compat
window.showSkeleton = (sel, html, count) => Loader.showSkeleton(sel, html, count);
window.hideSkeleton = (sel) => Loader.hideSkeleton(sel);

window.Loader = Loader;
console.log('[OM Loader] Component loaded ✓');
