/**
 * OM Mobile Art — Admin Loader Component (loader.js)
 * Fades in an elegant loading screen spinner on page loading transitions.
 */
(function() {
  'use strict';

  // Inject loader styling immediately
  const style = document.createElement('style');
  style.textContent = `
    #admin-global-loader {
      position: fixed;
      inset: 0;
      background: #f9f9f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      opacity: 1;
      visibility: visible;
      transition: opacity 300ms ease, visibility 300ms ease;
    }
  `;
  document.head.appendChild(style);

  // Prepend loader wrapper to body
  const loader = document.createElement('div');
  loader.id = 'admin-global-loader';
  loader.innerHTML = `
    <div class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p class="text-[10px] font-bold text-secondary uppercase tracking-widest animate-pulse">Loading OM Admin...</p>
    </div>
  `;
  
  if (document.body) {
    document.body.appendChild(loader);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(loader));
  }

  // Remove loader when document is fully loaded
  const hideLoader = () => {
    loader.style.opacity = '0';
    loader.style.visibility = 'hidden';
    setTimeout(() => loader.remove(), 300);
  };

  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
  }
})();
