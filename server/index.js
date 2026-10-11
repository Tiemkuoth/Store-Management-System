import multer from 'multer';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { execFile } from 'child_process';
import { initializeDatabase, getPool, getIsUsingFallback, syncMySQLToFallback } from './db/db.js';
import { logAudit } from './services/auditLogger.js';
import { sendEmail } from './services/notificationService.js';
import { triggerBackgroundSync } from './utils/safeSync.js';
import { retryWithBackoff, CircuitBreaker } from './utils/resilience.js';
import { validateBody } from './middleware/validation.js';
import { loginSchema, sendMessageSchema } from './validation/schemas.js';
import { sanitizeError, sanitizeDatabaseError } from './utils/errorSanitizer.js';
import { validateImageFile } from './utils/fileValidator.js';
import { combinedRateLimit, getClientIp, rateLimiterInstance, RATE_LIMITS } from './utils/rateLimiter.js';
import { generate2FASecret, verifyTOTPToken, completeTwoFactorSetup, is2FAEnabled } from './services/twoFactorService.js';
import { performLogout, checkTokenStatus, getSecurityStats, forceLogoutAllSessions } from './services/tokenBlacklistService.js';
import { checkTokenBlacklist, storeToken } from './middleware/tokenCheck.js';
import { realtimeService } from './services/realtimeService.js';
import { csrfTokenService } from './services/csrfTokenService.js';
import { csrfProtection, generateCSRFToken } from './middleware/csrf.js';
import fs from 'fs';
import path from 'path';
import { createHash, randomInt } from 'crypto';
import { fileURLToPath } from 'url';
import logger from './middleware/logger.js';
import { errorHandler, asyncHandler, ValidationError } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { healthCheck } from './routes/health.js';
import { swaggerSpec } from './config/swagger.js';
import gmailRouter from './routes/gmail.js';


// ── DIRECTOR - FULL SYSTEM ACCESS ─────────────────
// Director has full system access across all modules and features
const DIRECTOR_PERMISSIONS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANISATION & SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  'organisation:view', 'organisation:create', 'organisation:edit', 'organisation:delete',
  'organisation:configure', 'organisation:manage', 'organisation:full',
  'currency:view', 'currency:create', 'currency:edit', 'currency:delete', 'currency:manage',
  'regional:view', 'regional:edit', 'regional:configure', 'regional:manage',
  'settings:view', 'settings:edit', 'settings:delete', 'settings:configure', 'settings:manage',
  'settings:full', 'settings:all',

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS & CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  'product:view', 'product:create', 'product:edit', 'product:delete', 'product:suspend', 'product:activate',
  'product:read', 'product:manage', 'product:full', 'product:pricing', 'product:import', 'product:export',
  'category:view', 'category:create', 'category:edit', 'category:delete', 'category:suspend', 'category:activate',
  'category:read', 'category:manage', 'category:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY & STOCK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:read', 'inventory:manage',
  'inventory:stockIn', 'inventory:stockOut', 'inventory:return', 'inventory:adjust', 'inventory:transfer',
  'inventory:audit', 'inventory:full', 'inventory:import', 'inventory:export',
  'stock:adjustment', 'stock:transfer', 'stock:view', 'stock:manage', 'stock:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES & TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  'sales:view', 'sales:create', 'sales:edit', 'sales:delete', 'sales:cancel', 'sales:refund',
  'sales:approve', 'sales:reject', 'sales:read', 'sales:manage', 'sales:full', 'sales:export',
  'return:view', 'return:create', 'return:edit', 'return:delete', 'return:approve', 'return:reject',
  'return:refund', 'return:manage', 'return:full',
  'refund:view', 'refund:create', 'refund:edit', 'refund:approve', 'refund:reject', 'refund:process',
  'refund:manage', 'refund:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASES & SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════
  'purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete', 'purchase:cancel',
  'purchase:approve', 'purchase:reject', 'purchase:manage', 'purchase:full', 'purchase:export',
  'supplier:view', 'supplier:create', 'supplier:edit', 'supplier:delete', 'supplier:suspend',
  'supplier:activate', 'supplier:manage', 'supplier:full', 'supplier:import', 'supplier:export',

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMERS & ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════
  'customer:view', 'customer:create', 'customer:edit', 'customer:delete', 'customer:suspend',
  'customer:activate', 'customer:manage', 'customer:full', 'customer:import', 'customer:export',

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPENSES & PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  'expense:view', 'expense:create', 'expense:edit', 'expense:delete', 'expense:approve', 'expense:reject',
  'expense:manage', 'expense:full',
  'payment:view', 'payment:create', 'payment:edit', 'payment:delete', 'payment:process', 'payment:refund',
  'payment:manage', 'payment:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL & RECORDS
  // ═══════════════════════════════════════════════════════════════════════════
  'financial:view', 'financial:edit', 'financial:manage', 'financial:full', 'financial:export',
  'record:view', 'record:create', 'record:edit', 'record:delete', 'record:manage', 'record:full',
  'accounting:view', 'accounting:manage', 'accounting:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  'report:view', 'report:create', 'report:edit', 'report:delete', 'report:generate', 'report:export',
  'report:schedule', 'report:manage', 'report:full',
  'analytics:view', 'analytics:analyze', 'analytics:export', 'analytics:manage', 'analytics:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCHES & STORES
  // ═══════════════════════════════════════════════════════════════════════════
  'branch:view', 'branch:create', 'branch:edit', 'branch:delete', 'branch:suspend', 'branch:activate',
  'branch:manage', 'branch:full', 'branch:import', 'branch:export',
  'store:view', 'store:create', 'store:edit', 'store:delete', 'store:manage', 'store:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYEES & STAFF
  // ═══════════════════════════════════════════════════════════════════════════
  'employee:view', 'employee:create', 'employee:edit', 'employee:delete', 'employee:suspend',
  'employee:activate', 'employee:manage', 'employee:full', 'employee:import', 'employee:export',
  'staff:view', 'staff:manage', 'staff:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  'user:view', 'user:create', 'user:edit', 'user:delete', 'user:suspend', 'user:activate',
  'user:resetPassword', 'user:forceLogout', 'user:statusChange', 'user:read', 'user:manage',
  'user:assignRole', 'user:changeRole', 'user:assignPermission', 'user:removePermission',
  'user:assignBranch', 'user:moveBranch', 'user:manageStatus', 'user:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE & PERMISSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  'role:view', 'role:create', 'role:edit', 'role:delete', 'role:suspend', 'role:activate',
  'role:manage', 'role:full', 'role:custom', 'role:assignPermission', 'role:removePermission',
  'permission:view', 'permission:create', 'permission:edit', 'permission:delete', 'permission:manage',
  'permission:full', 'permission:assign', 'permission:remove', 'permission:group',
  'access:configure', 'access:modify', 'access:grant', 'access:revoke', 'access:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY & SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  'security:view', 'security:configure', 'security:edit', 'security:manage', 'security:full',
  'security:audit', 'security:override', 'security:access', 'session:view', 'session:manage',
  'session:forceLogout', 'session:terminate', 'session:full', 'password:configure',
  'password:policy', 'password:manage', 'password:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // RECEIPTS & INVOICES
  // ═══════════════════════════════════════════════════════════════════════════
  'receipt:view', 'receipt:create', 'receipt:edit', 'receipt:delete', 'receipt:configure', 'receipt:manage',
  'receipt:full', 'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete',
  'invoice:configure', 'invoice:manage', 'invoice:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS & COMMUNICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  'notification:view', 'notification:create', 'notification:edit', 'notification:delete',
  'notification:send', 'notification:configure', 'notification:manage', 'notification:full',
  'email:send', 'email:configure', 'email:manage', 'sms:send', 'sms:configure', 'sms:manage',

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKUP & DATA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  'backup:view', 'backup:create', 'backup:delete', 'backup:restore', 'backup:schedule',
  'backup:manage', 'backup:full', 'backup:export', 'backup:import',
  'data:export', 'data:import', 'data:manage', 'data:full', 'data:delete',

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM ADMINISTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  'system:view', 'system:configure', 'system:edit', 'system:manage', 'system:full',
  'system:maintenance', 'system:recovery', 'system:backup', 'system:restore',
  'system:settings', 'system:auditLogs', 'system:read', 'system:access', 'system:override',
  'system:all',

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT & COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════
  'audit:view', 'audit:search', 'audit:filter', 'audit:export', 'audit:read',
  'audit:userActivity', 'audit:loginActivity', 'audit:securityEvents', 'audit:manage',
  'audit:full', 'compliance:view', 'compliance:manage', 'compliance:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN CONTROLS & OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════════
  'admin:view', 'admin:create', 'admin:edit', 'admin:delete', 'admin:override',
  'admin:accessControl', 'admin:security', 'admin:policies', 'admin:read', 'admin:manage',
  'admin:full', 'admin:execute', 'admin:all', 'admin:emergency',

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTING & DASHBOARDS
  // ═══════════════════════════════════════════════════════════════════════════
  'dashboard:view', 'dashboard:edit', 'dashboard:manage', 'dashboard:full',
  'report:create', 'report:view', 'report:edit', 'report:delete', 'report:export',
  'report:generate', 'report:schedule', 'report:manage', 'report:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // API & INTEGRATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  'api:access', 'api:read', 'api:write', 'api:delete', 'api:admin', 'api:manage', 'api:full',
  'integration:view', 'integration:create', 'integration:edit', 'integration:delete',
  'integration:manage', 'integration:full',

  // ═══════════════════════════════════════════════════════════════════════════
  // HELP & DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════════════════
  'help:view', 'help:manage', 'help:full', 'documentation:view', 'documentation:manage',
  'about:view', 'system:info', 'system:status',

  // ═══════════════════════════════════════════════════════════════════════════
  // CATCH-ALL - DIRECTOR HAS EVERYTHING
  // ═══════════════════════════════════════════════════════════════════════════
  'director:full', 'director:all', 'director:fullAccess',
  'admin:full', 'admin:all', 'system:root',
];

const FULL_ADMIN_PERMISSIONS = [
  'user:create', 'user:edit', 'user:delete', 'user:resetPassword', 'user:statusChange',
  'material:create', 'material:update', 'material:delete',
  'category:create', 'category:update', 'category:delete',
  'supplier:create', 'supplier:update', 'supplier:delete',
  'employee:create', 'employee:update', 'employee:delete',
  'inventory:stockIn', 'inventory:stockOut', 'inventory:return',
  'inventory:adjust', 'inventory:transfer',
  'material:request:manage', 'disposal:create', 'disposal:approve',
  'task:manage', 'task:view',
  'system:auditLogs', 'system:configure',
];

const ROLE_PERMISSIONS = {
  Director: DIRECTOR_PERMISSIONS,
  Administrator: DIRECTOR_PERMISSIONS,

  Manager: [
    'material:create', 'material:update',
    'category:create', 'category:update',
    'supplier:create', 'supplier:update',
    'employee:create', 'employee:update',
    'inventory:stockIn', 'inventory:stockOut', 'inventory:return',
    'inventory:adjust', 'inventory:transfer',
    'material:request:manage', 'disposal:create', 'disposal:approve',
    'task:manage', 'task:view',
    'user:resetPassword', 'user:statusChange',
    'system:auditLogs',
    'report:view',
  ],

  Storekeeper: [
    'material:create', 'material:update',
    'inventory:stockIn', 'inventory:stockOut', 'inventory:return',
    'inventory:adjust',
    'disposal:create',
    'task:manage', 'task:view',
  ],

  Employee: [
    'task:view',
  ],
};

const FULL_ACCESS_ROLES = new Set(['Director', 'Administrator']);

/**
 * Check whether a user object has a given permission based on their role.
 * Director ALWAYS returns true - they have absolute authority.
 * Async to allow future DB-backed permission overrides.
 */
async function hasPermission(user, permission) {
  if (!user || !user.role) return false;

  if (FULL_ACCESS_ROLES.has(user.role)) return true;

  const perms = ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(permission);
}

/**
 * Return the full permission list for a user's role.
 * Director returns all permissions.
 */
async function getUserPermissions(user) {
  if (!user || !user.role) return [];

  if (FULL_ACCESS_ROLES.has(user.role)) return DIRECTOR_PERMISSIONS;

  return ROLE_PERMISSIONS[user.role] || [];
}

/**
 * Check if a user is a Director (highest authority)
 */
function isGrandDirector(user) {
  return user && user.role === 'Director';
}

/**
 * Check if a user has higher or equal authority to another user
 * Director > Administrator > Manager > Storekeeper > Employee
 */
function hasHigherAuthority(userRole, targetRole) {
  const roleHierarchy = {
    'Director': 95,
    'Administrator': 80,
    'Manager': 60,
    'Storekeeper': 40,
    'Employee': 20,
  };

  return (roleHierarchy[userRole] || 0) > (roleHierarchy[targetRole] || 0);
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// SECURITY: Validate JWT_SECRET is strong (not a placeholder)
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Add it to your .env file.');
  console.error('💡 Generate with: openssl rand -base64 32');
  process.exit(1);
}

// Check if JWT_SECRET is weak (placeholder or too short)
const WEAK_JWT_PATTERNS = [
  'your_secure_random_jwt_secret',
  'change_before_production',
  'secret',
  'password',
  '12345',
  'test',
  'demo'
];

const isWeakSecret =
  JWT_SECRET.length < 32 ||
  WEAK_JWT_PATTERNS.some(pattern => JWT_SECRET.toLowerCase().includes(pattern.toLowerCase()));

if (isWeakSecret) {
  console.error('❌ FATAL: JWT_SECRET is too weak or appears to be a placeholder.');
  console.error('❌ This is a CRITICAL security issue!');
  console.error('💡 Generate a strong secret with: openssl rand -base64 32');
  console.error('💡 Then set it in your .env file: JWT_SECRET=<generated_value>');
  process.exit(1);
}
const BCRYPT_ROUNDS = 10;
const passwordResetChallenges = new Map();

// ── ESM __dirname shim ────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Ensure avatars upload directory exists ────────────────────
const AVATARS_DIR = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

// ── Ensure uploads directory exists ────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000", "http://127.0.0.1:5173", "blob:"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000", "http://127.0.0.1:5173"],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// SECURITY: Validate CORS_ORIGIN - cannot use wildcard with credentials
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (corsOrigins.includes('*')) {
  console.error('❌ FATAL: CORS_ORIGIN cannot be "*" (wildcard) with credentials enabled.');
  console.error('❌ This would allow any website to access the API with your credentials!');
  console.error('💡 Set CORS_ORIGIN to a specific domain, e.g.: CORS_ORIGIN=https://yourdomain.com');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));

// ── Parse cookies for CSRF and auth token ────────────────────
app.use(cookieParser());

// ── Reset Rate Limiter (admin-only maintenance endpoint) ─────
app.post('/api/system/reset-rate-limit', requireAuth, requirePermission('system:configure'), (req, res) => {
  try {
    import('./utils/rateLimiter.js').then(({ rateLimiterInstance }) => {
      if (rateLimiterInstance?.store?.data) {
        rateLimiterInstance.store.data.clear();
        res.json({ success: true, message: 'All rate limits have been reset' });
      } else {
        res.status(500).json({ error: 'Rate limiter not available' });
      }
    }).catch(e => {
      res.status(500).json({ error: e.message });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve uploaded avatar images as static files
app.use('/avatars', express.static(path.join(__dirname, '..', 'public', 'avatars')));
app.use(express.json({ limit: '6mb' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image is too large. Please use an image under 5MB.' });
  }
  next(err);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health check endpoint ─────────────────────────────────────
app.get('/api/health', asyncHandler(healthCheck));

// ── Middleware ────────────────────────────────────────────────
function createAuthToken(user) {
  return jwt.sign({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
  }, JWT_SECRET, { expiresIn: '2h' });
}

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function requireAuth(req, res, next) {
  // Prefer the explicit bearer token so a stale cookie cannot override it.
  let token;
  let tokenSource;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
    tokenSource = 'header';
    console.log('✅ Token found in Authorization header');
  } else if (req.cookies?.auth_token) {
    token = req.cookies.auth_token;
    tokenSource = 'cookie';
  }

  // Debug: log token source
  if (!token) {
    console.warn('⚠️ No auth token found. Cookies:', Object.keys(req.cookies || {}), 'Auth header:', !!req.headers['authorization'], 'Path:', req.path);
  } else {
    console.log(`✅ Auth token from ${tokenSource}: ${token.substring(0, 20)}...`);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.token = token; // Store token for later use

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log(`✅ Token verified for user: ${req.user.username} (${req.user.role})`);

    // Check if token is blacklisted
    if (checkTokenStatus(token) && !checkTokenStatus(token).valid) {
      return res.status(401).json({
        error: 'Your session has been invalidated. Please log in again.'
      });
    }

    next();
  }
  catch (err) {
    console.error(`❌ Token verification failed: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const allowed = await hasPermission(req.user, permission);
      console.log(`🔐 Permission check: ${req.user?.username} requesting '${permission}' => ${allowed ? 'ALLOWED' : 'DENIED'}`);
      if (!allowed) return res.status(403).json({ error: `Access denied. Required permission: ${permission}` });
      next();
    } catch (e) {
      console.error(`❌ Permission check error: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  };
}

// ── Helpers ───────────────────────────────────────────────────
function validateRequired(obj, fields) {
  if (!obj || typeof obj !== 'object') return 'Request data is required';
  for (const f of fields)
    if (!Object.prototype.hasOwnProperty.call(obj, f) || obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '')
      return `Field "${f}" is required`;
  return null;
}
function validatePositiveNumber(val, fieldName) {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return `"${fieldName}" must be a non-negative number`;
  return null;
}
const toInt = (v, d = 0) => { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? d : n; };
const toFloat = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) || n < 0 ? d : n; };
const paginate = q => {
  const page = Math.max(1, toInt(q.page, 1));
  const limit = Math.min(200, Math.max(1, toInt(q.limit, 50)));
  return { page, limit, offset: (page - 1) * limit };
};

// ── System status ─────────────────────────────────────────────
app.get('/api/system/status', (_req, res) =>
  res.json({ status: 'operational', dbMode: getIsUsingFallback() ? 'Fallback JSON Store' : 'MySQL Connected', usingFallback: getIsUsingFallback() })
);

// ── System Settings (GET/PUT) ────────────────────────────────────────
app.get('/api/system/settings', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Login ─────────────────────────────────────────────────────
app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body; // Already validated by middleware

  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE username=?', [username.trim()]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = rows[0];

    // Check global status
    if (user.status === 'Locked') return res.status(403).json({ error: 'Account locked. Contact Administrator.' });
    if (user.status !== 'Active') return res.status(403).json({ error: 'Account inactive. Contact Administrator.' });

    const ok = user.password_hash.startsWith('$2')
      ? await bcrypt.compare(password, user.password_hash)
      : user.password_hash === password;

    if (!ok) {
      // Handle failed attempt
      const fails = (user.failed_login_attempts || 0) + 1;
      await getPool().query('UPDATE users SET failed_login_attempts=? WHERE id=?', [fails, user.id]);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    // Successful login – reset counters
    await getPool().query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id]);
    if (!user.password_hash.startsWith('$2')) {
      const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await getPool().query('UPDATE users SET password_hash=? WHERE id=?', [newHash, user.id]);
      await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [user.id, newHash]);
    }
    // Force password change / expiration check
    if (user.force_password_change) {
      return res.status(403).json({ error: 'Password change required', require_password_change: true, user_id: user.id });
    }
    // Password expiration disabled - no time limits
    const safe = { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role, avatar_url: user.avatar_url || null, preferred_page: user.preferred_page || 'DASHBOARD' };
    // Session timeout: 2 hours for security
    const token = createAuthToken(user);
    await logAudit(user.id, user.username, user.role, 'LOGIN', `${user.username} logged in`, req);

    console.log('✅ Preparing to set auth_token cookie for user:', user.username);

    // Replace any legacy oversized cookie left by older JWT payloads.
    res.clearCookie('auth_token', authCookieOptions);

    // Set httpOnly cookie with JWT token (no expiration)
    // In development (localhost): sameSite should be 'lax' or 'strict' (not 'none')
    // In production (HTTPS): sameSite can be 'strict' with secure: true
    res.cookie('auth_token', token, authCookieOptions);

    console.log('✅ auth_token cookie set. Sending response...');

    // Generate CSRF token for this session
    const sessionId = user.id;
    const { token: csrfToken } = csrfTokenService.generateToken(sessionId);

    // Note: CSRF secret is stored server-side in csrfTokenService.tokenSecrets
    // Client sends CSRF token in X-CSRF-Token header for validation

    // Return user data, CSRF token, and JWT token as fallback
    return res.json({ user: safe, csrfToken, token });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: sanitizeError(e, 'LOGIN') });
  }
});

// ── Self-service password reset ─────────────────────────────
app.post('/api/auth/request-password-reset', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const response = { message: 'If an account matches that email, a reset code has been sent.' };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const [rows] = await getPool().query('SELECT id, username, full_name, email FROM users WHERE LOWER(email)=?', [email]);
    const user = rows[0];

    if (user) {
      const code = String(randomInt(100000, 1000000));
      passwordResetChallenges.set(email, {
        userId: user.id,
        codeHash: createHash('sha256').update(code).digest('hex'),
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      await sendEmail({
        to: user.email,
        subject: 'Store Management System password reset',
        text: `Your password reset code is ${code}. It expires in 15 minutes.`,
        html: `<p>Your password reset code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
      });

      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_USER) {
        response.development_code = code;
      }
    }

    return res.json(response);
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({ error: 'Could not process the password reset request.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const resetCode = String(req.body?.reset_code || '').trim();
  const newPassword = String(req.body?.new_password || '');
  const challenge = passwordResetChallenges.get(email);

  if (!challenge || challenge.expiresAt < Date.now()) {
    passwordResetChallenges.delete(email);
    return res.status(400).json({ error: 'Reset code is invalid or expired.' });
  }

  const submittedHash = createHash('sha256').update(resetCode).digest('hex');
  if (submittedHash !== challenge.codeHash) {
    return res.status(400).json({ error: 'Reset code is invalid or expired.' });
  }

  if (!newPassword) return res.status(400).json({ error: 'New password is required.' });

  try {
    await checkPasswordPolicy(newPassword, challenge.userId);
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=0, failed_login_attempts=0, locked_until=NULL WHERE id=?', [newHash, challenge.userId]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [challenge.userId, newHash]);
    await forceLogoutAllSessions(Number(challenge.userId));
    passwordResetChallenges.delete(email);
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not reset password.' });
  }
});

// ── Get CSRF Token ──────────────────────────────────────────
app.get('/api/auth/csrf-token', requireAuth, (req, res) => {
  try {
    generateCSRFToken(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get user permissions ─────────────────────────────────────
app.get('/api/auth/permissions', requireAuth, async (req, res) => {
  try {
    const perms = await getUserPermissions(req.user);
    res.json({ permissions: perms });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Logout ────────────────────────────────────────────────────
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const expiresAt = new Date(req.user.exp * 1000); // Convert JWT exp to timestamp
    await performLogout(req.user.id, req.token, expiresAt);
    await logAudit(req.user.id, req.user.username, req.user.role, 'LOGOUT', 'User logged out', req);

    // Clear authentication cookies
    res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie('csrf_secret', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });

    // Revoke CSRF token
    csrfTokenService.revokeToken(req.user.id);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2FA: Initialize Setup ─────────────────────────────────────
app.post('/api/auth/2fa/setup', requireAuth, async (req, res) => {
  try {
    const secret = await generate2FASecret(req.user);
    // Generate QR code data URL
    const qrCode = `otpauth://totp/${encodeURIComponent(req.user.username)}?secret=${secret.secret}&issuer=Store%20Management%20System`;

    res.json({
      success: true,
      secret: secret.secret,
      qr_code: qrCode,
      backup_codes: secret.backup_codes,
      message: 'Scan QR code with Google Authenticator or similar app',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2FA: Verify & Complete Setup ──────────────────────────────
app.post('/api/auth/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Verification code required' });

    await completeTwoFactorSetup(req.user.id, token);
    await logAudit(req.user.id, req.user.username, req.user.role, '2FA_ENABLED', '2FA successfully enabled', req);

    res.json({ success: true, message: '2FA successfully enabled' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── 2FA: Disable ──────────────────────────────────────────────
app.post('/api/auth/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required to disable 2FA' });

    // Verify password
    const [[user]] = await getPool().query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const ok = user.password_hash.startsWith('$2')
      ? await bcrypt.compare(password, user.password_hash)
      : user.password_hash === password;

    if (!ok) return res.status(401).json({ error: 'Invalid password' });

    await getPool().query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_verified = FALSE, two_factor_secret = NULL WHERE id = ?',
      [req.user.id]
    );

    await logAudit(req.user.id, req.user.username, req.user.role, '2FA_DISABLED', '2FA disabled', req);
    res.json({ success: true, message: '2FA disabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2FA: Check Status ─────────────────────────────────────────
app.get('/api/auth/2fa/status', requireAuth, async (req, res) => {
  try {
    const status = await is2FAEnabled(req.user.id);
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Security: Get Stats (Admin Only) ──────────────────────────
app.get('/api/security/stats', requireAuth, requirePermission('MANAGE_SECURITY'), async (req, res) => {
  try {
    const stats = getSecurityStats();
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Change own password ───────────────────────────────────────
// Password Policy Check Helper
async function checkPasswordPolicy(new_password, user_id) {
  try {
    // SECURITY: Validate minimum password length
    if (!new_password || new_password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const [policyRows] = await getPool().query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('pwd_min_length','pwd_max_length','pwd_require_uppercase','pwd_require_lowercase','pwd_require_number','pwd_require_special','pwd_history_count')"
    );
    const policy = {};
    policyRows.forEach(r => { policy[r.setting_key] = r.setting_value; });
    const historyCount = parseInt(policy.pwd_history_count || '3', 10);

    // Minimum length check (default 8, configurable)
    const minLength = Math.max(8, parseInt(policy.pwd_min_length || '8', 10));
    if (new_password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }

    // Maximum length check (security: don't allow extremely long passwords)
    const maxLength = parseInt(policy.pwd_max_length || '128', 10);
    if (new_password.length > maxLength) {
      throw new Error(`Password must not exceed ${maxLength} characters`);
    }

    if ((policy.pwd_require_uppercase || 'true') === 'true' && !/[A-Z]/.test(new_password)) throw new Error('Password must contain at least one uppercase letter');
    if ((policy.pwd_require_lowercase || 'true') === 'true' && !/[a-z]/.test(new_password)) throw new Error('Password must contain at least one lowercase letter');
    if ((policy.pwd_require_number || 'true') === 'true' && !/[0-9]/.test(new_password)) throw new Error('Password must contain at least one number');
    if ((policy.pwd_require_special || 'false') === 'true' && !/[^A-Za-z0-9]/.test(new_password)) throw new Error('Password must contain at least one special character');

    // SECURITY: Reject common weak passwords
    const weakPasswords = ['password', 'password123', 'admin', 'admin123', '12345678', 'qwerty', 'letmein'];
    if (weakPasswords.some(weak => new_password.toLowerCase().includes(weak))) {
      throw new Error('Password is too common. Please choose a stronger password');
    }

    if (historyCount > 0 && user_id) {
      const [history] = await getPool().query('SELECT password_hash FROM password_history WHERE user_id=? ORDER BY created_at DESC LIMIT ?', [user_id, historyCount]);
      for (const row of history) {
        if (await bcrypt.compare(new_password, row.password_hash)) {
          throw new Error(`Password has been used recently. Please choose a different password.`);
        }
      }
    }
  } catch (e) {
    if (e.message.includes('Password')) throw e;
  }
}

app.put('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });

  try {
    await checkPasswordPolicy(new_password, req.user.id);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    const ok = u.password_hash.startsWith('$2')
      ? await bcrypt.compare(current_password, u.password_hash) : u.password_hash === current_password;
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [newHash, req.user.id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [req.user.id, newHash]);
    // Invalidate all other active sessions after password change
    await forceLogoutAllSessions(Number(req.user.id));
    await logAudit(req.user.id, u.username, u.role, 'CHANGE_PASSWORD', 'Changed own password', req);
    res.json({ success: true, sessionInvalidated: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/force-change-password', async (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  if (!user_id || !new_password || !current_password) return res.status(400).json({ error: 'Missing fields' });

  try {
    await checkPasswordPolicy(new_password, user_id);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE id=?', [user_id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    const ok = await bcrypt.compare(current_password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [newHash, user_id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [user_id, newHash]);
    await logAudit(user_id, u.username, u.role, 'CHANGE_PASSWORD', 'Completed forced password change', req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Update own profile ────────────────────────────────────────
app.put('/api/auth/update-profile', requireAuth, async (req, res) => {
  try {
    const { full_name, email, phone_contact, department, avatar_url, document_url, theme_preference } = req.body || {};

    // Validate required fields
    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    // Validate avatar is a data URL, absolute URL, or server-relative path
    if (avatar_url && typeof avatar_url === 'string' && avatar_url.length > 0) {
      if (!avatar_url.startsWith('data:image/') && !avatar_url.startsWith('http') && !avatar_url.startsWith('/avatars/') && !avatar_url.startsWith('/')) {
        return res.status(400).json({ error: 'Invalid image format.' });
      }
    }

    // Validate document_url is a server-relative path (must come from our own upload endpoint)
    if (document_url && typeof document_url === 'string' && document_url.length > 0) {
      if (!document_url.startsWith('/uploads/')) {
        return res.status(400).json({ error: 'Invalid document path.' });
      }
    }

    const preference = theme_preference || 'Light';
    const safeAvatar = (avatar_url && typeof avatar_url === 'string' && avatar_url.length > 0)
      ? avatar_url
      : null;
    const safeDocument = (document_url && typeof document_url === 'string' && document_url.length > 0)
      ? document_url
      : null;

    await getPool().query(
      'UPDATE users SET full_name=?, email=?, phone_contact=?, department=?, avatar_url=?, document_url=?, theme_preference=? WHERE id=?',
      [String(full_name).trim(), email || null, phone_contact || null, department || null, safeAvatar, safeDocument, preference, req.user.id]
    );

    if (req.user.role === 'Employee') {
      await syncUserToEmployee({ id: req.user.id, full_name: String(full_name).trim(), email: email || null, phone_contact: phone_contact || null, department: department || null, role: 'Employee', status: 'Active' });
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Updated profile', req);

    res.json({
      success: true,
      full_name: String(full_name).trim(),
      email: email || null,
      phone_contact: phone_contact || null,
      department: department || null,
      avatar_url: safeAvatar,
      document_url: safeDocument,
      theme_preference: preference,
    });
  } catch (e) {
    console.error('Profile update error:', e.message);
    res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

// ── User Document Upload ──────────────────────────────────────
// Accepts a base64-encoded file (PDF or common image types) and saves it to
// public/uploads/. Returns a server-relative URL stored in users.document_url.
app.post('/api/auth/upload-document', requireAuth, async (req, res) => {
  try {
    const { document_data, filename: originalName } = req.body || {};

    if (!document_data || typeof document_data !== 'string') {
      return res.status(400).json({ error: 'No document data provided.' });
    }

    // Accept PDF and common image data URLs
    const match = document_data.match(
      /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(jpeg|jpg|png|webp));base64,(.+)$/i
    );
    if (!match) {
      return res.status(400).json({ error: 'Unsupported file type. Accepted: PDF, DOC, DOCX, JPEG, PNG, WebP.' });
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[3];

    // Enforce 10 MB limit
    const byteLength = Buffer.byteLength(base64Data, 'base64');
    if (byteLength > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File is too large. Maximum size is 10 MB.' });
    }

    const mimeToExt = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[mimeType] || 'bin';

    // Stable filename per user so re-uploads overwrite the old file cleanly
    const stableFilename = `user_doc_${req.user.id}.${ext}`;

    // Delete any previous document file for this user (different extension)
    const extensions = ['pdf', 'doc', 'docx', 'jpg', 'png', 'webp'];
    for (const oldExt of extensions) {
      if (oldExt === ext) continue;
      const oldPath = path.join(UPLOADS_DIR, `user_doc_${req.user.id}.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      }
    }

    const filepath = path.join(UPLOADS_DIR, stableFilename);
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const documentUrl = `/uploads/${stableFilename}`;

    // Persist in DB
    await getPool().query('UPDATE users SET document_url=? WHERE id=?', [documentUrl, req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPLOAD_DOCUMENT', 'Uploaded profile document', req);

    res.json({ success: true, document_url: documentUrl });
  } catch (e) {
    console.error('Document upload error:', e.message);
    res.status(500).json({ error: 'Failed to upload document. Please try again.' });
  }
});

// ── Delete user document ──────────────────────────────────────
app.delete('/api/auth/delete-document', requireAuth, async (req, res) => {
  try {
    const [[user]] = await getPool().query('SELECT document_url FROM users WHERE id=?', [req.user.id]);
    if (user?.document_url && user.document_url.startsWith('/uploads/')) {
      const filepath = path.join(UPLOADS_DIR, path.basename(user.document_url));
      const normalizedPath = path.normalize(filepath);
      const normalizedUploads = path.normalize(UPLOADS_DIR);
      if (normalizedPath.startsWith(normalizedUploads) && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    await getPool().query('UPDATE users SET document_url=NULL WHERE id=?', [req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_DOCUMENT', 'Deleted profile document', req);
    res.json({ success: true });
  } catch (e) {
    console.error('Document delete error:', e.message);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// ── Avatar Upload (file saved to public/avatars/, not fallback JSON) ──
// IMPORTANT: Preserves filename/identifier per user. Only content is updated.
app.post('/api/auth/upload-avatar', requireAuth, async (req, res) => {
  try {
    const { avatar_data_url } = req.body || {};
    if (!avatar_data_url || typeof avatar_data_url !== 'string') {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // Validate it is a real image data URL
    const match = avatar_data_url.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Accepted: JPEG, PNG, WebP, GIF.' });
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[3];

    // Enforce 5 MB limit on the decoded binary
    const byteLength = Buffer.byteLength(base64Data, 'base64');
    if (byteLength > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image is too large. Maximum size is 5 MB.' });
    }

    // SECURITY: Validate file contents using magic bytes, not just MIME type
    const buffer = Buffer.from(base64Data, 'base64');
    const fileValidation = validateImageFile(buffer, mimeType, 5 * 1024 * 1024);

    if (!fileValidation.valid) {
      return res.status(400).json({ error: `Invalid image file: ${fileValidation.error}` });
    }

    // Determine extension from validated file type
    const ext = fileValidation.type === 'jpeg' ? 'jpg' : fileValidation.type;

    // STABLE FILENAME: Use username-based filename, never random
    // Example: john.jpg, sarah.png, admin.jpg
    // This ensures the same user always uses the same filename, even after multiple uploads
    const stableFilename = `${req.user.username}.${ext}`;
    const avatarUrl = `/avatars/${stableFilename}`;
    const filepath = path.join(AVATARS_DIR, stableFilename);

    // Write new file content to disk (overwrites existing file if present)
    // This replaces the image content while keeping the filename stable
    fs.writeFileSync(filepath, buffer);

    // Update database with the avatar URL (always set it, no conditional)
    // If it's the same as before, the UPDATE is idempotent
    await getPool().query(
      'UPDATE users SET avatar_url=? WHERE id=?',
      [avatarUrl, req.user.id]
    );

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Updated avatar photo', req);

    // Return updated user profile
    const [[user]] = await getPool().query(
      'SELECT id,username,full_name,email,role,status,avatar_url,theme_preference FROM users WHERE id=?',
      [req.user.id]
    );

    res.json({ success: true, avatar_url: avatarUrl, user });
  } catch (e) {
    console.error('Avatar upload error:', e.message);
    res.status(500).json({ error: 'Failed to save avatar. Please try again.' });
  }
});

// ── Remove own avatar ──────────────────────────────────────────
app.delete('/api/auth/avatar', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await getPool().query('SELECT avatar_url FROM users WHERE id=?', [req.user.id]);
    if (existing?.avatar_url && existing.avatar_url.startsWith('/avatars/')) {
      const oldFile = path.join(__dirname, '..', 'public', existing.avatar_url);
      // SECURITY: Verify the normalized path is still within avatars directory
      const normalizedPath = path.normalize(oldFile);
      const avatarsDir = path.normalize(path.join(__dirname, '..', 'public', 'avatars'));
      if (normalizedPath.startsWith(avatarsDir) && fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile);
      }
    }
    await getPool().query('UPDATE users SET avatar_url=NULL WHERE id=?', [req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Removed avatar photo', req);
    res.json({ success: true, avatar_url: null });
  } catch (e) {
    console.error('Avatar remove error:', e.message);
    res.status(500).json({ error: 'Failed to remove avatar.' });
  }
});

// ── Create initial administrator bootstrap (disabled automatically once any admin exists) ────
app.post('/api/auth/create-superadmin', async (req, res) => {
  try {
    // Self-disable: if any Administrator already exists, block this endpoint
    const [admins] = await getPool().query("SELECT id FROM users WHERE role='Administrator' LIMIT 1");
    if (admins.length > 0) {
      return res.status(410).json({ error: 'Setup endpoint is disabled. An Administrator account already exists. Please log in normally.' });
    }
    const { secret, username, password, full_name, email } = req.body || {};
    const SETUP_SECRET = process.env.SETUP_SECRET || process.env.JWT_SECRET || '';
    if (!SETUP_SECRET) {
      return res.status(500).json({ error: 'Setup secret not configured. Set SETUP_SECRET environment variable.' });
    }
    if (secret !== SETUP_SECRET) {
      return res.status(403).json({ error: 'Invalid setup secret.' });
    }
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'username, password, and full_name are required.' });
    }
    const [existing] = await getPool().query('SELECT id FROM users WHERE username=?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: `Username "${username}" already exists. Log in with that account.` });
    }
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [r] = await getPool().query(
      "INSERT INTO users (username,password_hash,full_name,email,role,status,theme_preference) VALUES (?,?,?,?,?,'Active','Light')",
      [username.trim(), hashed, full_name, email || null, 'Administrator']
    );
    res.json({
      success: true,
      message: 'Administrator created. Log in now.',
      id: r.insertId,
      username: username.trim(),
      role: 'Administrator',
    });
  } catch (e) {
    console.error('Create superadmin error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
// ── Get current user profile ──────────────────────────────────
app.get('/api/users/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT id,username,full_name,email,phone_contact,department,role,status,avatar_url,document_url,theme_preference,preferred_page,created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/auth/preferred-page', requireAuth, async (req, res) => {
  const allowedPages = ['DIRECTOR_PANEL', 'DASHBOARD', 'EMPLOYEES', 'MATERIALS', 'CATEGORIES', 'SUPPLIERS', 'USER_AUDIT', 'USERS_AUDIT', 'WAREHOUSES', 'REPORTS', 'TRANSACTIONS', 'REQUESTS', 'TASKS', 'RECEIPTS', 'TRANSFERS', 'PROCUREMENT', 'MESSAGES', 'SETTINGS', 'HELP'];
  const preferredPage = String(req.body?.preferred_page || 'DASHBOARD');
  if (!allowedPages.includes(preferredPage)) return res.status(400).json({ error: 'Invalid preferred page' });
  const restrictedPages = ['DIRECTOR_PANEL', 'EMPLOYEES', 'SUPPLIERS', 'USERS_AUDIT', 'WAREHOUSES'];
  if (restrictedPages.includes(preferredPage) && !['Director', 'Administrator', 'Manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this page' });
  }
  try {
    await getPool().query('UPDATE users SET preferred_page=? WHERE id=?', [preferredPage, req.user.id]);

    // Preferred page updates do not need to clutter the system audit_logs table
    // await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PREFERRED_PAGE', `Set preferred page to ${preferredPage}`, req);
    res.json({ preferred_page: preferredPage });
  } catch (e) { res.status(500).json({ error: 'Failed to save preferred page' }); }
});

// ── Get user login history (last 50 LOGIN audit entries) ──────
app.get('/api/users/:id/login-history', requireAuth, async (req, res) => {
  // Admin can view anyone; users can view their own
  if (!['Director', 'Administrator'].includes(req.user.role) && String(req.params.id) !== String(req.user.id))
    return res.status(403).json({ error: 'Access denied' });
  try {
    const [rows] = await getPool().query(
      `SELECT id, action_type, description, ip_address, created_at
       FROM audit_logs
       WHERE user_id = ? AND action_type IN ('LOGIN','LOGOUT','CHANGE_PASSWORD','UPDATE_PROFILE')
       ORDER BY id DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  let hasReadPermission = true;
  // Administrators see all users; Managers see read-only list
  if (!await hasPermission(req.user, 'user:read')) {
    // Fallback: check if role is Administrator or Manager
    if (!['Director', 'Administrator', 'Manager'].includes(req.user.role)) {
      hasReadPermission = false;
    }
  }
  try {
    if (hasReadPermission) {
      const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM users');
      const [rows] = await getPool().query('SELECT id,username,full_name,email,phone_contact,department,role,status,avatar_url,theme_preference,created_at FROM users ORDER BY id ASC LIMIT ? OFFSET ?', [limit, offset]);
      const pages = Math.ceil(total / limit);
      res.json({ data: rows, total, page, limit, pages });
    } else {
      // Safe subset for standard users to populate their messaging contact lists
      const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM users WHERE status = "Active"');
      const [rows] = await getPool().query('SELECT id,username,full_name,phone_contact,department,role,avatar_url FROM users WHERE status = "Active" ORDER BY id ASC LIMIT ? OFFSET ?', [limit, offset]);
      const pages = Math.ceil(total / limit);
      res.json({ data: rows, total, page, limit, pages });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Automatically sync a user demoted/created as Employee to the Employee side (employees_departments)
 */
async function syncUserToEmployee(user) {
  if (!user || user.role !== 'Employee') return;
  try {
    let existing = [];
    if (user.id) {
      [existing] = await getPool().query(
        'SELECT id FROM employees_departments WHERE user_id = ?',
        [user.id]
      );
    }
    if ((!existing || existing.length === 0) && user.email && String(user.email).trim() !== '') {
      [existing] = await getPool().query(
        'SELECT id FROM employees_departments WHERE email = ?',
        [user.email.trim()]
      );
    }
    if ((!existing || existing.length === 0) && user.full_name && String(user.full_name).trim() !== '') {
      [existing] = await getPool().query(
        'SELECT id FROM employees_departments WHERE name = ? AND type = "Employee"',
        [user.full_name.trim()]
      );
    }

    const statusVal = user.status === 'Active' ? 'Active' : 'Inactive';

    if (existing && existing.length > 0) {
      await getPool().query(
        'UPDATE employees_departments SET user_id=?, status=?, name=?, email=?, department_name=?, contact_number=? WHERE id=?',
        [user.id || null, statusVal, user.full_name, user.email || null, user.department || 'General', user.phone_contact || '', existing[0].id]
      );
    } else {
      const code = `EMP-${Math.floor(100 + Math.random() * 900)}`;
      await getPool().query(
        'INSERT INTO employees_departments (type, code, name, department_name, position, contact_number, email, gender, document_url, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['Employee', code, user.full_name, user.department || 'General', 'Employee', user.phone_contact || '', user.email || null, 'Not Specified', null, statusVal, user.id || null]
      );
    }
    invalidateStatsCache();
  } catch (e) {
    console.error('Error syncing user to employee side:', e.message);
  }
}

/**
 * Automatically remove a user promoted from Employee to another role from the Employee side
 */
async function removeUserFromEmployee(user) {
  if (!user) return;
  try {
    let removedRows = 0;
    if (user.id) {
      const [result] = await getPool().query(
        'DELETE FROM employees_departments WHERE user_id = ?',
        [user.id]
      );
      removedRows += Number(result?.affectedRows || 0);
    }
    if (user.email && String(user.email).trim() !== '') {
      const [result] = await getPool().query(
        'DELETE FROM employees_departments WHERE email = ? AND type = "Employee"',
        [user.email.trim()]
      );
      removedRows += Number(result?.affectedRows || 0);
    }
    if (user.full_name && String(user.full_name).trim() !== '') {
      const [result] = await getPool().query(
        'DELETE FROM employees_departments WHERE name = ? AND type = "Employee"',
        [user.full_name.trim()]
      );
      removedRows += Number(result?.affectedRows || 0);
    }
    invalidateStatsCache();
    return removedRows;
  } catch (e) {
    console.error('Error removing user from employee side:', e.message);
    throw e;
  }
}

/**
 * Perform initial startup sync between users and employee directory
 */
async function reconcileAllUserEmployees() {
  try {
    const [employeeUsers] = await getPool().query('SELECT id, full_name, email, role, status FROM users WHERE role = "Employee"');
    for (const u of employeeUsers) {
      await syncUserToEmployee(u);
    }

    // Clean up records left behind by promotions that happened before sync was enabled.
    const [promotedUsers] = await getPool().query('SELECT id, full_name, email, role FROM users WHERE role <> "Employee"');
    for (const u of promotedUsers) {
      await removeUserFromEmployee(u);
    }
  } catch (e) {
    console.warn('⚠️ User-employee reconciliation notice:', e.message);
  }
}

app.post('/api/users', requireAuth, requirePermission('user:create'), async (req, res) => {
  const err = validateRequired(req.body, ['username', 'password', 'full_name', 'role']);
  if (err) return res.status(400).json({ error: err });
  const { username, password, full_name, email, phone_contact, department, role, avatar_url, theme_preference } = req.body;
  try {
    // ── Duplicate username check ──────────────────────────────
    const trimmedUsername = username.trim();
    const [existing] = await getPool().query(
      'SELECT id FROM users WHERE username = ?', [trimmedUsername]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'This username is already in use. Please choose another username.'
      });
    }

    // ── Duplicate full_name check (optional, warn only if name already exists) ──
    const [existingName] = await getPool().query(
      'SELECT id FROM users WHERE full_name = ?', [full_name]
    );
    if (existingName.length > 0) {
      return res.status(409).json({
        error: 'This name is already in use. Please choose another name.'
      });
    }

    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      const [existingEmail] = await getPool().query(
        'SELECT id FROM users WHERE email = ?', [trimmedEmail]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          error: 'This email is already registered. Please use another email.'
        });
      }
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const preference = theme_preference || 'Light';
    let forceFirstLogin = 1;
    try {
      const [[s]] = await getPool().query("SELECT setting_value FROM system_settings WHERE setting_key='pwd_force_change_first_login'");
      if (s && s.setting_value === 'false') forceFirstLogin = 0;
    } catch { }

    const [r] = await getPool().query(
      'INSERT INTO users (username,password_hash,full_name,email,phone_contact,department,role,avatar_url,theme_preference,force_password_change) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [trimmedUsername, hashed, full_name, email || null, phone_contact || null, department || null, role, avatar_url || null, preference, forceFirstLogin]
    );
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [r.insertId, hashed]);
    if (role === 'Employee') {
      await syncUserToEmployee({ id: r.insertId, full_name, email, phone_contact, department, role, status: 'Active' });
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_USER', `Created user ${trimmedUsername} (${role})`, req);
    triggerBackgroundSync();
    res.json({ id: r.insertId, username: trimmedUsername, full_name, email, phone_contact, department, role, status: 'Active', avatar_url: avatar_url || null, theme_preference: preference });
  } catch (e) {
    // MySQL duplicate key error (code 1062 / ER_DUP_ENTRY) — safety net
    if (e.code === 'ER_DUP_ENTRY' || (e.message && e.message.includes('Duplicate entry'))) {
      if (e.message && e.message.includes("'username'")) {
        return res.status(409).json({ error: 'This username is already in use. Please choose another username.' });
      }
      return res.status(409).json({ error: 'A user with this information already exists.' });
    }
    console.error('Error creating user:', e.message);
    res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('user:edit'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(403).json({ error: 'Use Edit Profile to update your own account.' });
  }
  const { full_name, email, phone_contact, department, role, status, avatar_url, theme_preference } = req.body;

  // FIXED: Validate required fields
  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  try {
    // Protect Director accounts from being modified by non-director roles
    const [[target]] = await getPool().query('SELECT id, role, email, full_name FROM users WHERE id=?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Director accounts can only be modified by another Director
    if (target.role === 'Director' && req.user.role !== 'Director')
      return res.status(403).json({ error: 'Director accounts can only be modified by another Director' });

    // Director and Administrator can modify each other and lower roles
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      // Non-admin users cannot modify other users
      if (String(req.params.id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You do not have permission to modify this user' });
      }
    }
    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      const [existingEmail] = await getPool().query(
        'SELECT id FROM users WHERE email = ? AND id != ?', [trimmedEmail, req.params.id]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          error: 'This email is already registered to another user.'
        });
      }
    }

    await getPool().query('UPDATE users SET full_name=?,email=?,phone_contact=?,department=?,role=?,status=?,avatar_url=?,theme_preference=? WHERE id=?',
      [full_name.trim(), email || null, phone_contact || null, department || null, role, status || 'Active', avatar_url ?? null, theme_preference || 'Light', req.params.id]);

    // ── Auto-sync Employee role changes ──────────────────────────────────────────────
    if (role === 'Employee') {
      // Demoted or updated to Employee: automatically add/update on Employee side
      await syncUserToEmployee({ id: target.id, full_name: full_name.trim(), email, phone_contact, department, role: 'Employee', status: status || 'Active' });
    } else if (target.role === 'Employee' && role !== 'Employee') {
      // Promoted from Employee to another role: automatically remove from Employee side
      await removeUserFromEmployee(target);
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_USER', `Updated user #${req.params.id}`, req);
    triggerBackgroundSync();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['Active', 'Inactive', 'Locked'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `Status must be: ${allowed.join(', ')}` });
  if (!(await hasPermission(req.user, 'user:statusChange'))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const [[t]] = await getPool().query('SELECT id,role FROM users WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ error: 'User not found' });
    if (!['Director', 'Administrator'].includes(req.user.role))
      return res.status(403).json({ error: 'You do not have permission to change user status' });
    await getPool().query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    // If locking or deactivating, immediately kill any active sessions
    if (status === 'Locked' || status === 'Inactive') {
      await forceLogoutAllSessions(Number(req.params.id));
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_USER_STATUS', `Set user #${req.params.id} to ${status}`, req);
    invalidateStatsCache();
    triggerBackgroundSync();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  const { new_password, force_change } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });

  try {
    await checkPasswordPolicy(new_password, req.params.id);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (!(await hasPermission(req.user, 'user:resetPassword'))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const [[t]] = await getPool().query('SELECT id, username, role FROM users WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ error: 'User not found' });
    if (!['Director', 'Administrator'].includes(req.user.role))
      return res.status(403).json({ error: 'You do not have permission to reset passwords' });

    // FIXED: Default to forcing password change on reset for security
    let force = force_change === true ? 1 : 1; // Default to 1 (true) - users MUST change temp password
    if (force_change === false) {
      force = 0; // Only if explicitly false
    }

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=?, failed_login_attempts=0, locked_until=NULL WHERE id=?',
      [newHash, force, req.params.id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [req.params.id, newHash]);

    // Invalidate all active sessions so old tokens are rejected immediately
    await forceLogoutAllSessions(Number(req.params.id));

    await logAudit(req.user.id, req.user.username, req.user.role, 'RESET_PASSWORD', `Reset password for user #${req.params.id} (${t.username || 'unknown'})`, req);
    invalidateStatsCache();
    triggerBackgroundSync();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Allow users to change their own username ────────────────
app.put('/api/auth/change-username', requireAuth, async (req, res) => {
  const { new_username, current_password } = req.body;

  if (!new_username || !current_password) {
    return res.status(400).json({ error: 'New username and current password are required' });
  }

  if (new_username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (new_username.trim().length > 50) {
    return res.status(400).json({ error: 'Username must not exceed 50 characters' });
  }

  try {
    // Get current user details
    const [[user]] = await getPool().query(
      'SELECT id, username, password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const trimmedNewUsername = new_username.trim();

    // Check if new username is same as current
    if (trimmedNewUsername === user.username) {
      return res.status(400).json({ error: 'New username must be different from current username' });
    }

    // Check if new username already exists
    const [[existingUser]] = await getPool().query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [trimmedNewUsername, req.user.id]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'This username is already in use. Please choose another username.' });
    }

    // Update username
    await getPool().query(
      'UPDATE users SET username = ? WHERE id = ?',
      [trimmedNewUsername, req.user.id]
    );

    // Log the change
    await logAudit(
      req.user.id,
      user.username,
      req.user.role,
      'CHANGE_USERNAME',
      `User changed username from "${user.username}" to "${trimmedNewUsername}"`,
      req
    );

    triggerBackgroundSync();

    res.json({
      success: true,
      message: 'Username changed successfully',
      new_username: trimmedNewUsername,
      note: 'You will need to use your new username to login next time'
    });
  } catch (e) {
    console.error('Error changing username:', e.message);
    res.status(500).json({ error: 'Failed to change username. Please try again.' });
  }
});

app.delete('/api/users/:id', requireAuth, requirePermission('user:delete'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id))
    return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    const [[t]] = await getPool().query('SELECT id, role, email FROM users WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ error: 'User not found' });
    if (!['Director', 'Administrator'].includes(req.user.role))
      return res.status(403).json({ error: 'You do not have permission to delete users' });
    if (t.role === 'Director' && req.user.role !== 'Director')
      return res.status(403).json({ error: 'Director accounts can only be deleted by another Director' });
    await getPool().query('DELETE FROM users WHERE id=?', [req.params.id]);
    if (t.role === 'Employee') {
      await removeUserFromEmployee(t);
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_USER', `Deleted user #${req.params.id}`, req);
    triggerBackgroundSync();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Categories ────────────────────────────────────────────────
app.get('/api/categories', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM categories');
    const [rows] = await getPool().query('SELECT * FROM categories ORDER BY name ASC LIMIT ? OFFSET ?', [limit, offset]);
    const pages = Math.ceil(total / limit);
    res.json({ data: rows, total, page, limit, pages });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/categories', requireAuth, requirePermission('category:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name']);
  if (err) return res.status(400).json({ error: err });
  const { name, description, status = 'Active' } = req.body;
  try {
    const [r] = await getPool().query('INSERT INTO categories (name,description,status) VALUES (?,?,?)', [name.trim(), description || '', status === 'Inactive' ? 'Inactive' : 'Active']);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_CATEGORY', `Created category ${name.trim()}`, req);
    invalidateStatsCache();
    res.json({ id: r.insertId, name: name.trim(), description: description || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/categories/:id', requireAuth, requirePermission('category:update'), async (req, res) => {
  const { name, description, status } = req.body;
  try {
    await getPool().query('UPDATE categories SET name=?,description=?,status=? WHERE id=?', [name, description || '', status === 'Inactive' ? 'Inactive' : 'Active', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_CATEGORY', `Updated category #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/categories/:id', requireAuth, requirePermission('category:delete'), async (req, res) => {
  try {
    const [[dependency]] = await getPool().query('SELECT COUNT(*) AS total FROM materials WHERE category_id=?', [req.params.id]);
    if (Number(dependency?.total) > 0) return res.status(409).json({ error: 'Cannot delete this category while materials are assigned to it. Reassign the materials first.' });
    await getPool().query('DELETE FROM categories WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_CATEGORY', `Deleted category #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Suppliers ─────────────────────────────────────────────────
app.get('/api/suppliers', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM suppliers');
    const [rows] = await getPool().query('SELECT * FROM suppliers ORDER BY name ASC LIMIT ? OFFSET ?', [limit, offset]);
    const pages = Math.ceil(total / limit);
    res.json({ data: rows, total, page, limit, pages });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/suppliers', requireAuth, requirePermission('supplier:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name']);
  if (err) return res.status(400).json({ error: err });
  const { name, contact_person, email, phone, address } = req.body;
  const code = `SUP-${Math.floor(100 + Math.random() * 900)}`;
  try {
    const [r] = await getPool().query(
      'INSERT INTO suppliers (supplier_code,name,contact_person,email,phone,address) VALUES (?,?,?,?,?,?)',
      [code, name, contact_person, email, phone, address]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_SUPPLIER', `Added ${name}`, req);
    invalidateStatsCache();
    res.json({ id: r.insertId, supplier_code: code, name, contact_person, email, phone, address });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/suppliers/:id', requireAuth, requirePermission('supplier:update'), async (req, res) => {
  const { name, contact_person, email, phone, address, status } = req.body;
  try {
    await getPool().query('UPDATE suppliers SET name=?,contact_person=?,email=?,phone=?,address=?,status=? WHERE id=?',
      [name, contact_person, email, phone, address, status === 'Inactive' ? 'Inactive' : 'Active', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_SUPPLIER', `Updated supplier #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/suppliers/:id', requireAuth, requirePermission('supplier:delete'), async (req, res) => {
  try {
    const [[dependency]] = await getPool().query('SELECT COUNT(*) AS total FROM materials WHERE supplier_id=?', [req.params.id]);
    if (Number(dependency?.total) > 0) return res.status(409).json({ error: 'Cannot delete this supplier while materials are assigned to it. Reassign the materials first.' });
    await getPool().query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_SUPPLIER', `Deleted supplier #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Employees / Departments ───────────────────────────────────
app.get('/api/employees', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM employees_departments');
    const [rows] = await getPool().query('SELECT * FROM employees_departments ORDER BY name ASC LIMIT ? OFFSET ?', [limit, offset]);
    const pages = Math.ceil(total / limit);
    res.json({ data: rows, total, page, limit, pages });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/employees', requireAuth, requirePermission('employee:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name', 'type']);
  if (err) return res.status(400).json({ error: err });
  const { type, name, department_name, position, contact_number, email, gender, document_url } = req.body;
  const code = `${type === 'Department' ? 'DEP' : 'EMP'}-${Math.floor(100 + Math.random() * 900)}`;
  try {
    const [r] = await getPool().query(
      'INSERT INTO employees_departments (type,code,name,department_name,position,contact_number,email,gender,document_url) VALUES (?,?,?,?,?,?,?,?,?)',
      [type, code, name, department_name, position || null, contact_number, email, gender || null, document_url || null]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_EMPLOYEE', `Created ${type.toLowerCase()} ${name}`, req);
    invalidateStatsCache();
    res.json({ id: r.insertId, type, code, name, department_name, position, contact_number, email, gender, document_url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/employees/:id', requireAuth, requirePermission('employee:update'), async (req, res) => {
  const { name, department_name, position, contact_number, email, gender, document_url, status } = req.body;
  try {
    await getPool().query('UPDATE employees_departments SET name=?,department_name=?,position=?,contact_number=?,email=?,gender=?,document_url=?,status=? WHERE id=?',
      [name, department_name, position || null, contact_number, email, gender || null, document_url || null, status === 'Inactive' ? 'Inactive' : 'Active', req.params.id]);

    // Sync back to the users table if this employee is linked to a user
    const [[emp]] = await getPool().query('SELECT user_id FROM employees_departments WHERE id=?', [req.params.id]);
    if (emp && emp.user_id) {
      await getPool().query(
        'UPDATE users SET full_name=?, department=?, phone_contact=?, email=? WHERE id=?',
        [name, department_name, contact_number, email, emp.user_id]
      );
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_EMPLOYEE', `Updated employee record #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/employees/:id', requireAuth, requirePermission('employee:delete'), async (req, res) => {
  try {
    await getPool().query('DELETE FROM employees_departments WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_EMPLOYEE', `Deleted employee record #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Materials ─────────────────────────────────────────────────
app.get('/api/materials', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM materials');
    const [rows] = await getPool().query(`
      SELECT m.*, c.name AS category_name, s.name AS supplier_name
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN suppliers  s ON m.supplier_id  = s.id
      ORDER BY m.id DESC
      LIMIT ? OFFSET ?`, [limit, offset]);
    const pages = Math.ceil(total / limit);
    res.json({ data: rows, total, page, limit, pages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/materials/next-code', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM materials');
    let nextNum = 1001;
    if (rows && rows.length > 0) {
      const nums = rows.map(r => {
        if (!r.material_code) return null;
        const match = r.material_code.match(/^MAT-(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      }).filter(n => n !== null && !isNaN(n));
      if (nums.length > 0) {
        nextNum = Math.max(...nums) + 1;
      }
    }
    const nextCode = `MAT-${nextNum}`;

    let nextBarcodeSeq = 1;
    if (rows && rows.length > 0) {
      const seqs = rows.map(r => {
        if (!r.barcode) return null;
        const match = r.barcode.match(/^890123(\d{6})\d$/);
        return match ? parseInt(match[1], 10) : null;
      }).filter(n => n !== null && !isNaN(n));
      if (seqs.length > 0) {
        nextBarcodeSeq = Math.max(...seqs) + 1;
      }
    }
    const seqStr = String(nextBarcodeSeq).padStart(6, '0');
    const base12 = `890123${seqStr}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base12[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const nextBarcode = `${base12}${checkDigit}`;

    res.json({ nextCode, nextBarcode });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/materials', requireAuth, requirePermission('material:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name', 'unit_of_measure']);
  if (err) return res.status(400).json({ error: err });
  const { material_code, name, category_id, unit_of_measure, specifications,
    min_stock_level, current_stock, unit_cost, supplier_id, location, barcode } = req.body;
  if (unit_cost !== undefined && (isNaN(parseFloat(unit_cost)) || parseFloat(unit_cost) < 0)) {
    return res.status(400).json({ error: 'Unit cost must be a non-negative number' });
  }
  if (min_stock_level !== undefined && (isNaN(parseInt(min_stock_level)) || parseInt(min_stock_level) < 0)) {
    return res.status(400).json({ error: 'Minimum stock level must be a non-negative number' });
  }
  let code = material_code;
  let bar = barcode;
  try {
    const [rows] = await getPool().query('SELECT * FROM materials');
    if (!code) {
      let nextNum = 1001;
      if (rows && rows.length > 0) {
        const nums = rows.map(r => {
          if (!r.material_code) return null;
          const match = r.material_code.match(/^MAT-(\d+)$/i);
          return match ? parseInt(match[1], 10) : null;
        }).filter(n => n !== null && !isNaN(n));
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
      }
      code = `MAT-${nextNum}`;
    }
    if (!bar) {
      let nextBarcodeSeq = 1;
      if (rows && rows.length > 0) {
        const seqs = rows.map(r => {
          if (!r.barcode) return null;
          const match = r.barcode.match(/^890123(\d{6})\d$/);
          return match ? parseInt(match[1], 10) : null;
        }).filter(n => n !== null && !isNaN(n));
        if (seqs.length > 0) {
          nextBarcodeSeq = Math.max(...seqs) + 1;
        }
      }
      const seqStr = String(nextBarcodeSeq).padStart(6, '0');
      const base12 = `890123${seqStr}`;
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(base12[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      bar = `${base12}${checkDigit}`;
    }
  } catch (err) {
    if (!code) code = `MAT-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!bar) bar = `890123${Math.floor(100000 + Math.random() * 900000)}`;
  }

  try {
    const [r] = await getPool().query(
      `INSERT INTO materials (material_code,name,category_id,unit_of_measure,specifications,
        min_stock_level,current_stock,unit_cost,supplier_id,location,barcode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [code, name, category_id || null, unit_of_measure, specifications || '',
        toInt(min_stock_level, 5), toInt(current_stock, 0), toFloat(unit_cost, 0),
        supplier_id || null, location || 'Main Warehouse', bar]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_MATERIAL', `Registered ${name} (${code})`, req);
    invalidateStatsCache();
    res.json({ id: r.insertId, material_code: code, name, unit_of_measure, barcode: bar });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/materials/:id', requireAuth, requirePermission('material:update'), async (req, res) => {
  const { name, category_id, unit_of_measure, specifications,
    min_stock_level, unit_cost, supplier_id, location, current_stock, status } = req.body;
  const VALID_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock', 'Under Repair'];
  try {
    let updateFields = [name, category_id || null, unit_of_measure, specifications,
      toInt(min_stock_level, 5), toFloat(unit_cost, 0), supplier_id || null, location];
    let updateClause = `UPDATE materials SET name=?,category_id=?,unit_of_measure=?,specifications=?,
                        min_stock_level=?,unit_cost=?,supplier_id=?,location=?`;

    if (current_stock !== undefined) {
      const newStock = toInt(current_stock, 0);
      if (newStock < 0) return res.status(400).json({ error: 'Current stock cannot be negative' });
      updateClause += ',current_stock=?';
      updateFields.push(newStock);
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      updateClause += ',status=?';
      updateFields.push(status);
    }

    updateClause += ' WHERE id=?';
    updateFields.push(req.params.id);

    await getPool().query(updateClause, updateFields);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_MATERIAL', `Updated material #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/materials/:id', requireAuth, requirePermission('material:delete'), async (req, res) => {
  try {
    // FIXED: Check for dependencies before deleting
    const [[txnDeps]] = await getPool().query('SELECT COUNT(*) as count FROM stock_transactions WHERE material_id=?', [req.params.id]);
    const [[reqDeps]] = await getPool().query('SELECT COUNT(*) as count FROM material_requests WHERE material_id=?', [req.params.id]);
    const [[dispDeps]] = await getPool().query('SELECT COUNT(*) as count FROM material_disposals WHERE material_id=?', [req.params.id]);

    const totalDeps = (txnDeps?.count || 0) + (reqDeps?.count || 0) + (dispDeps?.count || 0);
    if (totalDeps > 0) {
      return res.status(409).json({
        error: `Cannot delete material. ${txnDeps?.count || 0} transaction(s), ${reqDeps?.count || 0} request(s), ${dispDeps?.count || 0} disposal(s) are linked to this material.`
      });
    }

    await getPool().query('DELETE FROM materials WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_MATERIAL', `Deleted material #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transactions ──────────────────────────────────────────────
app.get('/api/transactions', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM stock_transactions');
    const [rows] = await getPool().query(`
      SELECT t.*, 
         m.name as material_name, m.material_code, m.unit_of_measure,
         s.name as supplier_name,
         ed.name as receiver_name,
         u1.full_name as issued_by_name,
         u2.full_name as approved_by_name,
         t.payment_method
      FROM stock_transactions t
      LEFT JOIN materials m            ON t.material_id      = m.id
      LEFT JOIN suppliers s            ON t.supplier_id      = s.id
      LEFT JOIN employees_departments ed ON t.employee_dept_id = ed.id
      LEFT JOIN users u1               ON t.issued_by_id     = u1.id
      LEFT JOIN users u2               ON t.approved_by_id   = u2.id
      ORDER BY t.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data: rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/stock-in', requireAuth, requirePermission('inventory:stockIn'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, quantity, unit_cost, supplier_id, purpose, remarks, store_location, payment_method } = req.body;
  const qty = toInt(quantity); if (qty <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  const cost = toFloat(unit_cost);
  const pMethod = payment_method || 'Cash';
  let code = `TX-IN-${Date.now()}`;
  try {
    const [tRows] = await getPool().query("SELECT COUNT(*) as count FROM stock_transactions WHERE transaction_type='STOCK_IN'");
    const nextSeq = (tRows[0]?.count || 0) + 1;
    code = `GRN-${String(nextSeq).padStart(6, '0')}`;
  } catch (e) {
    console.error('Error generating sequential GRN:', e);
  }
  try {
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,unit_cost,supplier_id,purpose,issued_by_id,store_location,payment_method,remarks)
       VALUES (?,'STOCK_IN',?,?,?,?,?,?,?,?,?)`,
      [code, material_id, qty, cost, supplier_id || null, purpose || 'Stock In', req.user.id, store_location || 'Main Warehouse', pMethod, remarks]);

    // Update stock and unit cost in a single query
    if (cost > 0) {
      await getPool().query('UPDATE materials SET current_stock=current_stock+?, unit_cost=? WHERE id=?', [qty, cost, material_id]);
    } else {
      await getPool().query('UPDATE materials SET current_stock=current_stock+? WHERE id=?', [qty, material_id]);
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_IN', `Received ${qty} units for material #${material_id}`, req);
    invalidateStatsCache();
    res.json({ success: true, transaction_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/stock-out', requireAuth, requirePermission('inventory:stockOut'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, quantity, employee_dept_id, purpose, remarks } = req.body;
  const qty = toInt(quantity); if (qty <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  let code = `TX-OUT-${Date.now()}`;
  try {
    const [tRows] = await getPool().query("SELECT COUNT(*) as count FROM stock_transactions WHERE transaction_type='STOCK_OUT'");
    const nextSeq = (tRows[0]?.count || 0) + 1;
    code = `MIV-${String(nextSeq).padStart(6, '0')}`;
  } catch (e) {
    console.error('Error generating sequential MIV:', e);
  }
  try {
    const [[mat]] = await getPool().query('SELECT current_stock,name,unit_cost,min_stock_level,material_code FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    if (mat.current_stock < qty) return res.status(400).json({ error: `Insufficient stock. Available: ${mat.current_stock}` });

    const isStorekeeper = req.user.role === 'Storekeeper';
    const initialStatus = isStorekeeper ? 'Pending Approval' : 'Approved';
    const approvedById = isStorekeeper ? null : req.user.id;
    const approvedAt = isStorekeeper ? null : new Date();

    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,unit_cost,employee_dept_id,purpose,issued_by_id,remarks,status,approved_by_id,approved_at)
       VALUES (?,'STOCK_OUT',?,?,?,?,?,?,?,?,?,?)`,
      [code, material_id, qty, mat.unit_cost || 0, employee_dept_id || null, purpose || 'Material Issue', req.user.id, remarks, initialStatus, approvedById, approvedAt]);
    await getPool().query('UPDATE materials SET current_stock=current_stock-? WHERE id=?', [qty, material_id]);

    if (isStorekeeper) {
      await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_OUT_SUBMITTED', `Issued ${qty} units of ${mat.name} (Submitted for Approval)`, req);
      try {
        const [managers] = await getPool().query("SELECT id FROM users WHERE role IN ('Director', 'Administrator', 'Manager') AND status='Active'");
        for (const m of managers) {
          await createNotification(m.id, 'Transaction Approval Required', `Storekeeper ${req.user.full_name || req.user.username} issued ${qty} units of "${mat.name}" (${code}) pending approval.`, 'info');
        }
      } catch (notifErr) {
        console.error('Notification error on stock out:', notifErr.message);
      }
    } else {
      await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_OUT', `Issued ${qty} units of ${mat.name}`, req);
    }

    invalidateStatsCache();

    // Auto-alert if inventory drops below minimum threshold OR reaches zero
    const finalStock = mat.current_stock - qty;
    if (finalStock <= 0) {
      // OUT OF STOCK - Send urgent email
      try {
        const [managers] = await getPool().query("SELECT id, email, username FROM users WHERE role IN ('Director', 'Administrator', 'Manager') AND status='Active'");
        for (const m of managers) {
          await createNotification(m.id, '🚨 OUT OF STOCK ALERT', `Material "${mat.name}" is NOW OUT OF STOCK!`, 'error');
          if (m.email) {
            sendEmail({
              to: m.email,
              subject: `🚨 [URGENT] OUT OF STOCK: ${mat.name}`,
              text: `Hello ${m.username},\n\n⚠️ URGENT: "${mat.name}" is now OUT OF STOCK!\n\nDetails:\n- Current Stock: ${finalStock} units\n- Material Code: ${mat.material_code}\n- Action Required: IMMEDIATE REORDER\n\nPlease contact the supplier immediately to restock this critical item.\n\nBest regards,\nStore Management System Support`
            }).catch(e => console.error('Out of stock mail error:', e));
          }
        }
      } catch (alertErr) {
        console.error('Failed to dispatch out of stock alerts:', alertErr.message);
      }
    } else if (finalStock <= (mat.min_stock_level || 0)) {
      // LOW STOCK - Send standard email
      try {
        const [managers] = await getPool().query("SELECT id, email, username FROM users WHERE role IN ('Administrator', 'Manager') AND status='Active'");
        for (const m of managers) {
          await createNotification(m.id, 'Low Stock Alert', `Material "${mat.name}" has dropped to ${finalStock} units (Minimum required: ${mat.min_stock_level}).`, 'warning');
          if (m.email) {
            sendEmail({
              to: m.email,
              subject: `[SMS Alert] Low Stock: ${mat.name}`,
              text: `Hello ${m.username},\n\nThis is an automated alert to notify you that "${mat.name}" is running low.\n\nDetails:\n- Current Stock: ${finalStock}\n- Minimum Level Required: ${mat.min_stock_level}\n\nPlease restock this item soon.\n\nBest regards,\nStore Management System Support`
            }).catch(e => console.error('Low stock mail error:', e));
          }
        }
      } catch (alertErr) {
        console.error('Failed to dispatch low stock alerts:', alertErr.message);
      }
    }

    res.json({ success: true, transaction_code: code, status: initialStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id/approve', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  try {
    const [[txn]] = await getPool().query('SELECT * FROM stock_transactions WHERE id=?', [req.params.id]);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.status !== 'Pending Approval') {
      return res.status(400).json({ error: `Transaction is already ${txn.status || 'Approved'}` });
    }

    await getPool().query(
      `UPDATE stock_transactions SET status='Approved', approved_by_id=?, approval_remarks=?, approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks || 'Approved', req.params.id]
    );

    await logAudit(req.user.id, req.user.username, req.user.role, 'APPROVE_TRANSACTION',
      `Approved transaction ${txn.transaction_code}${req.body.remarks ? ': ' + req.body.remarks : ''}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id/reject', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  try {
    const [[txn]] = await getPool().query('SELECT * FROM stock_transactions WHERE id=?', [req.params.id]);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.status !== 'Pending Approval') {
      return res.status(400).json({ error: `Transaction is already ${txn.status || 'Approved'}` });
    }

    await getPool().query(
      `UPDATE stock_transactions SET status='Rejected', approved_by_id=?, approval_remarks=?, approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks || 'Rejected', req.params.id]
    );

    if (txn.transaction_type === 'STOCK_OUT') {
      await getPool().query('UPDATE materials SET current_stock = current_stock + ? WHERE id = ?', [txn.quantity, txn.material_id]);
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'REJECT_TRANSACTION',
      `Rejected transaction ${txn.transaction_code}${req.body.remarks ? ': ' + req.body.remarks : ''}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/return', requireAuth, requirePermission('inventory:return'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, quantity, employee_dept_id, remarks } = req.body;
  const qty = toInt(quantity); if (qty <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  let code = `TX-RET-${Date.now()}`;
  try {
    const [tRows] = await getPool().query("SELECT COUNT(*) as count FROM stock_transactions WHERE transaction_type='RETURN'");
    const nextSeq = (tRows[0]?.count || 0) + 1;
    code = `SRV-${String(nextSeq).padStart(6, '0')}`;
  } catch (e) {
    console.error('Error generating sequential SRV:', e);
  }
  try {
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,employee_dept_id,purpose,issued_by_id,remarks)
       VALUES (?,'RETURN',?,?,?,'Material Return',?,?)`,
      [code, material_id, qty, employee_dept_id || null, req.user.id, remarks]);
    await getPool().query('UPDATE materials SET current_stock=current_stock+? WHERE id=?', [qty, material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_RETURN', `Returned ${qty} units for material #${material_id}`, req);
    invalidateStatsCache();
    res.json({ success: true, transaction_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/adjust', requireAuth, requirePermission('inventory:adjust'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'new_quantity']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, new_quantity, remarks } = req.body;
  const target = toInt(new_quantity);
  if (target < 0) return res.status(400).json({ error: 'Target quantity must be >= 0' });
  const code = `TX-ADJ-${Date.now()}`;
  try {
    const [[mat]] = await getPool().query('SELECT current_stock,name FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    // Ensure resulting stock is not negative
    const diff = target - mat.current_stock;
    if (mat.current_stock + diff < 0) return res.status(400).json({ error: 'Adjustment would result in negative stock' });
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,purpose,issued_by_id,remarks)
       VALUES (?,'ADJUSTMENT',?,?,?,?,?)`,
      [code, material_id, diff, `Stock Adjustment (count: ${target})`, req.user.id, remarks]);
    await getPool().query('UPDATE materials SET current_stock=? WHERE id=?', [target, material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_ADJUSTMENT', `Adjusted ${mat.name} to ${target}`, req);
    invalidateStatsCache();
    res.json({ success: true, transaction_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock Transfers ───────────────────────────────────────────
app.get('/api/transfers', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM stock_transfers');
    const [rows] = await getPool().query(`
      SELECT t.*, m.name AS material_name, m.material_code, u.username AS transferred_by_name
      FROM stock_transfers t
      LEFT JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u     ON t.transferred_by_id = u.id
      ORDER BY t.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data: rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transfers', requireAuth, requirePermission('inventory:transfer'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity', 'source_location', 'destination_location']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, quantity, source_location, destination_location, remarks } = req.body;
  const qty = toInt(quantity);
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  if (source_location.trim() === destination_location.trim()) return res.status(400).json({ error: 'Source and destination must differ' });
  const code = `TRF-${Date.now()}`;
  try {
    const [[mat]] = await getPool().query('SELECT current_stock,name,unit_cost FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    if (mat.current_stock < qty) return res.status(400).json({ error: `Insufficient stock. Available: ${mat.current_stock}` });

    // FIXED: Stock transfers should deduct from source and add to destination
    // For simplicity, we're tracking at material level, not per-warehouse yet
    // The stock_transfers table tracks the movement for audit purposes
    await getPool().query(
      `INSERT INTO stock_transfers (transfer_code,material_id,quantity,source_location,destination_location,transferred_by_id,remarks)
       VALUES (?,?,?,?,?,?,?)`,
      [code, material_id, qty, source_location, destination_location, req.user.id, remarks]);

    // Also create a transaction record for audit trail (type='TRANSFER')
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,unit_cost,purpose,issued_by_id,store_location,remarks)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [code, 'TRANSFER', material_id, qty, mat.unit_cost || 0, `Transfer: ${source_location} → ${destination_location}`, req.user.id, destination_location, remarks || '']);

    // Update material location to destination
    await getPool().query('UPDATE materials SET location=? WHERE id=?', [destination_location, material_id]);

    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_TRANSFER', `Transferred ${qty} of ${mat.name}: ${source_location} → ${destination_location}`, req);
    invalidateStatsCache();
    res.json({ success: true, transfer_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Dashboard Stats Cache ─────────────────────────────────────
const statsCache = { data: null, timestamp: null, TTL: 10 * 1000 }; // 10 second TTL for real-time updates in Management Control Center

/**
 * Check if cache is valid
 * @returns {boolean} True if cache exists and is not expired
 */
function isCacheValid() {
  if (!statsCache.data || !statsCache.timestamp) return false;
  const now = Date.now();
  return (now - statsCache.timestamp) < statsCache.TTL;
}

/**
 * Update cache with new stats data
 * @param {Object} data - Stats data to cache
 */
function updateStatsCache(data) {
  statsCache.data = data;
  statsCache.timestamp = Date.now();
}

/**
 * Invalidate stats cache (called after data mutations)
 */
function invalidateStatsCache() {
  statsCache.data = null;
  statsCache.timestamp = null;
}

// ── Dashboard stats (OPTIMIZED) ───────────────────────────────────────────
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    // Check cache first
    if (isCacheValid()) {
      return res.json(statsCache.data);
    }

    // Single optimized query combining all stats using aggregations and JOINs
    const [statsRow] = await getPool().query(`
      SELECT
        -- Total Materials Stats
        (SELECT COUNT(*) FROM materials) AS totalMaterials,
        (SELECT COUNT(*) FROM materials WHERE current_stock <= min_stock_level) AS activeLowStockCount,
        (SELECT COUNT(*) FROM materials WHERE current_stock = 0) AS outOfStockCount,
        (SELECT COUNT(*) FROM materials WHERE current_stock > 0) AS activeMateries,
        (SELECT COUNT(*) FROM materials WHERE status = 'Under Repair') AS pendingRepairCount,
        
        -- Total Stock Value
        (SELECT COALESCE(SUM(current_stock * unit_cost), 0) FROM materials) AS totalStockValue,
        
        -- Category Stats
        (SELECT COUNT(*) FROM categories) AS totalCategories,
        
        -- Supplier Stats
        (SELECT COUNT(*) FROM suppliers) AS totalSuppliers,
        
        -- Employee/Department Stats
        (SELECT COUNT(*) FROM employees_departments WHERE type='Employee') AS totalEmployees,
        (SELECT COUNT(*) FROM employees_departments WHERE type='Department') AS totalDepartments,
        
        -- User Stats
        (SELECT COUNT(*) FROM users WHERE status='Active') AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE status='Inactive') AS inactiveUsers,
        
        -- Transaction Stats
        (SELECT COUNT(*) FROM stock_transactions WHERE transaction_type='STOCK_IN') AS totalStockInTransactions,
        (SELECT COUNT(*) FROM stock_transactions WHERE transaction_type='STOCK_OUT') AS totalStockOutTransactions,
        (SELECT COUNT(*) FROM stock_transactions WHERE transaction_type='RETURN') AS totalReturnTransactions,
        (SELECT COUNT(*) FROM stock_transactions WHERE transaction_type='ADJUSTMENT') AS totalAdjustmentTransactions,
        (SELECT COUNT(*) FROM stock_transactions WHERE status='Pending Approval') AS pendingTransactions,
        (SELECT COUNT(*) FROM stock_transactions WHERE DATE(transaction_date)=CURDATE()) AS transactionsToday,
        (SELECT COALESCE(SUM(quantity), 0) FROM stock_transactions WHERE transaction_type='STOCK_IN' AND DATE(transaction_date)=CURDATE()) AS stockInToday,
        (SELECT COALESCE(SUM(quantity), 0) FROM stock_transactions WHERE transaction_type='STOCK_OUT' AND DATE(transaction_date)=CURDATE()) AS stockOutToday,
        
        -- Stock Transfer Stats
        (SELECT COUNT(*) FROM stock_transfers) AS totalTransfers,
        
        -- Disposal Stats
        (SELECT COUNT(*) FROM material_disposals) AS totalDisposals,
        (SELECT COUNT(*) FROM material_disposals WHERE status='Pending Approval') AS pendingDisposals,
        (SELECT COUNT(*) FROM material_disposals WHERE status='Approved') AS approvedDisposals,
        
        -- Material Request Stats
        (SELECT COUNT(*) FROM material_requests WHERE status='Pending') AS pendingRequests,
        (SELECT COUNT(*) FROM material_requests WHERE status='Approved') AS approvedRequests,
        (SELECT COUNT(*) FROM material_requests WHERE status='Rejected') AS rejectedRequests,
        
        -- Purchase Order Stats
        (SELECT COUNT(*) FROM purchase_orders WHERE status='Draft') AS draftPOs,
        (SELECT COUNT(*) FROM purchase_orders WHERE status='Issued') AS issuedPOs,
        (SELECT COUNT(*) FROM purchase_orders WHERE status='Partially Received') AS partiallyReceivedPOs,
        (SELECT COUNT(*) FROM purchase_orders WHERE status='Completed') AS completedPOs,
        
        -- Warehouse Stats
        (SELECT COUNT(*) FROM warehouses) AS totalWarehouses,

        -- System Settings Stats
        (SELECT COUNT(*) FROM system_settings) AS totalSettings,

        -- Online Users & Failed Actions
        (SELECT GREATEST(1, COUNT(DISTINCT user_id)) FROM audit_logs WHERE created_at >= NOW() - INTERVAL 2 HOUR) AS onlineUsers,
        (SELECT COUNT(*) FROM audit_logs WHERE LOWER(action_type) LIKE '%fail%' OR LOWER(action_type) LIKE '%reject%' OR LOWER(action_type) LIKE '%deny%' OR LOWER(description) LIKE '%fail%' OR LOWER(description) LIKE '%invalid%') AS failedActions,
        (SELECT COUNT(*) FROM audit_logs) AS totalAuditLogs
    `);

    // Get category-wise stats for dashboard breakdown
    const [categoryStats] = await getPool().query(`
      SELECT 
        c.name AS category,
        COUNT(m.id) AS item_count,
        COALESCE(SUM(m.current_stock), 0) AS stock_qty,
        COALESCE(SUM(m.current_stock * m.unit_cost), 0) AS category_value
      FROM categories c 
      LEFT JOIN materials m ON c.id=m.category_id 
      GROUP BY c.id, c.name
      ORDER BY stock_qty DESC
    `);

    // Get monthly stock movement (last 6 months) for trend analysis
    const [monthlyMovement] = await getPool().query(`
      SELECT 
        DATE_FORMAT(transaction_date, '%Y-%m') AS month,
        SUM(CASE WHEN transaction_type='STOCK_IN' THEN quantity ELSE 0 END) AS in_qty,
        SUM(CASE WHEN transaction_type='STOCK_OUT' THEN quantity ELSE 0 END) AS out_qty,
        SUM(CASE WHEN transaction_type='RETURN' THEN quantity ELSE 0 END) AS return_qty,
        SUM(CASE WHEN transaction_type='ADJUSTMENT' THEN quantity ELSE 0 END) AS adjustment_qty
      FROM stock_transactions
      WHERE transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
      ORDER BY month ASC
    `);

    // Build comprehensive stats response
    const stats = {
      // Material Statistics
      totalMaterials: statsRow[0].totalMaterials,
      activeMaterials: statsRow[0].activeMateries,
      lowStockCount: statsRow[0].activeLowStockCount,
      outOfStockCount: statsRow[0].outOfStockCount || 0,
      pendingRepairCount: statsRow[0].pendingRepairCount || 0,
      totalStockValue: parseFloat(statsRow[0].totalStockValue || 0),

      // Organizational Statistics
      totalCategories: statsRow[0].totalCategories,
      totalSuppliers: statsRow[0].totalSuppliers,
      totalEmployees: statsRow[0].totalEmployees,
      totalDepartments: statsRow[0].totalDepartments,
      departments: statsRow[0].totalDepartments,
      totalUsers: statsRow[0].totalUsers,
      inactiveUsers: statsRow[0].inactiveUsers,

      // Transaction Statistics
      totalStockInTransactions: statsRow[0].totalStockInTransactions,
      totalStockOutTransactions: statsRow[0].totalStockOutTransactions,
      totalReturnTransactions: statsRow[0].totalReturnTransactions,
      totalAdjustmentTransactions: statsRow[0].totalAdjustmentTransactions,
      pendingTransactions: statsRow[0].pendingTransactions || 0,
      transactionsToday: statsRow[0].transactionsToday,
      stockInToday: statsRow[0].stockInToday,
      stockOutToday: statsRow[0].stockOutToday,

      // Transfer & Disposal Statistics
      totalTransfers: statsRow[0].totalTransfers,
      totalDisposals: statsRow[0].totalDisposals,
      pendingDisposals: statsRow[0].pendingDisposals,
      approvedDisposals: statsRow[0].approvedDisposals,

      // Request Statistics
      pendingRequests: statsRow[0].pendingRequests,
      pendingOrders: (statsRow[0].pendingRequests || 0) + (statsRow[0].pendingTransactions || 0),
      approvedRequests: statsRow[0].approvedRequests,
      rejectedRequests: statsRow[0].rejectedRequests,

      // Purchase Order Statistics
      draftPOs: statsRow[0].draftPOs,
      issuedPOs: statsRow[0].issuedPOs,
      partiallyReceivedPOs: statsRow[0].partiallyReceivedPOs,
      completedPOs: statsRow[0].completedPOs,

      // Warehouse Statistics
      totalWarehouses: statsRow[0].totalWarehouses,
      totalSettings: statsRow[0].totalSettings,

      // Breakdown by Category
      categoryStats: categoryStats,

      // Monthly Trend Data
      monthlyMovement: monthlyMovement,

      // Cache metadata
      cachedAt: new Date().toISOString(),
      cacheExpireAt: new Date(Date.now() + statsCache.TTL).toISOString(),
    };

    // Update cache
    updateStatsCache(stats);

    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Audit logs ────────────────────────────────────────────────
app.get('/api/audit-logs', requireAuth, async (req, res) => {
  // Allow audit viewing for most roles (not just strict permission check)
  const allowedRoles = ['Director', 'Administrator', 'Manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Audit logs require elevated privileges.' });
  }

  const { page, limit, offset } = paginate(req.query);
  const { searchText = '', username = '', user_role = '', actionType = '', module = '', dateFrom = '', dateTo = '' } = req.query;

  try {
    // Build WHERE clause and filter at database level for performance
    let whereConditions = ['1=1'];
    let params = [];

    if (searchText) {
      whereConditions.push(`(description LIKE ? OR username LIKE ? OR action_type LIKE ?)`);
      params.push(`%${searchText}%`, `%${searchText}%`, `%${searchText}%`);
    }
    if (username) {
      whereConditions.push('username = ?');
      params.push(username);
    }
    if (user_role) {
      whereConditions.push('user_role = ?');
      params.push(user_role);
    }
    if (actionType) {
      whereConditions.push('action_type = ?');
      params.push(actionType);
    }
    if (dateFrom) {
      whereConditions.push('created_at >= ?');
      params.push(`${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      whereConditions.push('created_at <= ?');
      params.push(`${dateTo}T23:59:59`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const [[{ total }]] = await getPool().query(`SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereClause}`, params);

    // Get paginated results
    const [rows] = await getPool().query(
      `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data: rows || [], total: total || 0, page, limit });
  } catch (e) {
    console.error('Audit logs error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Material Requests ─────────────────────────────────────────
app.get('/api/material-requests', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  // Roles that can see ALL requests; everyone else sees only their own
  const canSeeAll = ['Director', 'Administrator', 'Manager'].includes(req.user.role);
  const whereClause = canSeeAll ? '' : 'WHERE mr.requested_by_id = ?';
  const countWhere = canSeeAll ? '' : 'WHERE requested_by_id = ?';
  const queryParams = canSeeAll ? [limit, offset] : [req.user.id, limit, offset];
  const countParams = canSeeAll ? [] : [req.user.id];
  try {
    const [[{ total }]] = await getPool().query(
      `SELECT COUNT(*) AS total FROM material_requests ${countWhere}`, countParams
    );
    const [rows] = await getPool().query(`
      SELECT mr.*, m.name AS material_name, m.material_code, m.current_stock, m.unit_of_measure,
             u1.full_name AS requester_name, u1.username AS requester_username, u2.full_name AS approver_name
      FROM material_requests mr
      LEFT JOIN materials m ON mr.material_id    = m.id
      LEFT JOIN users u1    ON mr.requested_by_id = u1.id
      LEFT JOIN users u2    ON mr.approved_by_id  = u2.id
      ${whereClause}
      ORDER BY mr.id DESC LIMIT ? OFFSET ?`, queryParams);
    res.json({ data: rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/material-requests', requireAuth, async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  if (!req.body.purpose || !String(req.body.purpose).trim()) return res.status(422).json({ error: 'Purpose is required' });
  const { material_id, quantity, purpose, priority, remarks, required_date } = req.body;
  const requestedQuantity = toInt(quantity);
  if (requestedQuantity <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  const code = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const [r] = await getPool().query(
      `INSERT INTO material_requests (request_code,material_id,quantity,purpose,priority,remarks,requested_by_id,required_date,status)
       VALUES (?,?,?,?,?,?,?,?,'Pending')`,
      [code, material_id, requestedQuantity, String(purpose).trim(), priority || 'Normal', remarks || null, req.user.id, required_date || null]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_REQUEST', `Created request ${code}`, req);
    invalidateStatsCache();
    res.json({ id: r.insertId, request_code: code, status: 'Pending' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


app.put('/api/material-requests/:id/approve', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[mr]] = await conn.query('SELECT * FROM material_requests WHERE id=?', [req.params.id]);
    if (!mr) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Request not found' }); }
    if (mr.status !== 'Pending') { await conn.rollback(); conn.release(); return res.status(400).json({ error: `Request is already ${mr.status}` }); }

    const [[mat]] = await conn.query('SELECT id, name, current_stock, unit_of_measure FROM materials WHERE id=?', [mr.material_id]);
    if (!mat) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Material not found' }); }
    if (mat.current_stock < mr.quantity) {
      await conn.rollback(); conn.release();
      return res.status(400).json({
        error: `Insufficient stock. Requested: ${mr.quantity} ${mat.unit_of_measure || 'units'}, Available: ${mat.current_stock} ${mat.unit_of_measure || 'units'}.`
      });
    }

    const txCode = `OUT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const empId = await getEmployeeId(mr.requested_by_id);
    await conn.query(
      `INSERT INTO stock_transactions (transaction_code, transaction_type, material_id, quantity, employee_dept_id, purpose, issued_by_id, remarks)
       VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?)`,
      [txCode, mr.material_id, mr.quantity, empId || null, mr.purpose || 'Material Request', req.user.id, req.body.remarks || '']
    );
    await conn.query('UPDATE materials SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?', [mr.quantity, mr.material_id]);
    await conn.query(
      `UPDATE material_requests SET status='Issued', approved_by_id=?, approval_remarks=?, approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks || '', req.params.id]
    );

    await conn.commit();
    conn.release();

    await logAudit(req.user.id, req.user.username, req.user.role, 'APPROVE_AND_ISSUE_REQUEST',
      `Approved & issued request ${mr.request_code} — ${mr.quantity} × ${mat.name} (${txCode})`, req);

    if (mr.requested_by_id) {
      try {
        await pool.query(
          `INSERT INTO system_notifications (user_id, title, message, type) VALUES (?,?,?,?)`,
          [mr.requested_by_id,
          `Request ${mr.request_code} Approved & Issued`,
          `Your material request (${mr.request_code}) for ${mr.quantity} × ${mat.name} was approved and issued by ${req.user.full_name || req.user.username}. Please collect your materials.`,
            'success']
        );
      } catch (_) { }
    }

    invalidateStatsCache();
    res.json({ success: true, transaction_code: txCode, issued_quantity: mr.quantity, material: mat.name });
  } catch (e) {
    try { await conn.rollback(); conn.release(); } catch (_) { }
    console.error('❌ Approve+Issue error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/material-requests/:id/reject', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  try {
    const [[mr]] = await getPool().query('SELECT * FROM material_requests WHERE id=?', [req.params.id]);
    if (!mr) return res.status(404).json({ error: 'Request not found' });
    if (!req.body.remarks || !String(req.body.remarks).trim()) {
      return res.status(400).json({ error: 'A rejection reason is required' });
    }
    await getPool().query(
      `UPDATE material_requests SET status='Rejected',approved_by_id=?,approval_remarks=?,approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'REJECT_REQUEST',
      `Rejected request #${req.params.id}: ${req.body.remarks}`, req);
    if (mr.requested_by_id) {
      try {
        await getPool().query(
          `INSERT INTO system_notifications (user_id, title, message, type) VALUES (?,?,?,?)`,
          [mr.requested_by_id,
          `Request ${mr.request_code} Rejected`,
          `Your material request (${mr.request_code}) was rejected. Reason: ${req.body.remarks}`,
            'error']
        );
      } catch (_) { }
    }
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Issue a material request (kept for backward compat — approve now auto-issues) ──
app.put('/api/material-requests/:id/issue', requireAuth, requirePermission('inventory:stockOut'), async (req, res) => {
  try {
    const [[mr]] = await getPool().query('SELECT mr.*, m.id AS mat_id FROM material_requests mr LEFT JOIN materials m ON mr.material_id = m.id WHERE mr.id=?', [req.params.id]);
    if (!mr) return res.status(404).json({ error: 'Request not found' });
    if (mr.status !== 'Approved') return res.status(400).json({ error: `Can only issue Approved requests (current status: ${mr.status})` });

    const empId = await getEmployeeId(mr.requested_by_id);
    const code = `OUT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code, transaction_type, material_id, quantity, employee_dept_id, purpose, issued_by_id, remarks)
       VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?)`,
      [code, mr.material_id, mr.quantity, empId || null, mr.purpose || 'Material Request Issue', req.user.id, req.body.remarks || '']
    );
    await getPool().query('UPDATE materials SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?', [mr.quantity, mr.material_id]);
    await getPool().query(`UPDATE material_requests SET status='Issued', approved_by_id=COALESCE(approved_by_id,?) WHERE id=?`, [req.user.id, req.params.id]);

    if (mr.requested_by_id) {
      try {
        await getPool().query(
          `INSERT INTO system_notifications (user_id, title, message, type) VALUES (?,?,?,?)`,
          [mr.requested_by_id,
          `Materials Issued for ${mr.request_code}`,
          `Your requested materials have been issued by ${req.user.full_name || req.user.username}. Please collect them.`,
            'info']
        );
      } catch (_) { }
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'ISSUE_REQUEST',
      `Issued materials for request #${req.params.id} (${code})`, req);
    invalidateStatsCache();
    res.json({ success: true, transaction_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ── Disposals ─────────────────────────────────────────────────
app.get('/api/disposals', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM material_disposals');
    const [rows] = await getPool().query(`
      SELECT d.*, m.name AS material_name, m.material_code, m.unit_of_measure,
             u1.full_name AS recorder_name, u2.full_name AS approver_name
      FROM material_disposals d
      LEFT JOIN materials m ON d.material_id    = m.id
      LEFT JOIN users u1    ON d.recorded_by_id  = u1.id
      LEFT JOIN users u2    ON d.approved_by_id  = u2.id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data: rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/disposals', requireAuth, requirePermission('disposal:create'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id', 'quantity', 'reason']);
  if (err) return res.status(400).json({ error: err });
  const { material_id, quantity, reason, disposal_type, remarks } = req.body;
  const disposalQuantity = toInt(quantity);
  if (disposalQuantity <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });
  const code = `DISP-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const [r] = await getPool().query(
      `INSERT INTO material_disposals (disposal_code,material_id,quantity,reason,disposal_type,remarks,recorded_by_id,status)
       VALUES (?,?,?,?,?,?,?,'Pending Approval')`,
      [code, material_id, disposalQuantity, reason, disposal_type || 'Damaged', remarks, req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_DISPOSAL', `Recorded disposal ${code}`, req);
    res.json({ id: r.insertId, disposal_code: code, status: 'Pending Approval' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/disposals/:id/approve', requireAuth, requirePermission('disposal:approve'), async (req, res) => {
  try {
    const [[d]] = await getPool().query('SELECT * FROM material_disposals WHERE id=?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Disposal not found' });
    if (d.status !== 'Pending Approval') return res.status(400).json({ error: `Cannot approve a disposal with status: ${d.status}` });
    await getPool().query('UPDATE materials SET current_stock=GREATEST(0,current_stock-?) WHERE id=?', [d.quantity, d.material_id]);
    await getPool().query(`UPDATE material_disposals SET status='Approved',approved_by_id=?,approved_at=NOW() WHERE id=?`, [req.user.id, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'APPROVE_DISPOSAL', `Approved disposal #${req.params.id}`, req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reject disposal ───────────────────────────────────────────
app.put('/api/disposals/:id/reject', requireAuth, requirePermission('disposal:approve'), async (req, res) => {
  try {
    const [[d]] = await getPool().query('SELECT * FROM material_disposals WHERE id=?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Disposal not found' });
    if (d.status !== 'Pending Approval') return res.status(400).json({ error: `Cannot reject a disposal with status: ${d.status}` });
    await getPool().query(
      `UPDATE material_disposals SET status='Rejected', approved_by_id=?, approved_at=NOW() WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'REJECT_DISPOSAL', `Rejected disposal #${req.params.id}`, req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── System Settings ───────────────────────────────────────────
const DEFAULT_SETTINGS = {
  organization_name: 'Store Management System', organization_logo: '',
  currency: 'ETB', currency_symbol: 'Br',
  low_stock_threshold: '5', session_timeout: '12',
  date_format: 'DD/MM/YYYY', timezone: 'UTC+3',
  allow_negative_stock: 'false', require_approval_stock_out: 'false',
  system_email: '',
  pwd_min_length: '8', pwd_require_uppercase: 'true',
  pwd_require_number: 'true', pwd_require_special: 'false', pwd_expiry_days: '0',
  theme_presets: '', active_theme: 'default',
};

app.get('/api/system-settings', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT setting_key,setting_value FROM system_settings');
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/system-settings', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const updates = req.body;
  if (typeof updates !== 'object' || Array.isArray(updates))
    return res.status(400).json({ error: 'Body must be a key-value object' });
  try {
    for (const [key, value] of Object.entries(updates))
      await getPool().query(
        'INSERT INTO system_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
        [key, String(value), String(value)]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_SETTINGS', `Updated: ${Object.keys(updates).join(', ')}`, req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Backup export (JSON) ─────────────────────────────────────
app.get('/api/backup/export', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [materials] = await getPool().query('SELECT * FROM materials');
    const [categories] = await getPool().query('SELECT * FROM categories');
    const [suppliers] = await getPool().query('SELECT * FROM suppliers');
    const [employees] = await getPool().query('SELECT * FROM employees_departments');
    const [transactions] = await getPool().query('SELECT * FROM stock_transactions');
    const [transfers] = await getPool().query('SELECT * FROM stock_transfers');
    const [users] = await getPool().query('SELECT id,username,full_name,email,role,status,created_at FROM users');
    const [auditLogs] = await getPool().query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000');
    const data = { materials, categories, suppliers, employees, transactions, transfers, users, auditLogs, exportedAt: new Date().toISOString(), version: '3.0' };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="store_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Backup management (SQL) ─────────────────────────────────────
app.get('/api/backups', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM backups ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backups', requireAuth, requirePermission('system:configure'), async (req, res) => {
  // Alias to trigger backup (same as /api/backup/trigger) for API consistency
  req.url = '/api/backup/trigger';
  app._router.handle(req, res);
});

app.get('/api/backups/:id/download', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Backup not found' });

    // SECURITY: Validate backup filename - only alphanumeric, underscore, dash, and .json/.sql
    if (!/^[a-zA-Z0-9_-]+\.(json|sql)$/.test(b.file_name)) {
      return res.status(400).json({ error: 'Invalid backup filename format' });
    }

    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);

    // SECURITY: Prevent path traversal - ensure normalized path is within backups directory
    const backupsDir = path.normalize(path.join(__dirname, '..', 'server', 'backups'));
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(backupsDir)) {
      return res.status(400).json({ error: 'Invalid backup path' });
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.download(filePath, b.file_name);
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.post('/api/backups/:id/restore', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Backup not found' });

    // SECURITY: Validate backup filename - only alphanumeric, underscore, dash, and .json/.sql
    if (!/^[a-zA-Z0-9_-]+\.(json|sql)$/.test(b.file_name)) {
      return res.status(400).json({ error: 'Invalid backup filename format' });
    }

    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);

    // SECURITY: Prevent path traversal - ensure normalized path is within backups directory
    const backupsDir = path.normalize(path.join(__dirname, '..', 'server', 'backups'));
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(backupsDir)) {
      return res.status(400).json({ error: 'Invalid backup path' });
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    // SECURITY: Use execFile instead of exec to prevent command injection
    execFile('mysql', ['-u', 'root', 'store_management_db'], { timeout: 60000 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Restore error:', stderr || error.message);
        await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_RESTORE_FAILED', `Restore failed for backup ${b.file_name}`, req);
        return res.status(500).json({ error: 'Restore failed' });
      }
      await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_RESTORE', `Restored backup ${b.file_name}`, req);
      res.json({ success: true, message: 'Database restored' });
    });

    // Pipe file to mysql
    fs.createReadStream(filePath).pipe(process.stdin);
  } catch (e) {
    console.error('Restore error:', e);
    res.status(500).json({ error: 'Database operation failed' });
  }
});

app.delete('/api/backups/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Backup not found' });

    // SECURITY: Validate backup filename - only alphanumeric, underscore, dash, and .json/.sql
    if (!/^[a-zA-Z0-9_-]+\.(json|sql)$/.test(b.file_name)) {
      return res.status(400).json({ error: 'Invalid backup filename format' });
    }

    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);

    // SECURITY: Prevent path traversal - ensure normalized path is within backups directory
    const backupsDir = path.normalize(path.join(__dirname, '..', 'server', 'backups'));
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(backupsDir)) {
      return res.status(400).json({ error: 'Invalid backup path' });
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await getPool().query('DELETE FROM backups WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_BACKUP', `Deleted backup ${b.file_name}`, req);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete backup error:', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});


// ── Warehouses ────────────────────────────────────────────────
app.get('/api/warehouses', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM warehouses ORDER BY name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/warehouses', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const { code, name, address, manager_name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });
  try {
    const [r] = await getPool().query('INSERT INTO warehouses (code, name, address, manager_name) VALUES (?, ?, ?, ?)', [code, name, address || '', manager_name || '']);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_WAREHOUSE', `Created warehouse ${name}`, req);
    invalidateStatsCache();
    console.log('✅ Warehouse created:', { id: r.insertId, code, name });
    res.json({ id: r.insertId, code, name, address, manager_name });
  } catch (e) {
    console.error('❌ Warehouse creation error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/warehouses/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const { code, name, address, manager_name } = req.body;
  try {
    await getPool().query('UPDATE warehouses SET code=?, name=?, address=?, manager_name=? WHERE id=?', [code, name, address || '', manager_name || '', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_WAREHOUSE', `Updated warehouse #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/warehouses/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    await getPool().query('DELETE FROM warehouses WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_WAREHOUSE', `Deleted warehouse #${req.params.id}`, req);
    invalidateStatsCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Orders ───────────────────────────────────────────
app.get('/api/purchase-orders', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT po.*, s.name as supplier_name, u.full_name as creator_name 
      FROM purchase_orders po 
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_id = u.id
      ORDER BY po.id DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/purchase-orders/:id/items', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT poi.*, m.name as material_name, m.material_code, m.unit_of_measure 
      FROM po_items poi 
      LEFT JOIN materials m ON poi.material_id = m.id
      WHERE poi.po_id = ?
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/purchase-orders', requireAuth, async (req, res) => {
  const { supplier_id, expected_date, remarks, items } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ error: 'Supplier and items are required' });

  const po_number = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
  let total_amount = 0;
  items.forEach(item => total_amount += (item.quantity_ordered * item.unit_cost));

  try {
    const [r] = await getPool().query(`
      INSERT INTO purchase_orders (po_number, supplier_id, expected_date, remarks, total_amount, created_by_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Draft')
    `, [po_number, supplier_id, expected_date, remarks, total_amount, req.user.id]);

    const po_id = r.insertId;

    for (const item of items) {
      await getPool().query(`
        INSERT INTO po_items (po_id, material_id, quantity_ordered, unit_cost)
        VALUES (?, ?, ?, ?)
      `, [po_id, item.material_id, item.quantity_ordered, item.unit_cost]);
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_PO', `Created Purchase Order ${po_number}`, req);
    res.json({ id: po_id, po_number, status: 'Draft' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/purchase-orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    await getPool().query('UPDATE purchase_orders SET status=? WHERE id=?', [status, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PO', `Updated PO #${req.params.id} to ${status}`, req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/purchase-orders/:id/send-email', requireAuth, async (req, res) => {
  try {
    // 1. Fetch PO and supplier details
    const [[po]] = await getPool().query(`
      SELECT po.*, s.name AS supplier_name, s.email AS supplier_email
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `, [req.params.id]);

    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    if (!po.supplier_email) return res.status(400).json({ error: 'Supplier does not have an email address configured' });

    // 2. Fetch PO items
    const [items] = await getPool().query(`
      SELECT poi.*, m.name AS material_name, m.material_code, m.unit_of_measure
      FROM po_items poi
      LEFT JOIN materials m ON poi.material_id = m.id
      WHERE poi.po_id = ?
    `, [req.params.id]);

    // 3. Build PO items list for email
    const itemRows = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.material_code}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.material_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity_ordered} ${item.unit_of_measure || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.unit_cost.toFixed(2)} Birr</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${(item.quantity_ordered * item.unit_cost).toFixed(2)} Birr</td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h3 style="color: #4f46e5; margin-top: 0;">Purchase Order Request</h3>
        <p>Dear <strong>${po.supplier_name}</strong>,</p>
        <p>Please find our purchase order request details below:</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; width: 140px;">PO Number:</td>
              <td style="padding: 4px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${po.po_number}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569;">Expected Date:</td>
              <td style="padding: 4px 0; color: #0f172a;">${po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569;">Remarks:</td>
              <td style="padding: 4px 0; color: #0f172a;">${po.remarks || '—'}</td>
            </tr>
          </table>
        </div>

        <h4 style="color: #1e293b; margin-top: 24px; margin-bottom: 8px;">Order Details</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Code</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Material</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1;">Qty</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Unit Cost</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr style="font-weight: bold;">
              <td colspan="4" style="padding: 12px 8px 8px 8px; text-align: right;">Grand Total:</td>
              <td style="padding: 12px 8px 8px 8px; text-align: right; color: #4f46e5; font-size: 15px;">${po.total_amount.toFixed(2)} Birr</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top: 24px;">Please review the order details and let us know if you require any clarifications.</p>
        <p style="margin-bottom: 0;">Sincerely,<br/><strong>Store Management Team</strong></p>
      </div>
    `;

    // 4. Send the Email
    await sendEmail({
      to: po.supplier_email,
      subject: `[SMS] Purchase Order Request - ${po.po_number}`,
      text: `Hello ${po.supplier_name},\n\nPlease find purchase order ${po.po_number} attached. Total amount: ${po.total_amount} Birr.\n\nBest regards,\nStore Management Team`,
      html: emailHtml,
    });

    // 5. Update Status
    await getPool().query("UPDATE purchase_orders SET status='Sent' WHERE id=?", [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'SEND_PO_EMAIL', `Emailed PO ${po.po_number} to ${po.supplier_name}`, req);

    res.json({ success: true, status: 'Sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Document Uploads (Transaction Attachments) ────────────────

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/pdf|image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});
const uploadTypeExtensions = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp' };
const saveUploadedImage = (file, userId) => {
  const validation = validateImageFile(file.buffer, file.mimetype, 5 * 1024 * 1024);
  if (!validation.valid) return { error: validation.error };
  const extension = uploadTypeExtensions[validation.type];
  const filename = `attachment_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer, { flag: 'wx' });
  return { filename };
};
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// ── Employee Document Upload ──────────────────────────────────
app.post('/api/employees/:id/upload-document', requireAuth, requirePermission('employee:update'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!req.file.mimetype.match(/pdf|image/)) return res.status(400).json({ error: 'Only PDF and image files are allowed' });
    if (req.file.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'File size must be less than 10MB' });

    // Generate filename with correct extension
    const mimeToExt = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = mimeToExt[req.file.mimetype] || 'bin';
    const filename = `emp_${req.params.id}_${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    // Update employee record with document URL
    const documentUrl = `/uploads/${filename}`;
    await getPool().query('UPDATE employees_departments SET document_url=? WHERE id=?', [documentUrl, req.params.id]);

    res.json({ success: true, document_url: documentUrl, message: 'Document uploaded successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const saved = saveUploadedImage(req.file, req.user.id);
  if (saved.error) return res.status(400).json({ error: saved.error });
  res.json({ url: `/uploads/${saved.filename}`, filename: req.file.originalname });
});

// ── Bulk Import (Materials) ───────────────────────────────────
app.post('/api/import/materials', requireAuth, requirePermission('material:create'), async (req, res) => {
  const { items } = req.body; // Array of objects
  if (!items || !items.length) return res.status(400).json({ error: 'No data provided' });
  let successCount = 0;
  let errors = [];
  try {
    for (const item of items) {
      try {
        await getPool().query(`
          INSERT INTO materials (material_code, name, category_id, unit_of_measure, min_stock_level, current_stock, unit_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [item.material_code, item.name, item.category_id || null, item.unit_of_measure || 'Pcs', item.min_stock_level || 0, item.current_stock || 0, item.unit_cost || 0]);
        successCount++;
      } catch (e) {
        errors.push({ code: item.material_code, error: e.message });
      }
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'BULK_IMPORT', `Imported ${successCount} materials`, req);
    res.json({ success: true, imported: successCount, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DB Backup (mysqldump) ─────────────────────────────────────
app.post('/api/backup/trigger', requireAuth, requirePermission('system:configure'), (req, res) => {
  const backupDir = path.join(__dirname, '..', 'server', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const filename = `backup_${Date.now()}.sql`;
  const filepath = path.join(backupDir, filename);

  // Note: requires mysqldump in PATH. Hardcoding user/pass for local environment
  const cmd = `mysqldump -u root store_management_db > "${filepath}"`;
  exec(cmd, async (error) => {
    if (error) {
      console.error('Backup failed:', error);
      return res.status(500).json({ error: 'Backup failed' });
    }
    const { size } = fs.statSync(filepath);
    await getPool().query(
      'INSERT INTO backups (file_name,status,size_bytes,type,created_by) VALUES (?,\'Success\',?,\'Manual\',?)',
      [filename, size, req.user.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_BACKUP', 'Triggered database backup', req);
    res.json({ success: true, filename });
  });
});


// ── Tasks ─────────────────────────────────────────────────────
// PRIVACY: Only return tasks assigned to current user, created by them, or (admin can see all)
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    // Admins/Grand Directors can see all tasks, others see only their own
    const isAdmin = req.user.role === 'Director' || req.user.role === 'Administrator';
    const hasTaskManage = await hasPermission(req.user, 'task:manage');

    let query = `
      SELECT t.*,
        u1.full_name AS assigned_to_name, u1.username AS assigned_to_username,
        u2.full_name AS assigned_by_name, u2.username AS assigned_by_username
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to_id = u1.id
      LEFT JOIN users u2 ON t.assigned_by_id = u2.id
    `;

    // Authorization: Users with task:manage permission can see all tasks
    // Otherwise, users only see tasks assigned to them (not tasks they created)
    if (!isAdmin && !hasTaskManage) {
      query += ` WHERE t.assigned_to_id = ?`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const [rows] = isAdmin || hasTaskManage
      ? await getPool().query(query)
      : await getPool().query(query, [req.user.id]);

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', requireAuth, requirePermission('task:manage'), async (req, res) => {
  const err = validateRequired(req.body, ['title']);
  if (err) return res.status(400).json({ error: err });
  const { title, description, assigned_to_id, priority, due_date } = req.body;
  try {
    const [r] = await getPool().query(
      `INSERT INTO tasks (title, description, assigned_to_id, assigned_by_id, priority, due_date)
       VALUES (?,?,?,?,?,?)`,
      [title, description || '', assigned_to_id || null, req.user.id, priority || 'Normal', due_date || null]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_TASK', `Created task: ${title}`, req);
    // Fetch back the created task with joined names
    const [[task]] = await getPool().query(`
      SELECT t.*,
        u1.full_name AS assigned_to_name, u1.username AS assigned_to_username,
        u2.full_name AS assigned_by_name, u2.username AS assigned_by_username
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to_id = u1.id
      LEFT JOIN users u2 ON t.assigned_by_id = u2.id
      WHERE t.id = ?
    `, [r.insertId]);

    // PRIVACY: Send notification ONLY to the assigned user (not broadcast)
    if (assigned_to_id) {
      const taskLink = `Task "${title}" assigned by ${req.user.full_name || req.user.username}`;
      await createNotification(
        assigned_to_id,
        'New Task Assigned',
        `${taskLink}. Priority: ${priority || 'Normal'}. Due: ${due_date || 'No deadline'}.`,
        'task',
        req.user
      );
      try {
        const [[assignee]] = await getPool().query('SELECT email, full_name, username FROM users WHERE id = ?', [assigned_to_id]);
        if (assignee && assignee.email) {
          sendEmail({
            to: assignee.email,
            subject: `[SMS] New Task Assigned: ${title}`,
            text: `Hello ${assignee.full_name || assignee.username},\n\nA new task has been assigned to you by ${req.user.full_name || req.user.username}.\n\nTask Details:\n- Title: ${title}\n- Description: ${description || 'No description'}\n- Priority: ${priority || 'Normal'}\n- Due Date: ${due_date || 'No due date'}\n\nPlease log in to the Store Management System to view and manage this task.\n\nBest regards,\nStore Management System Support`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="color: #4f46e5; margin-top: 0;">New Task Assignment</h3>
                <p>Hello <strong>${assignee.full_name || assignee.username}</strong>,</p>
                <p>A new task has been assigned to you by <strong>${req.user.full_name || req.user.username}</strong>.</p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #475569; width: 120px;">Title:</td>
                      <td style="padding: 6px 0; color: #0f172a;">${title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #475569; vertical-align: top;">Description:</td>
                      <td style="padding: 6px 0; color: #0f172a; white-space: pre-wrap;">${description || '—'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #475569;">Priority:</td>
                      <td style="padding: 6px 0; color: #0f172a;">
                        <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; background: #fee2e2; color: #991b1b;">
                          ${priority || 'Normal'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: bold; color: #475569;">Due Date:</td>
                      <td style="padding: 6px 0; color: #0f172a;">${due_date || '—'}</td>
                    </tr>
                  </table>
                </div>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">This is an automated notification from the Store Management System. Please do not reply directly.</p>
              </div>
            `
          }).catch(mailErr => console.error('Failed to trigger email helper:', mailErr));
        }
      } catch (e) {
        console.error('Email selection or dispatcher error:', e);
      }
    }

    // Broadcast real-time update to assigned user
    if (assigned_to_id) {
      realtimeService.broadcastToUser(assigned_to_id, 'task:assigned', {
        id: task.id,
        title: task.title,
        priority: task.priority,
        assigned_by: req.user.full_name || req.user.username,
        timestamp: new Date().toISOString(),
      });
    }

    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', requireAuth, requirePermission('task:manage'), async (req, res) => {
  const { title, description, assigned_to_id, status, priority, due_date } = req.body;
  try {
    const [[existing]] = await getPool().query('SELECT id, assigned_to_id, assigned_by_id, status AS old_status FROM tasks WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    // SECURITY: Verify user is authorized to update this task
    // Only allow if: user is the assignee, creator, or has task:manage permission
    const isAdmin = req.user.role === 'Director' || req.user.role === 'Administrator';
    const isAssignee = existing.assigned_to_id === req.user.id;
    const isCreator = existing.assigned_by_id === req.user.id;
    const hasTaskManage = await hasPermission(req.user, 'task:manage');

    if (!isAdmin && !isAssignee && !isCreator && !hasTaskManage) {
      return res.status(403).json({ error: 'You are not authorized to update this task' });
    }

    const completedAt = status === 'Completed' ? 'NOW()' : 'NULL';
    await getPool().query(
      `UPDATE tasks SET title=?, description=?, assigned_to_id=?, status=?, priority=?, due_date=?, completed_at=${completedAt} WHERE id=?`,
      [title, description || '', assigned_to_id || null, status || 'Pending', priority || 'Normal', due_date || null, req.params.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_TASK', `Updated task #${req.params.id}`, req);

    // NOTIFICATION: If task is being re-assigned to a new user, notify the new assignee
    if (
      assigned_to_id &&
      String(assigned_to_id) !== String(existing.assigned_to_id) &&
      String(assigned_to_id) !== String(req.user.id)
    ) {
      await createNotification(
        assigned_to_id,
        'Task Assigned to You',
        `Task "${title}" has been assigned to you by ${req.user.full_name || req.user.username}. Priority: ${priority || 'Normal'}. Due: ${due_date || 'No deadline'}.`,
        'task',
        req.user
      );
      realtimeService.broadcastToUser(assigned_to_id, 'task:assigned', { taskId: req.params.id, title });
    }

    // NOTIFICATION: If status changed to Completed, notify assignee and creator
    if (status === 'Completed' && existing.old_status !== 'Completed') {
      const [[taskData]] = await getPool().query(
        'SELECT title FROM tasks WHERE id = ?',
        [req.params.id]
      );

      // Notify the task assignee if they're not the one completing it
      if (existing.assigned_to_id && existing.assigned_to_id !== req.user.id) {
        await createNotification(
          existing.assigned_to_id,
          'Task Completed',
          `Task "${taskData.title}" has been marked as completed by ${req.user.full_name || req.user.username}.`,
          'task',
          req.user
        );
      }

      // Notify the task creator if they're not the one completing it
      if (existing.assigned_by_id && existing.assigned_by_id !== req.user.id) {
        await createNotification(
          existing.assigned_by_id,
          'Task Completed',
          `Task "${taskData.title}" assigned to ${assigned_to_id || 'unassigned'} has been completed by ${req.user.full_name || req.user.username}.`,
          'task',
          req.user
        );
      }
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', requireAuth, requirePermission('task:manage'), async (req, res) => {
  try {
    const [[existing]] = await getPool().query('SELECT id, assigned_by_id FROM tasks WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    // SECURITY: Only task creator or admins can delete
    const isAdmin = req.user.role === 'Director' || req.user.role === 'Administrator';
    const isCreator = existing.assigned_by_id === req.user.id;
    const hasTaskManage = await hasPermission(req.user, 'task:manage');

    if (!isAdmin && !isCreator && !hasTaskManage) {
      return res.status(403).json({ error: 'Only the task creator can delete this task' });
    }

    await getPool().query('DELETE FROM tasks WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_TASK', `Deleted task #${req.params.id}`, req);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Receipts (STOCK_OUT vouchers accessible after sale) ───────
app.get('/api/receipts', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query(
      "SELECT COUNT(*) AS total FROM stock_transactions WHERE transaction_type='STOCK_OUT'"
    );
    const [rows] = await getPool().query(`
      SELECT t.*,
        m.name AS material_name, m.material_code, m.unit_of_measure, m.unit_cost AS material_unit_cost,
        ed.name AS receiver_name, ed.department_name AS receiver_department, ed.type AS receiver_type,
        u1.full_name AS issued_by_name
      FROM stock_transactions t
      LEFT JOIN materials m            ON t.material_id      = m.id
      LEFT JOIN employees_departments ed ON t.employee_dept_id = ed.id
      LEFT JOIN users u1               ON t.issued_by_id     = u1.id
      WHERE t.transaction_type = 'STOCK_OUT'
      ORDER BY t.transaction_date DESC
      LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data: rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── In-App System Notifications helper & endpoints ────────────
async function createNotification(userId, title, message, type = 'info', sender = null) {
  try {
    const senderId = sender?.id ?? null;
    const senderName = sender?.full_name || sender?.username || null;
    const senderAvatar = sender?.avatar_url || null;

    // Deduplication: skip if an unread notification with the same title already
    // exists for this user within the last 24 hours (prevents alert flooding).
    if (type !== 'message' && type !== 'info') {
      const [[existing]] = await getPool().query(
        `SELECT id FROM system_notifications
         WHERE user_id = ? AND title = ? AND is_read = FALSE
           AND created_at >= NOW() - INTERVAL 24 HOUR
         LIMIT 1`,
        [userId, title]
      );
      if (existing) {
        console.log(`⏭️ Skipping duplicate notification: "${title}" for user ${userId}`);
        return;
      }
    }

    console.log(`📬 Creating notification: type=${type}, title="${title}", userId=${userId}`);

    await getPool().query(
      `INSERT INTO system_notifications (user_id, title, message, type, sender_id, sender_name, sender_avatar) VALUES (?,?,?,?,?,?,?)`,
      [userId, title, message, type, senderId, senderName, senderAvatar]
    );

    console.log(`✅ Notification created successfully`);

    // Dispatch email notification to user
    const [[user]] = await getPool().query(`SELECT email, full_name FROM users WHERE id = ?`, [userId]);
    if (user && user.email) {
      sendEmail({
        to: user.email,
        subject: `[Store System] ${title}`,
        text: `Hello ${user.full_name || 'User'},\n\n${message}\n\nBest regards,\nStore Management System`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #4f46e5; margin-top: 0;">${title}</h3>
            <p>Hello <strong>${user.full_name || 'User'}</strong>,</p>
            <div style="font-size: 14px; line-height: 1.6; background: #f8fafc; padding: 14px; border-left: 4px solid #4f46e5; margin: 16px 0; border-radius: 4px;">
              ${message}
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">This is an automated system notification from Store Management System.</p>
          </div>
        `
      }).catch(err => console.error('Failed sending notification email:', err.message));
    }
  } catch (e) {
    console.error('❌ Failed to create system notification:', e.message, e.stack);
  }
}


// ── Server-Sent Events (SSE) for Real-time Updates ────────────
// ── Server-Sent Events (SSE) for Real-time Updates ────────────
// Custom auth for SSE - check Authorization header, then query param, then cookie.
const requireAuthSSE = (req, res, next) => {
  let token;
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) {
    token = h.slice(7);
  }

  // EventSource cannot set Authorization headers, so use the compact token query fallback.
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token && req.cookies?.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    console.warn('⚠️ SSE: No auth token found (cookie, header, or query param)');
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.token = token;

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log(`✅ SSE Token verified for user: ${req.user.username} (${req.user.role})`);
    next();
  } catch (err) {
    console.error(`❌ SSE Token verification failed: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.get('/api/events', requireAuthSSE, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // IMPORTANT: Use the CORS origin from env, NOT wildcard (wildcard breaks credentials)
  const origin = req.headers.origin;
  if (origin) {
    const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
      .split(',')
      .map(o => o.trim());
    if (corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  const userId = req.user.id;
  console.log(`✅ SSE client connected: user ${userId}`);

  // Register this client for real-time updates
  realtimeService.addClient(userId, res);

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write('event: heartbeat\n');
    res.write(`data: ${new Date().toISOString()}\n\n`);
  }, 30000);

  // Send any queued updates from while user was offline
  const queuedUpdates = realtimeService.getQueuedUpdates(userId);
  queuedUpdates.forEach((update) => {
    res.write(`event: ${update.event}\ndata: ${JSON.stringify(update.data)}\n\n`);
  });

  // Clean up when client disconnects
  req.on('close', () => {
    console.log(`❌ SSE client disconnected: user ${userId}`);
    clearInterval(heartbeatInterval);
    realtimeService.removeClient(userId);
    res.end();
  });

  req.on('error', () => {
    console.error(`⚠️ SSE client error: user ${userId}`);
    clearInterval(heartbeatInterval);
    realtimeService.removeClient(userId);
    res.end();
  });
});

// ── Notifications ────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    console.log(`📬 Fetching notifications for user ${req.user.id}...`);

    // Try to query, if table doesn't exist, return empty array
    let rows = [];
    try {
      const result = await getPool().query(
        `SELECT id, user_id, title, message, type, sender_id, sender_name, sender_avatar, is_read, created_at
         FROM system_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.user.id]
      );
      rows = result[0] || [];
    } catch (tableErr) {
      console.warn('⚠️ system_notifications table query failed (might not exist yet):', tableErr.message);
      // Create table if it doesn't exist
      try {
        await getPool().query(`
          CREATE TABLE IF NOT EXISTS system_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            type VARCHAR(50) DEFAULT 'info',
            sender_id INT NULL,
            sender_name VARCHAR(255) NULL,
            sender_avatar VARCHAR(255) NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
          )
        `);
        console.log('✅ system_notifications table created');
        rows = [];
      } catch (createErr) {
        console.error('❌ Failed to create system_notifications table:', createErr.message);
        rows = [];
      }
    }

    console.log(`✅ Found ${rows.length} notifications`);
    res.json(rows);
  } catch (e) {
    console.error('❌ /notifications error:', e.message, e.stack);
    res.status(500).json({ error: e.message, code: e.code });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await getPool().query(
      `UPDATE system_notifications SET is_read = TRUE WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await getPool().query(
      `UPDATE system_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/test-email', requireAuth, async (req, res) => {
  const { email } = req.body;
  const targetEmail = email || req.user.email;
  if (!targetEmail) return res.status(400).json({ error: 'Target email is required for sending test email' });

  try {
    await sendEmail({
      to: targetEmail,
      subject: '[Test Notification] Store Management System',
      text: 'This is a test notification email sent from your Store Management System.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="color: #10b981; margin-top: 0;">✅ Email Notification System Online</h3>
          <p>This is a live test notification email sent from <strong>Store Management System</strong>.</p>
          <div style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 6px;">
            Target Email: ${targetEmail}<br/>
            Dispatched At: ${new Date().toLocaleString()}
          </div>
        </div>
      `
    });
    res.json({ success: true, message: `Test email dispatched to ${targetEmail}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/test-notification', requireAuth, async (req, res) => {
  try {
    // Create a test notification for the current user
    await createNotification(
      req.user.id,
      '✅ Test Notification',
      'This is a test notification from the Store Management System. This should appear in your notification bell.',
      'info'
    );
    res.json({ message: 'Test notification created successfully!' });
  } catch (e) {
    console.error('❌ Failed to create test notification:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users/send-email', requireAuth, async (req, res) => {
  const { recipient_id, subject, message } = req.body;
  if (!recipient_id || !subject || !message) {
    return res.status(400).json({ error: 'Recipient, subject, and message are required.' });
  }

  try {
    const [[recipient]] = await getPool().query(`SELECT id, email, full_name, username FROM users WHERE id = ?`, [recipient_id]);
    if (!recipient) return res.status(404).json({ error: 'Recipient user not found' });
    if (!recipient.email) return res.status(400).json({ error: 'Recipient user does not have an email address configured' });

    const senderName = req.user.full_name || req.user.username;
    const senderEmail = req.user.email || 'no-reply@store.org';

    // Dispatch direct email message
    await sendEmail({
      to: recipient.email,
      subject: `[User Message from ${senderName}] ${subject}`,
      text: `Hello ${recipient.full_name || recipient.username},\n\nYou received a message from ${senderName} (${senderEmail}):\n\n${message}\n\nBest regards,\nStore Management System`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="color: #6366f1; margin-top: 0;">✉️ Direct Message from ${senderName}</h3>
          <p style="font-size: 13px; color: #64748b;"><strong>Sender Email:</strong> ${senderEmail}</p>
          <div style="font-size: 14px; line-height: 1.6; background: #f8fafc; padding: 14px; border-left: 4px solid #6366f1; margin: 16px 0; border-radius: 4px;">
            <strong style="display: block; margin-bottom: 6px; color: #1e293b;">Subject: ${subject}</strong>
            ${message}
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 20px;">Sent via Store Management System User Messaging</p>
        </div>
      `
    });

    // Create in-app notification for recipient
    await createNotification(
      recipient.id,
      `New Message from ${senderName}`,
      `Subject: ${subject} — "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
      'message'
    );

    // Audit log
    await logAudit(req.user.id, req.user.username, req.user.role, 'USER_MESSAGE_SENT', `Sent direct email message to user #${recipient.id} (${recipient.email})`, req);

    res.json({ success: true, message: `Email message successfully dispatched to ${recipient.full_name || recipient.username} (${recipient.email})` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ─ DIRECTOR ENDPOINTS ─ Role Management & Enhanced Audit
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/director/info
 * Get comprehensive Director role information and statistics
 */
app.get('/api/director/info', requireAuth, async (req, res) => {
  try {
    // Only Director/Administrator can access this endpoint
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'This endpoint is restricted to Director or Administrator roles' });
    }

    const [[userCount]] = await getPool().query('SELECT COUNT(*) as total FROM users');
    const [[roleCount]] = await getPool().query('SELECT COUNT(*) as total FROM role_definitions');
    const [[auditLogCount]] = await getPool().query('SELECT COUNT(*) as total FROM audit_logs');
    const [[activeUsers]] = await getPool().query(`SELECT COUNT(*) as total FROM users WHERE status = 'Active'`);

    res.json({
      role: 'Director',
      authority: 'FULL_ADMIN',
      authorityLevel: 100,
      accessLevel: 'FULL_ACCESS',
      permissionCount: DIRECTOR_PERMISSIONS.length,
      systemStats: {
        totalUsers: userCount?.total || 0,
        activeUsers: activeUsers?.total || 0,
        totalRoles: roleCount?.total || 0,
        auditLogEntries: auditLogCount?.total || 0,
      },
      capabilities: {
        canCreateUsers: true,
        canManageRoles: true,
        canOverridePermissions: true,
        canViewAuditLogs: true,
        canBackupData: true,
        canRestoreBackup: true,
        canConfigureSystem: true,
        canManageBranches: true,
        canManageEmployees: true,
        canAccessAllModules: true,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/director/permissions
 * Get all Director permissions
 */
app.get('/api/director/permissions', requireAuth, async (req, res) => {
  try {
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access restricted to Director/Administrator' });
    }

    const categorized = {
      organisation: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('organisation:') || p.startsWith('currency:') || p.startsWith('regional:') || p.startsWith('settings:')),
      products: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('product:') || p.startsWith('category:')),
      inventory: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('inventory:') || p.startsWith('stock:')),
      sales: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('sales:') || p.startsWith('return:') || p.startsWith('refund:')),
      purchases: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('purchase:') || p.startsWith('supplier:')),
      customers: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('customer:')),
      expenses: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('expense:') || p.startsWith('payment:')),
      financial: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('financial:') || p.startsWith('record:') || p.startsWith('accounting:')),
      reports: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('report:') || p.startsWith('analytics:') || p.startsWith('dashboard:')),
      branches: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('branch:') || p.startsWith('store:')),
      employees: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('employee:') || p.startsWith('staff:')),
      users: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('user:')),
      roles: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('role:') || p.startsWith('permission:') || p.startsWith('access:')),
      security: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('security:') || p.startsWith('session:') || p.startsWith('password:')),
      receipts: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('receipt:') || p.startsWith('invoice:')),
      notifications: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('notification:') || p.startsWith('email:') || p.startsWith('sms:')),
      backup: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('backup:') || p.startsWith('data:')),
      system: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('system:')),
      audit: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('audit:') || p.startsWith('compliance:')),
      admin: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('admin:')),
      api: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('api:') || p.startsWith('integration:')),
      help: GRAND_DIRECTOR_PERMISSIONS.filter(p => p.startsWith('help:') || p.startsWith('documentation:') || p.startsWith('about:')),
    };

    res.json({
      total: GRAND_DIRECTOR_PERMISSIONS.length,
      categories: Object.keys(categorized).length,
      categorized
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/director/audit-logs
 * Advanced audit log retrieval with search, filter, and export
 */
app.get('/api/director/audit-logs', requireAuth, async (req, res) => {
  try {
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access restricted to Director/Administrator' });
    }

    const { page, limit, offset } = paginate(req.query);
    const { userId, actionType, dateFrom, dateTo, searchText } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (actionType) {
      query += ' AND action_type LIKE ?';
      params.push(`%${actionType}%`);
    }
    if (dateFrom) {
      query += ' AND created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND created_at <= ?';
      params.push(dateTo);
    }
    if (searchText) {
      query += ' AND (description LIKE ? OR username LIKE ? OR action_type LIKE ?)';
      params.push(`%${searchText}%`, `%${searchText}%`, `%${searchText}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await getPool().query(query, params);
    const [[{ total }]] = await getPool().query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1${userId ? ' AND user_id = ?' : ''}${actionType ? ' AND action_type LIKE ?' : ''}${dateFrom ? ' AND created_at >= ?' : ''}${dateTo ? ' AND created_at <= ?' : ''}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      data: rows,
      total: total || 0,
      page,
      limit,
      count: rows.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/director/role-hierarchy
 * Get complete role hierarchy and authority levels
 */
app.get('/api/director/role-hierarchy', requireAuth, async (req, res) => {
  try {
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access restricted to Director/Administrator' });
    }

    const hierarchy = [
      { rank: 1, role: 'Director', authorityLevel: 95, description: 'Full administrative access and control', tag: 'ADMIN', accessLevel: 'FULL_ACCESS' },
      { rank: 2, role: 'Administrator', authorityLevel: 80, description: 'Full administrative access to system', tag: 'ADMIN', accessLevel: 'ADMIN_ACCESS' },
      { rank: 3, role: 'Manager', authorityLevel: 60, description: 'Management authority over store operations', tag: 'MANAGER', accessLevel: 'MANAGER_ACCESS' },
      { rank: 4, role: 'Storekeeper', authorityLevel: 40, description: 'Store operations staff', tag: 'STAFF', accessLevel: 'STAFF_ACCESS' },
      { rank: 5, role: 'Employee', authorityLevel: 20, description: 'Basic employee access', tag: 'EMPLOYEE', accessLevel: 'BASIC_ACCESS' },
    ];

    res.json({ hierarchy, total: hierarchy.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/director/system-action
 * Execute system-wide actions (backup, maintenance, etc.)
 */
app.post('/api/director/system-action', requireAuth, async (req, res) => {
  try {
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access restricted to Director/Administrator' });
    }

    const { actionType, actionParams } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'Action type is required' });
    }

    let result = {};

    switch (actionType) {
      case 'systemStatus': {
        const [[userStats]] = await getPool().query('SELECT COUNT(*) as total, SUM(CASE WHEN status="Active" THEN 1 ELSE 0 END) as active FROM users');
        const [[auditStats]] = await getPool().query('SELECT COUNT(*) as total FROM audit_logs');
        result = {
          systemHealth: 'operational',
          userStatistics: userStats,
          auditLogCount: auditStats?.total || 0,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'userSuspend': {
        if (!actionParams?.userId) return res.status(400).json({ error: 'userId required' });
        const [[target]] = await getPool().query('SELECT role FROM users WHERE id = ?', [actionParams.userId]);
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'Director' && req.user.id !== actionParams.userId) {
          // Only allow suspending a Director by another Director
          const [[currentUser]] = await getPool().query('SELECT role FROM users WHERE id = ?', [req.user.id]);
          if (currentUser.role !== 'Director') {
            return res.status(403).json({ error: 'Cannot suspend Director accounts' });
          }
        }
        await getPool().query('UPDATE users SET status = "Inactive" WHERE id = ?', [actionParams.userId]);
        await logAudit(req.user.id, req.user.username, req.user.role, 'SUSPEND_USER', `Director suspended user #${actionParams.userId}`, req);
        result = { success: true, message: `User #${actionParams.userId} suspended` };
        break;
      }

      case 'userActivate': {
        if (!actionParams?.userId) return res.status(400).json({ error: 'userId required' });
        await getPool().query('UPDATE users SET status = "Active" WHERE id = ?', [actionParams.userId]);
        await logAudit(req.user.id, req.user.username, req.user.role, 'ACTIVATE_USER', `Director activated user #${actionParams.userId}`, req);
        result = { success: true, message: `User #${actionParams.userId} activated` };
        break;
      }

      case 'clearFailedLogins': {
        if (!actionParams?.userId) return res.status(400).json({ error: 'userId required' });
        await getPool().query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [actionParams.userId]);
        await logAudit(req.user.id, req.user.username, req.user.role, 'CLEAR_FAILED_LOGINS', `Director cleared failed login attempts for user #${actionParams.userId}`, req);
        result = { success: true, message: `Failed login attempts cleared for user #${actionParams.userId}` };
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action type: ${actionType}` });
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/director/user-activity
 * Get detailed activity logs for a specific user
 */
app.get('/api/director/user-activity/:userId', requireAuth, async (req, res) => {
  try {
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access restricted to Director/Administrator' });
    }

    const { page, limit, offset } = paginate(req.query);
    const [[{ total }]] = await getPool().query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?',
      [req.params.userId]
    );

    const [rows] = await getPool().query(
      'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.params.userId, limit, offset]
    );

    res.json({
      userId: req.params.userId,
      activity: rows,
      total,
      page,
      limit
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/complaints', requireAuth, async (req, res) => {
  try {
    const { targetRole, content } = req.body;
    if (!targetRole || !content?.trim()) {
      return res.status(400).json({ error: 'targetRole and content are required' });
    }

    const roleMap = {
      'director': 'Director',
      'admin': 'Administrator',
      'manager': 'Manager',
      'storekeeper': 'Storekeeper',
      'employee': 'Employee'
    };

    const mappedRole = roleMap[targetRole.toLowerCase()];
    if (!mappedRole) {
      return res.status(400).json({ error: `Invalid role selected: ${targetRole}` });
    }

    // Find all active users with the mapped role
    const [targetUsers] = await getPool().query(
      'SELECT id, username, full_name FROM users WHERE role = ? AND status = "Active"',
      [mappedRole]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({ error: `No active users found with role: ${mappedRole}` });
    }

    const preview = content.trim().slice(0, 120);

    for (const targetUser of targetUsers) {
      // Send chat message
      await getPool().query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
        [req.user.id, targetUser.id, content]
      );

      // Create notification
      await createNotification(
        targetUser.id,
        `New Complaint from ${req.user.full_name || req.user.username}`,
        `"${preview}${content.trim().length > 120 ? '...' : ''}"`,
        'message',
        req.user
      );
    }

    await logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'SUBMIT_COMPLAINT',
      `Submitted complaint to role ${mappedRole} (${targetUsers.length} users)`,
      req
    );

    res.json({ success: true, message: `Complaint sent directly to ${targetUsers.length} users with role ${mappedRole}` });
  } catch (e) {
    console.error('❌ Complaint submit error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});


// ── MESSAGING ENDPOINTS ────────────────────────────────────────
// Send a message to another user
app.post('/api/messages/send', requireAuth, validateBody(sendMessageSchema), async (req, res) => {
  try {
    const { recipient_id, content } = req.body; // Already validated by middleware

    console.log(`💬 Message send requested: from user ${req.user.id} to user ${recipient_id}`);

    const [[recipient]] = await getPool().query('SELECT id FROM users WHERE id = ?', [recipient_id]);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const [result] = await getPool().query(
      'INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
      [req.user.id, recipient_id, content]
    );

    const preview = content.trim().slice(0, 120);
    console.log(`📤 Message created, now creating notification...`);

    await createNotification(
      recipient_id,
      `New Message from ${req.user.full_name || req.user.username}`,
      `"${preview}${content.trim().length > 120 ? '...' : ''}"`,
      'message',
      req.user
    );

    await logAudit(req.user.id, req.user.username, req.user.role, 'SEND_MESSAGE', `Sent message to user #${recipient_id}`, req);

    console.log(`✅ Message ${result.insertId} sent successfully`);
    res.json({ success: true, message_id: result.insertId, message: 'Message sent successfully' });
  } catch (e) {
    console.error(`❌ Message send error:`, e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// Get unread message count (simpler, faster endpoint)
app.get('/api/messages/unread/count', requireAuth, async (req, res) => {
  try {
    const [[{ count }]] = await getPool().query(
      'SELECT COUNT(*) AS count FROM messages WHERE recipient_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    console.log(`📬 Unread messages for user ${req.user.id}: ${count}`);
    res.json({ unread: count || 0 });
  } catch (e) {
    console.error('❌ /messages/unread/count error:', e.message);
    res.json({ unread: 0 });
  }
});

app.post('/api/messages/read-all', requireAuth, async (req, res) => {
  try {
    await getPool().query(
      'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE recipient_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get inbox messages for current user
app.get('/api/messages/inbox', requireAuth, async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { unreadOnly } = req.query;

    let countQuery = 'SELECT COUNT(*) AS total FROM messages WHERE recipient_id = ? AND is_read = FALSE';
    let countParams = [req.user.id];

    const [[{ total: unreadCount }]] = await getPool().query(countQuery, countParams);

    let query = 'SELECT COUNT(*) AS total FROM messages WHERE recipient_id = ?';
    let queryParams = [req.user.id];

    if (unreadOnly === 'true') {
      query += ' AND is_read = FALSE';
    }

    const [[{ total }]] = await getPool().query(query, queryParams);

    let dataQuery = `
      SELECT 
        m.id, m.sender_id, m.recipient_id, m.subject, m.content, 
        m.is_read, m.read_at, m.created_at,
        u.full_name AS sender_name, u.username AS sender_username, u.avatar_url AS sender_avatar
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = ?
    `;
    let params = [req.user.id];

    if (unreadOnly === 'true') {
      dataQuery += ' AND m.is_read = FALSE';
    }

    dataQuery += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [messages] = await getPool().query(dataQuery, params);

    res.json({
      messages,
      total,
      page,
      limit,
      unread: unreadCount
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get sent messages for current user
app.get('/api/messages/sent', requireAuth, async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const [[{ total }]] = await getPool().query(
      'SELECT COUNT(*) AS total FROM messages WHERE sender_id = ?',
      [req.user.id]
    );

    const [messages] = await getPool().query(`
      SELECT 
        m.id, m.sender_id, m.recipient_id, m.subject, m.content, 
        m.is_read, m.read_at, m.created_at,
        u.full_name AS recipient_name, u.username AS recipient_username, u.avatar_url AS recipient_avatar
      FROM messages m
      LEFT JOIN users u ON m.recipient_id = u.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `, [req.user.id, limit, offset]);

    res.json({
      messages,
      total,
      page,
      limit
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single message
app.get('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const [[message]] = await getPool().query(`
      SELECT 
        m.*, 
        sender.full_name AS sender_name, sender.username AS sender_username, sender.avatar_url AS sender_avatar,
        recipient.full_name AS recipient_name, recipient.username AS recipient_username, recipient.avatar_url AS recipient_avatar
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)
    `, [req.params.id, req.user.id, req.user.id]);

    if (!message) return res.status(404).json({ error: 'Message not found or access denied' });

    // Mark as read if recipient viewing
    if (message.recipient_id === req.user.id && !message.is_read) {
      await getPool().query(
        'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id]
      );
    }

    res.json(message);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark message as read
app.post('/api/messages/:id/read', requireAuth, async (req, res) => {
  try {
    const [[message]] = await getPool().query(
      'SELECT recipient_id FROM messages WHERE id = ?',
      [req.params.id]
    );

    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await getPool().query(
      'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true, message: 'Message marked as read' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete message
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const [[message]] = await getPool().query(
      'SELECT sender_id, recipient_id FROM messages WHERE id = ?',
      [req.params.id]
    );

    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender_id !== req.user.id && message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await getPool().query('DELETE FROM messages WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_MESSAGE', `Deleted message #${req.params.id}`, req);

    res.json({ success: true, message: 'Message deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get unread message count
app.get('/api/messages/unread/count', requireAuth, async (req, res) => {
  try {
    const [[{ count }]] = await getPool().query(
      'SELECT COUNT(*) AS count FROM messages WHERE recipient_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ unread: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Endpoint: Clean up broken avatar URLs ────────────────
// This endpoint fixes invalid avatar references in the database
// Only accessible to Director and Administrators
app.post('/api/admin/cleanup-avatars', requireAuth, async (req, res) => {
  try {
    // Verify admin access (Director/Administrator level)
    if (!['Director', 'Administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'This action requires administrative privileges' });
    }

    const [users] = await getPool().query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL');

    let fixed = 0;
    let errors = [];

    for (const user of users) {
      if (user.avatar_url && user.avatar_url.startsWith('/avatars/')) {
        const filepath = path.join(AVATARS_DIR, path.basename(user.avatar_url));

        // Check if file exists
        if (!fs.existsSync(filepath)) {
          // File doesn't exist, clear the avatar_url
          await getPool().query('UPDATE users SET avatar_url = NULL WHERE id = ?', [user.id]);
          fixed++;
        }
      }
    }

    await logAudit(req.user.id, req.user.username, req.user.role, 'ADMIN_ACTION', `Cleaned up ${fixed} broken avatar URLs`, req);

    res.json({
      success: true,
      message: `Fixed ${fixed} broken avatar references`,
      fixed
    });
  } catch (e) {
    console.error('Avatar cleanup error:', e.message);
    res.status(500).json({ error: 'Failed to cleanup avatars: ' + e.message });
  }
});

// ── Server-Sent Events (SSE) for Real-time Updates ─────────────────────────

app.use('/api/gmail', requireAuth, gmailRouter);

// ══════════════════════════════════════════════════════════════
// EMPLOYEE PORTAL ROUTES  (must be before errorHandler)
// ══════════════════════════════════════════════════════════════

// Helper: resolve employee_dept record for the logged-in user
async function getEmployeeId(userId) {
  if (!userId) return null;
  // Primary: match by user_id
  const [rows] = await getPool().query(
    `SELECT id FROM employees_departments WHERE user_id=? AND type='Employee' LIMIT 1`,
    [userId]
  );
  if (rows[0]) return rows[0].id;

  // Fallback 1: match by email for legacy records with no user_id
  const [[user]] = await getPool().query('SELECT id, full_name, email, username FROM users WHERE id=? LIMIT 1', [userId]);
  if (!user) return null;

  if (user.email) {
    const [byEmail] = await getPool().query(
      `SELECT id FROM employees_departments WHERE email=? AND type='Employee' LIMIT 1`,
      [user.email]
    );
    if (byEmail[0]) {
      await getPool().query('UPDATE employees_departments SET user_id=? WHERE id=?', [userId, byEmail[0].id]);
      return byEmail[0].id;
    }
  }

  // Fallback 2: match by name
  const [byName] = await getPool().query(
    `SELECT id FROM employees_departments WHERE name=? AND type='Employee' LIMIT 1`,
    [user.full_name]
  );
  if (byName[0]) {
    await getPool().query('UPDATE employees_departments SET user_id=? WHERE id=?', [userId, byName[0].id]);
    return byName[0].id;
  }

  // Fallback 3: auto-create a minimal record so the employee can receive items
  try {
    const code = `EMP-${userId}-${Date.now().toString(36).toUpperCase()}`;
    const [ins] = await getPool().query(
      `INSERT INTO employees_departments (type, code, name, department_name, position, email, status, user_id)
       VALUES ('Employee', ?, ?, 'General', 'Employee', ?, 'Active', ?)`,
      [code, user.full_name || user.username, user.email || null, userId]
    );
    console.log(`✅ Auto-created employees_departments record id=${ins.insertId} for user_id=${userId}`);
    return ins.insertId;
  } catch (e) {
    console.error('⚠️  Could not auto-create employee record:', e.message);
    return null;
  }
}

// My assigned / issued items
app.get('/api/employee-portal/my-items', requireAuth, async (req, res) => {
  try {
    const empId = await getEmployeeId(req.user.id);
    if (!empId) return res.json([]);

    const [rows] = await getPool().query(`
      SELECT st.id, st.transaction_code, st.transaction_type, st.quantity,
             st.purpose, st.remarks, st.status,
             st.transaction_date AS issued_at,
             m.name AS material_name, m.material_code, m.unit_of_measure,
             m.location, m.current_stock
      FROM stock_transactions st
      LEFT JOIN materials m ON st.material_id = m.id
      WHERE st.employee_dept_id = ?
        AND st.transaction_type = 'STOCK_OUT'
      ORDER BY st.id DESC
    `, [empId]);

    res.json(rows);
  } catch (e) {
    console.error('employee-portal/my-items error:', e);
    res.status(500).json({ error: e.message });
  }
});

// My material requests
app.get('/api/employee-portal/my-requests', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT mr.id, mr.request_code, mr.quantity, mr.purpose, mr.priority,
             mr.remarks, mr.status,
             mr.request_date AS created_at,
             mr.required_date,
             mr.approved_at,
             mr.approval_remarks,
             m.name AS material_name, m.material_code, m.unit_of_measure,
             u.full_name AS approver_name
      FROM material_requests mr
      LEFT JOIN materials m ON mr.material_id = m.id
      LEFT JOIN users u ON mr.approved_by_id = u.id
      WHERE mr.requested_by_id = ?
      ORDER BY mr.id DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (e) {
    console.error('employee-portal/my-requests error:', e);
    res.status(500).json({ error: e.message });
  }
});

// My transaction history
app.get('/api/employee-portal/history', requireAuth, async (req, res) => {
  try {
    const empId = await getEmployeeId(req.user.id);
    let rows = [];
    if (empId) {
      [rows] = await getPool().query(`
        SELECT st.*, m.name AS material_name, m.material_code, m.unit_of_measure
        FROM stock_transactions st
        LEFT JOIN materials m ON st.material_id = m.id
        WHERE st.employee_dept_id = ?
        ORDER BY st.id DESC LIMIT 200
      `, [empId]);
    }
    const [byUser] = await getPool().query(`
      SELECT st.*, m.name AS material_name, m.material_code, m.unit_of_measure
      FROM stock_transactions st
      LEFT JOIN materials m ON st.material_id = m.id
      WHERE st.issued_by_id = ?
      ORDER BY st.id DESC LIMIT 200
    `, [req.user.id]);
    const seen = new Set(rows.map(r => r.id));
    byUser.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); } });
    rows.sort((a, b) => b.id - a.id);
    res.json(rows.slice(0, 200));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// My notifications
app.get('/api/employee-portal/notifications', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, user_id, title, message, type, is_read, created_at
       FROM system_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('employee-portal/notifications error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mark notifications as read
app.put('/api/employee-portal/notifications/mark-read', requireAuth, async (req, res) => {
  try {
    await getPool().query(
      `UPDATE system_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit a return
app.post('/api/employee-portal/returns', requireAuth, async (req, res) => {
  const { request_id, quantity, remarks } = req.body;
  if (!request_id || !quantity) return res.status(400).json({ error: 'request_id and quantity are required' });
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive integer' });
  try {
    const [[mr]] = await getPool().query(
      `SELECT mr.*, m.id AS mat_id FROM material_requests mr
       LEFT JOIN materials m ON mr.material_id = m.id
       WHERE mr.id = ? AND mr.requested_by_id = ?`,
      [request_id, req.user.id]
    );
    if (!mr) return res.status(404).json({ error: 'Request not found or does not belong to you' });
    if (mr.status !== 'Issued') return res.status(400).json({ error: `Cannot return a request with status: ${mr.status}` });
    if (qty > mr.quantity) return res.status(400).json({ error: `Return quantity (${qty}) exceeds issued quantity (${mr.quantity})` });
    const empId = await getEmployeeId(req.user.id);
    const code = `RTN-${Math.floor(10000 + Math.random() * 90000)}`;
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code, transaction_type, material_id, quantity, employee_dept_id, purpose, issued_by_id, remarks)
       VALUES (?, 'RETURN', ?, ?, ?, 'Employee Material Return', ?, ?)`,
      [code, mr.material_id, qty, empId, req.user.id, remarks || '']
    );
    await getPool().query('UPDATE materials SET current_stock = current_stock + ? WHERE id = ?', [qty, mr.material_id]);
    if (qty >= mr.quantity) {
      await getPool().query(`UPDATE material_requests SET status = 'Returned' WHERE id = ?`, [request_id]);
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'EMPLOYEE_RETURN',
      `Employee returned ${qty} units for request #${request_id}`, req);
    invalidateStatsCache();
    res.json({ success: true, transaction_code: code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ensure employee_issues table exists
async function ensureIssuesTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS employee_issues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      issue_code VARCHAR(20) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      priority ENUM('Low','Normal','High','Urgent') DEFAULT 'Normal',
      reported_by_id INT NOT NULL,
      status ENUM('Open','In Progress','Resolved','Closed') DEFAULT 'Open',
      resolution TEXT,
      resolved_by_id INT,
      resolved_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reported_by_id) REFERENCES users(id)
    )
  `);
}

// Report an issue
app.post('/api/employee-portal/issues', requireAuth, async (req, res) => {
  const { title, description, priority } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  try {
    await ensureIssuesTable();
    const code = `ISS-${Math.floor(10000 + Math.random() * 90000)}`;
    const [r] = await getPool().query(
      `INSERT INTO employee_issues (issue_code, title, description, priority, reported_by_id, status)
       VALUES (?, ?, ?, ?, ?, 'Open')`,
      [code, title, description, priority || 'Normal', req.user.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'REPORT_ISSUE',
      `Employee reported issue: ${title}`, req);
    res.json({ success: true, issue_code: code, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// My reported issues
app.get('/api/employee-portal/my-issues', requireAuth, async (req, res) => {
  try {
    await ensureIssuesTable();
    const [rows] = await getPool().query(
      `SELECT ei.*, u.full_name AS resolved_by_name
       FROM employee_issues ei
       LEFT JOIN users u ON ei.resolved_by_id = u.id
       WHERE ei.reported_by_id = ?
       ORDER BY ei.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
    },
  });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Startup migrations ────────────────────────────────────────
async function runStartupMigrations() {
  try {
    const pool = getPool();
    // Add phone_contact, department, and document_url columns to users table if missing
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_contact VARCHAR(50) NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_url VARCHAR(500) NULL`);
    // Expand material_requests.status ENUM to include Issued, Returned, Cancelled
    await pool.query(
      `ALTER TABLE material_requests MODIFY COLUMN status ENUM('Pending','Approved','Rejected','Issued','Returned','Cancelled') NOT NULL DEFAULT 'Pending'`
    );
    // Add required_date column if missing
    await pool.query(`ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS required_date DATE NULL`);
    // Ensure employee_issues table exists
    await ensureIssuesTable();
    console.log('✅ Startup migrations complete');
  } catch (e) {
    console.warn('⚠️  Startup migration notice:', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────
initializeDatabase().then(async () => {
  await reconcileAllUserEmployees();
  await runStartupMigrations();
  app.listen(PORT, () => {
    console.log(`🚀 Store Management API running on port ${PORT}`);
    const fallbackActive = getIsUsingFallback();
    console.log(`📊 DB Mode: ${fallbackActive ? 'Fallback JSON Store' : 'MySQL Connected'}`);
    if (fallbackActive) {
      console.log('⚠️ Running in fallback mode. Data is persisted to server/db/fallback-store.json until MySQL becomes available.');
    }
  });
});












