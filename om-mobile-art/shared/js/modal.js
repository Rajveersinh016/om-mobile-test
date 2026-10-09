/**
 * OM Mobile Art — Modal System (modal.js)
 * Generic modal overlay system for product image galleries, forms, etc.
 */

const Modal = {
  _stack: [],

  /**
   * Open a modal with custom content.
   * @param {object} opts
   * @param {string} opts.title - Modal header title
   * @param {string} opts.content - HTML content for modal body
   * @param {string} [opts.size='md'] - 'sm' | 'md' | 'lg' | 'xl' | 'full'
   * @param {Function} [opts.onOpen] - Called after modal opens
   * @param {Function} [opts.onClose] - Called after modal closes
   * @param {boolean} [opts.closeOnBackdrop=true]
   * @returns {Element} - The modal element
   */
  open({ title, content, size = 'md', onOpen, onClose, closeOnBackdrop = true } = {}) {
    const sizeMap = {
      sm:   'max-w-sm',
      md:   'max-w-lg',
      lg:   'max-w-2xl',
      xl:   'max-w-4xl',
      full: 'max-w-full m-4'
    };

    const overlay = document.createElement('div');
    overlay.className = 'om-modal fixed inset-0 bg-black/60 z-[1500] flex items-center justify-center p-4 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="om-modal-box bg-white rounded-xl shadow-2xl border border-border-subtle w-full ${sizeMap[size] || sizeMap.md} flex flex-col max-h-[90vh] transform scale-95 transition-transform duration-300">
        ${title ? `
        <div class="flex items-center justify-between p-5 border-b border-border-subtle flex-shrink-0">
          <h2 class="font-headline-h3 text-headline-h3 font-bold">${title}</h2>
          <button class="om-modal-close material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">close</button>
        </div>` : `
        <button class="om-modal-close absolute top-4 right-4 material-symbols-outlined text-on-surface-variant hover:text-primary z-10">close</button>
        `}
        <div class="om-modal-body overflow-y-auto flex-1 p-5">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    this._stack.push(overlay);

    // Animate open
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.replace('opacity-0', 'opacity-100');
      overlay.querySelector('.om-modal-box').classList.replace('scale-95', 'scale-100');
    }));

    // Close handlers
    const closeModal = () => this.close(overlay, onClose);

    overlay.querySelector('.om-modal-close')?.addEventListener('click', closeModal);
    if (closeOnBackdrop) {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    }

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
    overlay._escHandler = escHandler;
    document.addEventListener('keydown', escHandler);

    if (onOpen) onOpen(overlay);
    return overlay;
  },

  /**
   * Close a specific modal.
   * @param {Element} overlay - The modal overlay element
   * @param {Function} [onClose]
   */
  close(overlay, onClose) {
    overlay.classList.replace('opacity-100', 'opacity-0');
    overlay.querySelector('.om-modal-box')?.classList.replace('scale-100', 'scale-95');
    document.removeEventListener('keydown', overlay._escHandler);
    setTimeout(() => {
      overlay.remove();
      this._stack = this._stack.filter(m => m !== overlay);
      if (this._stack.length === 0) document.body.style.overflow = '';
      if (onClose) onClose();
    }, 300);
  },

  /**
   * Close the most recently opened modal.
   */
  closeLast() {
    const last = this._stack[this._stack.length - 1];
    if (last) this.close(last);
  },

  /**
   * Close all open modals.
   */
  closeAll() {
    [...this._stack].forEach(m => this.close(m));
  },

  /**
   * Open an image lightbox modal.
   * @param {string[]} images - Array of image URLs
   * @param {number} [startIndex=0]
   */
  openGallery(images, startIndex = 0) {
    let current = startIndex;
    const renderSlide = () => `
      <img src="${images[current]}" class="w-full h-full object-contain max-h-[70vh]" alt="Product image ${current + 1}">
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        ${images.map((_, i) => `<button class="gallery-dot w-2 h-2 rounded-full ${i === current ? 'bg-primary' : 'bg-border-subtle'} transition-colors" data-idx="${i}"></button>`).join('')}
      </div>
    `;

    const modal = this.open({
      title: '',
      size: 'xl',
      content: `
        <div class="relative flex items-center justify-center min-h-[300px]">
          <button id="gallery-prev" class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/30 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <div id="gallery-slide" class="relative w-full flex items-center justify-center">${renderSlide()}</div>
          <button id="gallery-next" class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/30 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      `,
      closeOnBackdrop: true
    });

    const updateSlide = () => {
      const slide = modal.querySelector('#gallery-slide');
      if (slide) slide.innerHTML = renderSlide();
      // Re-attach dot listeners
      modal.querySelectorAll('.gallery-dot').forEach(dot => {
        dot.addEventListener('click', () => { current = parseInt(dot.dataset.idx); updateSlide(); });
      });
    };

    modal.querySelector('#gallery-prev').addEventListener('click', () => {
      current = (current - 1 + images.length) % images.length; updateSlide();
    });
    modal.querySelector('#gallery-next').addEventListener('click', () => {
      current = (current + 1) % images.length; updateSlide();
    });
    // Attach initial dot listeners
    modal.querySelectorAll('.gallery-dot').forEach(dot => {
      dot.addEventListener('click', () => { current = parseInt(dot.dataset.idx); updateSlide(); });
    });
  }
};

window.Modal = Modal;
console.log('[OM Modal] Loaded ✓');
