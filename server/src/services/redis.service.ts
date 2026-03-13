import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.client) {
      logger.info('[Redis] Already connected');
      return;
    }

    try {
      this.client = createClient({
        url: config.redis?.url || 'redis://localhost:6379',
      });

      this.client.on('error', (err) => {
        logger.error('[Redis] Client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('[Redis] Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('[Redis] Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('[Redis] Redis client initialized');
    } catch (error: any) {
      logger.error('[Redis] Failed to connect:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Get next sequence number for a conversation
   * Uses Redis INCR for atomic increment
   * Falls back to database if Redis is unavailable
   */
  async getNextSeq(conversationId: string): Promise<number | null> {
    if (!this.client || !this.isConnected) {
      logger.warn('[Redis] Not connected, return null for seq');
      return null;
    }

    try {
      const key = `conversation:${conversationId}:seq`;
      const seq = await this.client.incr(key);
      return seq;
    } catch (error: any) {
      logger.error('[Redis] INCR error:', error.message);
      return null;
    }
  }

  /**
   * Get current sequence number for a conversation
   */
  async getCurrentSeq(conversationId: string): Promise<number | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const key = `conversation:${conversationId}:seq`;
      const seq = await this.client.get(key);
      return seq ? parseInt(seq, 10) : null;
    } catch (error: any) {
      logger.error('[Redis] GET error:', error.message);
      return null;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('[Redis] Disconnected');
    }
  }
}

// Export singleton
export const redisService = new RedisService();
export default redisService;
