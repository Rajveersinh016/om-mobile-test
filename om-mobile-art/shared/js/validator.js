/**
 * OM Mobile Art — Validator (validator.js)
 * Form validation utilities. Return { valid: boolean, message: string }.
 */

const Validator = {

  /**
   * Check that a value is not empty.
   * @param {string} value
   * @param {string} [fieldName='Field']
   */
  required(value, fieldName = 'Field') {
    const v = String(value || '').trim();
    return v.length > 0
      ? { valid: true }
      : { valid: false, message: `${fieldName} is required.` };
  },

  /**
   * Check minimum length.
   * @param {string} value
   * @param {number} min
   * @param {string} [fieldName='Field']
   */
  minLength(value, min, fieldName = 'Field') {
    const v = String(value || '').trim();
    return v.length >= min
      ? { valid: true }
      : { valid: false, message: `${fieldName} must be at least ${min} characters.` };
  },

  /**
   * Check maximum length.
   * @param {string} value
   * @param {number} max
   * @param {string} [fieldName='Field']
   */
  maxLength(value, max, fieldName = 'Field') {
    const v = String(value || '').trim();
    return v.length <= max
      ? { valid: true }
      : { valid: false, message: `${fieldName} must be at most ${max} characters.` };
  },

  /**
   * Validate email format.
   * @param {string} value
   */
  email(value) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value || '').trim())
      ? { valid: true }
      : { valid: false, message: 'Please enter a valid email address.' };
  },

  /**
   * Validate phone number (basic, 7-15 digits, optional + prefix).
   * @param {string} value
   */
  phone(value) {
    const re = /^\+?[\d\s\-()]{7,15}$/;
    return re.test(String(value || '').trim())
      ? { valid: true }
      : { valid: false, message: 'Please enter a valid phone number.' };
  },

  /**
   * Check that two values match (e.g. password confirmation).
   * @param {string} value1
   * @param {string} value2
   * @param {string} [fieldName='Passwords']
   */
  match(value1, value2, fieldName = 'Passwords') {
    return String(value1) === String(value2)
      ? { valid: true }
      : { valid: false, message: `${fieldName} do not match.` };
  },

  /**
   * Validate that a value is a positive number.
   * @param {string|number} value
   * @param {string} [fieldName='Value']
   */
  positiveNumber(value, fieldName = 'Value') {
    const n = parseFloat(value);
    return !isNaN(n) && n > 0
      ? { valid: true }
      : { valid: false, message: `${fieldName} must be a positive number.` };
  },

  /**
   * Validate that a value is a non-negative integer.
   * @param {string|number} value
   * @param {string} [fieldName='Value']
   */
  nonNegativeInt(value, fieldName = 'Value') {
    const n = parseInt(value, 10);
    return !isNaN(n) && n >= 0
      ? { valid: true }
      : { valid: false, message: `${fieldName} must be 0 or a positive whole number.` };
  },

  /**
   * Run multiple validation rules and return the first failure.
   * @param {Array<{valid: boolean, message: string}>} rules
   * @returns {{ valid: boolean, message?: string }}
   */
  all(rules) {
    for (const result of rules) {
      if (!result.valid) return result;
    }
    return { valid: true };
  },

  /**
   * Show an error message under a form field.
   * @param {Element} field - The input/select/textarea element
   * @param {string} message
   */
  showFieldError(field, message) {
    field.classList.add('border-red-500', 'focus:ring-red-500');
    let errEl = field.parentElement.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'field-error text-red-600 text-xs mt-1';
      field.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;

    // Apply wobbly validation shake
    if (window.OM && window.OM.shakeElement) {
      window.OM.shakeElement(field);
    }
  },

  /**
   * Clear error styling from a form field.
   * @param {Element} field
   */
  clearFieldError(field) {
    field.classList.remove('border-red-500', 'focus:ring-red-500');
    const errEl = field.parentElement && field.parentElement.querySelector('.field-error');
    if (errEl) errEl.remove();
  },

  /**
   * Validate all required fields in a form and show errors inline.
   * @param {HTMLFormElement} form
   * @returns {boolean} - true if all valid
   */
  validateForm(form) {
    let allValid = true;
    const inputs = form.querySelectorAll('[required]');
    inputs.forEach(input => {
      Validator.clearFieldError(input);
      if (!input.value.trim()) {
        const label = form.querySelector(`label[for="${input.id}"]`);
        const name = label ? label.textContent.replace('*', '').trim() : (input.placeholder || 'This field');
        Validator.showFieldError(input, `${name} is required.`);
        allValid = false;
      }
    });
    return allValid;
  }
};

window.Validator = Validator;
console.log('[OM Validator] Loaded ✓');
