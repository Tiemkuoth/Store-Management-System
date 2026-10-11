/**
 * Authenticated fetch wrapper.
 * Automatically includes httpOnly cookies, JWT token fallback, and CSRF tokens.
 * Usage: apiFetch('/materials')  or  apiFetch('/users/1', { method:'PUT', body:JSON.stringify({...}) })
 */

const API_BASE = 'http://localhost:5000/api';

// Global CSRF token state
let globalCSRFToken = null;

export function setGlobalCSRFToken(token) {
  globalCSRFToken = token;
}

export function getGlobalCSRFToken() {
  return globalCSRFToken;
}

export default async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };
  
  // Don't override Content-Type for FormData (it needs to be set automatically with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  
  // Add CSRF token to state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    const csrfToken = globalCSRFToken;
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // ✅ FALLBACK: If httpOnly cookies fail, use Authorization header with JWT token
  const jwtToken = localStorage.getItem('auth_token');
  
  if (jwtToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { 
    ...options, 
    credentials: 'include', // Include httpOnly cookies
    headers 
  });

  return res;
}

export { API_BASE };
