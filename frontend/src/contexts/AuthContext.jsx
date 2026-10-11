import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { setGlobalCSRFToken } from '../utils/apiFetch';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const AuthContext = createContext();

// CSRF token management
let csrfToken = null;
let jwtToken = null;

export const getCSRFToken = () => csrfToken;
export const setCSRFToken = (token) => { 
  csrfToken = token;
  setGlobalCSRFToken(token);
};

// ✅ JWT token management
export const getJWTToken = () => jwtToken;
export const setJWTToken = (token) => { jwtToken = token; };

// Note: Auth tokens are now stored in httpOnly cookies, managed by the server
// We also store JWT in memory and localStorage as fallback for cross-origin requests
export const getToken = () => {
  if (jwtToken) return jwtToken;
  const storedToken = localStorage.getItem('auth_token');
  if (storedToken && storedToken.length > 2048) {
    // Discard tokens created by the old profile-sized JWT implementation.
    localStorage.removeItem('auth_token');
    return null;
  }
  return storedToken;
};
export const setToken = (token) => { 
  jwtToken = token;
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
};
export const clearToken = () => { 
  jwtToken = null;
  localStorage.removeItem('auth_token');
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setTokenState] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const logoutInFlightRef = useRef(false);

  const clearInvalidSession = useCallback(() => {
    clearToken();
    setCSRFToken(null);
    setTokenState(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('current_user');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      const savedUser = localStorage.getItem('current_user');
      const savedToken = localStorage.getItem('auth_token');

      if (savedToken && savedToken.length <= 2048) {
        setToken(savedToken);
        setTokenState(savedToken);
        try {
          const res = await apiFetch('/users/me');
          if (res.status === 401 || res.status === 403) {
            if (!cancelled) clearInvalidSession();
          } else if (res.ok && !cancelled) {
            const user = await res.json();
            setCurrentUser(user);
            localStorage.setItem('current_user', JSON.stringify(user));
            setIsLoggedIn(true);
            console.log('✅ Session restored and verified');
            await fetchCSRFToken();
          } else if (!res.ok && !cancelled) {
            console.warn(`Could not verify saved session: ${res.status} ${res.statusText}`);
          }
        } catch (e) {
          if (!cancelled) console.warn('Could not verify saved session:', e.message);
          if (!cancelled) clearInvalidSession();
        }
      } else if (savedToken) {
        // Remove tokens created by the old avatar-in-JWT implementation.
        clearInvalidSession();
      } else if (savedUser) {
        localStorage.removeItem('current_user');
      }

      if (!cancelled) setIsInitialized(true);
    };

    initializeAuth();
    return () => { cancelled = true; };
  }, [clearInvalidSession]);

  const fetchCSRFToken = async () => {
    try {
      const res = await apiFetch('/auth/csrf-token');
      if (res.ok) {
        const data = await res.json();
        setCSRFToken(data.csrfToken);
      }
    } catch (e) {
      console.warn('Could not fetch CSRF token:', e.message);
    }
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await apiFetch('/users/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem('current_user', JSON.stringify(data));
      } else if (res.status === 401 || res.status === 403) {
        clearInvalidSession();
      }
    } catch (e) {
      console.warn('Could not fetch current user profile:', e.message);
    }
  }, [clearInvalidSession]);

  const handleLogin = async (username, password, callback) => {
    username = username?.trim ? username.trim() : username;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      
      // ✅ HANDLE FORCED PASSWORD CHANGE (don't set isLoggedIn yet)
      if (res.status === 403 && data?.require_password_change) {
        return callback(data.error, { 
          requirePasswordChange: true, 
          userId: data.user_id 
        });
      }
      
      if (res.ok && data.user && data.csrfToken) {
        // ✅ SET ALL STATE AT ONCE to prevent partial renders
        setCSRFToken(data.csrfToken);
        if (!data.token) {
          callback('Login failed: server did not return an authentication token');
          return;
        }
        setToken(data.token);
        setTokenState(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('current_user', JSON.stringify(data.user));
        setIsLoggedIn(true); // ✅ Set last to prevent race conditions
        
        console.log('✅ Login successful');
        callback(null);
      } else {
        let message = `Login failed (${res.status})`;
        if (data?.error) {
          message = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
        }
        callback(message);
      }
    } catch (e) {
      callback(e.message || 'Could not reach the backend server');
    }
  };

  const handleLogout = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      await apiFetch('/auth/logout', { method: 'POST', signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      console.warn('Logout API error:', e.message);
      // Continue cleanup even if API call fails
    }
    
    // ✅ CLEAR ALL AUTH STATE AND STORAGE
    clearToken();
    setCSRFToken(null);
    setTokenState(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('current_user');
    localStorage.removeItem('sms_active_nav'); // Clear preferred navigation
    localStorage.removeItem('sms_preferred_page'); // Clear any page preferences
    
    console.log('✅ Logout complete - all state and storage cleared');
    logoutInFlightRef.current = false;
  }, []);

  const handleAvatarChange = async (dataUrl) => {
    if (!currentUser || !dataUrl || !dataUrl.startsWith('data:image/')) return;
    try {
      const res = await apiFetch('/auth/upload-avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar_data_url: dataUrl }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (res.ok && data.avatar_url) {
        const updatedUser = { ...currentUser, avatar_url: data.avatar_url, ...data.user };
        setCurrentUser(updatedUser);
        localStorage.setItem('current_user', JSON.stringify(updatedUser));
      }
    } catch {
      // Catch-all
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, user: currentUser, token, isLoggedIn, isAuthenticated: isLoggedIn, isInitialized, initialized: isInitialized, loading: !isInitialized, handleLogin, handleLogout, handleAvatarChange, setCurrentUser, fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Authenticated fetch — attaches CSRF token and sends cookies
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const authToken = getToken();

  // Send the in-memory/localStorage token when the cookie is unavailable.
  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  
  // Add CSRF token to state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    const csrf = getCSRFToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }
  
  return fetch(`${API_BASE}${path}`, { 
    ...options, 
    credentials: 'include', // Include httpOnly cookies
    headers 
  });
}
