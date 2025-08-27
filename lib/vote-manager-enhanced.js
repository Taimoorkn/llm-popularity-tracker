import dbManager from './database.js';
import cacheManager from './cache.js';
import logger from './logger.js';

class EnhancedVoteManager {
  constructor() {
    this.initialized = false;
    this.materializedViewRefreshInterval = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await dbManager.initialize();
      await cacheManager.initialize();
      
      // Setup periodic materialized view refresh (if they exist)
      this.setupMaterializedViewRefresh();
      
      this.initialized = true;
      logger.info('Enhanced Vote Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Enhanced Vote Manager:', error);
      throw error;
    }
  }

  setupMaterializedViewRefresh() {
    // Check if materialized views exist before setting up refresh
    this.materializedViewRefreshInterval = setInterval(async () => {
      try {
        await this.refreshMaterializedViews();
      } catch (error) {
        // Materialized views might not exist yet, that's ok
        logger.debug('Materialized views not available yet');
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async refreshMaterializedViews() {
    try {
      // Try to refresh if they exist (PostgreSQL doesn't support IF EXISTS with REFRESH)
      await dbManager.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vote_summary');
    } catch (error) {
      // Ignore errors if views don't exist
      if (!error.message.includes('does not exist')) {
        logger.debug('Materialized view refresh error:', error.message);
      }
    }
    
    try {
      await dbManager.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_stats');
    } catch (error) {
      // Ignore if view doesn't exist
      if (!error.message.includes('does not exist')) {
        logger.debug('Hourly stats view refresh error:', error.message);
      }
    }
  }

  async vote(fingerprint, llmId, voteType, metadata = {}) {
    await this.initialize();
    
    const start = Date.now();
    
    try {
      // Enhanced rate limiting
      const rateLimitKey = `rate_limit:vote:${fingerprint}`;
      const rateLimit = await cacheManager.checkRateLimit(rateLimitKey, 60, 60000);
      
      if (rateLimit.exceeded) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        };
      }
      
      return await dbManager.transaction(async (client) => {
        // Get or create user session with caching
        let userSession = await cacheManager.getUserSession(fingerprint);
        
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
          await cacheManager.setUserSession(fingerprint, userSession);
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
        
        // Update aggregate votes
        const { rows: voteRows } = await client.query(
          'SELECT * FROM votes WHERE llm_id = $1',
          [llmId]
        );
        
        if (voteRows.length === 0) {
          await client.query(
            `INSERT INTO votes (llm_id, vote_count, positive_votes, negative_votes)
             VALUES ($1, $2, $3, $4)`,
            [
              llmId,
              voteType,
              voteType === 1 ? 1 : 0,
              voteType === -1 ? 1 : 0
            ]
          );
        } else {
          let { vote_count, positive_votes, negative_votes } = voteRows[0];
          vote_count += voteChange;
          
          if (currentVote === 1) positive_votes--;
          if (currentVote === -1) negative_votes--;
          if (voteType === 1) positive_votes++;
          if (voteType === -1) negative_votes++;
          
          await client.query(
            `UPDATE votes 
             SET vote_count = $2, positive_votes = $3, negative_votes = $4, updated_at = NOW()
             WHERE llm_id = $1`,
            [llmId, vote_count, positive_votes, negative_votes]
          );
        }
        
        // Update user session activity
        await client.query(
          `UPDATE user_sessions 
           SET last_activity = NOW(), vote_count = vote_count + 1
           WHERE fingerprint = $1`,
          [fingerprint]
        );
        
        // Log analytics event
        await client.query(
          `INSERT INTO analytics (event_type, event_data, fingerprint, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'vote',
            JSON.stringify({ llmId, voteType, previousVote: currentVote }),
            fingerprint,
            metadata.ip || null,
            metadata.userAgent || null
          ]
        );
        
        // ALWAYS get fresh votes directly from votes table after an update
        // Don't use materialized view here as it may be stale
        const { rows: freshVoteRows } = await client.query(`
          SELECT l.id, COALESCE(v.vote_count, 0) as count
          FROM llms l
          LEFT JOIN votes v ON l.id = v.llm_id
          ORDER BY l.id
        `);
        
        const votes = {};
        freshVoteRows.forEach(row => {
          votes[row.id] = parseInt(row.count);
        });
        
        // Update caches
        await cacheManager.invalidateVoteCache(llmId);
        await cacheManager.setUserVote(fingerprint, llmId, voteType);
        await cacheManager.setAllVotes(votes);
        
        // Track activity for fraud detection
        await cacheManager.trackUserActivity(fingerprint, {
          action: 'vote',
          llmId,
          voteType,
          previousVote: currentVote
        });
        
        // Publish real-time update
        await cacheManager.publishVoteUpdate(llmId, {
          voteCount: votes[llmId],
          voteType,
          previousVote: currentVote
        });
        
        const duration = Date.now() - start;
        logger.info(`Vote processed in ${duration}ms`, {
          fingerprint: fingerprint.substring(0, 8) + '...',
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
      });
    } catch (error) {
      logger.error('Vote transaction failed:', error);
      throw error;
    }
  }

  async getUserVotes(fingerprint) {
    await this.initialize();
    
    try {
      // Try cache first
      const cached = await cacheManager.getUserVotes(fingerprint);
      if (cached) return cached;
      
      // Fetch from database
      const { rows } = await dbManager.query(
        'SELECT llm_id, vote_type FROM user_votes WHERE fingerprint = $1',
        [fingerprint]
      );
      
      const votes = {};
      rows.forEach(row => {
        votes[row.llm_id] = row.vote_type;
      });
      
      // Cache the result
      await cacheManager.setAllUserVotes(fingerprint, votes);
      
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
      const cached = await cacheManager.getAllVotes();
      if (cached) return cached;
      
      // Try materialized view first
      let votes = {};
      try {
        const { rows } = await dbManager.query(
          'SELECT llm_id, vote_count FROM mv_vote_summary'
        );
        rows.forEach(row => {
          votes[row.llm_id] = parseInt(row.vote_count);
        });
      } catch (error) {
        // Fallback to regular query
        const { rows } = await dbManager.query(`
          SELECT l.id, COALESCE(v.vote_count, 0) as count
          FROM llms l
          LEFT JOIN votes v ON l.id = v.llm_id
          ORDER BY l.id
        `);
        
        rows.forEach(row => {
          votes[row.id] = parseInt(row.count);
        });
      }
      
      // Cache the result
      await cacheManager.setAllVotes(votes);
      
      return votes;
    } catch (error) {
      logger.error('Failed to get votes:', error);
      
      // Fallback to empty votes
      const votes = {};
      const { llmData } = await import('./llm-data.js');
      llmData.forEach(llm => {
        votes[llm.id] = 0;
      });
      return votes;
    }
  }

  async getRankings() {
    await this.initialize();
    
    try {
      // Try cache first
      const cached = await cacheManager.getRankings();
      if (cached) return cached;
      
      // Try materialized view first
      let rankings = [];
      try {
        const { rows } = await dbManager.query(
          'SELECT llm_id as id, vote_count as count, rank FROM mv_vote_summary ORDER BY rank'
        );
        rankings = rows.map(row => ({
          id: row.id,
          count: parseInt(row.count),
          rank: parseInt(row.rank)
        }));
      } catch (error) {
        // Fallback to regular query
        const { rows } = await dbManager.query(`
          SELECT 
            l.id,
            COALESCE(v.vote_count, 0) as count,
            RANK() OVER (ORDER BY COALESCE(v.vote_count, 0) DESC) as rank
          FROM llms l
          LEFT JOIN votes v ON l.id = v.llm_id
          ORDER BY count DESC, l.id
        `);
        
        rankings = rows.map(row => ({
          id: row.id,
          count: parseInt(row.count),
          rank: parseInt(row.rank)
        }));
      }
      
      // Cache the result
      await cacheManager.setRankings(rankings);
      
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
      const cached = await cacheManager.getStats();
      if (cached) return cached;
      
      const now = new Date();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      
      // Use parallel queries for better performance
      const queries = await Promise.all([
        dbManager.query('SELECT COALESCE(SUM(ABS(vote_count)), 0) as total FROM votes'),
        dbManager.query('SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1', [todayStart]),
        dbManager.query('SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1', [oneHourAgo]),
        dbManager.query(`
          SELECT llm_id, COUNT(*) as recent_votes
          FROM user_votes
          WHERE created_at >= $1 AND vote_type != 0
          GROUP BY llm_id
          ORDER BY recent_votes DESC
          LIMIT 3
        `, [oneHourAgo]),
        dbManager.query(`
          SELECT llm_id
          FROM votes
          WHERE vote_count = (SELECT MAX(vote_count) FROM votes)
          LIMIT 1
        `)
      ]);
      
      const stats = {
        totalVotes: parseInt(queries[0].rows[0].total),
        votesToday: parseInt(queries[1].rows[0].count),
        votesLastHour: parseInt(queries[2].rows[0].count),
        trending: queries[3].rows.map(row => row.llm_id),
        topModel: queries[4].rows[0]?.llm_id || null
      };
      
      // Cache the result
      await cacheManager.setStats(stats);
      
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
      const activities = await cacheManager.getUserActivityHistory(fingerprint, 100);
      
      // Check for suspicious patterns
      const suspiciousPatterns = {
        rapidVoting: false,
        sameTargetRepetition: false,
        unusualVolume: false
      };
      
      // Check for rapid voting
      const oneMinuteAgo = Date.now() - 60000;
      const recentVotes = activities.filter(a => 
        a.activity?.action === 'vote' && a.timestamp > oneMinuteAgo
      );
      
      if (recentVotes.length > 10) {
        suspiciousPatterns.rapidVoting = true;
      }
      
      // Check for same target repetition
      const voteCounts = {};
      activities.forEach(a => {
        if (a.activity?.action === 'vote' && a.activity?.llmId) {
          voteCounts[a.activity.llmId] = (voteCounts[a.activity.llmId] || 0) + 1;
        }
      });
      
      const maxVotes = Math.max(...Object.values(voteCounts), 0);
      if (maxVotes > 20) {
        suspiciousPatterns.sameTargetRepetition = true;
      }
      
      // Check for unusual volume
      if (activities.length > 100) {
        suspiciousPatterns.unusualVolume = true;
      }
      
      const isSuspicious = Object.values(suspiciousPatterns).some(v => v);
      
      if (isSuspicious) {
        logger.warn('Suspicious activity detected', { 
          fingerprint: fingerprint.substring(0, 8) + '...', 
          patterns: suspiciousPatterns 
        });
        
        // Implement temporary restrictions
        await cacheManager.setTemporaryRestriction(fingerprint, 3600);
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
      const dbHealth = await dbManager.healthCheck();
      const cacheHealth = await cacheManager.healthCheck();
      
      return {
        database: dbHealth,
        cache: cacheHealth,
        status: dbHealth.postgres && cacheHealth.status === 'healthy' ? 'healthy' : 'degraded'
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
  }
}

// Singleton instance
let voteManager;

export function getEnhancedVoteManager() {
  if (!voteManager) {
    voteManager = new EnhancedVoteManager();
  }
  return voteManager;
}

export default getEnhancedVoteManager();