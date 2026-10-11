/**
 * Resilience utilities for handling failures, retries, and circuit breaker pattern
 */

// ── Retry wrapper with exponential backoff ────────────────────
export async function retryWithBackoff(
  fn,
  maxRetries = 3,
  initialDelayMs = 100,
  maxDelayMs = 5000
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 100ms, 200ms, 400ms (capped at 5s)
        const delayMs = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        
        console.warn(
          `⚠️ Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
          error.message
        );
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(
    `Failed after ${maxRetries} attempts: ${lastError.message}`
  );
}

// ── Circuit Breaker Pattern ────────────────────────────────────
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async call(...args) {
    // OPEN: Fail fast without calling function
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker OPEN. Retry after ${Math.ceil(
            (this.nextAttemptTime - Date.now()) / 1000
          )}s`
        );
      }
      // Try to HALF_OPEN
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await this.fn(...args);

      // HALF_OPEN: Track success
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 2) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          console.log('✅ Circuit breaker CLOSED');
        }
      }

      // CLOSED: Reset failure count on success
      if (this.state === 'CLOSED') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // HALF_OPEN: One failure reopens
      if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
        console.error('🔴 Circuit breaker OPEN (half-open failed)');
      }
      // CLOSED: Threshold failures open
      else if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
        console.error(
          `🔴 Circuit breaker OPEN after ${this.failureCount} failures`
        );
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

export { CircuitBreaker };

// ── Timeout wrapper ────────────────────────────────────────────
export async function withTimeout(promise, timeoutMs = 5000, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// ── Bulk operation wrapper ────────────────────────────────────
export async function bulkOpWithFallback(operations, onError = null) {
  const results = [];
  const errors = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();
      results.push({ success: true, data: result, index: i });
    } catch (error) {
      errors.push({ success: false, error: error.message, index: i });
      results.push({ success: false, error: error.message, index: i });

      if (onError) {
        await onError(error, i);
      }
    }
  }

  return { results, errors, totalErrors: errors.length };
}
