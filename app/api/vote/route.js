import { NextResponse } from 'next/server';
import { getVoteManager } from '@/lib/vote-manager';

export async function POST(request) {
  try {
    const { fingerprint, llmId, voteType } = await request.json();
    
    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Fingerprint is required' },
        { status: 400 }
      );
    }
    
    // Process vote using fingerprint
    const voteManager = getVoteManager();
    const result = voteManager.vote(fingerprint, llmId, voteType);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      votes: result.votes,
      userVote: result.userVote,
      previousVote: result.previousVote,
    });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'Failed to process vote' },
      { status: 500 }
    );
  }
}

// This endpoint is deprecated - use POST /api/vote/sync instead
export async function GET() {
  try {
    const voteManager = getVoteManager();
    const votes = voteManager.getVotes();
    const rankings = voteManager.getRankings();
    const stats = voteManager.getStats();
    
    return NextResponse.json({
      votes,
      rankings,
      stats,
      userVotes: {},
    });
  } catch (error) {
    console.error('Get votes error:', error);
    return NextResponse.json(
      { error: 'Failed to get votes' },
      { status: 500 }
    );
  }
}