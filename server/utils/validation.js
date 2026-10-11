/**
 * Validation utilities and helpers
 */

/**
 * Validate and sanitize request data
 */
export function validateRequest(schema, data) {
  try {
    if (!schema || typeof schema.safeParse !== 'function') {
      return {
        valid: false,
        errors: [{ field: 'schema', message: 'Invalid schema', code: 'ERR_SCHEMA' }],
        message: 'Invalid validation schema',
      };
    }
    
    const result = schema.safeParse(data);
    
    if (!result || !result.success) {
      // Get errors safely
      let errorList = [];
      
      if (result?.error?.errors && Array.isArray(result.error.errors)) {
        errorList = result.error.errors;
      } else if (result?.error?.flatten && typeof result.error.flatten === 'function') {
        const flattened = result.error.flatten();
        errorList = flattened.fieldErrors ? Object.entries(flattened.fieldErrors).map(([field, msgs]) => ({
          path: [field],
          message: Array.isArray(msgs) ? msgs[0] : msgs,
        })) : [];
      }
      
      const errors = (Array.isArray(errorList) ? errorList : []).map(err => ({
        field: (Array.isArray(err?.path) ? err.path.join('.') : err?.field) || 'unknown',
        message: err?.message || 'Validation error',
        code: err?.code || 'ERR_VALIDATION',
      }));
      
      if (errors.length === 0) {
        errors.push({ field: 'unknown', message: 'Validation failed', code: 'ERR_VALIDATION' });
      }
      
      return {
        valid: false,
        errors,
        message: `Validation failed: ${errors[0]?.message || 'Unknown error'}`,
      };
    }
    
    return {
      valid: true,
      data: result.data,
    };
  } catch (err) {
    console.error('[VALIDATION ERROR]', err);
    return {
      valid: false,
      errors: [{ field: 'unknown', message: 'Validation error', code: 'ERR_INTERNAL' }],
      message: 'Validation error occurred',
    };
  }
}

/**
 * Sanitize user input to prevent XSS
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
 * Validate email format
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
  
  const strength = Object.values(checks).filter(Boolean).length;
  
  return {
    valid: checks.length && checks.uppercase && checks.number,
    score: strength,
    checks,
  };
}

/**
 * Validate username format
 */
export function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * Validate SQL injection attempts
 */
export function detectSQLInjection(input) {
  if (typeof input !== 'string') return false;
  
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
    'UNION', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE',
    '/*', '*/', '--', ';', '\'', '"', '||', 'OR', 'AND'
  ];
  
  const upperInput = input.toUpperCase();
  return sqlKeywords.some(keyword => upperInput.includes(keyword));
}

/**
 * Validate XSS attempts
 */
export function detectXSSAttempt(input) {
  if (typeof input !== 'string') return false;
  
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /src=.*data:/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

/**
 * Batch validation for arrays
 */
export function validateArray(schema, array) {
  if (!Array.isArray(array)) {
    return {
      valid: false,
      errors: ['Input must be an array'],
    };
  }
  
  const errors = [];
  const validData = [];
  
  array.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      errors.push({
        index,
        message: result.error.errors[0]?.message,
      });
    } else {
      validData.push(result.data);
    }
  });
  
  return {
    valid: errors.length === 0,
    data: validData,
    errors,
  };
}
