/**
 * Centralized Error Handler
 * Provides structured logging, error parsing, and consistent error responses
 */

const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * Structured error logging
 */
class ErrorLogger {
  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  log(level, message, error = null, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
      }),
    };

    if (this.isDevelopment) {
      const consoleMethod = level === 'error' || level === 'critical' ? 'error' : level;
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, logEntry);
    } else {
      // In production, send to logging service (Sentry, LogRocket, etc.)
      if (level === 'critical') {
        console.error(logEntry);
      }
    }

    return logEntry;
  }

  debug(message, context) {
    return this.log(LogLevel.DEBUG, message, null, context);
  }

  info(message, context) {
    return this.log(LogLevel.INFO, message, null, context);
  }

  warn(message, error, context) {
    return this.log(LogLevel.WARN, message, error, context);
  }

  error(message, error, context) {
    return this.log(LogLevel.ERROR, message, error, context);
  }

  critical(message, error, context) {
    return this.log(LogLevel.CRITICAL, message, error, context);
  }
}

export const errorLogger = new ErrorLogger();

/**
 * Parse API error response
 */
export function parseApiError(error) {
  if (!error) return { message: 'An unknown error occurred' };

  // Axios error
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.message || error.message || `HTTP ${status}`,
      errors: data?.errors || [],
      code: data?.code,
      details: data?.details,
    };
  }

  // Network error
  if (error.message === 'Network Error') {
    return {
      status: 0,
      message: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
    };
  }

  // Timeout error
  if (error.code === 'ECONNABORTED') {
    return {
      status: 0,
      message: 'Request timeout. Please try again.',
      code: 'TIMEOUT',
    };
  }

  // Generic error
  return {
    message: error.message || 'An error occurred',
    code: error.code,
    status: error.status,
  };
}

/**
 * Handle API errors with logging and user-friendly messages
 */
export function handleApiError(error, context = {}) {
  const parsed = parseApiError(error);

  // Log the error
  errorLogger.error('API Error', error, {
    ...context,
    ...parsed,
  });

  return {
    ...parsed,
    userMessage: getUserMessage(parsed),
  };
}

/**
 * Convert error to user-friendly message
 */
export function getUserMessage(error) {
  if (typeof error === 'string') return error;

  const { status, code, message } = error;

  // Map common errors to user messages
  const messages = {
    401: 'Your session has expired. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with the current state. Please refresh and try again.',
    422: 'The provided data is invalid. Please check your input.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'A server error occurred. Please try again later.',
    503: 'The service is temporarily unavailable. Please try again later.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT: 'Request timeout. Please try again.',
  };

  return messages[status] || messages[code] || message || 'An error occurred. Please try again.';
}

/**
 * Error Boundary Component (React)
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorLogger.critical('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
        }}>
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
          {import.meta.env.DEV && (
            <details style={{ marginTop: '10px', textAlign: 'left' }}>
              <summary>Error Details (Development Only)</summary>
              <pre style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                overflow: 'auto',
                borderRadius: '4px',
              }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling async errors in components
 */
export function useAsyncError() {
  const [, setError] = React.useState();
  return React.useCallback(
    (error) => {
      setError(() => {
        throw error;
      });
    },
    [setError]
  );
}

/**
 * Standardized error response object
 */
export function createErrorResponse(message, code = 'ERR_UNKNOWN', status = 500, details = null) {
  return {
    success: false,
    message,
    code,
    status,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Standardized success response object
 */
export function createSuccessResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export default {
  errorLogger,
  parseApiError,
  handleApiError,
  getUserMessage,
  createErrorResponse,
  createSuccessResponse,
  LogLevel,
};
