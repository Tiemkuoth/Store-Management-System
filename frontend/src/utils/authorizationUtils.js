/**
 * Authorization utility functions for role-based access control
 * Centralizes permission checks and role hierarchy logic
 */

// Define role hierarchy and authority levels
const ROLE_HIERARCHY = {
  'Director': 95,
  'Administrator': 80,
  'Manager': 60,
  'Storekeeper': 40,
  'Employee': 20,
};

// Define modules and their required role/authority levels
const RESTRICTED_MODULES = {
  'WAREHOUSES': ['Director', 'Administrator'],
  'EMPLOYEES': ['Director', 'Administrator', 'Manager', 'Storekeeper'],
  'USERS_AUDIT': ['Director', 'Administrator'],
  'SETTINGS': ['Director', 'Administrator'],
};

/**
 * Check if a user has access to a specific module
 * @param {Object} user - Current user object with 'role' property
 * @param {string} moduleId - The module ID to check (e.g., 'WAREHOUSES', 'SETTINGS')
 * @returns {boolean} - True if user has access, false otherwise
 */
export function hasModuleAccess(user, moduleId) {
  if (!user || !user.role) {
    console.warn('⚠️ hasModuleAccess: Invalid user object', user);
    return false;
  }

  // If module is not restricted, allow access
  if (!RESTRICTED_MODULES[moduleId]) {
    return true;
  }

  // Check if user's role is in the allowed roles for this module
  const allowedRoles = RESTRICTED_MODULES[moduleId];
  const hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess) {
    console.log(`❌ Access denied for ${user.role} to module ${moduleId}`);
  }

  return hasAccess;
}

/**
 * Get all accessible modules for a user
 * @param {Object} user - Current user object with 'role' property
 * @returns {string[]} - Array of accessible module IDs
 */
export function getAccessibleModules(user) {
  if (!user || !user.role) {
    return [];
  }

  return Object.entries(RESTRICTED_MODULES)
    .filter(([_moduleId, allowedRoles]) => allowedRoles.includes(user.role))
    .map(([moduleId]) => moduleId);
}

/**
 * Check if a user has higher authority than another user's role
 * @param {string} userRole - Role of the user checking authority
 * @param {string} targetRole - Role of the target user
 * @returns {boolean} - True if user has higher authority
 */
export function hasHigherAuthority(userRole, targetRole) {
  const userAuthority = ROLE_HIERARCHY[userRole] || 0;
  const targetAuthority = ROLE_HIERARCHY[targetRole] || 0;
  return userAuthority > targetAuthority;
}

/**
 * Get authority level of a role
 * @param {string} role - Role name
 * @returns {number} - Authority level
 */
export function getAuthorityLevel(role) {
  return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if a user is in a director or administrative role
 * @param {Object} user - Current user object with 'role' property
 * @returns {boolean} - True if user is director/admin
 */
export function isDirectorOrAdmin(user) {
  if (!user || !user.role) return false;
  return ['Director', 'Administrator'].includes(user.role);
}

/**
 * Check if a user is a restricted module administrator
 * @param {Object} user - Current user object with 'role' property
 * @returns {boolean} - True if user can access restricted modules
 */
export function isRestrictedModuleAdmin(user) {
  if (!user || !user.role) return false;
  return ['Director', 'Administrator'].includes(user.role);
}

/**
 * Get required role string for a module
 * @param {string} moduleId - Module ID
 * @returns {string} - Human-readable required roles
 */
export function getModuleRequiredRoles(moduleId) {
  const roles = RESTRICTED_MODULES[moduleId];
  if (!roles) return 'No restrictions';
  return roles.join(', ');
}

/**
 * Validate access to a module and redirect if necessary
 * @param {Object} user - Current user object
 * @param {string} moduleId - Module to access
 * @param {Function} onAccessDenied - Callback if access denied
 * @returns {boolean} - True if access granted
 */
export function validateModuleAccess(user, moduleId, onAccessDenied) {
  const hasAccess = hasModuleAccess(user, moduleId);
  
  if (!hasAccess && onAccessDenied) {
    const requiredRoles = getModuleRequiredRoles(moduleId);
    onAccessDenied({
      feature: moduleId.replace(/_/g, ' '),
      requiredRole: requiredRoles,
      currentRole: user?.role || 'Unknown',
    });
  }

  return hasAccess;
}

export default {
  hasModuleAccess,
  getAccessibleModules,
  hasHigherAuthority,
  getAuthorityLevel,
  isDirectorOrAdmin,
  isRestrictedModuleAdmin,
  getModuleRequiredRoles,
  validateModuleAccess,
  ROLE_HIERARCHY,
  RESTRICTED_MODULES,
};
