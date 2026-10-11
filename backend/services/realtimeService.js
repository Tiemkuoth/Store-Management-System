/**
 * Real-time Updates Service
 * Manages Server-Sent Events (SSE) connections for live updates
 * Broadcasts inventory changes, task updates, and notifications
 */

class RealtimeService {
  constructor() {
    this.clients = new Map(); // userId -> Set of response objects
    this.updateQueue = []; // Queue of pending updates
    this.maxQueueSize = 1000;
  }

  /**
   * Register a new SSE client
   */
  addClient(userId, res) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(res);
    
    console.log(`✅ SSE Client connected for user ${userId} (total: ${this.clients.get(userId).size})`);

    // Send keep-alive every 30 seconds to prevent connection timeout
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (e) {
        console.log(`❌ Keep-alive failed for user ${userId}, removing client`);
        this.removeClient(userId, res);
        clearInterval(keepAliveInterval);
      }
    }, 30000);

    // Clean up on client disconnect
    res.on('close', () => {
      this.removeClient(userId, res);
      clearInterval(keepAliveInterval);
    });

    res.on('error', (err) => {
      console.error(`SSE error for user ${userId}:`, err.message);
      this.removeClient(userId, res);
      clearInterval(keepAliveInterval);
    });
  }

  /**
   * Remove SSE client
   */
  removeClient(userId, res) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(res);
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
      console.log(`❌ SSE Client disconnected for user ${userId}`);
    }
  }

  /**
   * Broadcast update to specific user
   */
  broadcastToUser(userId, event, data) {
    const clients = this.clients.get(userId);
    if (!clients || clients.size === 0) {
      // User not connected, queue for later
      this._queueUpdate(userId, event, data);
      return false;
    }

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sentCount = 0;

    clients.forEach((res) => {
      try {
        res.write(message);
        sentCount++;
      } catch (e) {
        console.error(`Failed to send SSE to user ${userId}:`, e.message);
        this.removeClient(userId, res);
      }
    });

    return sentCount > 0;
  }

  /**
   * Broadcast update to multiple users
   */
  broadcastToUsers(userIds, event, data) {
    userIds.forEach((userId) => {
      this.broadcastToUser(userId, event, data);
    });
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastToAll(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let totalSent = 0;

    this.clients.forEach((clientSet, userId) => {
      clientSet.forEach((res) => {
        try {
          res.write(message);
          totalSent++;
        } catch (e) {
          console.error(`Failed to broadcast to user ${userId}:`, e.message);
          this.removeClient(userId, res);
        }
      });
    });

    return totalSent;
  }

  /**
   * Queue an update for later delivery (when client reconnects)
   */
  _queueUpdate(userId, event, data) {
    this.updateQueue.push({ userId, event, data, timestamp: Date.now() });
    if (this.updateQueue.length > this.maxQueueSize) {
      this.updateQueue.shift(); // Remove oldest
    }
  }

  /**
   * Get queued updates for a user (on reconnect)
   */
  getQueuedUpdates(userId) {
    const updates = this.updateQueue.filter((u) => u.userId === userId);
    // Remove delivered updates from queue
    this.updateQueue = this.updateQueue.filter((u) => u.userId !== userId);
    return updates;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    let totalClients = 0;
    this.clients.forEach((set) => {
      totalClients += set.size;
    });
    return {
      connectedUsers: this.clients.size,
      totalConnections: totalClients,
      queuedUpdates: this.updateQueue.length,
    };
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();

export default realtimeService;
