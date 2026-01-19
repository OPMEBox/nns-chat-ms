/**
 * Manages online presence for users
 * Tracks which users are online and their socket connections
 * Note: For horizontal scaling, this should be replaced with Redis
 */
export class PresenceManager {
  // userId -> Set of socketIds (user can have multiple tabs/devices)
  private presence: Map<string, Set<string>> = new Map();

  /**
   * Add a socket connection for a user
   */
  addConnection(userId: string, socketId: string): void {
    if (!this.presence.has(userId)) {
      this.presence.set(userId, new Set());
    }
    this.presence.get(userId)!.add(socketId);
  }

  /**
   * Remove a socket connection for a user
   * Returns true if the user is now completely offline
   */
  removeConnection(userId: string, socketId: string): boolean {
    const userSockets = this.presence.get(userId);
    if (!userSockets) {
      return false;
    }

    userSockets.delete(socketId);

    if (userSockets.size === 0) {
      this.presence.delete(userId);
      return true; // User is now offline
    }

    return false;
  }

  /**
   * Check if a user is online
   */
  isOnline(userId: string): boolean {
    const userSockets = this.presence.get(userId);
    return userSockets !== undefined && userSockets.size > 0;
  }

  /**
   * Get online status for multiple users
   */
  getOnlineUsers(userIds: string[]): string[] {
    return userIds.filter(userId => this.isOnline(userId));
  }

  /**
   * Get all socket IDs for a user
   */
  getSocketIds(userId: string): string[] {
    const userSockets = this.presence.get(userId);
    return userSockets ? Array.from(userSockets) : [];
  }

  /**
   * Get total online user count
   */
  getOnlineCount(): number {
    return this.presence.size;
  }

  /**
   * Get all online user IDs
   */
  getAllOnlineUserIds(): string[] {
    return Array.from(this.presence.keys());
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();

