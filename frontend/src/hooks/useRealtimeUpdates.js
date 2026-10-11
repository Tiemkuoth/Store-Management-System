import { useEffect, useRef, useCallback, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, getToken } from '../contexts/AuthContext';

/**
 * Hook for managing Server-Sent Events (SSE) connection
 * Listens for real-time updates and triggers React Query cache invalidation
 * 
 * Usage:
 * const { isConnected, error } = useRealtimeUpdates();
 */
export const useRealtimeUpdates = () => {
  const { isLoggedIn } = useContext(AuthContext) || {};
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const queryClient = useQueryClient();

  const reconnectDelay = useRef(1000); // Start with 1 second
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3; // Reduced from 5 - SSE is optional
  const HEARTBEAT_TIMEOUT = 45000; // 45 seconds - consider dead if no heartbeat

  const handleReconnect = useCallback(() => {
    if (!isLoggedIn) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Check max retries
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.debug(`SSE: Max reconnection attempts reached. Real-time updates unavailable.`);
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(reconnectDelay.current, 30000);
    if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
      console.debug(`SSE: Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current++;
      connectSSE();
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
    }, delay);
  }, [isLoggedIn]);

  const resetHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    // If no heartbeat for 45 seconds, connection is dead
    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn('⚠️ SSE: No heartbeat received in 45s. Connection likely dead.');
      handleReconnect();
    }, HEARTBEAT_TIMEOUT);
  }, [handleReconnect]);

  const connectSSE = useCallback(() => {
    if (!isLoggedIn) return;
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const token = getToken();
      const eventsUrl = new URL(`${API_BASE}/events`);
      if (token) {
        eventsUrl.searchParams.set('token', token);
      }

      eventSourceRef.current = new EventSource(eventsUrl, {
        withCredentials: true,
      });

      // Heartbeat/ping event - server sends this every 30 seconds
      eventSourceRef.current.addEventListener('heartbeat', (event) => {
        console.log('💓 SSE Heartbeat received');
        resetHeartbeatTimeout();
      });

      eventSourceRef.current.addEventListener('connected', (event) => {
        console.log('✅ SSE Connected:', event.data);
        reconnectDelay.current = 1000; // Reset backoff
        reconnectAttempts.current = 0; // Reset attempts counter
        resetHeartbeatTimeout(); // Start heartbeat monitoring
      });

      // Task assignment event
      eventSourceRef.current.addEventListener('task:assigned', (event) => {
        console.log('📋 New task assigned:', event.data);
        resetHeartbeatTimeout();
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        // Signal App.jsx to refresh notifications immediately
        window.dispatchEvent(new CustomEvent('notification:new'));
      });

      // Inventory update event
      eventSourceRef.current.addEventListener('inventory:changed', (event) => {
        console.log('📦 Inventory updated:', event.data);
        resetHeartbeatTimeout();
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      });

      // Message event
      eventSourceRef.current.addEventListener('message:received', (event) => {
        console.log('💬 New message:', event.data);
        resetHeartbeatTimeout();
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        window.dispatchEvent(new CustomEvent('notification:new'));
      });

      // Request approved event
      eventSourceRef.current.addEventListener('request:approved', (event) => {
        console.log('✅ Request approved:', event.data);
        resetHeartbeatTimeout();
        queryClient.invalidateQueries({ queryKey: ['materialRequests'] });
        window.dispatchEvent(new CustomEvent('notification:new'));
      });

      // Generic update event
      eventSourceRef.current.addEventListener('update', (event) => {
        const update = JSON.parse(event.data);
        console.log('🔄 Real-time update:', update);
        resetHeartbeatTimeout();
        if (update.type === 'task') {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      });

      eventSourceRef.current.onerror = (error) => {
        // SSE is optional - only log on first attempt
        if (reconnectAttempts.current === 0) {
          console.info('ℹ️ SSE connection not available. Real-time updates disabled. (This is optional - app will still work)');
        }
        handleReconnect();
      };
    } catch (err) {
      console.error('Failed to connect to SSE:', err);
      handleReconnect();
    }
  }, [isLoggedIn, queryClient, handleReconnect, resetHeartbeatTimeout]);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [connectSSE, isLoggedIn]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  };
};

export default useRealtimeUpdates;
