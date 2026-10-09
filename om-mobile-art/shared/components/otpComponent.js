/**
 * OM Mobile Art - Reusable 6-Box OTP Component (otpComponent.js)
 * Supports Email Verification, Email Login, Mobile Login, and Password Reset.
 * Features:
 * - 6 numeric OTP boxes
 * - Auto focus & auto next on input
 * - Backspace focus shifting
 * - Paste support (digits extraction)
 * - 60s countdown timer with Resend functionality
 * - Loading & Error states
 */

window.OM_OTPComponent = class OTPComponent {
  constructor(options = {}) {
    this.container = typeof options.container === 'string' 
      ? document.querySelector(options.container) 
      : options.container;
    this.target = options.target || '';
    this.onVerify = options.onVerify || null;
    this.onResend = options.onResend || null;
    this.onBack = options.onBack || null;
    this.cooldownSeconds = options.cooldown || 60;
    this.title = options.title || 'Enter Verification Code';
    this.subtitle = options.subtitle || `We sent a 6-digit code to:`;
    
    this.timerInterval = null;
    this.remainingSeconds = this.cooldownSeconds;
    this.isSubmitting = false;

    if (this.container) {
      this.render();
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="otp-component-wrapper w-full max-w-md bg-surface-container-lowest border border-border-subtle p-8 rounded-2xl shadow-xl space-y-6">
        <!-- Branding Header -->
        <div class="flex flex-col items-center text-center space-y-3">
          <div class="w-[80px] h-[80px] bg-white border border-gray-100 rounded-[20px] shadow-md flex items-center justify-center p-3">
            <img src="../../assets/logos/logo.png" alt="OM Mobile Art Logo" class="w-full h-full object-contain" onerror="this.style.display='none'"/>
          </div>
          <h3 class="text-2xl font-extrabold text-[#03045E] tracking-tight">${this.escapeHtml(this.title)}</h3>
          <p class="text-sm text-gray-500 font-medium leading-relaxed">
            ${this.escapeHtml(this.subtitle)}<br/>
            <strong class="text-[#03045E] font-bold text-base">${this.escapeHtml(this.target)}</strong>
          </p>
        </div>

        <!-- Form -->
        <form class="otp-form space-y-6" onsubmit="return false;">
          <!-- 6-Box Input -->
          <div class="flex justify-between items-center gap-2 otp-boxes-container">
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="0" autofocus autocomplete="off"/>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="1" autocomplete="off"/>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="2" autocomplete="off"/>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="3" autocomplete="off"/>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="4" autocomplete="off"/>
            <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-box-input w-12 h-14 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-[#03045E] focus:ring-4 focus:ring-[#03045E]/15 focus:outline-none transition-all" data-index="5" autocomplete="off"/>
          </div>

          <!-- Error Alert Banner -->
          <div class="otp-error-banner hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold text-center flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-sm">error</span>
            <span class="otp-error-text"></span>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <button type="submit" class="otp-submit-btn w-full h-12 bg-[#03045E] text-white font-bold rounded-xl hover:bg-[#0077B6] active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md">
              <span class="material-symbols-outlined text-sm">verified</span> Verify Code
            </button>

            <div class="flex items-center justify-between text-xs font-semibold px-1">
              <button type="button" class="otp-resend-btn text-gray-400 cursor-not-allowed flex items-center gap-1 hover:underline" disabled>
                <span class="material-symbols-outlined text-sm">refresh</span> Resend Code
              </button>
              <span class="otp-timer-text text-gray-500 font-medium">Resend in ${this.cooldownSeconds}s</span>
            </div>
          </div>

          ${this.onBack ? `
            <div class="text-center pt-2">
              <button type="button" class="otp-back-btn inline-flex items-center gap-1 text-xs font-bold text-[#03045E] hover:underline">
                <span class="material-symbols-outlined text-sm">arrow_back</span> Change Email / Number
              </button>
            </div>
          ` : ''}
        </form>
      </div>
    `;

    this.bindEvents();
    this.startTimer();
  }

  bindEvents() {
    const boxes = Array.from(this.container.querySelectorAll('.otp-box-input'));
    const form = this.container.querySelector('.otp-form');
    const resendBtn = this.container.querySelector('.otp-resend-btn');
    const backBtn = this.container.querySelector('.otp-back-btn');

    // Auto Focus first box
    if (boxes[0]) setTimeout(() => boxes[0].focus(), 100);

    boxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = box.value.replace(/[^0-9]/g, '');
        box.value = val;
        this.clearError();

        if (val && idx < boxes.length - 1) {
          boxes[idx + 1].focus();
        }
        
        // Auto submit if all 6 boxes filled
        if (boxes.every(b => b.value.length === 1)) {
          this.submitOTP();
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          boxes[idx - 1].focus();
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        if (pasteData) {
          for (let i = 0; i < boxes.length; i++) {
            if (i < pasteData.length) {
              boxes[i].value = pasteData[i];
            }
          }
          const focusIdx = Math.min(pasteData.length, boxes.length - 1);
          boxes[focusIdx].focus();

          if (pasteData.length >= 6) {
            this.submitOTP();
          }
        }
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOTP();
    });

    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        if (resendBtn.disabled) return;
        this.clearError();
        resendBtn.disabled = true;
        resendBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Resending...`;

        try {
          if (this.onResend) {
            await this.onResend();
          }
          this.resetBoxes();
          this.startTimer();
          window.showToast?.("A new 6-digit code has been sent.", "success");
        } catch (err) {
          this.showError(err.message || 'Failed to resend OTP.');
        } finally {
          resendBtn.innerHTML = `<span class="material-symbols-outlined text-sm">refresh</span> Resend Code`;
        }
      });
    }

    if (backBtn && this.onBack) {
      backBtn.addEventListener('click', () => {
        this.destroy();
        this.onBack();
      });
    }
  }

  getEnteredOTP() {
    const boxes = Array.from(this.container.querySelectorAll('.otp-box-input'));
    return boxes.map(b => b.value).join('');
  }

  resetBoxes() {
    const boxes = Array.from(this.container.querySelectorAll('.otp-box-input'));
    boxes.forEach(b => b.value = '');
    if (boxes[0]) boxes[0].focus();
  }

  showError(msg) {
    const banner = this.container.querySelector('.otp-error-banner');
    const textEl = this.container.querySelector('.otp-error-text');
    if (banner && textEl) {
      textEl.textContent = msg;
      banner.classList.remove('hidden');
    }
    const firstBox = this.container.querySelector('.otp-box-input');
    if (window.OM?.shakeElement && firstBox) {
      window.OM.shakeElement(firstBox);
    }
  }

  clearError() {
    const banner = this.container.querySelector('.otp-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  setLoading(isLoading) {
    this.isSubmitting = isLoading;
    const submitBtn = this.container.querySelector('.otp-submit-btn');
    const boxes = Array.from(this.container.querySelectorAll('.otp-box-input'));

    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.innerHTML = isLoading 
        ? `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Verifying Code...`
        : `<span class="material-symbols-outlined text-sm">verified</span> Verify Code`;
    }

    boxes.forEach(b => b.disabled = isLoading);
  }

  async submitOTP() {
    if (this.isSubmitting) return;

    const otp = this.getEnteredOTP();
    if (otp.length !== 6) {
      this.showError('Please enter the complete 6-digit code.');
      return;
    }

    this.clearError();
    this.setLoading(true);

    try {
      if (this.onVerify) {
        await this.onVerify(otp);
      }
    } catch (err) {
      this.showError(err.message || 'Invalid or expired OTP. Please try again.');
      this.resetBoxes();
    } finally {
      this.setLoading(false);
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.remainingSeconds = this.cooldownSeconds;

    const resendBtn = this.container.querySelector('.otp-resend-btn');
    const timerText = this.container.querySelector('.otp-timer-text');

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.className = "otp-resend-btn text-gray-400 cursor-not-allowed flex items-center gap-1 hover:underline";
    }

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.className = "otp-resend-btn text-[#03045E] cursor-pointer font-bold flex items-center gap-1 hover:underline";
        }
        if (timerText) {
          timerText.textContent = "Ready to resend";
        }
      } else {
        if (timerText) {
          timerText.textContent = `Resend in ${this.remainingSeconds}s`;
        }
      }
    }, 1000);
  }

  destroy() {
    clearInterval(this.timerInterval);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[m]);
  }
};
