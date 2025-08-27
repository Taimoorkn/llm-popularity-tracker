import scaledDbManager from './database-scaled.js';
import logger from './logger.js';

class EnhancedCacheManager {
  constructor() {
    this.redis = null;
    this.memoryCache = new Map();
    this.memoryCacheTTL = 60000; // 1 minute for L1 cache
    this.defaultTTL = 3600; // 1 hour for L2 cache
    this.pubsubClient = null;
    this.subscribers = new Map();
  }

  async initialize() {
    try {
      // Get Redis clients for different purposes
      this.redis = scaledDbManager.getRedis('cache');
      this.pubsubClient = scaledDbManager.getRedis('pubsub');
      
      // Setup cleanup interval for memory cache
      setInterval(() => this.cleanupMemoryCache(), 30000);
      
      logger.info('Enhanced Cache Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize Enhanced Cache Manager:', error);
      throw error;
    }
  }

  // L1 Cache (Memory) operations
  getFromMemory(key) {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.value;
  }

  setInMemory(key, value, ttl = this.memoryCacheTTL) {
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, data] of this.memoryCache.entries()) {
      if (now > data.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Multi-layer cache operations
  async getWithLayers(key) {
    // Check L1 (Memory)
    const memoryValue = this.getFromMemory(key);
    if (memoryValue !== null) {
      return { value: memoryValue, source: 'memory' };
    }
    
    // Check L2 (Redis)
    try {
      const redisValue = await this.redis.get(key);
      if (redisValue) {
        const parsed = JSON.parse(redisValue);
        // Populate L1 cache
        this.setInMemory(key, parsed);
        return { value: parsed, source: 'redis' };
      }
    } catch (error) {
      logger.error('Redis get failed:', error);
    }
    
    return { value: null, source: null };
  }

  async setWithLayers(key, value, options = {}) {
    const { memoryTTL = this.memoryCacheTTL, redisTTL = this.defaultTTL } = options;
    
    // Set in L1 (Memory)
    this.setInMemory(key, value, memoryTTL);
    
    // Set in L2 (Redis)
    try {
      await this.redis.setex(key, redisTTL, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis set failed:', error);
    }
  }

  // Vote counting cache with optimizations
  async getVoteCount(llmId) {
    const { value } = await this.getWithLayers(`vote_count:${llmId}`);
    return value ? parseInt(value, 10) : null;
  }

  async setVoteCount(llmId, count, ttl = 300) {
    await this.setWithLayers(`vote_count:${llmId}`, count, {
      memoryTTL: 60000,
      redisTTL: ttl
    });
  }

  async incrementVoteCount(llmId, increment = 1) {
    try {
      const newCount = await this.redis.incrby(`vote_count:${llmId}`, increment);
      await this.redis.expire(`vote_count:${llmId}`, 300);
      // Update memory cache
      this.setInMemory(`vote_count:${llmId}`, newCount);
      return newCount;
    } catch (error) {
      logger.error('Redis increment vote count failed:', error);
      return null;
    }
  }

  // All votes cache
  async getAllVotes() {
    const { value } = await this.getWithLayers('all_votes');
    return value;
  }

  async setAllVotes(votesData, ttl = 60) {
    await this.setWithLayers('all_votes', votesData, {
      memoryTTL: 30000,
      redisTTL: ttl
    });
  }

  // User session cache
  async getUserSession(fingerprint) {
    const { value } = await this.getWithLayers(`user_session:${fingerprint}`);
    return value;
  }

  async setUserSession(fingerprint, sessionData, ttl = 86400) {
    await this.setWithLayers(`user_session:${fingerprint}`, sessionData, {
      memoryTTL: 300000, // 5 minutes
      redisTTL: ttl
    });
  }

  // User votes cache with batching
  async getUserVotes(fingerprint) {
    const { value } = await this.getWithLayers(`user_votes:${fingerprint}`);
    if (value) return value;
    
    // Try Redis hash for individual votes
    try {
      const cached = await this.redis.hgetall(`user_votes:${fingerprint}`);
      const votes = {};
      for (const [llmId, voteType] of Object.entries(cached)) {
        votes[llmId] = parseInt(voteType, 10);
      }
      
      if (Object.keys(votes).length > 0) {
        // Cache in memory
        this.setInMemory(`user_votes:${fingerprint}`, votes);
        return votes;
      }
    } catch (error) {
      logger.error('Redis get user votes failed:', error);
    }
    
    return null;
  }

  async setUserVote(fingerprint, llmId, voteType) {
    try {
      // Update Redis hash
      if (voteType === 0) {
        await this.redis.hdel(`user_votes:${fingerprint}`, llmId);
      } else {
        await this.redis.hset(`user_votes:${fingerprint}`, llmId, voteType.toString());
      }
      await this.redis.expire(`user_votes:${fingerprint}`, 86400);
      
      // Invalidate memory cache
      this.memoryCache.delete(`user_votes:${fingerprint}`);
    } catch (error) {
      logger.error('Redis set user vote failed:', error);
    }
  }

  async setAllUserVotes(fingerprint, votes, ttl = 86400) {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.del(`user_votes:${fingerprint}`);
      
      for (const [llmId, voteType] of Object.entries(votes)) {
        if (voteType !== 0) {
          pipeline.hset(`user_votes:${fingerprint}`, llmId, voteType.toString());
        }
      }
      
      pipeline.expire(`user_votes:${fingerprint}`, ttl);
      await pipeline.exec();
      
      // Update memory cache
      this.setInMemory(`user_votes:${fingerprint}`, votes);
    } catch (error) {
      logger.error('Redis set all user votes failed:', error);
    }
  }

  // Rankings cache
  async getRankings() {
    const { value } = await this.getWithLayers('rankings');
    return value;
  }

  async setRankings(rankings, ttl = 60) {
    await this.setWithLayers('rankings', rankings, {
      memoryTTL: 30000,
      redisTTL: ttl
    });
  }

  // Statistics cache
  async getStats() {
    const { value } = await this.getWithLayers('stats');
    return value;
  }

  async setStats(stats, ttl = 60) {
    await this.setWithLayers('stats', stats, {
      memoryTTL: 30000,
      redisTTL: ttl
    });
  }

  // Enhanced rate limiting with sliding window
  async checkRateLimit(key, maxRequests = 100, windowMs = 900000) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Use Redis sorted set for sliding window
      const pipeline = this.redis.pipeline();
      
      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Count requests in window
      pipeline.zcard(key);
      
      // Set expiry
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[2][1];
      
      return {
        totalRequests: count,
        remainingRequests: Math.max(0, maxRequests - count),
        resetTime: new Date(now + windowMs),
        exceeded: count > maxRequests
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return {
        totalRequests: 0,
        remainingRequests: maxRequests,
        resetTime: new Date(Date.now() + windowMs),
        exceeded: false
      };
    }
  }

  // Temporary restrictions for fraud prevention
  async setTemporaryRestriction(fingerprint, durationSeconds) {
    try {
      await this.redis.setex(
        `restriction:${fingerprint}`,
        durationSeconds,
        JSON.stringify({
          restricted: true,
          until: new Date(Date.now() + durationSeconds * 1000)
        })
      );
    } catch (error) {
      logger.error('Failed to set temporary restriction:', error);
    }
  }

  async checkRestriction(fingerprint) {
    try {
      const restricted = await this.redis.get(`restriction:${fingerprint}`);
      return restricted ? JSON.parse(restricted) : null;
    } catch (error) {
      logger.error('Failed to check restriction:', error);
      return null;
    }
  }

  // Activity tracking for fraud detection
  async trackUserActivity(fingerprint, activity) {
    try {
      const key = `activity:${fingerprint}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.lpush(key, JSON.stringify({
        activity,
        timestamp: Date.now()
      }));
      pipeline.ltrim(key, 0, 999); // Keep last 1000 activities
      pipeline.expire(key, 86400); // 24 hours
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Failed to track user activity:', error);
    }
  }

  async getUserActivityHistory(fingerprint, limit = 100) {
    try {
      const activities = await this.redis.lrange(`activity:${fingerprint}`, 0, limit - 1);
      return activities.map(activity => JSON.parse(activity));
    } catch (error) {
      logger.error('Failed to get activity history:', error);
      return [];
    }
  }

  // Real-time updates pub/sub
  async publishVoteUpdate(llmId, voteData) {
    try {
      const message = JSON.stringify({
        llmId,
        ...voteData,
        timestamp: Date.now()
      });
      
      await this.pubsubClient.publish('vote_updates', message);
      await this.pubsubClient.publish(`vote_updates:${llmId}`, message);
    } catch (error) {
      logger.error('Failed to publish vote update:', error);
    }
  }

  async subscribeToVoteUpdates(callback, llmId = null) {
    try {
      const channel = llmId ? `vote_updates:${llmId}` : 'vote_updates';
      
      if (!this.subscribers.has(channel)) {
        const subscriber = scaledDbManager.getRedis('pubsub').duplicate();
        await subscriber.subscribe(channel);
        
        subscriber.on('message', (ch, message) => {
          if (ch === channel) {
            try {
              const data = JSON.parse(message);
              callback(data);
            } catch (error) {
              logger.error('Failed to parse vote update message:', error);
            }
          }
        });
        
        this.subscribers.set(channel, subscriber);
      }
      
      return () => this.unsubscribeFromVoteUpdates(channel);
    } catch (error) {
      logger.error('Failed to subscribe to vote updates:', error);
      return null;
    }
  }

  async unsubscribeFromVoteUpdates(channel) {
    const subscriber = this.subscribers.get(channel);
    if (subscriber) {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
      this.subscribers.delete(channel);
    }
  }

  // Cache invalidation
  async invalidateVoteCache(llmId) {
    try {
      // Clear from memory cache
      this.memoryCache.delete(`vote_count:${llmId}`);
      this.memoryCache.delete('all_votes');
      this.memoryCache.delete('rankings');
      this.memoryCache.delete('stats');
      
      // Clear from Redis
      const pipeline = this.redis.pipeline();
      pipeline.del(`vote_count:${llmId}`);
      pipeline.del('all_votes');
      pipeline.del('rankings');
      pipeline.del('stats');
      await pipeline.exec();
    } catch (error) {
      logger.error('Failed to invalidate vote cache:', error);
    }
  }

  async invalidateAllCaches() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Clear Redis caches
      const pattern = 'vote_count:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      await this.redis.del('all_votes', 'rankings', 'stats');
      
      logger.info('All caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate all caches:', error);
    }
  }

  // Batch operations for efficiency
  async batchGet(keys) {
    const results = {};
    const missingKeys = [];
    
    // Check memory cache first
    for (const key of keys) {
      const value = this.getFromMemory(key);
      if (value !== null) {
        results[key] = value;
      } else {
        missingKeys.push(key);
      }
    }
    
    // Fetch missing keys from Redis
    if (missingKeys.length > 0) {
      try {
        const pipeline = this.redis.pipeline();
        for (const key of missingKeys) {
          pipeline.get(key);
        }
        const redisResults = await pipeline.exec();
        
        for (let i = 0; i < missingKeys.length; i++) {
          const [err, value] = redisResults[i];
          if (!err && value) {
            const parsed = JSON.parse(value);
            results[missingKeys[i]] = parsed;
            this.setInMemory(missingKeys[i], parsed);
          }
        }
      } catch (error) {
        logger.error('Batch get failed:', error);
      }
    }
    
    return results;
  }

  // Health check
  async healthCheck() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      const info = await this.redis.info('memory');
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1];
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        memoryCache: {
          size: this.memoryCache.size,
          maxSize: 10000
        },
        redisMemory: memoryUsage
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Cleanup
  async cleanup() {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Close pub/sub subscribers
    for (const [channel, subscriber] of this.subscribers) {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    }
    this.subscribers.clear();
    
    logger.info('Enhanced Cache Manager cleaned up');
  }
}

// Singleton instance
const enhancedCacheManager = new EnhancedCacheManager();

export default enhancedCacheManager;