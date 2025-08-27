import { NextResponse } from 'next/server';
import { getAdaptedVoteManager } from '@/lib/vote-manager-wrapper';
import { apiMiddleware, securityHeaders } from '@/lib/middleware';
import logger from '@/lib/logger';

export async function GET(request) {
  // Apply middleware
  const middlewareResult = await apiMiddleware(request, {
    rateLimit: {
      maxRequests: 200,
      windowMs: 60000 // 200 requests per minute
    }
  });
  
  if (middlewareResult.status) {
    return middlewareResult;
  }
  
  const { requestInfo, rateLimitHeaders } = middlewareResult;
  
  try {
    const voteManager = await getAdaptedVoteManager();
    const stats = await voteManager.getStats();
    const rankings = await voteManager.getRankings();
    
    logger.logResponse(requestInfo, { status: 200 });
    
    return NextResponse.json(
      {
        stats,
        rankings,
        timestamp: new Date().toISOString(),
      },
      {
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  } catch (error) {
    logger.error('Stats error:', error);
    logger.logResponse(requestInfo, { status: 500 }, error);
    
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { 
        status: 500,
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  }
}