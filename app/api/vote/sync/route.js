import { NextResponse } from 'next/server';
import { getVoteManager } from '@/lib/vote-manager';

export async function POST(request) {
  try {
    const { fingerprint } = await request.json();
    
    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Fingerprint is required' },
        { status: 400 }
      );
    }
    
    const voteManager = getVoteManager();
    const votes = voteManager.getVotes();
    const rankings = voteManager.getRankings();
    const stats = voteManager.getStats();
    const userVotes = voteManager.getUserVotes(fingerprint);
    
    return NextResponse.json({
      votes,
      rankings,
      stats,
      userVotes,
    });
  } catch (error) {
    console.error('Sync votes error:', error);
    return NextResponse.json(
      { error: 'Failed to sync votes' },
      { status: 500 }
    );
  }
}