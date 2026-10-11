/**
 * Safe wrapper for syncMySQLToFallback with error handling and logging
 */

import { syncMySQLToFallback } from '../db/db.js';
import { retryWithBackoff } from './resilience.js';

const SYNC_TIMEOUT_MS = 3000; // 3 second timeout for sync operations

/**
 * Safely sync MySQL to fallback store without blocking request
 * Runs in background with retry logic
 */
export async function safeSyncToFallback() {
  try {
    // Use retry wrapper with exponential backoff
    await retryWithBackoff(
      async () => {
        // Timeout after 3 seconds to prevent hanging
        const syncPromise = syncMySQLToFallback();
        return Promise.race([
          syncPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Sync timeout')),
              SYNC_TIMEOUT_MS
            )
          ),
        ]);
      },
      2, // Max 2 retries
      200 // Initial delay
    );

    console.log('✅ Fallback sync completed');
  } catch (error) {
    // Log error but don't fail the request
    console.error('⚠️ Fallback sync failed (non-critical):', error.message);
    // Silently fail - fallback sync is not critical for request success
  }
}

/**
 * Fire-and-forget sync (non-blocking)
 * Safely trigger sync in background without awaiting
 */
export function triggerBackgroundSync() {
  // Schedule sync for next event loop tick
  setImmediate(() => {
    safeSyncToFallback().catch(err =>
      console.error('Background sync error:', err.message)
    );
  });
}

/**
 * Batch sync wrapper for multiple operations
 */
export async function batchSyncToFallback(operations = 1) {
  // Debounce multiple sync calls
  clearTimeout(globalThis._syncTimeout);
  
  globalThis._syncTimeout = setTimeout(() => {
    safeSyncToFallback().catch(err =>
      console.error('Batch sync error:', err.message)
    );
  }, 500); // Wait 500ms to batch syncs
}
