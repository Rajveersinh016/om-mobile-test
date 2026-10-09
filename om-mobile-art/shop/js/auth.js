/**
 * OM Mobile Art - Auth & Profile Controller (auth.js)
 * Manages client-side sessions, registration, login forms, address books, and profile dashboard.
 */

function formatAuthError(body) {
    if (!body) return 'An unexpected error occurred. Please try again.';
    const code = body.error?.code || body.code || '';
    const rawMsg = body.error?.message || (body.error?.details && body.error.details[0]?.issue) || body.message || '';

    if (code === 'EMAIL_NOT_VERIFIED' || rawMsg.includes('verify your email')) {
        return "Your email hasn't been verified yet. Please check your inbox for the verification code.";
    }
    if (code === 'UNAUTHENTICATED' || rawMsg.includes('Invalid email address or password')) {
        return "Invalid email or password.";
    }
    if (rawMsg.includes('Invalid OTP') || rawMsg.includes('Invalid verification code')) {
        return "Invalid verification code. Please try again.";
    }
    if (rawMsg.includes('OTP has expired') || rawMsg.includes('code expired')) {
        return "This verification code has expired. Please request a new code.";
    }
    if (rawMsg.includes('Too many failed attempts') || rawMsg.includes('Too many incorrect attempts')) {
        return "Too many incorrect attempts. Please request a new verification code.";
    }
    if (code === 'RATE_LIMIT_EXCEEDED' || rawMsg.includes('Please wait')) {
        return rawMsg || "Please wait before requesting another code.";
    }
    if (code === 'CONFLICT' || rawMsg.includes('already exists')) {
        return "An account with this email already exists. Please log in.";
    }
    return rawMsg || 'Authentication failed. Please check your details.';
}

document.addEventListener('DOMContentLoaded', () => {
    // Check URL query parameters for registration/reset toasts
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'success') {
        setTimeout(() => { window.showToast?.("Registration successful. Please login.", "success"); }, 200);
    } else if (urlParams.get('reset') === 'success') {
        setTimeout(() => { window.showToast?.("Password changed successfully.", "success"); }, 200);
    }

    // -----------------------------------------
    // LOGIN & REGISTER & FORGOT PASSWORD PAGE
    // -----------------------------------------
    const tabLoginPassword = document.getElementById('tab-login-password') || document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formForgot = document.getElementById('form-forgot');

    const btnForgotPassword = document.getElementById('btn-forgot-password');
    const btnForgotBack = document.getElementById('btn-forgot-back');

    const handleSuccessfulLogin = (user, tokens, customMsg) => {
        const token = tokens?.accessToken;
        const refreshToken = tokens?.refreshToken;
        if (token) {
            localStorage.setItem('om_customer_auth_token', token);
            localStorage.setItem('om_auth_token', token);
        }
        if (refreshToken) {
            localStorage.setItem('om_customer_refresh_token', refreshToken);
            localStorage.setItem('om_refresh_token', refreshToken);
        }
        if (user) {
            if (user.role === 'ADMIN' || user.role === 'EDITOR') {
                localStorage.setItem('om_admin_session', JSON.stringify(user));
                if (token) localStorage.setItem('om_admin_auth_token', token);
            } else {
                localStorage.setItem('om_customer_session', JSON.stringify(user));
                localStorage.setItem('om_user_session', JSON.stringify(user));
            }
            if (window.DB) window.DB.saveUsers([user]);
        }
        console.log(`[Auth Audit] Login Successful: Email="${user?.email}", Role="${user?.role}"`);
        window.showToast?.(customMsg || ("Welcome back, " + (user?.name || 'Customer') + "!"), "success");
        setTimeout(() => {
            if (user?.role === 'ADMIN' || user?.role === 'EDITOR') {
                window.location.href = '../admin/admin.html';
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const redirect = urlParams.get('redirect');
                window.location.href = redirect ? redirect : 'profile.html';
            }
        }, 800);
    };

    if (tabLoginPassword || tabRegister) {
        const activeTabClass = "font-headline-h3 text-sm font-bold pb-2 border-b-2 border-primary text-primary transition-all flex items-center gap-1.5";
        const inactiveTabClass = "font-headline-h3 text-sm font-bold pb-2 border-b-2 border-transparent text-text-muted hover:text-on-surface transition-all flex items-center gap-1.5";

        const hideAllAuthViews = () => {
            if (formLogin) formLogin.classList.add('hidden');
            if (formRegister) formRegister.classList.add('hidden');
            if (formForgot) formForgot.classList.add('hidden');
        };

        if (tabLoginPassword) {
            tabLoginPassword.addEventListener('click', () => {
                hideAllAuthViews();
                if (tabLoginPassword) tabLoginPassword.className = activeTabClass;
                if (tabRegister) tabRegister.className = inactiveTabClass;
                if (formLogin) formLogin.classList.remove('hidden');
            });
        }

        if (tabRegister) {
            tabRegister.addEventListener('click', () => {
                hideAllAuthViews();
                if (tabLoginPassword) tabLoginPassword.className = inactiveTabClass;
                if (tabRegister) tabRegister.className = activeTabClass;
                if (formRegister) formRegister.classList.remove('hidden');
            });
        }

        // Forgot password view toggles
        if (btnForgotPassword) {
            btnForgotPassword.addEventListener('click', () => {
                hideAllAuthViews();
                if (formForgot) formForgot.classList.remove('hidden');
            });
        }

        if (btnForgotBack) {
            btnForgotBack.addEventListener('click', () => {
                hideAllAuthViews();
                if (tabLoginPassword) tabLoginPassword.click();
            });
        }

        // Handle Login Submission
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passInput = document.getElementById('login-password');
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passInput ? passInput.value : '';

            const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

            try {
                const apiRes = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const body = await apiRes.json();

                if (apiRes.ok && body.success && body.data) {
                    const token = body.data.tokens?.accessToken;
                    const user = body.data.user;
                    if (token) {
                        localStorage.setItem('om_customer_auth_token', token);
                        localStorage.setItem('om_auth_token', token);
                    }
                    if (user) {
                        if (user.role === 'ADMIN' || user.role === 'EDITOR') {
                            localStorage.setItem('om_admin_session', JSON.stringify(user));
                            if (token) localStorage.setItem('om_admin_auth_token', token);
                        } else {
                            localStorage.setItem('om_customer_session', JSON.stringify(user));
                            localStorage.setItem('om_user_session', JSON.stringify(user));
                        }
                        if (window.DB) window.DB.saveUsers([user]);
                    }

                    console.log(`[Auth Audit] Storefront Login Successful: Email="${user?.email}", Role="${user?.role}"`);
                    window.showToast?.("Welcome back, " + (user?.name || 'Customer') + "!", "success");
                    setTimeout(() => {
                        if (user?.role === 'ADMIN' || user?.role === 'EDITOR') {
                            window.location.href = '../admin/admin.html';
                        } else {
                            const urlParams = new URLSearchParams(window.location.search);
                            const redirect = urlParams.get('redirect');
                            window.location.href = redirect ? redirect : 'profile.html';
                        }
                    }, 800);
                    return;
                } else if (apiRes.status === 403 || body.error?.code === 'EMAIL_NOT_VERIFIED' || (body.error?.message && body.error.message.includes('verify')) || (body.message && body.message.includes('verify'))) {
                    window.showToast?.("Your email hasn't been verified yet. Redirecting to verification...", "error");
                    setTimeout(() => {
                        window.location.href = `verify_email.html?email=${encodeURIComponent(email)}`;
                    }, 1500);
                    return;
                } else {
                    const errorMsg = formatAuthError(body);
                    window.showToast?.(errorMsg, "error");
                    if (emailInput && window.OM?.shakeElement) window.OM.shakeElement(emailInput);
                    if (passInput && window.OM?.shakeElement) window.OM.shakeElement(passInput);
                    return;
                }
            } catch (err) {
                console.warn('Backend login request failed:', err);
                window.showToast?.('Unable to connect to server. Please try again.', 'error');
                return;
            }
        });

        // Handle Register Submission
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameEl = document.getElementById('register-name');
            const emailEl = document.getElementById('register-email');
            const passEl = document.getElementById('register-password');
            const confirmEl = document.getElementById('register-confirm');

            const name = nameEl ? nameEl.value.trim() : '';
            const email = emailEl ? emailEl.value.trim() : '';
            const password = passEl ? passEl.value : '';
            const confirm = confirmEl ? confirmEl.value : '';

            const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!email || !strictEmailRegex.test(email)) {
                if (emailEl && window.OM?.shakeElement) window.OM.shakeElement(emailEl);
                window.showToast?.("Please enter a valid email address (e.g. user@example.com).", "error");
                return;
            }

            if (password !== confirm) {
                if (confirmEl && window.OM?.shakeElement) window.OM.shakeElement(confirmEl);
                window.showToast("Passwords do not match.", "error");
                return;
            }

            if (password.length < 8) {
                if (passEl && window.OM?.shakeElement) window.OM.shakeElement(passEl);
                window.showToast?.("Password must be at least 8 characters long.", "error");
                return;
            }

            const submitBtn = formRegister.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Creating Account...';
            }

            const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

            try {
                const regRes = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const body = await regRes.json();

                if (regRes.ok && body.success) {
                    // Mandatory email OTP verification: Save pending email & redirect to verify_email.html
                    // DO NOT store authentication tokens or create user session yet!
                    localStorage.setItem('om_pending_verify_email', email);
                    window.showToast?.("A 6-digit verification code has been sent to your email.", "success");
                    setTimeout(() => {
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirect = urlParams.get('redirect');
                        const targetUrl = redirect 
                            ? `verify_email.html?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`
                            : `verify_email.html?email=${encodeURIComponent(email)}`;
                        window.location.href = targetUrl;
                    }, 1200);
                    return;
                } else {
                    const errorMsg = formatAuthError(body);
                    window.showToast?.(errorMsg, "error");
                    if (emailEl && window.OM?.shakeElement) window.OM.shakeElement(emailEl);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">person_add</span> Create Account';
                    }
                    return;
                }
            } catch (err) {
                console.error('Backend registration API error:', err);
                window.showToast?.('Unable to connect to server. Please try again.', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">person_add</span> Create Account';
                }
            }
        });

        // Handle Forgot Password Submission
        formForgot.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('forgot-email');
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email) {
                if (emailInput) window.OM?.shakeElement(emailInput);
                window.showToast?.("Please enter your email address.", "error");
                return;
            }

            const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

            try {
                const res = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const body = await res.json();

                if (res.ok && body.success) {
                    window.showToast?.(body.message || "If an account exists, a password reset link has been sent to your email.", "success");
                    setTimeout(() => {
                        btnForgotBack?.click();
                    }, 2500);
                    return;
                } else {
                    window.showToast?.(body.message || body.error || "Failed to process request.", "error");
                }
            } catch (err) {
                console.warn('Backend forgot password failed, falling back to simulated Toast:', err);
                window.showToast?.(`If an account exists, a password reset link has been sent.`, "success");
                setTimeout(() => {
                    btnForgotBack?.click();
                }, 2000);
            }
        });
    }

    // -----------------------------------------
    // PROFILE PAGE DASHBOARD
    // -----------------------------------------
    const profileContainer = document.getElementById('profile-dashboard') || document.querySelector('.flex-grow');
    if (profileContainer) {
        let currentUser = null;
        if (window.DB) {
            currentUser = window.DB.getCurrentUser();
        }
        
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        renderProfileDashboard(currentUser);
    }
});

let currentFilterStatus = 'ALL';

// Single-page Tab Controller
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    const panel = document.getElementById(tabId + '-tab-panel');
    if (panel) panel.classList.add('active');

    // Desktop sidebar highlighting
    document.querySelectorAll('#desktop-sidebar-menu button').forEach(btn => {
        btn.className = "menu-btn flex items-center gap-3 p-3 rounded-xl transition-all text-left hover:bg-gray-50 text-gray-700";
        if (btn.getAttribute('data-tab') === tabId) {
            btn.className = "menu-btn flex items-center gap-3 p-3 rounded-xl transition-all text-left bg-[#03045E]/10 text-[#03045E] border-l-4 border-l-[#03045E]";
        }
    });

    // Mobile navigation highlighting
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.className = "mobile-tab-btn flex flex-col items-center gap-0.5 text-gray-400";
        if (btn.getAttribute('data-tab') === tabId) {
            btn.className = "mobile-tab-btn flex flex-col items-center gap-0.5 text-[#03045E]";
        }
    });
};

window.logoutCustomer = function() {
    window.showConfirm("Logout?", "Are you sure you want to log out of your account?", async () => {
        if (window.API && window.API.logout) {
            await window.API.logout();
        }
        localStorage.removeItem('om_auth_token');
        localStorage.removeItem('om_customer_auth_token');
        localStorage.removeItem('om_user_session');
        localStorage.removeItem('om_customer_session');
        console.log('[Auth Audit] Storefront Logout completed.');
        window.showToast("Logged out successfully.", "info");
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 800);
    });
};

// Render the entire profile page dynamically
async function renderProfileDashboard(user) {
    const displayName = (user.name && user.name !== 'null' && user.name.trim() !== '') ? user.name : (user.email ? user.email.split('@')[0] : 'OM Customer');
    document.querySelectorAll('.profile-user-name').forEach(el => el.textContent = displayName);
    document.querySelectorAll('.profile-user-email').forEach(el => el.textContent = user.email);

    const memberSinceStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'July 2026';
    const memberSinceEl = document.getElementById('profile-member-since');
    if (memberSinceEl) memberSinceEl.textContent = memberSinceStr;

    // Load sub-modules
    await loadKPIs(user);
    await loadRecentOrders(user);
    await loadDefaultAddress(user);
    await loadRecentlyViewed();
    await loadAddresses(user.addresses || []);
    await loadCustomSkins();
    await loadWishlistItems();

    // Populate Settings forms
    const settingsName = document.getElementById('settings-name');
    const settingsEmail = document.getElementById('settings-email');
    if (settingsName) settingsName.value = user.name || '';
    if (settingsEmail) settingsEmail.value = user.email || '';

    // Watch search input
    const searchInput = document.getElementById('order-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            fetchAndRenderOrders();
        });
    }

    // Load initial orders
    fetchAndRenderOrders();

    // 10s Realtime Auto-Polling
    startCustomerOrdersAutoPolling(user);
}

let cachedCustomerOrders = null;

async function getSharedCustomerOrders(forceRefresh = false) {
    if (!forceRefresh && cachedCustomerOrders !== null) {
        return cachedCustomerOrders;
    }
    if (window.API && window.API.getOrders) {
        try {
            cachedCustomerOrders = await window.API.getOrders();
            console.log(`[Auth Audit] getSharedCustomerOrders: Cached ${cachedCustomerOrders.length} orders for dashboard and my orders.`);
            return cachedCustomerOrders;
        } catch (err) {
            console.warn('[Auth Audit] Failed to load customer orders:', err);
        }
    }
    return [];
}

window.refreshCustomerOrders = async function() {
    console.log('[Auth Audit] Invoking refreshCustomerOrders event listener...');
    const orders = await getSharedCustomerOrders(true);
    const currentUser = window.DB ? window.DB.getCurrentUser() : null;
    if (currentUser) {
        await loadKPIs(currentUser);
        await loadRecentOrders(currentUser);
        await loadPendingReviews(currentUser);
        await fetchAndRenderOrders(true);
    }
    return orders;
};

window.addEventListener('orders-updated', window.refreshCustomerOrders);

async function loadPendingReviews(user) {
    const section = document.getElementById('dash-pending-reviews-section');
    const mount = document.getElementById('dash-pending-reviews-mount');
    const countBadge = document.getElementById('dash-pending-reviews-count');

    if (!section || !mount) return;

    try {
        const token = localStorage.getItem('om_auth_token') || (window.getAuthToken ? await window.getAuthToken() : null);
        if (!token) {
            section.classList.add('hidden');
            return;
        }

        const res = await fetch('http://localhost:3000/api/v1/user/pending-reviews', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            section.classList.add('hidden');
            return;
        }

        const data = await res.json();
        const pendingItems = data.data || [];

        if (pendingItems.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        if (countBadge) countBadge.textContent = `${pendingItems.length} Pending`;

        mount.innerHTML = pendingItems.map(item => `
            <div class="p-4 bg-white border border-amber-200/90 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                <div class="flex items-center gap-3 min-w-0">
                    <img src="${item.product.image || 'https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=200&auto=format&fit=crop'}" alt="${item.product.name}" class="w-12 h-12 object-cover rounded-xl border border-gray-100 flex-shrink-0"/>
                    <div class="min-w-0">
                        <h4 class="font-extrabold text-xs text-gray-900 truncate">${item.product.name}</h4>
                        <p class="text-[10px] text-gray-500 font-medium truncate">Order #${item.orderNumber}</p>
                        <div class="flex items-center gap-0.5 text-amber-400 mt-1">
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
                        </div>
                    </div>
                </div>
                <a href="product_detail.html?id=${encodeURIComponent(item.product.id)}" class="px-4 py-2 bg-[#0077B6] hover:bg-[#03045E] text-white text-xs font-bold rounded-xl shadow-xs transition-all whitespace-nowrap flex-shrink-0">
                    Leave Review
                </a>
            </div>
        `).join('');
    } catch (err) {
        console.warn('Failed to load pending reviews:', err);
        section.classList.add('hidden');
    }
}

async function loadKPIs(user) {
    try {
        const orders = await getSharedCustomerOrders();
        const wishlist = window.API ? await window.API.getWishlist() : [];
        const addresses = user.addresses || [];

        const ordersEl = document.getElementById('dash-kpi-orders');
        const wishlistEl = document.getElementById('dash-kpi-wishlist');
        const addressesEl = document.getElementById('dash-kpi-addresses');

        if (ordersEl) ordersEl.textContent = orders.length;
        if (wishlistEl) wishlistEl.textContent = wishlist.length;
        if (addressesEl) addressesEl.textContent = addresses.length;
    } catch (err) {
        console.error('Failed to load KPIs:', err);
    }
}

async function loadRecentOrders(user) {
    const container = document.getElementById('dash-recent-orders-mount');
    if (!container) return;

    try {
        const orders = await getSharedCustomerOrders();
        if (orders.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic">No recent orders found.</p>`;
            return;
        }

        const recent = orders.slice(0, 3);
        container.innerHTML = recent.map(o => {
            const dateStr = new Date(o.createdAt || o.date).toLocaleDateString();
            const currencySymbol = window.pageCurrency ? window.pageCurrency() : '₹';
            const displayTotal = currencySymbol === '₹' ? '₹' + Math.round(o.total || o.grandTotal || 0).toLocaleString('en-IN') : '$' + (o.total || o.grandTotal || 0).toFixed(2);
            
            const items = Array.isArray(o.items) ? o.items : [];
            const first = items.length > 0 ? items[0] : {};
            const devBrand = first.deviceBrand || first.brandName || '';
            const devModel = first.deviceModel || first.deviceName || '';
            const prodName = first.productName || first.name || 'Custom Skin';
            const devText = devBrand || devModel ? `${devBrand} ${devModel}`.trim() : prodName;

            return `
                <div class="p-3 bg-gray-50 border rounded-xl flex items-center justify-between text-xs font-semibold">
                    <div class="space-y-0.5 min-w-0 pr-2">
                        <p class="font-extrabold text-gray-900 truncate">${o.orderNumber || o.id}</p>
                        <p class="text-gray-600 font-medium text-[11px] truncate">${escapeHtml(devText)}</p>
                        <p class="text-gray-400 text-[10px]">${dateStr} • <span class="font-bold text-[#03045E]">${o.status}</span></p>
                    </div>
                    <span class="text-[#03045E] font-extrabold flex-shrink-0">${displayTotal}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic">Failed to load recent orders.</p>`;
    }
}

async function loadDefaultAddress(user) {
    const container = document.getElementById('dash-default-address-mount');
    if (!container) return;

    const addresses = user.addresses || [];
    if (addresses.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic">No saved addresses.</p>`;
        return;
    }

    const addr = addresses[0];
    container.innerHTML = `
        <p class="font-bold text-gray-900">${addr.firstName} ${addr.lastName}</p>
        <p class="text-gray-500 mt-1">${addr.street}</p>
        <p class="text-gray-500">${addr.city} - ${addr.zip}</p>
    `;
}

async function loadRecentlyViewed() {
    const container = document.getElementById('dash-recent-viewed-mount');
    if (!container) return;

    try {
        const list = window.API ? await window.API.getRecentlyViewed() : [];
        if (list.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">No recently viewed items yet.</p>`;
            return;
        }

        const products = window.DB ? window.DB.getProducts() : [];
        const recentProducts = products.filter(p => list.includes(p.id)).slice(0, 4);

        if (recentProducts.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">No recently viewed items yet.</p>`;
            return;
        }

        container.innerHTML = recentProducts.map(p => {
            const currencySymbol = window.pageCurrency ? window.pageCurrency() : '₹';
            const priceStr = currencySymbol === '₹' ? '₹' + Math.round(p.price * 80) : '$' + p.price.toFixed(2);
            return `
                <a href="product_detail.html?id=${p.id}" class="bg-gray-50 border border-gray-100 hover:border-[#03045E]/30 rounded-xl p-3 flex flex-col items-center text-center transition-all">
                    <img src="${p.image}" class="w-16 h-16 object-cover rounded-lg bg-white shadow-sm mb-2" />
                    <span class="text-xs font-bold text-gray-900 line-clamp-1">${p.name}</span>
                    <span class="text-[11px] font-extrabold text-[#03045E] mt-1">${priceStr}</span>
                </a>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">Failed to load recently viewed.</p>`;
    }
}

// Addresses sub-module CRUD
async function loadAddresses(addresses) {
    const container = document.getElementById('addresses-list-mount');
    if (!container) return;

    if (addresses.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">No addresses saved yet.</p>`;
        return;
    }

    container.innerHTML = addresses.map((addr, idx) => `
        <div class="p-4 border rounded-xl flex justify-between items-start bg-gray-50/50">
            <div class="text-sm space-y-1">
                <p class="font-bold text-gray-900">${addr.firstName} ${addr.lastName}</p>
                <p class="text-gray-500">${addr.street}</p>
                <p class="text-gray-500">${addr.city} - ${addr.zip}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="editAddress(${addr.id})" class="text-xs font-bold text-[#03045E] hover:underline">Edit</button>
                <button onclick="deleteAddress(${addr.id})" class="text-xs font-bold text-red-500 hover:underline">Delete</button>
            </div>
        </div>
    `).join('');
}

window.openNewAddressForm = function() {
    document.getElementById('address-form-wrapper').classList.remove('hidden');
    document.getElementById('address-form').reset();
    document.getElementById('address-id').value = '';
    document.getElementById('address-form-title').textContent = 'Add New Address';
    document.getElementById('address-form').scrollIntoView({ behavior: 'smooth' });
};

window.closeAddressForm = function() {
    document.getElementById('address-form-wrapper').classList.add('hidden');
};

window.saveAddress = function(e) {
    e.preventDefault();
    if (!window.DB) return;
    const user = window.DB.getCurrentUser();
    if (!user) return;

    const id = document.getElementById('address-id').value;
    const firstName = document.getElementById('address-first').value.trim();
    const lastName = document.getElementById('address-last').value.trim();
    const street = document.getElementById('address-street-field').value.trim();
    const city = document.getElementById('address-city-field').value.trim();
    const zip = document.getElementById('address-zip-field').value.trim();

    const addresses = user.addresses || [];
    if (id) {
        const idx = addresses.findIndex(a => a.id === parseInt(id));
        if (idx !== -1) {
            addresses[idx] = { id: parseInt(id), firstName, lastName, street, city, zip };
        }
    } else {
        const newId = addresses.length > 0 ? Math.max(...addresses.map(a => a.id)) + 1 : 1;
        addresses.push({ id: newId, firstName, lastName, street, city, zip });
    }

    const updated = window.DB.updateCurrentUser({ addresses });
    if (updated) {
        window.showToast("Address saved successfully!", "success");
        loadAddresses(updated.addresses);
        loadDefaultAddress(updated);
        closeAddressForm();
    }
};

window.editAddress = function(id) {
    const user = window.DB.getCurrentUser();
    if (!user) return;
    const addr = user.addresses.find(a => a.id === id);
    if (addr) {
        document.getElementById('address-form-wrapper').classList.remove('hidden');
        document.getElementById('address-id').value = addr.id;
        document.getElementById('address-first').value = addr.firstName;
        document.getElementById('address-last').value = addr.lastName;
        document.getElementById('address-street-field').value = addr.street;
        document.getElementById('address-city-field').value = addr.city;
        document.getElementById('address-zip-field').value = addr.zip;

        document.getElementById('address-form-title').textContent = 'Update Address';
        document.getElementById('address-form').scrollIntoView({ behavior: 'smooth' });
    }
};

window.deleteAddress = function(id) {
    window.showConfirm("Remove Address?", "Are you sure you want to delete this saved address?", () => {
        const user = window.DB.getCurrentUser();
        if (!user) return;
        const addresses = (user.addresses || []).filter(a => a.id !== id);
        const updated = window.DB.updateCurrentUser({ addresses });
        if (updated) {
            window.showToast("Address deleted.", "info");
            loadAddresses(updated.addresses);
            loadDefaultAddress(updated);
        }
    });
};

// Custom Designs Loader
async function loadCustomSkins() {
    const container = document.getElementById('custom-skins-mount');
    if (!container) return;

    const draft = localStorage.getItem('om_custom_skin_draft');
    if (!draft) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">No custom skin drafts found.</p>`;
        return;
    }

    try {
        const details = JSON.parse(draft);
        container.innerHTML = `
            <div class="p-4 border rounded-xl bg-gray-50 flex flex-col justify-between space-y-4">
                <div class="aspect-[2/3] bg-white border rounded-xl overflow-hidden relative flex items-center justify-center p-4">
                    <img src="${details.artworkUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'}" class="max-h-full object-contain" />
                    <span class="absolute top-3 left-3 bg-[#03045E] text-white font-extrabold text-[9px] uppercase tracking-widest px-2.5 py-1 rounded">DRAFT DESIGN</span>
                </div>
                <div class="text-xs space-y-1">
                    <p class="font-bold text-gray-900 text-sm">${details.brand || 'Device'} - ${details.model || 'Model'}</p>
                    <p class="text-gray-500 font-medium">Material: ${details.material || 'Standard'}</p>
                    <p class="text-gray-500 font-medium">Finish: ${details.finish || 'Matte'}</p>
                </div>
                <a href="custom_skin.html?draft=1" class="w-full text-center py-2.5 bg-black hover:bg-gray-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all">Edit &amp; Checkout</a>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full font-medium">No custom skin drafts found.</p>`;
    }
}

// Wishlist Loader
async function loadWishlistItems() {
    const container = document.getElementById('wishlist-items-mount');
    if (!container) return;

    try {
        const wishlist = window.API ? await window.API.getWishlist() : [];
        if (wishlist.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full font-medium">Your wishlist is empty.</p>`;
            return;
        }

        const products = window.DB ? window.DB.getProducts() : [];
        const wishProducts = products.filter(p => wishlist.includes(p.id));

        if (wishProducts.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full font-medium">Your wishlist is empty.</p>`;
            return;
        }

        container.innerHTML = wishProducts.map(p => {
            const currencySymbol = window.pageCurrency ? window.pageCurrency() : '₹';
            const priceStr = currencySymbol === '₹' ? '₹' + Math.round(p.price * 80) : '$' + p.price.toFixed(2);
            return `
                <div class="border rounded-2xl p-4 bg-white space-y-3 flex flex-col justify-between">
                    <img src="${p.image}" class="w-full aspect-square object-cover rounded-xl bg-gray-50 border" />
                    <div>
                        <h4 class="font-bold text-sm text-gray-900 truncate">${p.name}</h4>
                        <span class="text-xs font-extrabold text-[#03045E] block mt-1">${priceStr}</span>
                    </div>
                    <div class="flex gap-2">
                        <a href="product_detail.html?id=${p.id}" class="flex-1 text-center py-2 bg-black hover:bg-gray-900 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all">Details</a>
                        <button onclick="removeFromWishlist(${p.id})" class="p-2 border rounded-lg text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic col-span-full">Failed to load wishlist items.</p>`;
    }
}

window.removeFromWishlist = async function(id) {
    if (window.API && window.API.toggleWishlist) {
        await window.API.toggleWishlist(id);
        window.showToast("Removed from Wishlist.", "info");
        await loadWishlistItems();
        await loadKPIs(window.DB.getCurrentUser());
    }
};

// Profile Update Details
window.updateProfileInfo = function(e) {
    e.preventDefault();
    if (!window.DB) return;
    const name = document.getElementById('settings-name').value.trim();
    const email = document.getElementById('settings-email').value.trim();

    const updated = window.DB.updateCurrentUser({ name, email });
    if (updated) {
        window.showToast("Profile details updated successfully!", "success");
        document.querySelectorAll('.profile-user-name').forEach(el => el.textContent = updated.name);
        document.querySelectorAll('.profile-user-email').forEach(el => el.textContent = updated.email);
    }
};

// Change Password Settings
window.changePassword = async function(e) {
    e.preventDefault();
    const currentInput = document.getElementById('pass-current');
    const newInput = document.getElementById('pass-new');
    const confirmInput = document.getElementById('pass-confirm');

    const oldPassword = currentInput ? currentInput.value : '';
    const newPassword = newInput ? newInput.value : '';
    const confirm = confirmInput ? confirmInput.value : '';

    if (!oldPassword) {
        if (currentInput) window.OM?.shakeElement(currentInput);
        window.showToast?.("Please enter your current password.", "error");
        return;
    }
    if (newPassword !== confirm) {
        if (confirmInput) window.OM?.shakeElement(confirmInput);
        window.showToast?.("New passwords do not match.", "error");
        return;
    }
    if (newPassword.length < 8) {
        if (newInput) window.OM?.shakeElement(newInput);
        window.showToast?.("New password must be at least 8 characters.", "error");
        return;
    }

    const form = document.getElementById('password-change-form');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Updating...';
    }

    const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');
    const token = localStorage.getItem('om_auth_token') || localStorage.getItem('om_customer_auth_token');

    try {
        const res = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const body = await res.json();

        if (res.ok && body.success) {
            window.showToast?.("Password updated successfully", "success");
            if (form) form.reset();
        } else {
            const errorMsg = body.error?.message || body.message || "Current password is incorrect";
            window.showToast?.(errorMsg, "error");
            if (currentInput) window.OM?.shakeElement(currentInput);
        }
    } catch (err) {
        console.warn('Backend change password error:', err);
        if (window.DB) {
            const user = window.DB.getCurrentUser();
            if (user && user.password === oldPassword) {
                const updated = window.DB.updateCurrentUser({ password: newPassword });
                if (updated) {
                    window.showToast?.("Password updated successfully", "success");
                    if (form) form.reset();
                    return;
                }
            }
        }
        window.showToast?.("Current password is incorrect.", "error");
        if (currentInput) window.OM?.shakeElement(currentInput);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Password';
        }
    }
};

// Filter orders list by status
window.filterOrders = function(status) {
    currentFilterStatus = status;
    
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.className = "order-filter-btn px-4 py-2 bg-gray-50 border text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold uppercase transition-all";
        if (btn.getAttribute('data-status') === status) {
            btn.className = "order-filter-btn px-4 py-2 bg-[#03045E] text-white rounded-xl text-xs font-bold uppercase transition-all";
        }
    });

    fetchAndRenderOrders();
};

window.trackLatestOrder = async function() {
    switchTab('orders');
    const orders = window.API ? await window.API.getOrders() : [];
    if (orders.length > 0) {
        const sorted = orders.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        const latest = sorted[0];
        setTimeout(() => {
            const detailsPanel = document.getElementById(`tracking-timeline-${latest.orderNumber || latest.id}`);
            if (detailsPanel && detailsPanel.classList.contains('hidden')) {
                toggleOrderTracking(latest.orderNumber || latest.id);
            }
        }, 300);
    }
};

let customerPollTimer = null;
function startCustomerOrdersAutoPolling(user) {
    if (customerPollTimer) clearInterval(customerPollTimer);
    customerPollTimer = setInterval(async () => {
        if (!document.hidden) {
            await getSharedCustomerOrders(true); // Force fresh order retrieval from backend
            await loadKPIs(user);
            await loadRecentOrders(user);
            await fetchAndRenderOrders(true);
        }
    }, 4000); // Realtime 4s polling for instant live status updates
}

// Fetch orders with search text and status filters from backend
async function fetchAndRenderOrders(isSilent = false) {
    const listEl = document.getElementById('orders-list-mount');
    if (!listEl) return;

    if (!isSilent) {
        listEl.innerHTML = `
            <div class="animate-pulse space-y-4">
                <div class="h-28 bg-gray-200 rounded-2xl"></div>
                <div class="h-28 bg-gray-200 rounded-2xl"></div>
            </div>
        `;
    }

    try {
        const searchInput = document.getElementById('order-search-input');
        const search = searchInput ? searchInput.value.trim() : '';

        const orders = await getSharedCustomerOrders(true);
        let filtered = Array.isArray(orders) ? [...orders] : [];
        if (currentFilterStatus === 'ACTIVE') {
            const inactiveStatuses = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED'];
            filtered = filtered.filter(o => o.status && !inactiveStatuses.includes(o.status.toUpperCase()));
        } else if (currentFilterStatus === 'DELIVERED') {
            const deliveredStatuses = ['DELIVERED', 'COMPLETED'];
            filtered = filtered.filter(o => o.status && deliveredStatuses.includes(o.status.toUpperCase()));
        }

        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(o => {
                const idMatch = (o.orderNumber || o.id || '').toLowerCase().includes(s);
                const itemMatch = o.items && Array.isArray(o.items) && o.items.some(item => 
                    (item.productName || item.name || '').toLowerCase().includes(s) || 
                    (item.variantName || item.deviceName || item.deviceModel || '').toLowerCase().includes(s)
                );
                return idMatch || itemMatch;
            });
        }

        if (filtered.length === 0) {
            let emptyTitle = "No Orders Yet";
            let emptyDesc = "You haven't placed any orders yet. Discover our premium 3M skins and elevate your device!";
            if (currentFilterStatus === 'ACTIVE') {
                emptyTitle = "No Active Orders";
                emptyDesc = "You don't have any active or in-progress orders right now.";
            } else if (currentFilterStatus === 'DELIVERED') {
                emptyTitle = "No Delivered Orders";
                emptyDesc = "You don't have any delivered or completed orders yet.";
            } else if (search) {
                emptyTitle = "No Matching Orders Found";
                emptyDesc = `No orders match your search term "${search}".`;
            }

            listEl.innerHTML = `
                <div class="text-center py-12 bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 space-y-4">
                    <div class="w-16 h-16 bg-[#03045E]/10 rounded-full flex items-center justify-center mx-auto text-[#03045E]">
                        <span class="material-symbols-outlined text-3xl">shopping_bag</span>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-lg text-gray-900">${emptyTitle}</h3>
                        <p class="text-sm text-gray-500 mt-1">${emptyDesc}</p>
                    </div>
                    <div class="pt-2">
                        <a href="shop.html" class="inline-flex items-center gap-2 px-6 py-3 bg-[#03045E] hover:bg-[#0077B6] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md">
                            <span class="material-symbols-outlined text-sm">store</span>
                            Start Shopping
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        const currencySymbol = window.pageCurrency ? window.pageCurrency() : '₹';

        listEl.innerHTML = filtered.map(order => {
            const orderId = order.orderNumber || order.id;
            const dateStr = new Date(order.createdAt || order.date || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            const displayTotal = currencySymbol === '₹' ? '₹' + Math.round(order.total || 0).toLocaleString('en-IN') : '$' + (order.total || 0).toFixed(2);
            
            let badgeClass = 'bg-gray-150 text-gray-700';
            if (['DELIVERED'].includes(order.status?.toUpperCase())) badgeClass = 'bg-green-100 text-green-700';
            else if (['SHIPPED'].includes(order.status?.toUpperCase())) badgeClass = 'bg-blue-100 text-blue-700';
            else if (['PROCESSING', 'PAID', 'PENDING_PAYMENT', 'PENDING'].includes(order.status?.toUpperCase())) badgeClass = 'bg-yellow-100 text-yellow-700';
            else if (['CANCELLED', 'FAILED'].includes(order.status?.toUpperCase())) badgeClass = 'bg-red-100 text-red-700';

            // Items layout: if multiple items exist, show first and '+X More' indicator
            const itemsList = order.items && Array.isArray(order.items) && order.items.length > 0 ? order.items : [{ productName: 'Vinyl Device Skin', quantity: 1 }];
            const firstItem = itemsList[0];
            const extraCount = itemsList.length - 1;
            const extraText = extraCount > 0 ? `<span class="bg-gray-100 border text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded ml-2">+${extraCount} More</span>` : '';

            const estDate = order.estimatedDelivery 
                ? new Date(order.estimatedDelivery).toLocaleDateString() 
                : new Date(new Date(order.createdAt || order.date || Date.now()).getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString();

            const firstItemName = (firstItem.productName || firstItem.name || '').toLowerCase();
            const customBadge = firstItemName.includes('custom') || itemsList.some(i => i.isCustom || (i.productName || i.name || '').toLowerCase().includes('custom'))
                ? `<span class="bg-[#03045E] text-white text-[9px] font-extrabold px-2 py-0.5 rounded tracking-widest uppercase shadow-sm">CUSTOM DESIGN BADGE</span>`
                : '';

            return `
                <div class="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col mb-4">
                    <!-- Card Top Header -->
                    <div class="p-4 border-b bg-gray-50/50 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
                        <div>
                            <p class="font-extrabold text-sm text-gray-900">${orderId}</p>
                            <p class="text-gray-400 text-[10px] mt-0.5">${dateStr}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-2.5 py-1 rounded-lg uppercase tracking-wider text-[10px] font-extrabold ${badgeClass}">${order.status}</span>
                            <span class="text-[#03045E] font-extrabold text-sm">${displayTotal}</span>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b">
                        <div class="flex items-start gap-4">
                            <img src="${firstItem.imageUrl || firstItem.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop'}" class="w-16 h-16 object-cover bg-gray-50 border rounded-xl flex-shrink-0" />
                            <div class="space-y-1">
                                <div class="flex items-center flex-wrap gap-1.5">
                                    <h4 class="font-bold text-sm text-gray-900 leading-snug">${firstItem.productName || firstItem.name || 'Device Skin'}</h4>
                                    ${extraText}
                                    ${customBadge}
                                </div>
                                <p class="text-xs text-gray-500 font-medium">${firstItem.variantName || firstItem.deviceName || firstItem.device || 'Precision Fit'} / Qty: ${firstItem.quantity || firstItem.qty || 1}</p>
                                <p class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Est. Delivery: ${estDate}</p>
                            </div>
                        </div>

                        <!-- Card action buttons -->
                        <div class="flex flex-wrap md:flex-nowrap gap-2 items-center self-stretch md:self-auto justify-end">
                            <button onclick="toggleOrderDetail('${orderId}')" class="flex-grow md:flex-grow-0 px-3.5 py-2 border hover:bg-gray-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">Details</button>
                            <button onclick="toggleOrderTracking('${orderId}')" class="flex-grow md:flex-grow-0 px-3.5 py-2 bg-[#03045E] hover:bg-[#2C4A6B] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all">Track Order</button>
                            <button onclick="buyAgain('${order.id || orderId}')" class="flex-grow md:flex-grow-0 px-3.5 py-2 border border-[#03045E]/30 text-[#03045E] hover:bg-[#03045E]/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">Buy Again</button>
                        </div>
                    </div>

                    <!-- Expandable: Tracking Timeline Panel -->
                    <div id="tracking-timeline-${orderId}" class="hidden p-6 border-b bg-gray-50/20">
                        ${renderTimelineHTML(order, estDate)}
                    </div>

                    <!-- Expandable: Order Detail Panel -->
                    <div id="order-details-${orderId}" class="hidden p-6 bg-gray-50/10 space-y-6">
                        ${renderDetailHTML(order, estDate, currencySymbol)}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        listEl.innerHTML = `
            <div class="text-center py-10 bg-white border rounded-2xl shadow-sm text-red-500">
                <p class="text-sm font-semibold">Failed to fetch order history from server.</p>
            </div>
        `;
    }
}

// Binds Buy Again cart actions
window.buyAgain = async function(orderId) {
    if (!window.API) return;

    try {
        const orders = await window.API.getOrders();
        const order = orders.find(o => o.id === orderId || o.orderNumber === orderId);
        if (!order) {
            window.showToast("Order not found.", "error");
            return;
        }

        let skippedItems = [];
        let successCount = 0;

        for (const item of order.items) {
            try {
                // Add first product to cart using API adapter
                await window.API.addToCart({
                    id: item.id || item.productVariantId,
                    qty: item.quantity || item.qty,
                    finish: item.finish || 'Matte',
                    material: item.material || 'Standard 3M',
                    modelId: item.modelId || null
                });
                successCount++;
            } catch (err) {
                skippedItems.push(item.productName || item.name);
            }
        }

        if (successCount > 0) {
            window.showToast(`Added ${successCount} products back to cart!`, "success");
        }
        if (skippedItems.length > 0) {
            setTimeout(() => {
                window.showToast(`Skipped unavailable items: ${skippedItems.join(', ')}`, "warning");
            }, 1000);
        }
    } catch (err) {
        window.showToast("Failed to purchase items again.", "error");
    }
};

window.toggleOrderDetail = function(orderId) {
    const el = document.getElementById(`order-details-${orderId}`);
    if (el) el.classList.toggle('hidden');
};

window.toggleOrderTracking = function(orderId) {
    const el = document.getElementById(`tracking-timeline-${orderId}`);
    if (el) el.classList.toggle('hidden');
};

// Generates expanded timeline tracker HTML dynamically from backend order.status
function renderTimelineHTML(order, estDate) {
    const timeline = order.timelineEvents || [];
    
    // Comprehensive 10-stage order fulfillment pipeline
    const stages = [
        { key: 'PENDING_PAYMENT', label: 'Order Placed', code: 'ORDER_CREATED', aliases: ['PENDING', 'CONFIRMED'] },
        { key: 'PAID', label: 'Payment Confirmed', code: 'PAYMENT_CAPTURED', aliases: ['PAYMENT_CONFIRMED'] },
        { key: 'PROCESSING', label: 'Processing', code: 'PROCESSING', aliases: [] },
        { key: 'PRINTING', label: 'Printing', code: 'PRINTING', aliases: [] },
        { key: 'QUALITY_CHECK', label: 'Quality Check', code: 'QUALITY_CHECK', aliases: [] },
        { key: 'PACKED', label: 'Packed', code: 'PACKED', aliases: [] },
        { key: 'READY_TO_SHIP', label: 'Ready To Ship', code: 'READY_TO_SHIP', aliases: [] },
        { key: 'SHIPPED', label: 'Shipped', code: 'SHIPPED', aliases: [] },
        { key: 'OUT_FOR_DELIVERY', label: 'Out For Delivery', code: 'OUT_FOR_DELIVERY', aliases: [] },
        { key: 'DELIVERED', label: 'Delivered', code: 'DELIVERED', aliases: ['COMPLETED'] }
    ];

    const statusUpper = (order.status || 'PENDING_PAYMENT').toUpperCase();
    
    let currentIdx = -1;
    if (statusUpper === 'CANCELLED' || statusUpper === 'FAILED' || statusUpper === 'REFUNDED') {
        currentIdx = -1;
    } else {
        currentIdx = stages.findIndex(s => s.key === statusUpper || (s.aliases && s.aliases.includes(statusUpper)));
        if (currentIdx === -1) {
            if (order.fulfillmentStatus === 'FULFILLED') currentIdx = 9;
            else if (order.paymentStatus === 'PAID') currentIdx = 1;
            else currentIdx = 0;
        }
    }

    console.log(`[Customer Order Timeline Audit] Order #${order.orderNumber || order.id} -> API Order Status: "${order.status}", Timeline currentStep Index: ${currentIdx + 1}, Mapped Step Stage: "${currentIdx >= 0 ? stages[currentIdx].label : 'CANCELLED'}"`);

    // Check specific custom timeline events mapped by actor
    const eventTimeMap = {};
    timeline.forEach(e => {
        if (e.eventType) {
            eventTimeMap[e.eventType.toUpperCase()] = new Date(e.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    });

    let trackingHeaderHtml = '';
    if (order.trackingNumber) {
        trackingHeaderHtml = `
            <div class="mb-5 bg-white border border-gray-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                <div>
                    <p class="text-gray-400 font-bold uppercase tracking-wider">Courier / Shipper</p>
                    <p class="font-extrabold text-sm text-gray-900 mt-1">${order.courierName || 'Standard Delivery Service'}</p>
                </div>
                <div>
                    <p class="text-gray-400 font-bold uppercase tracking-wider">Tracking Number</p>
                    <p class="font-extrabold text-sm text-gray-900 mt-1">${order.trackingNumber}</p>
                </div>
                ${order.courierLink ? `
                    <a href="${order.courierLink}" target="_blank" class="px-4 py-2 border border-[#03045E]/30 text-[#03045E] hover:bg-[#03045E]/10 rounded-lg font-bold uppercase tracking-wider text-[10px] self-start md:self-auto flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">open_in_new</span> Track Courier Link
                    </a>
                ` : ''}
            </div>
        `;
    }

    if (currentIdx === -1) {
        return `
            <div class="space-y-5">
                <h4 class="font-bold text-sm text-gray-900 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-red-600">cancel</span> Delivery Tracking Timeline</h4>
                <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center space-y-1">
                    <p class="font-bold text-red-800 text-sm">Order Status: ${statusUpper}</p>
                    <p class="text-xs text-red-600">This order has been ${statusUpper.toLowerCase()}. If you have questions, please contact customer support.</p>
                </div>
            </div>
        `;
    }

    let timelineNodes = stages.map((stage, idx) => {
        let isCompleted = idx <= currentIdx;
        let isCurrent = idx === currentIdx;
        
        const timestamp = eventTimeMap[stage.code] || eventTimeMap[`STATUS_UPDATED_${stage.key}`] || '';
        
        let circleBg = 'bg-white border-gray-200 text-gray-400';
        let lineBg = 'bg-gray-200';
        let checkIcon = `${idx + 1}`;
        if (isCompleted) {
            circleBg = 'bg-[#03045E] border-[#03045E] text-white shadow-sm';
            lineBg = 'bg-[#03045E]';
            checkIcon = '✓';
        }
        if (isCurrent) {
            circleBg = 'bg-[#03045E] border-[#03045E] text-white animate-pulse ring-4 ring-[#03045E]/20 shadow';
            checkIcon = `${idx + 1}`;
        }

        return `
            <div class="flex items-start gap-4 timeline-step relative ${idx === stages.length - 1 ? '' : 'pb-6'}">
                ${idx === stages.length - 1 ? '' : `<div class="absolute left-4 top-8 w-0.5 h-full ${lineBg} timeline-line"></div>`}
                <div class="w-8 h-8 rounded-full border-2 ${circleBg} flex items-center justify-center font-bold text-xs flex-shrink-0 z-10 timeline-circle">
                    ${checkIcon}
                </div>
                <div class="space-y-0.5">
                    <h5 class="font-bold text-xs text-gray-900 leading-snug">${stage.label}</h5>
                    ${timestamp ? `<p class="text-[10px] text-gray-400 font-bold">${timestamp}</p>` : ''}
                    ${isCurrent ? `<p class="text-[10px] font-bold text-[#03045E] animate-pulse uppercase tracking-wider">Current Status</p>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="space-y-5">
            <h4 class="font-bold text-sm text-gray-900 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[#03045E]">local_shipping</span> Delivery Tracking Timeline</h4>
            ${trackingHeaderHtml}
            <div class="mt-4 pl-2">
                ${timelineNodes}
            </div>
        </div>
    `;
}

// Generates expanded detail details HTML
function renderDetailHTML(order, estDate, currencySymbol) {
    const address = order.shippingAddress || {};
    const items = order.items || [];
    const customerFullName = address.fullName || (address.firstName ? `${address.firstName} ${address.lastName || ''}`.trim() : null) || order.customerName || 'Customer';

    const itemsListHtml = items.map(item => {
        const itemUnitPrice = Number(item.unitPrice || item.pricePaid || 0);
        const displayPrice = currencySymbol === '₹' ? '₹' + Math.round(itemUnitPrice).toLocaleString('en-IN') : '$' + itemUnitPrice.toFixed(2);
        
        const productName = item.productName || item.name || 'Device Skin';
        const variantName = item.variantName || item.deviceName || item.device || 'Precision Fit';
        const itemImage = item.imageUrl || item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';

        let customProperties = '';
        if (productName.toLowerCase().includes('custom') || item.isCustom) {
            customProperties = `
                <div class="mt-2 space-y-1.5">
                    <span class="px-2 py-0.5 bg-[#03045E]/10 text-[#03045E] text-[9px] font-extrabold uppercase rounded shadow-sm tracking-wide">Custom Artwork Config</span>
                    <div class="grid grid-cols-2 gap-4 bg-gray-50 border p-3 rounded-xl mt-1 text-[11px] text-gray-500">
                        <div>
                            <p class="font-bold uppercase text-[9px] text-gray-400">Material Selection</p>
                            <p class="font-semibold text-gray-800 mt-0.5">${item.material || 'Standard Material'}</p>
                        </div>
                        <div>
                            <p class="font-bold uppercase text-[9px] text-gray-400">Lamination Finish</p>
                            <p class="font-semibold text-gray-800 mt-0.5">${item.finish || 'Matte Finish'}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <img src="${itemImage}" class="w-14 h-14 object-cover bg-gray-50 rounded-xl border flex-shrink-0" />
                <div class="flex-grow space-y-1">
                    <h5 class="font-bold text-xs text-gray-800">${productName}</h5>
                    <p class="text-xs text-gray-400">${variantName} (Qty: ${item.quantity || item.qty || 1})</p>
                    ${customProperties}
                </div>
                <div class="font-extrabold text-xs text-gray-900">${displayPrice}</div>
            </div>
        `;
    }).join('');

    const subtotalVal = Number(order.subtotal || order.total || 0);
    const shippingVal = Number(order.shippingFee || order.shipping || 0);
    const discountVal = Number(order.discount || 0);
    const totalVal = Number(order.total || order.grandTotal || 0);

    const subtotalDisplay = currencySymbol === '₹' ? '₹' + Math.round(subtotalVal).toLocaleString('en-IN') : '$' + subtotalVal.toFixed(2);
    const shippingDisplay = currencySymbol === '₹' ? '₹' + Math.round(shippingVal).toLocaleString('en-IN') : '$' + shippingVal.toFixed(2);
    const discountDisplay = currencySymbol === '₹' ? '₹' + Math.round(discountVal).toLocaleString('en-IN') : '$' + discountVal.toFixed(2);
    const totalDisplay = currencySymbol === '₹' ? '₹' + Math.round(totalVal).toLocaleString('en-IN') : '$' + totalVal.toFixed(2);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-semibold">
            <!-- Shipping & Invoice Details -->
            <div class="space-y-4">
                <div class="bg-white border p-4 rounded-xl space-y-2">
                    <h5 class="font-bold uppercase tracking-wider text-[10px] text-gray-400">Shipping Address</h5>
                    <p class="font-extrabold text-gray-800">${customerFullName}</p>
                    <p class="text-gray-500 font-medium">${address.addressLine1 || address.street || ''}</p>
                    ${address.addressLine2 ? `<p class="text-gray-500 font-medium">${address.addressLine2}</p>` : ''}
                    <p class="text-gray-500 font-medium">${address.city || ''} ${address.state ? `, ${address.state}` : ''} - ${address.pincode || address.zip || ''}</p>
                </div>

                <div class="bg-white border p-4 rounded-xl space-y-2">
                    <h5 class="font-bold uppercase tracking-wider text-[10px] text-gray-400">Payment Summary</h5>
                    <p class="text-gray-500 font-medium">Gateway: ${order.paymentMethod || 'Online Payment'}</p>
                    <p class="text-gray-500 font-medium">Status: ${order.paymentStatus || 'PAID'}</p>
                    ${order.couponCode ? `<p class="text-gray-500 font-medium">Coupon Code: <span class="bg-[#03045E]/10 border border-[#03045E]/20 text-[#03045E] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">${order.couponCode}</span></p>` : ''}
                </div>

                <div class="flex gap-2">
                    ${order.invoiceUrl ? `
                        <a href="${order.invoiceUrl}" target="_blank" class="flex-1 text-center py-2.5 border hover:bg-gray-50 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">download</span> Invoice Receipt
                        </a>
                    ` : `
                        <button onclick="window.print()" class="flex-1 py-2.5 border hover:bg-gray-50 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">print</span> Print Invoice
                        </button>
                    `}
                    <a href="mailto:ommobileart09@gmail.com?subject=Support Request for Order ${order.orderNumber || order.id}" class="flex-1 text-center py-2.5 border border-[#03045E]/30 text-[#03045E] hover:bg-[#03045E]/10 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">support_agent</span> Contact Support
                    </a>
                </div>
            </div>

            <!-- Ordered items details & Price breakdown -->
            <div class="space-y-4 flex flex-col justify-between">
                <div class="bg-white border p-4 rounded-xl divide-y space-y-2">
                    <h5 class="font-bold uppercase tracking-wider text-[10px] text-gray-400 mb-2">Item Breakdown</h5>
                    ${itemsListHtml}
                </div>

                <!-- Price breakdown details -->
                <div class="bg-white border p-4 rounded-xl space-y-2.5">
                    <div class="flex justify-between items-center text-gray-500">
                        <span>Items Subtotal</span>
                        <span>${subtotalDisplay}</span>
                    </div>
                    ${order.discount > 0 ? `
                        <div class="flex justify-between items-center text-green-600">
                            <span>Coupon Discount</span>
                            <span>-${discountDisplay}</span>
                        </div>
                    ` : ''}
                    <div class="flex justify-between items-center text-gray-500">
                        <span>Shipping Fees</span>
                        <span>${shippingDisplay}</span>
                    </div>
                    <div class="border-t pt-2.5 flex justify-between items-center font-bold text-sm text-gray-900">
                        <span>Total Paid</span>
                        <span class="text-[#03045E] font-extrabold">${totalDisplay}</span>
        </div>
    `;
}
