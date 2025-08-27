import { NextResponse } from 'next/server';
import { getAdaptedVoteManager } from '@/lib/vote-manager-wrapper';
import { apiMiddleware, schemas, detectFraud, securityHeaders } from '@/lib/middleware';
import logger from '@/lib/logger';

export async function POST(request) {
  // Apply middleware
  const middlewareResult = await apiMiddleware(request, {
    schema: schemas.vote,
    rateLimit: {
      maxRequests: 60,
      windowMs: 60000 // 60 requests per minute
    }
  });
  
  if (middlewareResult.status) {
    // Middleware returned an error response
    return middlewareResult;
  }
  
  const { validatedData, requestInfo, rateLimitHeaders } = middlewareResult;
  
  try {
    const { fingerprint, llmId, voteType } = validatedData;
    
    // Fraud detection
    const fraudCheck = await detectFraud(fingerprint, 'vote', {
      llmId,
      voteType
    });
    
    if (fraudCheck.isSuspicious && fraudCheck.riskScore > 50) {
      logger.business.fraudulentVoteDetected(
        fingerprint,
        'High risk score',
        fraudCheck
      );
      
      return NextResponse.json(
        { error: 'Suspicious activity detected. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Process vote using database
    const voteManager = await getAdaptedVoteManager();
    const result = await voteManager.vote(fingerprint, llmId, voteType, {
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400, headers: { ...securityHeaders(), ...rateLimitHeaders } }
      );
    }
    
    // Log successful vote
    logger.logResponse(requestInfo, { status: 200 });
    
    return NextResponse.json(
      {
        success: true,
        votes: result.votes,
        userVote: result.userVote,
        previousVote: result.previousVote,
      },
      { 
        status: 200,
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  } catch (error) {
    logger.error('Vote error:', error);
    logger.logResponse(requestInfo, { status: 500 }, error);
    
    return NextResponse.json(
      { error: 'Failed to process vote' },
      { 
        status: 500,
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  }
}

// This endpoint is deprecated - use POST /api/vote/sync instead
export async function GET(request) {
  // Apply middleware
  const middlewareResult = await apiMiddleware(request, {
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000 // 100 requests per minute
    }
  });
  
  if (middlewareResult.status) {
    return middlewareResult;
  }
  
  const { requestInfo, rateLimitHeaders } = middlewareResult;
  
  try {
    const voteManager = await getAdaptedVoteManager();
    const votes = await voteManager.getVotes();
    const rankings = await voteManager.getRankings();
    const stats = await voteManager.getStats();
    
    logger.logResponse(requestInfo, { status: 200 });
    
    return NextResponse.json(
      {
        votes,
        rankings,
        stats,
        userVotes: {},
      },
      {
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  } catch (error) {
    logger.error('Get votes error:', error);
    logger.logResponse(requestInfo, { status: 500 }, error);
    
    return NextResponse.json(
      { error: 'Failed to get votes' },
      { 
        status: 500,
        headers: { ...securityHeaders(), ...rateLimitHeaders }
      }
    );
  }
}