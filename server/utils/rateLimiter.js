/**
 * Advanced rate limiting with multiple strategies
 * Supports per-IP, per-user, per-endpoint limits
 */

// ── In-memory store (fallback for when Redis unavailable) ────────
class MemoryStore {
  constructor() {
    this.data = new Map();
    this.cleanup();
  }

  cleanup() {
    // Clean up expired entries every 60 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.data.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
          this.data.delete(key);
        }
      }
    }, 60000);
  }

  async increment(key, ttl = 60) {
    const now = Date.now();
    const entry = this.data.get(key);

    if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
      // New or expired entry
      this.data.set(key, {
        count: 1,
        expiresAt: now + (ttl * 1000),
      });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  async get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.count;
  }

  async reset(key) {
    this.data.delete(key);
  }
}

// ── Rate Limiter Configuration ────────────────────────────────
const RATE_LIMITS = {
  // Global limits
  global: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per window
  },

  // Per-IP limits
  ip: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP per 15 min
  },

  // Per-user limits (authenticated users)
  user: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per user per minute
  },

  // Endpoint-specific limits
  endpoints: {
    '/api/auth/login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per 15 min
    },
    '/api/auth/signup': {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 signups per hour
    },
    '/api/messages/send': {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 messages per minute
    },
    '/api/transactions': {
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 transactions per minute
    },
    '/api/users': {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 user ops per minute
    },
  },
};

// ── Rate Limiter Instance ────────────────────────────────────
class RateLimiter {
  constructor(store = null) {
    this.store = store || new MemoryStore();
  }

  /**
   * Check if request is within rate limits
   * Returns: { allowed: boolean, remaining: number, resetTime: number }
   */
  async checkLimit(identifier, limit) {
    const key = `ratelimit:${identifier}`;
    const count = await this.store.increment(key, limit.windowMs / 1000);

    return {
      allowed: count <= limit.max,
      count,
      remaining: Math.max(0, limit.max - count),
      resetTime: Math.ceil(limit.windowMs / 1000),
    };
  }

  /**
   * Get current count for identifier
   */
  async getCount(identifier) {
    const key = `ratelimit:${identifier}`;
    return (await this.store.get(key)) || 0;
  }

  /**
   * Reset limit for identifier
   */
  async reset(identifier) {
    const key = `ratelimit:${identifier}`;
    await this.store.reset(key);
  }
}

// ── Middleware Factories ────────────────────────────────────────
export function createRateLimiter(store = null) {
  return new RateLimiter(store);
}

export const rateLimiterInstance = createRateLimiter();

/**
 * Global rate limiter middleware (per-IP)
 */
export function globalRateLimit(req, res, next) {
  const ip = getClientIp(req);
  return checkRateLimit(ip, RATE_LIMITS.ip, req, res, next);
}

/**
 * Per-user rate limiter (for authenticated endpoints)
 */
export function userRateLimit(req, res, next) {
  if (!req.user?.id) {
    // Not authenticated, use IP limit
    return globalRateLimit(req, res, next);
  }

  const identifier = `user:${req.user.id}`;
  return checkRateLimit(identifier, RATE_LIMITS.user, req, res, next);
}

/**
 * Endpoint-specific rate limiter
 */
export function endpointRateLimit(req, res, next) {
  const endpoint = req.path;
  const limit = RATE_LIMITS.endpoints[endpoint];

  if (!limit) {
    // No specific limit, use default IP limit
    return globalRateLimit(req, res, next);
  }

  const identifier = req.user?.id
    ? `user:${req.user.id}:${endpoint}`
    : `ip:${getClientIp(req)}:${endpoint}`;

  return checkRateLimit(identifier, limit, req, res, next);
}

/**
 * Combination rate limiter (global + endpoint-specific)
 * SKIPS login endpoint - that has its own per-username rate limiting
 */
export function combinedRateLimit(req, res, next) {
  // Skip rate limiting for login - it has per-username limiting built-in
  if (req.path === '/api/auth/login') {
    return next();
  }
  
  const ip = getClientIp(req);
  const userId = req.user?.id;

  // Check global limit first
  const globalLimiter = async () => {
    const globalCheck = await rateLimiterInstance.checkLimit(
      `global:${ip}`,
      RATE_LIMITS.global
    );

    if (!globalCheck.allowed) {
      res.set('X-RateLimit-Limit', RATE_LIMITS.global.max);
      res.set('X-RateLimit-Remaining', '0');
      res.set('Retry-After', globalCheck.resetTime);

      return res.status(429).json({
        success: false,
        error: {
          code: 'ERR_RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP. Please try again later.',
          retryAfter: globalCheck.resetTime,
        },
      });
    }

    // Check endpoint-specific limit
    const endpoint = req.path;
    const endpointLimit = RATE_LIMITS.endpoints[endpoint];

    if (endpointLimit) {
      const identifier = userId
        ? `user:${userId}:${endpoint}`
        : `ip:${ip}:${endpoint}`;

      const endpointCheck = await rateLimiterInstance.checkLimit(
        identifier,
        endpointLimit
      );

      if (!endpointCheck.allowed) {
        res.set('X-RateLimit-Limit', endpointLimit.max);
        res.set('X-RateLimit-Remaining', '0');
        res.set('Retry-After', endpointCheck.resetTime);

        return res.status(429).json({
          success: false,
          error: {
            code: 'ERR_ENDPOINT_RATE_LIMIT_EXCEEDED',
            message: `Too many requests to ${endpoint}. Please try again later.`,
            retryAfter: endpointCheck.resetTime,
          },
        });
      }

      // Set rate limit headers
      res.set('X-RateLimit-Limit', endpointLimit.max);
      res.set('X-RateLimit-Remaining', endpointCheck.remaining);
      res.set('X-RateLimit-Reset', new Date(Date.now() + endpointLimit.windowMs).toISOString());
    }

    next();
  };

  globalLimiter().catch(err => {
    console.error('Rate limiter error:', err);
    next(); // Continue even if limiter fails
  });
}

/**
 * Helper: Check rate limit and respond
 */
async function checkRateLimit(identifier, limit, req, res, next) {
  const check = await rateLimiterInstance.checkLimit(identifier, limit);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', limit.max);
  res.set('X-RateLimit-Remaining', check.remaining);
  res.set('X-RateLimit-Reset', new Date(Date.now() + limit.windowMs).toISOString());

  if (!check.allowed) {
    res.set('Retry-After', check.resetTime);

    console.warn(
      `⚠️ Rate limit exceeded for ${identifier}. ` +
      `Limit: ${limit.max}/${Math.ceil(limit.windowMs / 1000)}s`
    );

    return res.status(429).json({
      success: false,
      error: {
        code: 'ERR_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: check.resetTime,
        limit: limit.max,
        window: Math.ceil(limit.windowMs / 1000),
      },
    });
  }

  next();
}

/**
 * Helper: Extract client IP address securely
 * Only trusts X-Forwarded-For if behind a known proxy
 */
export function getClientIp(req) {
  // SECURITY: Only trust proxy headers if explicitly configured
  const trustProxy = process.env.TRUST_PROXY === 'true';
  
  if (trustProxy) {
    // Behind reverse proxy - check trusted headers
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      'unknown'
    );
  } else {
    // Direct connection - use connection IP only (headers are client-controllable)
    return req.connection.remoteAddress || 'unknown';
  }
}

/**
 * Test helper: Reset all limits
 */
export async function resetAllLimits() {
  const keys = rateLimiterInstance.store.data.keys();
  for (const key of keys) {
    await rateLimiterInstance.store.reset(key);
  }
}

export { RATE_LIMITS, MemoryStore };
