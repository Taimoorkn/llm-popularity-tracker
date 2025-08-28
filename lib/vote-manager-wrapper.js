import logger from './logger.js';

let voteManager;

export async function getVoteManager() {
  if (voteManager) {
    return voteManager;
  }
  
  // Always use database-backed manager - no fallback
  try {
    const { getEnhancedVoteManager: getDbVoteManager } = await import('./vote-manager-enhanced.js');
    voteManager = getDbVoteManager();
    
    // Test the connection
    await voteManager.initialize();
    
    logger.info('Database-backed vote manager initialized successfully');
    return voteManager;
  } catch (error) {
    logger.error('Failed to initialize database vote manager:', error);
    throw new Error(`Database connection required. Please ensure PostgreSQL and Redis are running. Error: ${error.message}`);
  }
}

// Direct export of database manager - no adapter needed
export async function getAdaptedVoteManager() {
  return await getVoteManager();
}

// Always using database storage
export function isUsingDatabaseStorage() {
  return true;
}