import scaledDbManager from './database-scaled.js';
import enhancedCacheManager from './cache-enhanced.js';
import logger from './logger.js';

class OptimizedVoteManager {
  constructor() {
    this.initialized = false;
    this.materializedViewRefreshInterval = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await scaledDbManager.initialize();
      await enhancedCacheManager.initialize();
      
      // Setup periodic materialized view refresh
      this.setupMaterializedViewRefresh();
      
      this.initialized = true;
      logger.info('Optimized Vote Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Optimized Vote Manager:', error);
      throw error;
    }
  }

  setupMaterializedViewRefresh() {
    // Refresh materialized views every 5 minutes
    this.materializedViewRefreshInterval = setInterval(async () => {
      try {
        await this.refreshMaterializedViews();
      } catch (error) {
        logger.error('Failed to refresh materialized views:', error);
      }
    }, 5 * 60 * 1000);
  }

  async refreshMaterializedViews() {
    try {
      await scaledDbManager.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vote_summary');
      await scaledDbManager.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_stats');
      logger.info('Materialized views refreshed successfully');
    } catch (error) {
      logger.error('Error refreshing materialized views:', error);
    }
  }

  async vote(fingerprint, llmId, voteType, metadata = {}) {
    await this.initialize();
    
    const start = Date.now();
    
    try {
      // Check rate limiting first
      const rateLimitKey = `rate_limit:vote:${fingerprint}`;
      const rateLimit = await enhancedCacheManager.checkRateLimit(rateLimitKey, 60, 60000);
      
      if (rateLimit.exceeded) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        };
      }
      
      // Use optimized transaction with retries
      return await scaledDbManager.transaction(async (client) => {
        // Get or create user session from cache first
        let userSession = await enhancedCacheManager.getUserSession(fingerprint);
        
        if (!userSession) {
          const { rows } = await client.query(
            'SELECT * FROM user_sessions WHERE fingerprint = $1',
            [fingerprint]
          );
          
          if (rows.length === 0) {
            const { rows: newSession } = await client.query(
              `INSERT INTO user_sessions (fingerprint, ip_address, user_agent)
               VALUES ($1, $2, $3)
               RETURNING *`,
              [fingerprint, metadata.ip || null, metadata.userAgent || null]
            );
            userSession = newSession[0];
          } else {
            userSession = rows[0];
          }
          
          // Cache the session
          await enhancedCacheManager.setUserSession(fingerprint, userSession);
        }
        
        // Check for existing vote
        const { rows: existingVotes } = await client.query(
          'SELECT vote_type FROM user_votes WHERE fingerprint = $1 AND llm_id = $2',
          [fingerprint, llmId]
        );
        
        const currentVote = existingVotes[0]?.vote_type || 0;
        const voteChange = voteType - currentVote;
        
        if (voteChange === 0) {
          return { success: false, error: 'Vote unchanged' };
        }
        
        // Update or insert user vote
        if (currentVote === 0 && voteType !== 0) {
          await client.query(
            `INSERT INTO user_votes (fingerprint, llm_id, vote_type, previous_vote, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fingerprint, llmId, voteType, currentVote, metadata.ip || null, metadata.userAgent || null]
          );
        } else if (voteType === 0) {
          await client.query(
            'DELETE FROM user_votes WHERE fingerprint = $1 AND llm_id = $2',
            [fingerprint, llmId]
          );
        } else {
          await client.query(
            `UPDATE user_votes 
             SET vote_type = $3, previous_vote = $4, updated_at = NOW()
             WHERE fingerprint = $1 AND llm_id = $2`,
            [fingerprint, llmId, voteType, currentVote]
          );
        }
        
        // The trigger will automatically update vote counts
        // Get fresh votes from materialized view for better performance
        const { rows: voteRows } = await client.query(
          'SELECT llm_id, vote_count FROM mv_vote_summary'
        );
        
        const votes = {};
        voteRows.forEach(row => {
          votes[row.llm_id] = parseInt(row.vote_count);
        });
        
        // Update caches
        await enhancedCacheManager.invalidateVoteCache(llmId);
        await enhancedCacheManager.setUserVote(fingerprint, llmId, voteType);
        await enhancedCacheManager.setAllVotes(votes);
        
        // Track user activity for fraud detection
        await enhancedCacheManager.trackUserActivity(fingerprint, {
          action: 'vote',
          llmId,
          voteType,
          previousVote: currentVote
        });
        
        // Publish real-time update
        await enhancedCacheManager.publishVoteUpdate(llmId, {
          voteCount: votes[llmId],
          voteType,
          previousVote: currentVote,
          fingerprint
        });
        
        const duration = Date.now() - start;
        logger.info(`Vote processed in ${duration}ms`, {
          fingerprint,
          llmId,
          voteType,
          duration
        });
        
        return {
          success: true,
          votes,
          userVote: voteType,
          previousVote: currentVote
        };
      }, { maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      logger.error('Vote transaction failed:', error);
      throw error;
    }
  }

  async getUserVotes(fingerprint) {
    await this.initialize();
    
    try {
      // Try multi-layer cache first
      const cached = await enhancedCacheManager.getUserVotes(fingerprint);
      if (cached) return cached;
      
      // Fetch from read replica
      const { rows } = await scaledDbManager.query(
        'SELECT llm_id, vote_type FROM user_votes WHERE fingerprint = $1',
        [fingerprint],
        { isWrite: false }
      );
      
      const votes = {};
      rows.forEach(row => {
        votes[row.llm_id] = row.vote_type;
      });
      
      // Update cache
      await enhancedCacheManager.setAllUserVotes(fingerprint, votes);
      
      return votes;
    } catch (error) {
      logger.error('Failed to get user votes:', error);
      return {};
    }
  }

  async getVotes() {
    await this.initialize();
    
    try {
      // Try cache first
      const cached = await enhancedCacheManager.getAllVotes();
      if (cached) return cached;
      
      // Fetch from materialized view for better performance
      const { rows } = await scaledDbManager.query(
        'SELECT llm_id, vote_count FROM mv_vote_summary',
        [],
        { isWrite: false }
      );
      
      const votes = {};
      rows.forEach(row => {
        votes[row.llm_id] = parseInt(row.vote_count);
      });
      
      // Update cache
      await enhancedCacheManager.setAllVotes(votes);
      
      return votes;
    } catch (error) {
      logger.error('Failed to get votes:', error);
      
      // Fallback to direct query
      const { rows } = await scaledDbManager.query(`
        SELECT l.id, COALESCE(v.vote_count, 0) as count
        FROM llms l
        LEFT JOIN votes v ON l.id = v.llm_id
        ORDER BY l.id
      `, [], { isWrite: false });
      
      const votes = {};
      rows.forEach(row => {
        votes[row.id] = parseInt(row.count);
      });
      
      return votes;
    }
  }

  async getRankings() {
    await this.initialize();
    
    try {
      // Try cache first
      const cached = await enhancedCacheManager.getRankings();
      if (cached) return cached;
      
      // Fetch from materialized view
      const { rows } = await scaledDbManager.query(
        'SELECT llm_id as id, vote_count as count, rank FROM mv_vote_summary ORDER BY rank',
        [],
        { isWrite: false }
      );
      
      const rankings = rows.map(row => ({
        id: row.id,
        count: parseInt(row.count),
        rank: parseInt(row.rank)
      }));
      
      // Update cache
      await enhancedCacheManager.setRankings(rankings);
      
      return rankings;
    } catch (error) {
      logger.error('Failed to get rankings:', error);
      return [];
    }
  }

  async getStats() {
    await this.initialize();
    
    try {
      // Try cache first
      const cached = await enhancedCacheManager.getStats();
      if (cached) return cached;
      
      const now = new Date();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      
      // Use parallel queries for better performance
      const [totalResult, todayResult, hourResult, trendingResult, topResult] = await Promise.all([
        scaledDbManager.query(
          'SELECT COALESCE(SUM(ABS(vote_count)), 0) as total FROM mv_vote_summary',
          [],
          { isWrite: false }
        ),
        scaledDbManager.query(
          'SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1',
          [todayStart],
          { isWrite: false }
        ),
        scaledDbManager.query(
          'SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1',
          [oneHourAgo],
          { isWrite: false }
        ),
        scaledDbManager.query(`
          SELECT llm_id, SUM(vote_count) as recent_votes
          FROM mv_hourly_stats
          WHERE hour >= $1
          GROUP BY llm_id
          ORDER BY recent_votes DESC
          LIMIT 3
        `, [oneHourAgo], { isWrite: false }),
        scaledDbManager.query(
          'SELECT llm_id FROM mv_vote_summary WHERE rank = 1 LIMIT 1',
          [],
          { isWrite: false }
        )
      ]);
      
      const stats = {
        totalVotes: parseInt(totalResult.rows[0].total),
        votesToday: parseInt(todayResult.rows[0].count),
        votesLastHour: parseInt(hourResult.rows[0].count),
        trending: trendingResult.rows.map(row => row.llm_id),
        topModel: topResult.rows[0]?.llm_id || null
      };
      
      // Update cache
      await enhancedCacheManager.setStats(stats);
      
      return stats;
    } catch (error) {
      logger.error('Failed to get stats:', error);
      return {
        totalVotes: 0,
        votesToday: 0,
        votesLastHour: 0,
        trending: [],
        topModel: null
      };
    }
  }

  async syncUserVotes(fingerprint) {
    await this.initialize();
    
    try {
      // Use parallel fetching for better performance
      const [userVotes, allVotes, rankings, stats] = await Promise.all([
        this.getUserVotes(fingerprint),
        this.getVotes(),
        this.getRankings(),
        this.getStats()
      ]);
      
      return {
        votes: allVotes,
        userVotes,
        rankings,
        stats
      };
    } catch (error) {
      logger.error('Failed to sync user votes:', error);
      throw error;
    }
  }

  async detectFraud(fingerprint) {
    try {
      // Get user activity history
      const activities = await enhancedCacheManager.getUserActivityHistory(fingerprint, 100);
      
      // Check for suspicious patterns
      const suspiciousPatterns = {
        rapidVoting: false,
        sameTargetRepetition: false,
        unusualVolume: false
      };
      
      // Check for rapid voting (more than 10 votes per minute)
      const oneMinuteAgo = Date.now() - 60000;
      const recentVotes = activities.filter(a => 
        a.activity.action === 'vote' && a.timestamp > oneMinuteAgo
      );
      
      if (recentVotes.length > 10) {
        suspiciousPatterns.rapidVoting = true;
      }
      
      // Check for same target repetition
      const voteCounts = {};
      activities.forEach(a => {
        if (a.activity.action === 'vote') {
          voteCounts[a.activity.llmId] = (voteCounts[a.activity.llmId] || 0) + 1;
        }
      });
      
      const maxVotes = Math.max(...Object.values(voteCounts));
      if (maxVotes > 20) {
        suspiciousPatterns.sameTargetRepetition = true;
      }
      
      // Check for unusual volume
      if (activities.length > 100) {
        suspiciousPatterns.unusualVolume = true;
      }
      
      const isSuspicious = Object.values(suspiciousPatterns).some(v => v);
      
      if (isSuspicious) {
        logger.warn('Suspicious activity detected', { fingerprint, patterns: suspiciousPatterns });
        
        // Implement temporary restrictions
        await enhancedCacheManager.setTemporaryRestriction(fingerprint, 3600); // 1 hour
      }
      
      return {
        suspicious: isSuspicious,
        patterns: suspiciousPatterns
      };
    } catch (error) {
      logger.error('Failed to detect fraud:', error);
      return { suspicious: false, patterns: {} };
    }
  }

  async checkHealth() {
    try {
      const dbHealth = await scaledDbManager.healthCheck();
      const cacheHealth = await enhancedCacheManager.healthCheck();
      const poolStats = await scaledDbManager.getPoolStats();
      
      const isHealthy = dbHealth.postgresqlPrimary && 
                       dbHealth.redis && 
                       cacheHealth.status === 'healthy';
      
      return {
        database: dbHealth,
        cache: cacheHealth,
        poolStats,
        status: isHealthy ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async cleanup() {
    if (this.materializedViewRefreshInterval) {
      clearInterval(this.materializedViewRefreshInterval);
    }
    
    await scaledDbManager.closeAll();
  }
}

// Singleton instance
let voteManager;

export function getOptimizedVoteManager() {
  if (!voteManager) {
    voteManager = new OptimizedVoteManager();
  }
  return voteManager;
}

export default getOptimizedVoteManager();