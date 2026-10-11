import crypto from 'crypto';

/**
 * CSRF Token Service
 * Generates and validates CSRF tokens to prevent cross-site request forgery
 * Uses the "Double Submit Cookie" pattern with httpOnly cookies
 */

class CSRFTokenService {
  constructor() {
    this.tokenSecrets = new Map(); // sessionId -> secret
    this.MAX_TOKENS = 10000; // Prevent memory leak
  }

  /**
   * Generate a new CSRF token for a session
   * Returns { token, secret } pair
   */
  generateToken(sessionId) {
    // Generate a cryptographically secure random secret
    const secret = crypto.randomBytes(32).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');

    // Store the secret mapped to session
    this.tokenSecrets.set(sessionId, secret);

    // Cleanup if too many tokens (prevent memory leak)
    if (this.tokenSecrets.size > this.MAX_TOKENS) {
      const firstKey = this.tokenSecrets.keys().next().value;
      this.tokenSecrets.delete(firstKey);
    }

    return {
      token,    // Send to client (in X-CSRF-Token header)
      secret,   // Store as httpOnly cookie
    };
  }

  /**
   * Validate CSRF token
   * Compares client token with stored secret (server-side only)
   */
  validateToken(sessionId, clientToken) {
    const storedSecret = this.tokenSecrets.get(sessionId);

    if (!storedSecret || !clientToken) {
      console.warn(`⚠️ CSRF validation failed: missing token or secret for session ${sessionId}`);
      return false;
    }

    // Simple comparison - secret is server-side only, client sends token
    const isValid = clientToken === storedSecret;

    if (!isValid) {
      console.warn(`⚠️ CSRF token mismatch for session ${sessionId}`);
    }

    return isValid;
  }

  /**
   * Revoke a CSRF token (on logout)
   */
  revokeToken(sessionId) {
    this.tokenSecrets.delete(sessionId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeSessions: this.tokenSecrets.size,
    };
  }
}

export const csrfTokenService = new CSRFTokenService();
export default csrfTokenService;
