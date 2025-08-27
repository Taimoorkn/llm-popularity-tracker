import dbManager from './database.js';
import logger from './logger.js';

class CacheManager {
  constructor() {
    this.redis = null;
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  async initialize() {
    this.redis = dbManager.getRedis();
  }

  // Vote counting cache
  async getVoteCount(llmId) {
    try {
      const cached = await this.redis.get(`vote_count:${llmId}`);
      return cached ? parseInt(cached, 10) : null;
    } catch (error) {
      logger.error('Redis get vote count failed:', error);
      return null;
    }
  }

  async setVoteCount(llmId, count, ttl = this.defaultTTL) {
    try {
      await this.redis.setex(`vote_count:${llmId}`, ttl, count.toString());
    } catch (error) {
      logger.error('Redis set vote count failed:', error);
    }
  }

  async incrementVoteCount(llmId, increment = 1) {
    try {
      const newCount = await this.redis.incrby(`vote_count:${llmId}`, increment);
      await this.redis.expire(`vote_count:${llmId}`, this.defaultTTL);
      return newCount;
    } catch (error) {
      logger.error('Redis increment vote count failed:', error);
      return null;
    }
  }

  // All votes cache
  async getAllVotes() {
    try {
      const cached = await this.redis.get('all_votes');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Redis get all votes failed:', error);
      return null;
    }
  }

  async setAllVotes(votesData, ttl = 300) { // 5 minutes for all votes
    try {
      await this.redis.setex('all_votes', ttl, JSON.stringify(votesData));
    } catch (error) {
      logger.error('Redis set all votes failed:', error);
    }
  }

  // User session cache
  async getUserSession(fingerprint) {
    try {
      const cached = await this.redis.get(`user_session:${fingerprint}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Redis get user session failed:', error);
      return null;
    }
  }

  async setUserSession(fingerprint, sessionData, ttl = 86400) { // 24 hours
    try {
      await this.redis.setex(
        `user_session:${fingerprint}`,
        ttl,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      logger.error('Redis set user session failed:', error);
    }
  }

  // User votes cache
  async getUserVotes(fingerprint) {
    try {
      const cached = await this.redis.hgetall(`user_votes:${fingerprint}`);
      const votes = {};
      for (const [llmId, voteType] of Object.entries(cached)) {
        votes[llmId] = parseInt(voteType, 10);
      }
      return Object.keys(votes).length > 0 ? votes : null;
    } catch (error) {
      logger.error('Redis get user votes failed:', error);
      return null;
    }
  }

  async setUserVote(fingerprint, llmId, voteType) {
    try {
      if (voteType === 0) {
        await this.redis.hdel(`user_votes:${fingerprint}`, llmId);
      } else {
        await this.redis.hset(`user_votes:${fingerprint}`, llmId, voteType.toString());
      }
      await this.redis.expire(`user_votes:${fingerprint}`, 86400); // 24 hours
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
    } catch (error) {
      logger.error('Redis set all user votes failed:', error);
    }
  }

  // Rankings cache
  async getRankings() {
    try {
      const cached = await this.redis.get('rankings');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Redis get rankings failed:', error);
      return null;
    }
  }

  async setRankings(rankings, ttl = 300) { // 5 minutes
    try {
      await this.redis.setex('rankings', ttl, JSON.stringify(rankings));
    } catch (error) {
      logger.error('Redis set rankings failed:', error);
    }
  }

  // Statistics cache
  async getStats() {
    try {
      const cached = await this.redis.get('stats');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Redis get stats failed:', error);
      return null;
    }
  }

  async setStats(stats, ttl = 300) { // 5 minutes
    try {
      await this.redis.setex('stats', ttl, JSON.stringify(stats));
    } catch (error) {
      logger.error('Redis set stats failed:', error);
    }
  }

  // Rate limiting
  async checkRateLimit(key, maxRequests = 100, windowMs = 900000) { // 15 minutes default
    try {
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      
      const ttl = await this.redis.ttl(key);
      
      return {
        totalRequests: current,
        remainingRequests: Math.max(0, maxRequests - current),
        resetTime: new Date(Date.now() + ttl * 1000),
        exceeded: current > maxRequests
      };
    } catch (error) {
      logger.error('Redis rate limit check failed:', error);
      return {
        totalRequests: 0,
        remainingRequests: maxRequests,
        resetTime: new Date(Date.now() + windowMs),
        exceeded: false
      };
    }
  }

  // Session tracking for fraud detection
  async trackUserActivity(fingerprint, activity) {
    try {
      const key = `activity:${fingerprint}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.lpush(key, JSON.stringify({
        activity,
        timestamp: Date.now()
      }));
      pipeline.ltrim(key, 0, 99); // Keep last 100 activities
      pipeline.expire(key, 86400); // 24 hours
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Redis track activity failed:', error);
    }
  }

  async getUserActivityHistory(fingerprint, limit = 20) {
    try {
      const activities = await this.redis.lrange(`activity:${fingerprint}`, 0, limit - 1);
      return activities.map(activity => JSON.parse(activity));
    } catch (error) {
      logger.error('Redis get activity history failed:', error);
      return [];
    }
  }

  // Real-time updates pub/sub
  async publishVoteUpdate(llmId, voteData) {
    try {
      await this.redis.publish('vote_updates', JSON.stringify({
        llmId,
        ...voteData,
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('Redis publish vote update failed:', error);
    }
  }

  async subscribeToVoteUpdates(callback) {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe('vote_updates');
      subscriber.on('message', (channel, message) => {
        if (channel === 'vote_updates') {
          try {
            const data = JSON.parse(message);
            callback(data);
          } catch (error) {
            logger.error('Failed to parse vote update message:', error);
          }
        }
      });
      return subscriber;
    } catch (error) {
      logger.error('Redis subscribe to vote updates failed:', error);
      return null;
    }
  }

  // Cache invalidation
  async invalidateVoteCache(llmId) {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.del(`vote_count:${llmId}`);
      pipeline.del('all_votes');
      pipeline.del('rankings');
      pipeline.del('stats');
      await pipeline.exec();
    } catch (error) {
      logger.error('Redis invalidate vote cache failed:', error);
    }
  }

  async invalidateAllCaches() {
    try {
      const pattern = 'vote_count:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      await this.redis.del('all_votes', 'rankings', 'stats');
    } catch (error) {
      logger.error('Redis invalidate all caches failed:', error);
    }
  }

  // Cleanup expired keys
  async cleanup() {
    try {
      // This is handled automatically by Redis TTL, but we can add custom cleanup logic
      const expiredSessions = await this.redis.keys('user_session:*');
      let cleanedCount = 0;
      
      for (const key of expiredSessions) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // Key exists but has no TTL
          await this.redis.expire(key, 86400); // Set 24 hour TTL
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} session keys without TTL`);
      }
    } catch (error) {
      logger.error('Redis cleanup failed:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager();

export default cacheManager;