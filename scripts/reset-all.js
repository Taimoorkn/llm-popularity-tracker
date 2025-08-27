const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://llm_user:changeme@localhost:5432/llm_tracker',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

async function resetAll() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting ALL data to zero...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Clear all user votes
    console.log('1. Clearing all user votes...');
    const userVotesResult = await client.query('DELETE FROM user_votes');
    console.log(`   ✓ Deleted ${userVotesResult.rowCount} user votes`);
    
    // 2. Clear all user sessions 
    console.log('2. Clearing all user sessions...');
    const sessionsResult = await client.query('DELETE FROM user_sessions');
    console.log(`   ✓ Deleted ${sessionsResult.rowCount} user sessions`);
    
    // 3. Clear analytics
    console.log('3. Clearing analytics data...');
    const analyticsResult = await client.query('DELETE FROM analytics');
    console.log(`   ✓ Deleted ${analyticsResult.rowCount} analytics records`);
    
    // 4. Reset all vote counts to 0
    console.log('4. Resetting all vote counts to 0...');
    const votesResult = await client.query(
      'UPDATE votes SET vote_count = 0, positive_votes = 0, negative_votes = 0'
    );
    console.log(`   ✓ Reset ${votesResult.rowCount} vote records to 0`);
    
    // 5. Clear rate limits
    console.log('5. Clearing rate limits...');
    const rateLimitsResult = await client.query('DELETE FROM rate_limits');
    console.log(`   ✓ Deleted ${rateLimitsResult.rowCount} rate limit records`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ ALL DATA RESET SUCCESSFULLY!');
    console.log('   • All user votes: CLEARED');
    console.log('   • All user sessions: CLEARED');  
    console.log('   • All analytics: CLEARED');
    console.log('   • All vote counts: RESET TO 0');
    console.log('   • All rate limits: CLEARED');
    console.log('\n🧹 Next steps:');
    console.log('   1. Clear browser localStorage: Application → Storage → Local Storage → Clear All');
    console.log('   2. Clear Redis cache: docker-compose exec redis redis-cli FLUSHDB');
    console.log('   3. Refresh the browser page');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run reset
resetAll();