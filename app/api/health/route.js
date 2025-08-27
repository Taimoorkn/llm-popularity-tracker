import { NextResponse } from 'next/server';
import { getAdaptedVoteManager } from '@/lib/vote-manager-wrapper';
import dbManager from '@/lib/database';
import cacheManager from '@/lib/cache';
import logger from '@/lib/logger';
import { securityHeaders } from '@/lib/middleware';

export async function GET(request) {
  const startTime = Date.now();
  
  try {
    const voteManager = await getAdaptedVoteManager();
    const health = await voteManager.checkHealth();
    
    // Additional health checks
    const checks = {
      database: health.database,
      cache: health.cache,
      api: {
        status: 'healthy',
        latency: `${Date.now() - startTime}ms`
      },
      overall: health.status
    };
    
    // Determine HTTP status based on health
    const httpStatus = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 503 : 500;
    
    logger.debug('Health check performed', checks);
    
    return NextResponse.json(
      {
        status: health.status,
        checks,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '0.1.0'
      },
      {
        status: httpStatus,
        headers: securityHeaders()
      }
    );
  } catch (error) {
    logger.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders()
      }
    );
  }
}