/**
 * Token check middleware to prevent blacklisted tokens from being used
 */

import { tokenBlacklist, sessionManager } from '../services/tokenBlacklistService.js';

/**
 * Middleware to check if token is blacklisted
 * Should be applied after JWT verification
 */
export function checkTokenBlacklist(req, res, next) {
  // Only check if there's an authenticated user and token
  if (!req.user || !req.token) {
    return next();
  }

  // Check if token is blacklisted
  if (tokenBlacklist.isBlacklisted(req.token)) {
    console.warn(`🚫 Attempt to use blacklisted token for user ${req.user.id}`);
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'ERR_TOKEN_BLACKLISTED',
        message: 'Your session has been invalidated. Please log in again.',
      },
    });
  }

  // Update last activity
  sessionManager.updateActivity(req.user.id, req.token);

  next();
}

/**
 * Check concurrent session limit
 */
export function checkConcurrentSessions(maxSessions = 5) {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    if (sessionManager.checkConcurrentLimit(req.user.id, maxSessions)) {
      console.warn(
        `⚠️ User ${req.user.id} exceeds concurrent session limit (${maxSessions})`
      );

      // You can either:
      // 1. Reject the new request
      // 2. Invalidate oldest session
      // Here we'll log it but allow (can be changed to strict mode)

      // For strict mode, uncomment:
      // return res.status(403).json({
      //   success: false,
      //   error: {
      //     code: 'ERR_CONCURRENT_SESSIONS_EXCEEDED',
      //     message: `Maximum ${maxSessions} concurrent sessions allowed`,
      //   },
      // });
    }

    next();
  };
}

/**
 * Middleware to store token in request for later use
 * Should be added after JWT verification
 */
export function storeToken(req, res, next) {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.token = authHeader.substring(7);
  }

  next();
}
