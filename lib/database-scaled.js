import { Pool } from 'pg';
import Redis from 'ioredis';
import logger from './logger.js';

class ScaledDatabaseManager {
  constructor() {
    this.primaryPool = null;
    this.readPools = [];
    this.currentReadIndex = 0;
    this.redisSentinel = null;
    this.redisClients = new Map();
    this.initialized = false;
  }

  async initializePostgres() {
    try {
      // Initialize primary pool
      this.primaryPool = new Pool({
        host: process.env.POSTGRES_HOST || 'pgbouncer',
        port: process.env.PGBOUNCER_PORT || 6432,
        database: process.env.POSTGRES_DB || 'llm_tracker',
        user: process.env.POSTGRES_USER || 'llm_user',
        password: process.env.POSTGRES_PASSWORD || 'changeme',
        max: 50,
        min: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
        query_timeout: 10000,
        application_name: 'llm-tracker-primary',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Initialize read replica pools
      const readReplicas = process.env.POSTGRES_READ_HOSTS?.split(',') || [];
      for (const host of readReplicas) {
        const readPool = new Pool({
          host,
          port: process.env.POSTGRES_PORT || 5432,
          database: process.env.POSTGRES_DB || 'llm_tracker',
          user: process.env.POSTGRES_USER || 'llm_user',
          password: process.env.POSTGRES_PASSWORD || 'changeme',
          max: 30,
          min: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          statement_timeout: 10000,
          query_timeout: 10000,
          application_name: `llm-tracker-read-${host}`,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.readPools.push(readPool);
      }

      // Test connections
      await this.testConnection(this.primaryPool, 'Primary');
      for (let i = 0; i < this.readPools.length; i++) {
        await this.testConnection(this.readPools[i], `Read Replica ${i + 1}`);
      }
      
      logger.info(`PostgreSQL initialized: 1 primary, ${this.readPools.length} read replicas`);
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }

  async testConnection(pool, name) {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info(`${name} PostgreSQL connection successful`);
    } catch (error) {
      logger.error(`${name} PostgreSQL connection failed:`, error);
      throw error;
    }
  }

  async initializeRedisSentinel() {
    try {
      const sentinels = process.env.REDIS_SENTINELS?.split(',').map(s => {
        const [host, port] = s.split(':');
        return { host, port: parseInt(port) || 26379 };
      }) || [{ host: 'localhost', port: 26379 }];

      // Create Redis Sentinel client
      this.redisSentinel = new Redis({
        sentinels,
        name: process.env.REDIS_MASTER_NAME || 'mymaster',
        password: process.env.REDIS_PASSWORD || undefined,
        sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        reconnectOnError: (err) => {
          logger.error('Redis reconnect on error:', err);
          return true;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        keepAlive: 30000,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
        db: 0
      });

      // Handle Redis events
      this.redisSentinel.on('connect', () => {
        logger.info('Redis Sentinel connected');
      });

      this.redisSentinel.on('ready', () => {
        logger.info('Redis Sentinel ready');
      });

      this.redisSentinel.on('error', (error) => {
        logger.error('Redis Sentinel error:', error);
      });

      this.redisSentinel.on('+switch-master', (master) => {
        logger.info('Redis master switched:', master);
      });

      // Test connection
      await this.redisSentinel.ping();
      
      // Create separate clients for different purposes
      await this.createRedisClients();
      
      logger.info('Redis Sentinel initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis Sentinel:', error);
      // Fallback to standard Redis if Sentinel fails
      await this.initializeRedisStandard();
    }
  }

  async createRedisClients() {
    // Create specialized Redis clients for different purposes
    const purposes = ['cache', 'pubsub', 'session', 'ratelimit'];
    
    for (const purpose of purposes) {
      const client = this.redisSentinel.duplicate();
      await client.ping();
      this.redisClients.set(purpose, client);
    }
  }

  async initializeRedisStandard() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        keepAlive: 30000,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      this.redisSentinel = new Redis(redisConfig);
      await this.redisSentinel.ping();
      await this.createRedisClients();
      
      logger.info('Standard Redis initialized (fallback mode)');
    } catch (error) {
      logger.error('Failed to initialize standard Redis:', error);
      throw error;
    }
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await Promise.all([
        this.initializePostgres(),
        this.initializeRedisSentinel()
      ]);
      
      this.initialized = true;
      logger.info('Scaled Database Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Scaled Database Manager:', error);
      throw error;
    }
  }

  // Get appropriate pool based on query type
  getPool(isWrite = false) {
    if (isWrite || this.readPools.length === 0) {
      return this.primaryPool;
    }
    
    // Round-robin load balancing for read queries
    const pool = this.readPools[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readPools.length;
    return pool;
  }

  // Get Redis client for specific purpose
  getRedis(purpose = 'cache') {
    const client = this.redisClients.get(purpose) || this.redisSentinel;
    if (!client) {
      throw new Error('Redis not initialized');
    }
    return client;
  }

  // Execute query with automatic routing
  async query(text, params = [], options = {}) {
    const { isWrite = false, preferPrimary = false } = options;
    const isWriteQuery = isWrite || this.isWriteQuery(text);
    const pool = preferPrimary ? this.primaryPool : this.getPool(isWriteQuery);
    
    const start = Date.now();
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (duration > 500) {
          logger.warn('Slow query detected', { 
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            pool: isWriteQuery ? 'primary' : 'read-replica'
          });
        }
        
        return result;
      } catch (error) {
        retries++;
        
        if (retries > maxRetries) {
          logger.error('Query failed after retries', { 
            query: text.substring(0, 100),
            error: error.message,
            retries
          });
          throw error;
        }
        
        // If read replica fails, fallback to primary
        if (!isWriteQuery && pool !== this.primaryPool) {
          logger.warn('Read replica failed, falling back to primary');
          return this.primaryPool.query(text, params);
        }
        
        await this.delay(100 * retries);
      }
    }
  }

  // Determine if query is a write operation
  isWriteQuery(text) {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    const upperText = text.trim().toUpperCase();
    return writeKeywords.some(keyword => upperText.startsWith(keyword));
  }

  // Enhanced transaction with automatic retries
  async transaction(callback, options = {}) {
    const { maxRetries = 3, retryDelay = 100 } = options;
    let retries = 0;
    
    while (retries < maxRetries) {
      const client = await this.primaryPool.connect();
      
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Check if error is retryable
        if (this.isRetryableError(error) && retries < maxRetries - 1) {
          retries++;
          logger.warn(`Transaction retry ${retries}/${maxRetries}`, { error: error.message });
          await this.delay(retryDelay * retries);
          continue;
        }
        
        throw error;
      } finally {
        client.release();
      }
    }
  }

  // Check if error is retryable
  isRetryableError(error) {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '57P03', // cannot_connect_now
    ];
    
    return retryableCodes.includes(error.code);
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch query execution
  async batchQuery(queries) {
    const client = await this.primaryPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check for all components
  async healthCheck() {
    const results = {
      postgresqlPrimary: false,
      postgresqlReplicas: [],
      redis: false,
      redisSentinel: false,
      timestamp: new Date().toISOString()
    };

    // Check primary PostgreSQL
    try {
      await this.primaryPool.query('SELECT 1');
      results.postgresqlPrimary = true;
    } catch (error) {
      logger.error('Primary PostgreSQL health check failed:', error);
    }

    // Check read replicas
    for (let i = 0; i < this.readPools.length; i++) {
      try {
        await this.readPools[i].query('SELECT 1');
        results.postgresqlReplicas.push({ index: i, healthy: true });
      } catch (error) {
        logger.error(`Read replica ${i} health check failed:`, error);
        results.postgresqlReplicas.push({ index: i, healthy: false });
      }
    }

    // Check Redis
    try {
      await this.redisSentinel.ping();
      results.redis = true;
      
      // Check Sentinel status
      const sentinelInfo = await this.redisSentinel.call('SENTINEL', 'masters');
      results.redisSentinel = sentinelInfo && sentinelInfo.length > 0;
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }

    return results;
  }

  // Get pool statistics
  async getPoolStats() {
    const stats = {
      primary: {
        totalCount: this.primaryPool.totalCount,
        idleCount: this.primaryPool.idleCount,
        waitingCount: this.primaryPool.waitingCount
      },
      replicas: []
    };

    for (let i = 0; i < this.readPools.length; i++) {
      stats.replicas.push({
        index: i,
        totalCount: this.readPools[i].totalCount,
        idleCount: this.readPools[i].idleCount,
        waitingCount: this.readPools[i].waitingCount
      });
    }

    return stats;
  }

  // Close all connections
  async closeAll() {
    const promises = [];
    
    if (this.primaryPool) {
      promises.push(this.primaryPool.end());
    }
    
    for (const pool of this.readPools) {
      promises.push(pool.end());
    }
    
    for (const [purpose, client] of this.redisClients) {
      promises.push(client.quit());
    }
    
    if (this.redisSentinel) {
      promises.push(this.redisSentinel.quit());
    }
    
    await Promise.all(promises);
    logger.info('All database connections closed');
  }
}

// Singleton instance
const scaledDbManager = new ScaledDatabaseManager();

export default scaledDbManager;