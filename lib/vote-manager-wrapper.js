import config from './config.js';
import logger from './logger.js';

// This wrapper intelligently chooses between database and file-based vote manager
// based on configuration and availability

let voteManager;
let isUsingDatabase = false;

export async function getVoteManager() {
  if (voteManager) {
    return voteManager;
  }
  
  // Try to use database-backed manager if configured
  if (config.features.useDatabase) {
    try {
      const { getVoteManager: getDbVoteManager } = await import('./vote-manager-db.js');
      voteManager = getDbVoteManager();
      
      // Test the connection
      await voteManager.initialize();
      isUsingDatabase = true;
      
      logger.info('Using database-backed vote manager');
      return voteManager;
    } catch (error) {
      logger.warn('Failed to initialize database vote manager, falling back to file storage:', error.message);
    }
  }
  
  // Fall back to file-based manager
  try {
    const { getVoteManager: getFileVoteManager } = await import('./vote-manager.js');
    voteManager = getFileVoteManager();
    isUsingDatabase = false;
    
    logger.info('Using file-based vote manager');
    return voteManager;
  } catch (error) {
    logger.error('Failed to initialize any vote manager:', error);
    throw new Error('No vote manager available');
  }
}

// Adapter to make file-based manager async-compatible
export class VoteManagerAdapter {
  constructor(fileManager) {
    this.fileManager = fileManager;
  }
  
  async initialize() {
    // File manager doesn't need initialization
    return Promise.resolve();
  }
  
  async vote(fingerprint, llmId, voteType, metadata = {}) {
    try {
      const result = this.fileManager.vote(fingerprint, llmId, voteType);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async getUserVotes(fingerprint) {
    try {
      const votes = this.fileManager.getUserVotes(fingerprint);
      return Promise.resolve(votes);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async getVotes() {
    try {
      const votes = this.fileManager.getVotes();
      return Promise.resolve(votes);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async getRankings() {
    try {
      const rankings = this.fileManager.getRankings();
      return Promise.resolve(rankings);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async getStats() {
    try {
      const stats = this.fileManager.getStats();
      return Promise.resolve(stats);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async syncUserVotes(fingerprint) {
    try {
      const userVotes = this.fileManager.getUserVotes(fingerprint);
      const votes = this.fileManager.getVotes();
      const rankings = this.fileManager.getRankings();
      const stats = this.fileManager.getStats();
      
      return Promise.resolve({
        votes,
        userVotes,
        rankings,
        stats
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  
  async checkHealth() {
    return Promise.resolve({
      database: { postgres: false, redis: false },
      cache: { status: 'not-available' },
      status: 'healthy' // File-based is always healthy if accessible
    });
  }
}

// Wrapper function that returns the appropriate manager
export async function getAdaptedVoteManager() {
  const manager = await getVoteManager();
  
  // If it's the file-based manager, wrap it in the adapter
  if (!isUsingDatabase && manager.vote && !manager.vote.constructor.name.includes('Async')) {
    return new VoteManagerAdapter(manager);
  }
  
  return manager;
}

// Export status function
export function isUsingDatabaseStorage() {
  return isUsingDatabase;
}