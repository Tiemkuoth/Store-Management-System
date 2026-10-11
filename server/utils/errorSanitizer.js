/**
 * Error Sanitization Utility
 * Prevents sensitive information disclosure through error messages
 */

/**
 * Sanitize error message to prevent SQL injection info disclosure
 * Logs full error server-side, returns generic message to client
 */
export function sanitizeError(error, context = '') {
  // Log full error with context for debugging
  console.error(`[ERROR${context ? ': ' + context : ''}]`, error);
  
  // Return generic message to client
  return 'An error occurred while processing your request';
}

/**
 * Sanitize multiple error messages
 */
export function sanitizeErrors(errors, context = '') {
  errors.forEach(e => sanitizeError(e, context));
  return 'An error occurred while processing your request';
}

/**
 * Check if error message contains SQL keywords (SQL injection attempt indicator)
 */
export function isSQLError(message) {
  const sqlKeywords = ['sql', 'table', 'column', 'database', 'syntax', 'query', 'insert', 'update', 'delete', 'select', 'from', 'where'];
  return sqlKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

/**
 * Validate and sanitize database errors
 */
export function sanitizeDatabaseError(error, userFacingDefault = 'Database operation failed') {
  console.error('[DATABASE ERROR]', error);
  
  // Specific validation errors
  if (error.message?.includes('Duplicate entry')) {
    return 'This record already exists';
  }
  if (error.message?.includes('foreign key constraint')) {
    return 'Cannot delete this record as it is referenced by other data';
  }
  if (error.message?.includes('unknown column')) {
    return userFacingDefault;
  }
  
  // Default: don't expose SQL error details
  return userFacingDefault;
}
