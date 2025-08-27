// Configuration helper to manage environment variables
// Falls back to file-based storage if database is not configured

const config = {
  // Database configuration
  database: {
    enabled: process.env.POSTGRES_HOST && process.env.POSTGRES_HOST !== 'localhost',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'llm_tracker',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    url: process.env.DATABASE_URL,
  },
  
  // Redis configuration
  redis: {
    enabled: process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL,
  },
  
  // Application settings
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  // Security settings
  security: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    sessionSecret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  },
  
  // Rate limiting
  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  },
  
  // Feature flags
  features: {
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    realTime: process.env.ENABLE_REAL_TIME === 'true',
    useDatabase: false, // Will be determined below
  },
};

// Determine if we should use database or file storage
// Use database only if both PostgreSQL and Redis are properly configured
config.features.useDatabase = !!(
  (config.database.enabled || config.database.url) &&
  (config.redis.enabled || config.redis.url)
);

// Log configuration status (without sensitive data)
if (typeof window === 'undefined') { // Only on server side
  console.log('Configuration loaded:', {
    environment: config.app.env,
    databaseEnabled: config.features.useDatabase,
    redisEnabled: config.redis.enabled,
    features: config.features,
  });
}

export default config;