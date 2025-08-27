import { Pool } from 'pg';
import Redis from 'ioredis';
import logger from './logger.js';

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.redis = null;
  }

  async initializePostgres() {
    try {
      this.pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'llm_tracker',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'password',
        max: 20, // Maximum pool size
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
        statement_timeout: 10000, // Terminate any statement that takes over 10 seconds
        query_timeout: 10000, // Terminate any query that takes over 10 seconds
        application_name: 'llm-popularity-tracker',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('PostgreSQL connection pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }

  async initializeRedis() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4, // Force IPv4
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      this.redis = new Redis(redisConfig);
      
      // Test connection
      await this.redis.connect();
      await this.redis.ping();
      
      this.redis.on('error', (error) => {
        logger.error('Redis error:', error);
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.redis.on('ready', () => {
        logger.info('Redis ready to accept commands');
      });

      logger.info('Redis connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async initialize() {
    await Promise.all([
      this.initializePostgres(),
      this.initializeRedis()
    ]);
  }

  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  getRedis() {
    if (!this.redis) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.redis;
  }

  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Query executed', { 
        query: text, 
        duration: `${duration}ms`, 
        rows: result.rowCount 
      });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', { 
        query: text, 
        duration: `${duration}ms`, 
        error: error.message 
      });
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async closeAll() {
    const promises = [];
    
    if (this.pool) {
      promises.push(this.pool.end());
    }
    
    if (this.redis) {
      promises.push(this.redis.quit());
    }
    
    await Promise.all(promises);
    logger.info('All database connections closed');
  }

  // Health check methods
  async healthCheck() {
    const results = {
      postgres: false,
      redis: false,
      timestamp: new Date().toISOString()
    };

    try {
      await this.pool.query('SELECT 1');
      results.postgres = true;
    } catch (error) {
      logger.error('PostgreSQL health check failed:', error);
    }

    try {
      await this.redis.ping();
      results.redis = true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }

    return results;
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

export default dbManager;