/**
 * Enhanced error handler with structured logging and error codes
 */

import { ValidationError as ValidationErrorClass } from '../utils/validation.js';

export const errorHandler = (err, req, res, next) => {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine error type and status code
  let statusCode = 500;
  let errorCode = 'ERR_INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';

  if (err.name === 'ValidationError' || err instanceof ValidationErrorClass) {
    statusCode = 400;
    errorCode = 'ERR_VALIDATION_FAILED';
    message = err.message || 'Validation failed';
  } else if (err.name === 'UnauthorizedError' || err.statusCode === 401) {
    statusCode = 401;
    errorCode = 'ERR_UNAUTHORIZED';
    message = 'Unauthorized access';
  } else if (err.statusCode === 403) {
    statusCode = 403;
    errorCode = 'ERR_FORBIDDEN';
    message = 'Access forbidden';
  } else if (err.statusCode === 404) {
    statusCode = 404;
    errorCode = 'ERR_NOT_FOUND';
    message = 'Resource not found';
  } else if (err.message.includes('timeout')) {
    statusCode = 504;
    errorCode = 'ERR_REQUEST_TIMEOUT';
    message = 'Request timeout';
  } else if (err.message.includes('Circuit breaker')) {
    statusCode = 503;
    errorCode = 'ERR_SERVICE_UNAVAILABLE';
    message = 'Service temporarily unavailable';
  }

  // Log structured error
  const errorLog = {
    errorId,
    errorCode,
    statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id || 'anonymous',
    username: req.user?.username || 'unknown',
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  console.error(`❌ [${errorCode}] ${errorId}:`, errorLog);

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      errorId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

// ── Async route wrapper ────────────────────────────────────────
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ValidationError — single source of truth in ../utils/validation.js
export { ValidationError } from '../utils/validation.js';

// ── Circuit breaker error ────────────────────────────────────
export class CircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.statusCode = 503;
  }
}
