/**
 * Validation middleware for request bodies and parameters
 */

import { validateRequest } from '../utils/validation.js';

/**
 * Middleware factory for validating request body
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const validation = validateRequest(schema, req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ERR_VALIDATION_FAILED',
          message: validation.message,
          details: validation.errors,
        },
      });
    }

    // Replace req.body with validated data
    req.body = validation.data;
    next();
  };
}

/**
 * Middleware factory for validating URL parameters
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const validation = validateRequest(schema, req.params);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ERR_INVALID_PARAMETER',
          message: validation.message,
          details: validation.errors,
        },
      });
    }

    // Replace req.params with validated data
    req.params = validation.data;
    next();
  };
}

/**
 * Middleware factory for validating query parameters
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const validation = validateRequest(schema, req.query);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ERR_INVALID_QUERY',
          message: validation.message,
          details: validation.errors,
        },
      });
    }

    // Replace req.query with validated data
    req.query = validation.data;
    next();
  };
}

/**
 * Validation helper that can be called manually in route handlers
 */
export { validateRequest };

// ValidationError is the single source of truth — re-export from utils
export { ValidationError } from '../utils/validation.js';
