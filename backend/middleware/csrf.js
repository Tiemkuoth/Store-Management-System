import { csrfTokenService } from '../services/csrfTokenService.js';

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing requests
 * Server-side storage only - no cookies for secrets
 */
export function csrfProtection(req, res, next) {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for public endpoints
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/request-password-reset', '/api/auth/reset-password'];
  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Get session ID from user
  const sessionId = req.user?.id;
  if (!sessionId) {
    console.warn('⚠️ CSRF: No session ID found');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get CSRF token from request header
  const clientToken = req.headers['x-csrf-token'];

  if (!clientToken) {
    console.warn('⚠️ CSRF: Missing CSRF token in request header');
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  // Validate token (secret is stored server-side)
  const isValid = csrfTokenService.validateToken(sessionId, clientToken);

  if (!isValid) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  // Token is valid, generate a new one for the next request
  const { token: newToken } = csrfTokenService.generateToken(sessionId);
  res.setHeader('X-CSRF-Token', newToken);

  next();
}

/**
 * Generate CSRF token endpoint
 * Called on page load to get initial CSRF token
 */
export function generateCSRFToken(req, res) {
  const sessionId = req.user?.id;
  if (!sessionId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token } = csrfTokenService.generateToken(sessionId);

  // Return token (to be sent in X-CSRF-Token header)
  res.json({ csrfToken: token });
}

