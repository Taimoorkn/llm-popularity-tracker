import { NextResponse } from 'next/server';
import { getAdaptedVoteManager } from '@/lib/vote-manager-wrapper';
import { apiMiddleware, schemas, securityHeaders, logResponse } from '@/lib/middleware';
import logger from '@/lib/logger';

export async function POST(request) {
  // Apply middleware
  const middlewareResult = await apiMiddleware(request, {
    schema: schemas.sync,
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000 // 100 requests per minute
    }
  });
  
  if (middlewareResult.status) {
    return middlewareResult;
  }
  
  const { validatedData, requestInfo, rateLimitHeaders } = middlewareResult;
  
  try {
    const { fingerprint } = validatedData;
    
    const voteManager = await getAdaptedVoteManager();
    const syncData = await voteManager.syncUserVotes(fingerprint);
    
    logResponse(requestInfo, { status: 200 });
    
    return NextResponse.json(
      syncData,
      {
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  } catch (error) {
    logger.error('Sync votes error:', error);
    logResponse(requestInfo, { status: 500 }, error);
    
    return NextResponse.json(
      { error: 'Failed to sync votes' },
      { 
        status: 500,
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  }
}