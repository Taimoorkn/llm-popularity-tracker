// Configuration helper to manage environment variables
// Falls back to file-based storage if database is not configured

const config = {
  // Database configuration - always enabled for production
  database: {
    enabled: true, // Database is required, no fallback
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'llm_tracker',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    url: process.env.DATABASE_URL,
  },
  
  // Redis configuration - always enabled for production
  redis: {
    enabled: true, // Redis is required for caching and real-time updates
    host: process.env.REDIS_HOST || 'redis',
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
    analytics: process.env.ENABLE_ANALYTICS !== 'false', // Default to true
    realTime: process.env.ENABLE_REAL_TIME !== 'false', // Default to true for real-time updates
    useDatabase: true, // Always use database, no fallback to file storage
  },
};

// Database and Redis are mandatory - no fallback to file storage
// This provides better performance and data persistence
config.features.useDatabase = true;

// Log configuration status (without sensitive data)
if (typeof window === 'undefined') { // Only on server side
  console.log('Configuration loaded:', {
    environment: config.app.env,
    databaseEnabled: true, // Always enabled
    redisEnabled: true, // Always enabled
    postgresHost: config.database.host,
    redisHost: config.redis.host,
    features: config.features,
  });
}

export default config;