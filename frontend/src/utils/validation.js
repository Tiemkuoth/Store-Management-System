/**
 * Client-side validation utilities for forms
 * Provides real-time validation feedback with minimal dependencies
 */

/**
 * Email validation
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  return {
    score: passed,
    maxScore: 5,
    passed,
    checks,
    strength: passed >= 4 ? 'Strong' : passed >= 3 ? 'Good' : 'Weak',
  };
}

/**
 * Form field validators
 */
export const validators = {
  required: (value) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (value && !isValidEmail(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (value && value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (value && value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  pattern: (pattern, message) => (value) => {
    if (value && !pattern.test(value)) {
      return message || 'Invalid format';
    }
    return null;
  },

  match: (matchValue, fieldName) => (value) => {
    if (value !== matchValue) {
      return `${fieldName} does not match`;
    }
    return null;
  },

  phoneNumber: (value) => {
    if (value && !/^\d{10,15}$/.test(value.replace(/\D/g, ''))) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  url: (value) => {
    if (value) {
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
    }
    return null;
  },

  minValue: (min) => (value) => {
    if (value !== null && value !== undefined && value < min) {
      return `Must be at least ${min}`;
    }
    return null;
  },

  maxValue: (max) => (value) => {
    if (value !== null && value !== undefined && value > max) {
      return `Must be no more than ${max}`;
    }
    return null;
  },

  numeric: (value) => {
    if (value && isNaN(value)) {
      return 'Must be a number';
    }
    return null;
  },

  integer: (value) => {
    if (value && !Number.isInteger(Number(value))) {
      return 'Must be a whole number';
    }
    return null;
  },
};

/**
 * Compose multiple validators
 */
export function composeValidators(...validatorFunctions) {
  return (value) => {
    for (const validator of validatorFunctions) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };
}

/**
 * Validate form data against schema
 */
export function validateForm(formData, schema) {
  const errors = {};

  for (const [field, validator] of Object.entries(schema)) {
    const value = formData[field];
    const error = validator(value);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (Array.isArray(error)) return error[0]?.message || 'An error occurred';
  return 'An error occurred';
}
