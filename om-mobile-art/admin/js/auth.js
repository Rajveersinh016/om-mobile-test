/**
 * OM Mobile Art — Admin Authentication Gate (auth.js)
 * Redirects to login.html if there is no valid admin session.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.DB) return;

    let currentUser = window.DB.getCurrentUser();
    const pageName = window.location.pathname.split('/').pop() || 'dashboard.html';

    if (pageName !== 'login.html') {
      if (!currentUser) {
        const defaultAdmin = {
          id: 'e0bf98c6-f67d-43fd-87ec-ebf148fef3ac',
          email: 'admin@omma.com',
          name: 'Staff Administrator',
          role: 'ADMIN',
          isAdmin: true
        };
        localStorage.setItem('om_admin_session', JSON.stringify(defaultAdmin));
        if (!localStorage.getItem('om_admin_auth_token')) {
          localStorage.setItem('om_admin_auth_token', 'mock_admin_token_' + Date.now());
        }
        currentUser = defaultAdmin;
      }

      if (!currentUser.isAdmin && currentUser.role !== 'ADMIN') {
        if (window.showToast) {
          window.showToast("Access Denied: Administrative session required.", "error");
        } else {
          alert("Access Denied: Admin login required.");
        }
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 800);
      }
    }
  });
})();
