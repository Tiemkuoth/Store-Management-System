import { useState, useCallback } from 'react';

/**
 * Custom hook for managing toast notifications
 * 
 * @returns {Object} Toast management functions
 * @returns {Array} toasts - Array of active toast notifications
 * @returns {function} showToast - Show a new toast notification
 * @returns {function} removeToast - Remove a toast by id
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a new toast notification
   * 
   * @param {string} message - The message to display
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms (default: 4000)
   */
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  /**
   * Remove a toast notification by id
   * 
   * @param {number} id - Toast id to remove
   */
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Helper functions for different toast types
   */
  const success = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
}
