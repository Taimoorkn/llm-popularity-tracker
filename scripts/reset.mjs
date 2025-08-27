import dbManager from '../lib/database.js';
import cacheManager from '../lib/cache.js';
import logger from '../lib/logger.js';
import { migrations } from './migrate.js';
import { seedDatabase } from './seed.js';

async function resetDatabase() {
  try {
    await dbManager.initialize();
    logger.warn('⚠️  Database reset initiated - ALL DATA WILL BE LOST!');
    
    // Drop all tables in reverse order to respect foreign keys
    logger.info('Dropping all tables...');
    
    await dbManager.transaction(async (client) => {
      // First, get all custom tables (excluding system tables)
      const { rows: tables } = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename DESC
      `);
      
      // Drop all tables
      for (const { tablename } of tables) {
        logger.info(`Dropping table: ${tablename}`);
        await client.query(`DROP TABLE IF EXISTS ${tablename} CASCADE`);
      }
      
      // Drop all functions
      await client.query(`DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE`);
    });
    
    logger.info('All tables dropped successfully');
    
    // Clear Redis cache if available
    try {
      await cacheManager.initialize();
      logger.info('Clearing Redis cache...');
      await cacheManager.invalidateAllCaches();
      logger.info('Redis cache cleared');
    } catch (error) {
      logger.warn('Could not clear Redis cache:', error.message);
    }
    
    // Re-run all migrations
    logger.info('Re-creating database schema...');
    
    // Create migrations table
    await dbManager.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Run all migrations
    for (const migration of migrations) {
      logger.info(`Running migration: ${migration.name}`);
      await dbManager.transaction(async (client) => {
        await client.query(migration.up);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
      });
    }
    
    logger.info('Database schema recreated successfully');
    
    // Optionally seed the database
    const shouldSeed = process.argv.includes('--seed');
    if (shouldSeed) {
      logger.info('Seeding database with initial data...');
      await seedDatabase();
    } else {
      logger.info('Skipping database seeding (use --seed flag to seed)');
    }
    
    logger.info('✅ Database reset completed successfully');
    
  } catch (error) {
    logger.error('Database reset failed:', error);
    process.exit(1);
  } finally {
    await dbManager.closeAll();
  }
}

// Run reset if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Safety check for production
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    logger.error('❌ Cannot reset production database without --force flag');
    logger.error('This action will DELETE ALL DATA. Use: npm run db:reset -- --force');
    process.exit(1);
  }
  
  resetDatabase();
}

export { resetDatabase };