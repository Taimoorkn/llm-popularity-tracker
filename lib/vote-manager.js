import fs from 'fs';
import path from 'path';
import { llmData } from './llm-data.js';

class VoteManager {
  constructor() {
    this.votesFile = path.join(process.cwd(), 'data', 'votes.json');
    this.votes = {};
    this.userVotes = new Map(); // fingerprint -> { llmId -> vote (-1, 0, 1) }
    this.stats = {
      totalVotes: 0,
      lastHourVotes: [],
      dailyVotes: new Map(),
    };
    this.loadVotes();
  }

  loadVotes() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Load votes from file if it exists
      if (fs.existsSync(this.votesFile)) {
        const data = JSON.parse(fs.readFileSync(this.votesFile, 'utf8'));
        this.votes = data.votes || {};
        // Load user votes from persistent storage
        if (data.userSessions) {
          this.userVotes = new Map(Object.entries(data.userSessions));
        }
        // Restore stats properly, converting arrays back to Maps
        if (data.stats) {
          this.stats.totalVotes = data.stats.totalVotes || 0;
          this.stats.lastHourVotes = data.stats.lastHourVotes || [];
          this.stats.dailyVotes = new Map(data.stats.dailyVotes || []);
        }
      } else {
        // Initialize with zero votes for all LLMs
        llmData.forEach(llm => {
          this.votes[llm.id] = 0;
        });
        this.saveVotes();
      }
    } catch (error) {
      console.error('Error loading votes:', error);
      // Initialize with empty votes
      llmData.forEach(llm => {
        this.votes[llm.id] = 0;
      });
    }
  }

  saveVotes() {
    try {
      const data = {
        votes: this.votes,
        userSessions: Object.fromEntries(this.userVotes.entries()),
        stats: {
          totalVotes: this.stats.totalVotes,
          lastHourVotes: this.stats.lastHourVotes.slice(-100), // Keep last 100 entries
          dailyVotes: Array.from(this.stats.dailyVotes.entries()).slice(-30), // Keep last 30 days
        },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.votesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving votes:', error);
    }
  }

  vote(fingerprint, llmId, voteType) {
    // voteType: 1 for upvote, -1 for downvote, 0 for remove vote
    if (!this.votes.hasOwnProperty(llmId)) {
      return { success: false, error: 'Invalid LLM ID' };
    }

    // Get user's current votes
    let userVoteMap = this.userVotes.get(fingerprint) || {};
    const currentVote = userVoteMap[llmId] || 0;

    // Calculate vote change
    const voteChange = voteType - currentVote;
    
    if (voteChange === 0) {
      return { success: false, error: 'Vote unchanged' };
    }

    // Update vote count
    this.votes[llmId] += voteChange;
    
    // Update user's vote record
    if (voteType === 0) {
      delete userVoteMap[llmId];
    } else {
      userVoteMap[llmId] = voteType;
    }
    
    if (Object.keys(userVoteMap).length === 0) {
      this.userVotes.delete(fingerprint);
    } else {
      this.userVotes.set(fingerprint, userVoteMap);
    }

    // Update stats
    this.updateStats(llmId, voteType);
    
    // Save immediately to ensure persistence
    this.saveVotes();

    return { 
      success: true, 
      votes: this.votes,
      userVote: voteType,
      previousVote: currentVote,
    };
  }

  updateStats(llmId, voteType) {
    const now = new Date();
    
    // Update total votes
    if (voteType !== 0) {
      this.stats.totalVotes++;
    }
    
    // Track last hour votes
    this.stats.lastHourVotes.push({
      llmId,
      voteType,
      timestamp: now.toISOString(),
    });
    
    // Remove votes older than 1 hour
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    this.stats.lastHourVotes = this.stats.lastHourVotes.filter(
      v => new Date(v.timestamp) > oneHourAgo
    );
    
    // Track daily votes
    const today = now.toDateString();
    const dailyCount = this.stats.dailyVotes.get(today) || 0;
    this.stats.dailyVotes.set(today, dailyCount + 1);
  }

  getUserVotes(fingerprint) {
    return this.userVotes.get(fingerprint) || {};
  }

  getVotes() {
    return this.votes;
  }

  getRankings() {
    const rankings = Object.entries(this.votes)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    return rankings;
  }

  getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const today = now.toDateString();
    
    // Get trending (most voted in last hour)
    const recentVotes = {};
    this.stats.lastHourVotes.forEach(v => {
      if (new Date(v.timestamp) > oneHourAgo && v.voteType !== 0) {
        recentVotes[v.llmId] = (recentVotes[v.llmId] || 0) + 1;
      }
    });
    
    const trending = Object.entries(recentVotes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    
    return {
      totalVotes: this.stats.totalVotes,
      votesToday: this.stats.dailyVotes.get(today) || 0,
      votesLastHour: this.stats.lastHourVotes.filter(
        v => new Date(v.timestamp) > oneHourAgo
      ).length,
      trending,
      topModel: this.getRankings()[0]?.id || null,
    };
  }
}

// Singleton instance
let voteManager;

export function getVoteManager() {
  if (!voteManager) {
    voteManager = new VoteManager();
  }
  return voteManager;
}