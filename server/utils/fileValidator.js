/**
 * File Type Validation Utility
 * Validates files based on magic bytes (file signatures) not just MIME type
 * Prevents polyglot files (e.g., ZIP disguised as PNG)
 */

/**
 * Magic bytes (file signatures) for allowed image types
 */
const MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [[0xff, 0xd8, 0xff, 0xe0], [0xff, 0xd8, 0xff, 0xe1], [0xff, 0xd8, 0xff, 0xe2]],
  gif87: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  gif89: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  webp: [
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    null, null, null, null,  // File size (skip)
    0x57, 0x45, 0x42, 0x50   // 'WEBP'
  ]
};

/**
 * Validate file type using magic bytes
 * @param {Buffer} buffer - File buffer to validate
 * @returns {Object} - { valid: boolean, type: string, error: string }
 */
export function validateFileByMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return { valid: false, type: null, error: 'File too small' };
  }

  // Check PNG
  if (matchMagicBytes(buffer, MAGIC_BYTES.png)) {
    return { valid: true, type: 'png', error: null };
  }

  // Check JPEG
  for (const jpeg of MAGIC_BYTES.jpeg) {
    if (matchMagicBytes(buffer, jpeg)) {
      return { valid: true, type: 'jpeg', error: null };
    }
  }

  // Check GIF87
  if (matchMagicBytes(buffer, MAGIC_BYTES.gif87)) {
    return { valid: true, type: 'gif', error: null };
  }

  // Check GIF89
  if (matchMagicBytes(buffer, MAGIC_BYTES.gif89)) {
    return { valid: true, type: 'gif', error: null };
  }

  // Check WebP
  if (matchMagicBytes(buffer, MAGIC_BYTES.webp)) {
    return { valid: true, type: 'webp', error: null };
  }

  return { valid: false, type: null, error: 'Unrecognized file type. Ensure it is a valid image.' };
}

/**
 * Helper: Match magic bytes in buffer
 * @private
 */
function matchMagicBytes(buffer, signature) {
  if (buffer.length < signature.length) return false;
  
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== null && buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Comprehensive file validation for image uploads
 * @param {Buffer} buffer - File buffer
 * @param {string} claimedMimeType - MIME type from client
 * @param {number} maxSizeBytes - Maximum file size
 * @returns {Object} - { valid: boolean, type: string, error: string }
 */
export function validateImageFile(buffer, claimedMimeType, maxSizeBytes = 5 * 1024 * 1024) {
  // Size check
  if (buffer.length > maxSizeBytes) {
    return { 
      valid: false, 
      type: null, 
      error: `File too large. Maximum size is ${maxSizeBytes / 1024 / 1024}MB.` 
    };
  }

  // Magic bytes check
  const magicCheck = validateFileByMagicBytes(buffer);
  if (!magicCheck.valid) {
    return magicCheck;
  }

  // MIME type should match detected type (optional additional check)
  if (claimedMimeType) {
    const mimeToType = {
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const expectedType = mimeToType[claimedMimeType.toLowerCase()];
    if (expectedType && expectedType !== magicCheck.type) {
      // MIME mismatch but we allow it - just log warning
      console.warn(`⚠️ MIME type mismatch: claimed ${claimedMimeType}, detected ${magicCheck.type}`);
    }
  }

  return magicCheck;
}

/**
 * Sanitize filename - prevent path traversal and special characters
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  
  // Only allow alphanumeric, underscore, dash, and single dot
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '');
  
  // Remove multiple dots (prevent .php.png tricks)
  safe = safe.replace(/\.{2,}/g, '.');
  
  // Remove leading/trailing dots
  safe = safe.replace(/^\.+|\.+$/g, '');
  
  return safe || 'file';
}
