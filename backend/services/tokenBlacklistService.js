/**
 * Token Blacklist & Session Management Service
 * Manages JWT token blacklisting for logout and session invalidation
 */

import { getPool } from '../db/db.js';

// ── In-Memory Token Blacklist (with auto-cleanup) ─────────────
class TokenBlacklist {
  constructor() {
    this.blacklist = new Map();
    this.startCleanup();
  }

  startCleanup() {
    // Clean up expired tokens every 60 seconds
    setInterval(() => {
      const now = Date.now();
      const expired = [];

      for (const [token, entry] of this.blacklist.entries()) {
        if (entry.expiresAt < now) {
          expired.push(token);
        }
      }

      expired.forEach(token => this.blacklist.delete(token));

      if (expired.length > 0) {
        console.log(`🧹 Cleaned up ${expired.length} expired tokens`);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Add token to blacklist
   */
  blacklistToken(token, expiresAt) {
    this.blacklist.set(token, {
      blacklistedAt: Date.now(),
      expiresAt,
      reason: 'logout',
    });
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(token) {
    const entry = this.blacklist.get(token);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Get blacklist stats
   */
  getStats() {
    return {
      totalBlacklisted: this.blacklist.size,
      entries: Array.from(this.blacklist.entries()).map(([token, entry]) => ({
        token: `${token.substring(0, 10)}...`,
        blacklistedAt: new Date(entry.blacklistedAt),
        expiresAt: new Date(entry.expiresAt),
        reason: entry.reason,
      })),
    };
  }

  /**
   * Clear all blacklisted tokens
   */
  clearAll() {
    const count = this.blacklist.size;
    this.blacklist.clear();
    return count;
  }
}

// ── Session Management ────────────────────────────────────────
class SessionManager {
  constructor() {
    this.sessions = new Map(); // userId -> [sessions]
    this.startCleanup();
  }

  startCleanup() {
    // Clean up expired sessions every 30 seconds
    setInterval(() => {
      const now = Date.now();
      let totalCleaned = 0;

      for (const [userId, sessions] of this.sessions.entries()) {
        const activeSessions = sessions.filter(s => s.expiresAt > now);
        
        if (activeSessions.length === 0) {
          this.sessions.delete(userId);
          totalCleaned++;
        } else if (activeSessions.length < sessions.length) {
          this.sessions.set(userId, activeSessions);
          totalCleaned += sessions.length - activeSessions.length;
        }
      }

      if (totalCleaned > 0) {
        console.log(`🧹 Cleaned up ${totalCleaned} expired sessions`);
      }
    }, 30 * 1000); // Every 30 seconds
  }

  /**
   * Create new session
   */
  createSession(userId, token, expiresAt, metadata = {}) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, []);
    }

    const session = {
      token,
      expiresAt,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata,
    };

    this.sessions.get(userId).push(session);
    return session;
  }

  /**
   * Get user's active sessions
   */
  getUserSessions(userId) {
    const now = Date.now();
    const sessions = this.sessions.get(userId) || [];
    
    return sessions.filter(s => s.expiresAt > now);
  }

  /**
   * Invalidate all sessions for user (force logout)
   */
  invalidateUserSessions(userId) {
    const sessions = this.sessions.get(userId) || [];
    this.sessions.delete(userId);
    return sessions.length;
  }

  /**
   * Invalidate specific session
   */
  invalidateSession(userId, token) {
    const sessions = this.sessions.get(userId) || [];
    const filtered = sessions.filter(s => s.token !== token);
    
    if (filtered.length === 0) {
      this.sessions.delete(userId);
    } else {
      this.sessions.set(userId, filtered);
    }

    return sessions.length !== filtered.length;
  }

  /**
   * Update last activity
   */
  updateActivity(userId, token) {
    const sessions = this.sessions.get(userId) || [];
    const session = sessions.find(s => s.token === token);

    if (session) {
      session.lastActivity = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Check for concurrent session limits
   */
  checkConcurrentLimit(userId, maxSessions = 5) {
    const sessions = this.getUserSessions(userId);
    return sessions.length >= maxSessions;
  }

  /**
   * Get session stats
   */
  getStats() {
    return {
      totalUsers: this.sessions.size,
      totalSessions: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.length, 0),
      sessionsByUser: Object.fromEntries(
        Array.from(this.sessions.entries()).map(([userId, sessions]) => [
          userId,
          sessions.length,
        ])
      ),
    };
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    const count = this.sessions.size;
    this.sessions.clear();
    return count;
  }
}

// ── Singleton Instances ────────────────────────────────────────
const tokenBlacklist = new TokenBlacklist();
const sessionManager = new SessionManager();

export { tokenBlacklist, sessionManager };

// ── Logout Helper ──────────────────────────────────────────────
export async function performLogout(userId, token, expiresAt) {
  try {
    // Blacklist the token
    tokenBlacklist.blacklistToken(token, expiresAt);

    // Invalidate session
    sessionManager.invalidateSession(userId, token);

    // Log the logout
    console.log(`✅ User ${userId} logged out`);

    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
}

// ── Force Logout All Sessions ──────────────────────────────────
export async function forceLogoutAllSessions(userId) {
  try {
    const invalidated = sessionManager.invalidateUserSessions(userId);
    console.log(`🔒 Forced logout of ${invalidated} sessions for user ${userId}`);

    return {
      success: true,
      message: `Invalidated ${invalidated} sessions`,
      sessionsInvalidated: invalidated,
    };
  } catch (error) {
    console.error('Error forcing logout:', error);
    throw error;
  }
}

// ── Check Token Status ────────────────────────────────────────
export function checkTokenStatus(token) {
  if (tokenBlacklist.isBlacklisted(token)) {
    return {
      valid: false,
      reason: 'Token is blacklisted (logged out)',
    };
  }

  return {
    valid: true,
    reason: null,
  };
}

// ── Get Stats ──────────────────────────────────────────────────
export function getSecurityStats() {
  return {
    blacklist: tokenBlacklist.getStats(),
    sessions: sessionManager.getStats(),
  };
}

// ── Clear All (Admin/Emergency) ────────────────────────────────
export function emergencyClearAll() {
  const blacklistCount = tokenBlacklist.clearAll();
  const sessionCount = sessionManager.clearAll();

  console.warn('⚠️ EMERGENCY: Cleared all tokens and sessions');

  return {
    blacklistCleared: blacklistCount,
    sessionsCleared: sessionCount,
  };
}
