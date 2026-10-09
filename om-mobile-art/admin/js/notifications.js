/**
 * OM Mobile Art — Notifications Controller (notifications.js)
 * Manages notification dropdown list, badges, read states, and deletes.
 */
(function() {
  'use strict';

  window.AdminNotification = {
    init: () => {
      const bell = document.getElementById('admin-notification-bell');
      const dropdown = document.getElementById('admin-notification-dropdown');
      const badge = document.getElementById('admin-notification-badge');
      if (!bell || !dropdown) return;

      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (badge) badge.classList.add('hidden');
      });

      const prefix = window.AdminUtils ? window.AdminUtils.getPrefix() : '../../';

      fetch(prefix + 'admin/components/notification.html')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch notifications layout');
          return res.text();
        })
        .then(html => {
          dropdown.innerHTML = html;
          renderNotificationsList();
        })
        .catch(err => console.error('[OM Admin Notifications]', err));

      document.addEventListener('click', (e) => {
        if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });

      function renderNotificationsList() {
        const list = document.getElementById('admin-notif-list');
        if (!list) return;

        let notifs = JSON.parse(localStorage.getItem('admin_notifications')) || [
          { id: 1, text: "New order placed by John Doe (#OM-1002)", time: "5 mins ago", read: false },
          { id: 2, text: "Low stock alert: Stealth Black Skin is below 10", time: "1 hour ago", read: false },
          { id: 3, text: "Customer review pending approval", time: "2 hours ago", read: true }
        ];

        // Update badge alert dot
        const unreadCount = notifs.filter(n => !n.read).length;
        if (badge) {
          if (unreadCount > 0) {
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }

        if (notifs.length === 0) {
          list.innerHTML = `<p class="px-4 py-6 text-xs text-secondary text-center italic">No new notifications.</p>`;
        } else {
          list.innerHTML = notifs.map(n => `
            <div class="px-4 py-2.5 hover:bg-surface-container-low transition-colors flex justify-between items-start gap-2 ${n.read ? 'opacity-60' : ''}">
              <div class="flex-1">
                <p class="text-xs text-on-surface leading-tight">${n.text}</p>
                <span class="text-[9px] text-secondary mt-0.5 block">${n.time}</span>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${!n.read ? `<button onclick="window.AdminNotification.markRead(${n.id})" class="text-[10px] text-primary hover:underline font-semibold cursor-pointer">Read</button>` : ''}
                <button onclick="window.AdminNotification.deleteNotif(${n.id})" class="text-[10px] text-red-500 hover:underline font-semibold cursor-pointer">Delete</button>
              </div>
            </div>
          `).join('');
        }

        // Bind Read All / Clear All (from component buttons)
        const readAllBtn = document.getElementById('admin-notif-read-all');
        const clearAllBtn = document.getElementById('admin-notif-clear-all');

        if (readAllBtn) {
          readAllBtn.textContent = 'Mark all read';
          readAllBtn.onclick = (e) => {
            e.preventDefault();
            notifs.forEach(n => n.read = true);
            localStorage.setItem('admin_notifications', JSON.stringify(notifs));
            renderNotificationsList();
            if (window.showToast) window.showToast("All notifications marked as read.", "success");
          };
        }

        if (clearAllBtn) {
          clearAllBtn.textContent = 'View All';
          clearAllBtn.onclick = (e) => {
            e.preventDefault();
            const allText = notifs.map(n => `• [${n.read ? 'Read' : 'New'}] ${n.text} (${n.time})`).join('\n');
            if (window.showAlert) {
              window.showAlert('All Notifications', allText);
            }
          };
        }
      }

      window.AdminNotification.markRead = (id) => {
        let notifs = JSON.parse(localStorage.getItem('admin_notifications')) || [];
        const idx = notifs.findIndex(n => n.id === id);
        if (idx !== -1) {
          notifs[idx].read = true;
          localStorage.setItem('admin_notifications', JSON.stringify(notifs));
          renderNotificationsList();
        }
      };

      window.AdminNotification.deleteNotif = (id) => {
        let notifs = JSON.parse(localStorage.getItem('admin_notifications')) || [];
        const filtered = notifs.filter(n => n.id !== id);
        localStorage.setItem('admin_notifications', JSON.stringify(filtered));
        renderNotificationsList();
        if (window.showToast) window.showToast("Notification deleted.", "info");
      };
    }
  };
})();
