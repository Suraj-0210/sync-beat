import Redis from "ioredis";
import { config } from "../config/config.js";
import logger from "../utils/logger.js";

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      tls: {},
      retryStrategy: (times) => {
        // Retry after increasing delays
        return Math.min(times * 50, 2000);
      },
    });

    this.redis.on("error", (error) => {
      logger.error("Redis Error:", error);
    });

    this.redis.on("connect", () => {
      logger.info("Connected to Azure Redis Cache");
    });

    // Room cleanup configuration
    this.ROOM_EXPIRY = 24 * 60 * 60; // 24 hours
    this.INACTIVE_CLEANUP = 30 * 60; // 30 minutes
  }

  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Cache Get Error:", error);
      return null;
    }
  }

  async set(key, value, expirySeconds = 3600) {
    try {
      await this.redis.setex(key, expirySeconds, JSON.stringify(value));
    } catch (error) {
      logger.error("Cache Set Error:", error);
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error("Cache Delete Error:", error);
    }
  }

  // Room-specific methods
  async getRoomState(roomCode) {
    return this.get(`room:${roomCode}:state`);
  }

  async setRoomState(roomCode, state) {
    await this.set(`room:${roomCode}:state`, state, this.ROOM_EXPIRY);
  }

  async getRoomUsers(roomCode) {
    return this.get(`room:${roomCode}:users`);
  }

  async setRoomUsers(roomCode, users) {
    await this.set(`room:${roomCode}:users`, users, this.ROOM_EXPIRY);

    // If room is empty, schedule cleanup
    if (users.length === 0) {
      this.scheduleRoomCleanup(roomCode);
    }
  }

  async getRoomMessages(roomCode) {
    return this.get(`room:${roomCode}:messages`);
  }

  async setRoomMessages(roomCode, messages) {
    await this.set(`room:${roomCode}:messages`, messages, this.ROOM_EXPIRY);
  }

  // Room cleanup methods
  async scheduleRoomCleanup(roomCode) {
    logger.info(`Scheduling cleanup for empty room: ${roomCode}`);

    // Set a cleanup flag with expiry
    await this.set(
      `room:${roomCode}:cleanup`,
      { scheduledAt: Date.now() },
      this.INACTIVE_CLEANUP,
    );

    // Schedule the actual cleanup
    setTimeout(async () => {
      await this.cleanupRoomIfEmpty(roomCode);
    }, this.INACTIVE_CLEANUP * 1000);
  }

  async cleanupRoomIfEmpty(roomCode) {
    try {
      const users = await this.getRoomUsers(roomCode);
      const cleanupFlag = await this.get(`room:${roomCode}:cleanup`);

      // Only cleanup if the room is still empty and cleanup wasn't cancelled
      if (!users || (users.length === 0 && cleanupFlag)) {
        await this.cleanupRoom(roomCode);
        logger.info(`Cleaned up inactive room: ${roomCode}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up room ${roomCode}:`, error);
    }
  }

  async cleanupRoom(roomCode) {
    const keys = [
      `room:${roomCode}:state`,
      `room:${roomCode}:users`,
      `room:${roomCode}:messages`,
      `room:${roomCode}:cleanup`,
    ];

    for (const key of keys) {
      await this.del(key);
    }
  }

  async cancelRoomCleanup(roomCode) {
    await this.del(`room:${roomCode}:cleanup`);
  }
}

export default new CacheService();
