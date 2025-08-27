import dbManager from './database.js';
import cacheManager from './cache.js';
import logger from './logger.js';

class DatabaseVoteManager {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await dbManager.initialize();
      await cacheManager.initialize();
      this.initialized = true;
      logger.info('DatabaseVoteManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DatabaseVoteManager:', error);
      throw error;
    }
  }

  async vote(fingerprint, llmId, voteType, metadata = {}) {
    await this.initialize();
    
    try {
      return await dbManager.transaction(async (client) => {
        // Get or create user session
        let userSession = await this.getOrCreateUserSession(client, fingerprint, metadata);
        
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
          // New vote
          await client.query(
            `INSERT INTO user_votes (fingerprint, llm_id, vote_type, previous_vote, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fingerprint, llmId, voteType, currentVote, metadata.ip || null, metadata.userAgent || null]
          );
        } else if (voteType === 0) {
          // Remove vote
          await client.query(
            'DELETE FROM user_votes WHERE fingerprint = $1 AND llm_id = $2',
            [fingerprint, llmId]
          );
        } else {
          // Update vote
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
          // Create vote record
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
          // Update vote counts
          let { vote_count, positive_votes, negative_votes } = voteRows[0];
          vote_count += voteChange;
          
          // Adjust positive/negative counts
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
        
        // Invalidate cache
        await cacheManager.invalidateVoteCache(llmId);
        await cacheManager.setUserVote(fingerprint, llmId, voteType);
        
        // Get updated votes
        const votes = await this.getVotes();
        
        // Publish real-time update
        await cacheManager.publishVoteUpdate(llmId, {
          voteCount: votes[llmId],
          voteType,
          previousVote: currentVote
        });
        
        logger.business.voteSubmitted(fingerprint, llmId, voteType, currentVote);
        
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

  async getOrCreateUserSession(client, fingerprint, metadata) {
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
      return newSession[0];
    }
    
    return rows[0];
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
      
      // Fetch from database
      const { rows } = await dbManager.query(`
        SELECT l.id, COALESCE(v.vote_count, 0) as count
        FROM llms l
        LEFT JOIN votes v ON l.id = v.llm_id
        ORDER BY l.id
      `);
      
      const votes = {};
      rows.forEach(row => {
        votes[row.id] = row.count;
      });
      
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
      
      // Fetch from database
      const { rows } = await dbManager.query(`
        SELECT 
          l.id,
          COALESCE(v.vote_count, 0) as count,
          RANK() OVER (ORDER BY COALESCE(v.vote_count, 0) DESC) as rank
        FROM llms l
        LEFT JOIN votes v ON l.id = v.llm_id
        ORDER BY count DESC, l.id
      `);
      
      const rankings = rows.map(row => ({
        id: row.id,
        count: parseInt(row.count),
        rank: parseInt(row.rank)
      }));
      
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
      
      // Get total votes
      const { rows: totalRows } = await dbManager.query(
        'SELECT COALESCE(SUM(ABS(vote_count)), 0) as total FROM votes'
      );
      
      // Get votes today
      const { rows: todayRows } = await dbManager.query(
        'SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1',
        [todayStart]
      );
      
      // Get votes last hour
      const { rows: hourRows } = await dbManager.query(
        'SELECT COUNT(*) as count FROM user_votes WHERE created_at >= $1',
        [oneHourAgo]
      );
      
      // Get trending models (most voted in last hour)
      const { rows: trendingRows } = await dbManager.query(`
        SELECT llm_id, COUNT(*) as recent_votes
        FROM user_votes
        WHERE created_at >= $1 AND vote_type != 0
        GROUP BY llm_id
        ORDER BY recent_votes DESC
        LIMIT 3
      `, [oneHourAgo]);
      
      // Get top model
      const { rows: topRows } = await dbManager.query(`
        SELECT llm_id
        FROM votes
        WHERE vote_count = (SELECT MAX(vote_count) FROM votes)
        LIMIT 1
      `);
      
      const stats = {
        totalVotes: parseInt(totalRows[0].total),
        votesToday: parseInt(todayRows[0].count),
        votesLastHour: parseInt(hourRows[0].count),
        trending: trendingRows.map(row => row.llm_id),
        topModel: topRows[0]?.llm_id || null
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
      const userVotes = await this.getUserVotes(fingerprint);
      const allVotes = await this.getVotes();
      const rankings = await this.getRankings();
      const stats = await this.getStats();
      
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
}

// Singleton instance
let voteManager;

export function getVoteManager() {
  if (!voteManager) {
    voteManager = new DatabaseVoteManager();
  }
  return voteManager;
}

export default getVoteManager();