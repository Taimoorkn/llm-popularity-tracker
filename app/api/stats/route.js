import { NextResponse } from 'next/server';
import { getVoteManager } from '@/lib/vote-manager';

export async function GET() {
  try {
    const voteManager = getVoteManager();
    const stats = voteManager.getStats();
    const rankings = voteManager.getRankings();
    
    return NextResponse.json({
      stats,
      rankings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}