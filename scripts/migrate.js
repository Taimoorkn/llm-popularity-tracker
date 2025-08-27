import dbManager from '../lib/database.js';
import logger from '../lib/logger.js';

const migrations = [
  {
    name: '001_create_llms_table',
    up: `
      CREATE TABLE IF NOT EXISTS llms (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        description TEXT,
        use_cases JSONB DEFAULT '[]',
        release_year INTEGER,
        color VARCHAR(100),
        logo VARCHAR(10),
        image_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create index for faster queries
      CREATE INDEX IF NOT EXISTS idx_llms_company ON llms(company);
      CREATE INDEX IF NOT EXISTS idx_llms_release_year ON llms(release_year);
    `,
    down: `
      DROP INDEX IF EXISTS idx_llms_release_year;
      DROP INDEX IF EXISTS idx_llms_company;
      DROP TABLE IF EXISTS llms;
    `
  },
  
  {
    name: '002_create_votes_table',
    up: `
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        llm_id VARCHAR(255) NOT NULL REFERENCES llms(id) ON DELETE CASCADE,
        vote_count INTEGER DEFAULT 0,
        positive_votes INTEGER DEFAULT 0,
        negative_votes INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(llm_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_votes_llm_id ON votes(llm_id);
      CREATE INDEX IF NOT EXISTS idx_votes_vote_count ON votes(vote_count DESC);
    `,
    down: `
      DROP INDEX IF EXISTS idx_votes_vote_count;
      DROP INDEX IF EXISTS idx_votes_llm_id;
      DROP TABLE IF EXISTS votes;
    `
  },
  
  {
    name: '003_create_user_sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        fingerprint VARCHAR(255) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        country VARCHAR(2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_suspicious BOOLEAN DEFAULT FALSE,
        vote_count INTEGER DEFAULT 0,
        UNIQUE(fingerprint)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint ON user_sessions(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_suspicious ON user_sessions(is_suspicious);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON user_sessions(ip_address);
    `,
    down: `
      DROP INDEX IF EXISTS idx_user_sessions_ip;
      DROP INDEX IF EXISTS idx_user_sessions_suspicious;
      DROP INDEX IF EXISTS idx_user_sessions_last_activity;
      DROP INDEX IF EXISTS idx_user_sessions_fingerprint;
      DROP TABLE IF EXISTS user_sessions;
    `
  },
  
  {
    name: '004_create_user_votes_table',
    up: `
      CREATE TABLE IF NOT EXISTS user_votes (
        id SERIAL PRIMARY KEY,
        fingerprint VARCHAR(255) NOT NULL,
        llm_id VARCHAR(255) NOT NULL REFERENCES llms(id) ON DELETE CASCADE,
        vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 0, 1)),
        previous_vote INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        UNIQUE(fingerprint, llm_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_user_votes_fingerprint ON user_votes(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_user_votes_llm_id ON user_votes(llm_id);
      CREATE INDEX IF NOT EXISTS idx_user_votes_created_at ON user_votes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_votes_vote_type ON user_votes(vote_type);
    `,
    down: `
      DROP INDEX IF EXISTS idx_user_votes_vote_type;
      DROP INDEX IF EXISTS idx_user_votes_created_at;
      DROP INDEX IF EXISTS idx_user_votes_llm_id;
      DROP INDEX IF EXISTS idx_user_votes_fingerprint;
      DROP TABLE IF EXISTS user_votes;
    `
  },
  
  {
    name: '005_create_analytics_table',
    up: `
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL DEFAULT '{}',
        fingerprint VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create indexes for analytics queries
      CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_fingerprint ON analytics(fingerprint);
    `,
    down: `
      DROP INDEX IF EXISTS idx_analytics_fingerprint;
      DROP INDEX IF EXISTS idx_analytics_created_at;
      DROP INDEX IF EXISTS idx_analytics_event_type;
      DROP TABLE IF EXISTS analytics;
    `
  },
  
  {
    name: '006_create_rate_limits_table',
    up: `
      CREATE TABLE IF NOT EXISTS rate_limits (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL,
        points INTEGER DEFAULT 0,
        expire_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(key)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_expire_at ON rate_limits(expire_at);
    `,
    down: `
      DROP INDEX IF EXISTS idx_rate_limits_expire_at;
      DROP INDEX IF EXISTS idx_rate_limits_key;
      DROP TABLE IF EXISTS rate_limits;
    `
  },
  
  {
    name: '007_create_triggers',
    up: `
      -- Create function to update timestamp
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      -- Create triggers for updated_at
      CREATE TRIGGER update_llms_updated_at BEFORE UPDATE ON llms 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
      CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON votes 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
      CREATE TRIGGER update_user_votes_updated_at BEFORE UPDATE ON user_votes 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `,
    down: `
      DROP TRIGGER IF EXISTS update_user_votes_updated_at ON user_votes;
      DROP TRIGGER IF EXISTS update_votes_updated_at ON votes;
      DROP TRIGGER IF EXISTS update_llms_updated_at ON llms;
      DROP FUNCTION IF EXISTS update_updated_at_column();
    `
  }
];

async function runMigrations() {
  try {
    await dbManager.initialize();
    
    // Create migrations table
    await dbManager.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Get already executed migrations
    const { rows: executedMigrations } = await dbManager.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    
    const executedNames = executedMigrations.map(row => row.name);
    
    // Run pending migrations
    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        
        await dbManager.transaction(async (client) => {
          await client.query(migration.up);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migration.name]
          );
        });
        
        logger.info(`Migration completed: ${migration.name}`);
      } else {
        logger.info(`Migration already executed: ${migration.name}`);
      }
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dbManager.closeAll();
  }
}

// Run migrations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations, migrations };