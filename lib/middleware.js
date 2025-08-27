import Joi from 'joi';
import { NextResponse } from 'next/server';
import cacheManager from './cache.js';
import logger from './logger.js';

// Input validation schemas
const schemas = {
  vote: Joi.object({
    fingerprint: Joi.string().required().min(10).max(255),
    llmId: Joi.string().required().min(1).max(255),
    voteType: Joi.number().integer().valid(-1, 0, 1).required()
  }),
  
  sync: Joi.object({
    fingerprint: Joi.string().required().min(10).max(255)
  }),
  
  fingerprint: Joi.string().alphanum().min(10).max(255)
};

// Get client IP helper
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddress = request.headers.get('remote-address');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || remoteAddress || 'unknown';
}

// Get user agent helper
function getUserAgent(request) {
  return request.headers.get('user-agent') || 'unknown';
}

// Rate limiting middleware
export async function rateLimit(request, options = {}) {
  const {
    maxRequests = 100,
    windowMs = 900000, // 15 minutes
    keyGenerator = (req) => getClientIP(req),
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  try {
    const key = `rate_limit:${keyGenerator(request)}`;
    const rateLimitInfo = await cacheManager.checkRateLimit(key, maxRequests, windowMs);
    
    if (rateLimitInfo.exceeded) {
      logger.security.rateLimitExceeded(
        getClientIP(request),
        new URL(request.url).pathname,
        maxRequests
      );
      
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${maxRequests} per ${Math.floor(windowMs / 1000 / 60)} minutes`,
          retryAfter: rateLimitInfo.resetTime.toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitInfo.remainingRequests.toString(),
            'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString(),
            'Retry-After': Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    // Add rate limit headers to response
    return {
      rateLimitHeaders: {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remainingRequests.toString(),
        'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString()
      }
    };
  } catch (error) {
    logger.error('Rate limiting failed:', error);
    // Allow request to continue if rate limiting fails
    return null;
  }
}

// Input validation middleware
export function validateInput(schema, data) {
  try {
    const { error, value } = schema.validate(data, {
      stripUnknown: true,
      abortEarly: false
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return {
        isValid: false,
        errors: errorMessages,
        data: null
      };
    }
    
    return {
      isValid: true,
      errors: null,
      data: value
    };
  } catch (error) {
    logger.error('Input validation failed:', error);
    return {
      isValid: false,
      errors: [{ field: 'unknown', message: 'Validation error occurred' }],
      data: null
    };
  }
}

// Security headers middleware
export function securityHeaders() {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
}

// Request logging middleware
export function logRequest(request, startTime = Date.now()) {
  const ip = getClientIP(request);
  const userAgent = getUserAgent(request);
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  
  logger.info({
    event: 'request-start',
    method,
    path,
    ip: ip.substring(0, 8) + '...',
    userAgent: userAgent.substring(0, 100),
    timestamp: new Date().toISOString()
  }, `${method} ${path}`);
  
  return {
    ip,
    userAgent,
    method,
    path,
    startTime
  };
}

// Response logging middleware
export function logResponse(requestInfo, response, error = null) {
  const duration = Date.now() - requestInfo.startTime;
  const status = response?.status || (error ? 500 : 200);
  
  const logLevel = error ? 'error' : status >= 400 ? 'warn' : 'info';
  
  logger[logLevel]({
    event: 'request-end',
    method: requestInfo.method,
    path: requestInfo.path,
    status,
    duration: `${duration}ms`,
    ip: requestInfo.ip.substring(0, 8) + '...',
    error: error?.message,
    timestamp: new Date().toISOString()
  }, `${requestInfo.method} ${requestInfo.path} ${status} ${duration}ms`);
}

// Fraud detection middleware
export async function detectFraud(fingerprint, activity, context = {}) {
  try {
    const suspiciousIndicators = [];
    
    // Track activity
    await cacheManager.trackUserActivity(fingerprint, {
      type: activity,
      context,
      timestamp: Date.now()
    });
    
    // Get recent activity history
    const recentActivity = await cacheManager.getUserActivityHistory(fingerprint, 50);
    
    // Check for suspicious patterns
    
    // 1. Too many votes in short time
    if (activity === 'vote') {
      const recentVotes = recentActivity.filter(a => 
        a.activity.type === 'vote' && 
        Date.now() - a.activity.timestamp < 60000 // Last minute
      );
      
      if (recentVotes.length > 10) {
        suspiciousIndicators.push('rapid_voting');
      }
    }
    
    // 2. Repeated identical requests
    const identicalRequests = recentActivity.filter(a => 
      JSON.stringify(a.activity.context) === JSON.stringify(context) &&
      Date.now() - a.activity.timestamp < 300000 // Last 5 minutes
    );
    
    if (identicalRequests.length > 5) {
      suspiciousIndicators.push('repeated_requests');
    }
    
    // 3. Unusual voting patterns (alternating votes rapidly)
    if (activity === 'vote') {
      const recentVoteChanges = recentActivity
        .filter(a => a.activity.type === 'vote')
        .slice(0, 10);
      
      let alternatingPattern = 0;
      for (let i = 1; i < recentVoteChanges.length; i++) {
        const current = recentVoteChanges[i - 1].activity.context.voteType;
        const previous = recentVoteChanges[i].activity.context.voteType;
        if (current !== previous) {
          alternatingPattern++;
        }
      }
      
      if (alternatingPattern >= 5) {
        suspiciousIndicators.push('alternating_votes');
      }
    }
    
    // Log suspicious activity
    if (suspiciousIndicators.length > 0) {
      logger.security.suspiciousActivity(
        fingerprint,
        activity,
        {
          indicators: suspiciousIndicators,
          context,
          recentActivityCount: recentActivity.length
        }
      );
      
      return {
        isSuspicious: true,
        indicators: suspiciousIndicators,
        riskScore: suspiciousIndicators.length * 25 // 0-100 scale
      };
    }
    
    return {
      isSuspicious: false,
      indicators: [],
      riskScore: 0
    };
  } catch (error) {
    logger.error('Fraud detection failed:', error);
    return {
      isSuspicious: false,
      indicators: [],
      riskScore: 0
    };
  }
}

// Combined middleware for API routes
export async function apiMiddleware(request, options = {}) {
  const startTime = Date.now();
  const requestInfo = logRequest(request, startTime);
  
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, options.rateLimit);
    if (rateLimitResult?.status === 429) {
      logResponse(requestInfo, rateLimitResult);
      return rateLimitResult;
    }
    
    // Parse and validate request body if it exists
    let validatedData = null;
    if (request.method !== 'GET' && options.schema) {
      try {
        const body = await request.json();
        const validation = validateInput(options.schema, body);
        
        if (!validation.isValid) {
          const errorResponse = NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.errors
            },
            { status: 400 }
          );
          
          logResponse(requestInfo, errorResponse);
          return errorResponse;
        }
        
        validatedData = validation.data;
      } catch (error) {
        const errorResponse = NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
        
        logResponse(requestInfo, errorResponse);
        return errorResponse;
      }
    }
    
    return {
      success: true,
      requestInfo,
      validatedData,
      rateLimitHeaders: rateLimitResult?.rateLimitHeaders || {}
    };
  } catch (error) {
    logger.error('API middleware failed:', error);
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    
    logResponse(requestInfo, errorResponse, error);
    return errorResponse;
  }
}

// Export schemas for use in route handlers
export { schemas };