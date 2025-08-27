import pino from 'pino';
import pretty from 'pino-pretty';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logger configuration
const loggerConfig = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
      remoteAddress: req.connection?.remoteAddress,
      remotePort: req.connection?.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.headers['content-type'],
        'content-length': res.headers['content-length'],
      },
    }),
  },
};

// Create logger instance
let logger;

if (isDevelopment) {
  // Pretty print for development
  logger = pino(
    loggerConfig,
    pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    })
  );
} else {
  // JSON format for production
  logger = pino(loggerConfig);
}

// Create child loggers for different modules
const createChildLogger = (module) => {
  return logger.child({ module });
};

// Export logger with additional methods
const enhancedLogger = Object.assign(logger, {
  child: createChildLogger,
  
  // Request logging middleware
  logRequest: (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
    
    req.log = logger.child({ requestId });
    
    req.log.info({
      req,
      event: 'request-start'
    }, 'Request started');
    
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;
      req.log.info({
        res,
        event: 'request-end',
        duration: `${duration}ms`
      }, 'Request completed');
      
      originalEnd.apply(this, args);
    };
    
    if (next) next();
  },
  
  // Security event logging
  security: {
    loginAttempt: (fingerprint, success, reason = null) => {
      logger.warn({
        event: 'login-attempt',
        fingerprint: fingerprint?.substring(0, 8) + '...',
        success,
        reason,
        timestamp: new Date().toISOString()
      }, `Login attempt ${success ? 'succeeded' : 'failed'}`);
    },
    
    rateLimitExceeded: (ip, endpoint, limit) => {
      logger.warn({
        event: 'rate-limit-exceeded',
        ip: ip?.substring(0, 8) + '...',
        endpoint,
        limit,
        timestamp: new Date().toISOString()
      }, 'Rate limit exceeded');
    },
    
    suspiciousActivity: (fingerprint, activity, details) => {
      logger.error({
        event: 'suspicious-activity',
        fingerprint: fingerprint?.substring(0, 8) + '...',
        activity,
        details,
        timestamp: new Date().toISOString()
      }, 'Suspicious activity detected');
    }
  },
  
  // Performance logging
  performance: {
    dbQuery: (query, duration, rows) => {
      const level = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
      logger[level]({
        event: 'db-query',
        query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows,
        timestamp: new Date().toISOString()
      }, 'Database query executed');
    },
    
    apiResponse: (endpoint, method, duration, statusCode) => {
      const level = duration > 2000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
      logger[level]({
        event: 'api-response',
        endpoint,
        method,
        duration: `${duration}ms`,
        statusCode,
        timestamp: new Date().toISOString()
      }, 'API response');
    }
  },
  
  // Business logic logging
  business: {
    voteSubmitted: (fingerprint, llmId, voteType, previousVote) => {
      logger.info({
        event: 'vote-submitted',
        fingerprint: fingerprint?.substring(0, 8) + '...',
        llmId,
        voteType,
        previousVote,
        timestamp: new Date().toISOString()
      }, 'Vote submitted');
    },
    
    fraudulentVoteDetected: (fingerprint, reason, details) => {
      logger.error({
        event: 'fraudulent-vote-detected',
        fingerprint: fingerprint?.substring(0, 8) + '...',
        reason,
        details,
        timestamp: new Date().toISOString()
      }, 'Fraudulent vote detected');
    }
  }
});

export default enhancedLogger;