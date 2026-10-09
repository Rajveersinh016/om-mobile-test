/**
 * OM Mobile Art — Register Page Controller (register.js)
 * Production Email Verification & API Auth Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-register');
  if (!form) return;

  // Password visibility toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? 'visibility_off' : 'visibility';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameEl     = document.getElementById('register-name');
    const emailEl    = document.getElementById('register-email');
    const passwordEl = document.getElementById('register-password');
    const confirmEl  = document.getElementById('register-confirm');
    const termsEl    = document.getElementById('register-terms');

    const name     = nameEl ? nameEl.value.trim() : '';
    const email    = emailEl ? emailEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value : '';
    const confirm  = confirmEl ? confirmEl.value : '';
    const terms    = termsEl ? termsEl.checked : false;

    // Validation checks
    if (!name) {
      if (nameEl && window.OM?.shakeElement) window.OM.shakeElement(nameEl);
      window.showToast?.('Full name is required.', 'error');
      return;
    }

    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !strictEmailRegex.test(email)) {
      if (emailEl && window.OM?.shakeElement) window.OM.shakeElement(emailEl);
      window.showToast?.('Please enter a valid email address (e.g. user@example.com).', 'error');
      return;
    }

    if (!password || password.length < 8) {
      if (passwordEl && window.OM?.shakeElement) window.OM.shakeElement(passwordEl);
      window.showToast?.('Password must be at least 8 characters long.', 'error');
      return;
    }

    if (password !== confirm) {
      if (confirmEl && window.OM?.shakeElement) window.OM.shakeElement(confirmEl);
      window.showToast?.('Passwords do not match.', 'error');
      return;
    }

    if (!terms) {
      if (termsEl && window.OM?.shakeElement) window.OM.shakeElement(termsEl);
      window.showToast?.('Please accept the Terms of Service to continue.', 'error');
      return;
    }

    const btn = document.getElementById('register-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">autorenew</span> Creating Account...';
    }

    const API_URL = window.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api/v1' : '/api/v1');

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const body = await res.json();

      if (res.ok && body.success) {
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
        window.showToast?.(errorMsg, 'error');
        if (emailEl && window.OM?.shakeElement) window.OM.shakeElement(emailEl);
      }
    } catch (err) {
      console.error('Registration API error:', err);
      window.showToast?.('Unable to connect to server. Please try again.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">person_add</span> Create Account';
      }
    }
  });
});

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
    return rawMsg || 'Registration failed. Please check your details.';
}
