/**
 * OM Mobile Art — Notifications (notifications.js)
 * Toast notification system + Confirm dialog.
 * Extracted from main.js for shared use across shop and admin.
 */

// ─── Toast System ─────────────────────────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'|'warning'} [type='success']
 * @param {number} [duration=4000] - Auto-dismiss time in ms
 */
window.showToast = function(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast flex items-center gap-3 px-5 py-4 bg-white border border-border-subtle rounded-lg shadow-2xl pointer-events-auto max-w-sm transition-all duration-300 transform translate-y-10 opacity-0';

  const styles = {
    success: { color: '#03045E', icon: 'check_circle', border: '4px solid #03045E' },
    error:   { color: '#EF4444', icon: 'error',        border: '4px solid #EF4444' },
    info:    { color: '#0077B6', icon: 'info',          border: '4px solid #0077B6' },
    warning: { color: '#F59E0B', icon: 'warning',       border: '4px solid #F59E0B' },
  };

  const s = styles[type] || styles.success;
  toast.style.borderLeft = s.border;

  toast.innerHTML = `
    <span class="material-symbols-outlined" style="color: ${s.color}; font-variation-settings: 'FILL' 1">${s.icon}</span>
    <div class="text-sm font-medium text-on-surface flex-grow">${message}</div>
    <button class="material-symbols-outlined text-[16px] text-text-muted hover:text-on-surface" onclick="this.parentElement.remove()">close</button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
    });
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('translate-y-[-10px]', 'opacity-0');
    setTimeout(() => toast.remove(), 350);
  }, duration);
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

/**
 * Show a styled confirmation dialog.
 * @param {string} title
 * @param {string} message
 * @param {Function} onConfirm - Called when user clicks Confirm
 * @param {Function} [onCancel] - Called when user clicks Cancel
 * @param {object} [opts] - { confirmText, cancelText, danger }
 */
window.showConfirm = function(title, message, onConfirm, onCancel, opts = {}) {
  const { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = opts;
  const confirmClass = danger
    ? 'px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors'
    : 'px-4 py-2 bg-primary text-on-primary rounded-md text-sm font-medium hover:bg-accent-hover transition-colors';

  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm';
  dialog.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl border border-border-subtle p-6 max-w-sm w-full space-y-4 animate-pop-in">
      <h3 class="font-headline-h3 text-lg font-bold">${title}</h3>
      <p class="text-body-main text-on-surface-variant text-sm leading-relaxed">${message}</p>
      <div class="flex justify-end gap-3 pt-2">
        <button class="cancel-btn px-4 py-2 border border-border-subtle rounded-md text-sm font-medium hover:bg-surface-container-low transition-colors">${cancelText}</button>
        <button class="confirm-btn ${confirmClass}">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const close = () => dialog.remove();

  dialog.querySelector('.cancel-btn').addEventListener('click', () => {
    if (onCancel) onCancel();
    close();
  });
  dialog.querySelector('.confirm-btn').addEventListener('click', () => {
    onConfirm();
    close();
  });

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) { if (onCancel) onCancel(); close(); }
  });
};

// ─── Alert Dialog ─────────────────────────────────────────────────────────────

/**
 * Show a simple alert dialog.
 * @param {string} title
 * @param {string} message
 * @param {Function} [onClose]
 */
window.showAlert = function(title, message, onClose) {
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm';
  dialog.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl border border-border-subtle p-6 max-w-sm w-full space-y-4">
      <h3 class="font-headline-h3 text-lg font-bold">${title}</h3>
      <p class="text-body-main text-on-surface-variant text-sm leading-relaxed">${message}</p>
      <div class="flex justify-end pt-2">
        <button class="ok-btn px-6 py-2 bg-primary text-on-primary rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const close = () => { if (onClose) onClose(); dialog.remove(); };
  dialog.querySelector('.ok-btn').addEventListener('click', close);
};


