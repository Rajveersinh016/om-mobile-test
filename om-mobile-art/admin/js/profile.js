/**
 * OM Mobile Art — Profile Dropdown Controller (profile.js)
 * Manages the profile sub-menu toggle, active account routing, and logout session clears.
 */
(function() {
  'use strict';

  window.AdminProfile = {
    init: () => {
      const trigger = document.getElementById('admin-profile-trigger');
      const dropdown = document.getElementById('admin-profile-dropdown');
      if (!trigger || !dropdown) return;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });

      const prefix = window.AdminUtils ? window.AdminUtils.getPrefix() : '../../';
      
      fetch(prefix + 'admin/components/profile_dropdown.html')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch profile dropdown');
          return res.text();
        })
        .then(html => {
          dropdown.innerHTML = html;

          // Bind dropdown logout hook
          const logoutBtn = document.getElementById('admin-logout-dropdown');
          if (logoutBtn) {
            logoutBtn.removeAttribute('href'); // disable navigation
            logoutBtn.addEventListener('click', (e) => {
              e.preventDefault();
              window.showConfirm("Admin Log Out", "Exit administrative panel?", () => {
                if (window.DB) window.DB.logoutUser();
                window.showToast("Logged out from admin.", "info");
                setTimeout(() => {
                  window.location.href = 'login.html';
                }, 800);
              });
            });
          }
        })
        .catch(err => console.error('[OM Admin Profile]', err));

      // Close profile dropdown on click outside
      document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }
  };
})();
