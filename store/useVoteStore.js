import { create } from 'zustand';
import { llmData } from '@/lib/llm-data';
import fingerprintService from '@/lib/fingerprint';
import voteManager from '@/lib/supabase/vote-manager';

const useVoteStore = create((set, get) => ({
  llms: llmData,
  votes: {},
  userVotes: {},
  rankings: [],
  stats: {
    totalVotes: 0,
    uniqueVoters: 0,
    votesLastHour: 0,
    votesToday: 0,
    topModel: null,
    topModelVotes: 0,
  },
  loading: false,
  error: null,
  lastUpdate: null,
  fingerprint: null,
  realtimeConnected: false,
  
  // Initialize votes and real-time connection
  initializeVotes: async () => {
    console.log('🚀 Initializing Supabase vote store...');
    set({ loading: true, error: null });
    
    try {
      // Get fingerprint
      const fingerprint = await fingerprintService.getFingerprintWithFallbacks();
      console.log('🔍 Fingerprint obtained:', fingerprint.substring(0, 8) + '...');
      set({ fingerprint });
      
      // Sync initial data
      const syncResult = await voteManager.syncUserData(fingerprint);
      
      if (syncResult.success) {
        set({
          votes: syncResult.votes || {},
          userVotes: syncResult.userVotes || {},
          rankings: syncResult.rankings || [],
          stats: syncResult.stats || get().stats,
          loading: false,
          lastUpdate: new Date(),
        });
        
        // Initialize real-time subscriptions with optimized partial updates
        const realtimeSuccess = await voteManager.initializeRealtime(
          // Partial vote update - only update the specific LLM that changed
          (voteUpdate) => {
            console.log('📡 Real-time aggregate update for:', voteUpdate.llmId);
            const currentVotes = get().votes;
            set({ 
              votes: {
                ...currentVotes,
                [voteUpdate.llmId]: voteUpdate.votes
              },
              lastUpdate: new Date()
            });
            get().updateRankings();
          },
          // Global stats update
          (statsUpdate) => {
            console.log('📊 Real-time global stats update');
            set({ 
              stats: {
                totalVotes: statsUpdate.totalVotes || 0,
                uniqueVoters: statsUpdate.uniqueVoters || 0,
                votesLastHour: statsUpdate.votesLastHour || 0,
                votesToday: statsUpdate.votesToday || 0,
                topModel: statsUpdate.topModel,
                topModelVotes: statsUpdate.topModelVotes || 0
              }
            });
          }
        );
        
        set({ realtimeConnected: realtimeSuccess });
        console.log('✅ Vote store initialized with real-time:', realtimeSuccess);
      } else {
        throw new Error(syncResult.error || 'Failed to sync data');
      }
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      set({ 
        loading: false, 
        error: 'Failed to connect to voting system',
      });
      
      // Initialize with zero votes as fallback
      const initialVotes = {};
      llmData.forEach(llm => {
        initialVotes[llm.id] = 0;
      });
      set({ votes: initialVotes });
    }
  },
  
  // Vote for an LLM
  vote: async (llmId, voteType) => {
    console.log('🗳️ Voting:', { llmId, voteType });
    
    const fingerprint = get().fingerprint;
    if (!fingerprint) {
      console.error('No fingerprint available');
      return;
    }
    
    const currentUserVote = get().userVotes[llmId] || 0;
    
    // Don't vote if it's the same
    if (currentUserVote === voteType) {
      console.log('Same vote, ignoring');
      return;
    }
    
    // Optimistic update
    const optimisticVotes = { ...get().votes };
    const optimisticUserVotes = { ...get().userVotes };
    
    // Calculate vote change
    const voteChange = voteType - currentUserVote;
    optimisticVotes[llmId] = (optimisticVotes[llmId] || 0) + voteChange;
    
    // Update user vote
    if (voteType === 0) {
      delete optimisticUserVotes[llmId];
    } else {
      optimisticUserVotes[llmId] = voteType;
    }
    
    set({ 
      votes: optimisticVotes,
      userVotes: optimisticUserVotes,
    });
    
    try {
      // Submit vote to Supabase
      const result = await voteManager.vote(
        llmId, 
        fingerprint, 
        voteType,
        {
          ip: window.location.hostname,
          userAgent: navigator.userAgent
        }
      );
      
      if (!result.success) {
        // Revert optimistic update on failure
        console.error('Vote failed:', result.error);
        
        const revertedVotes = { ...get().votes };
        revertedVotes[llmId] = (revertedVotes[llmId] || 0) - voteChange;
        
        const revertedUserVotes = { ...get().userVotes };
        if (currentUserVote === 0) {
          delete revertedUserVotes[llmId];
        } else {
          revertedUserVotes[llmId] = currentUserVote;
        }
        
        set({ 
          votes: revertedVotes,
          userVotes: revertedUserVotes,
          error: result.error || 'Failed to submit vote'
        });
        
        setTimeout(() => set({ error: null }), 3000);
      } else {
        console.log('✅ Vote successful');
        // Real-time will handle the update
        get().updateRankings();
      }
    } catch (error) {
      console.error('❌ Vote error:', error);
      // Keep optimistic update but show error
      set({ error: 'Vote may not have been saved' });
      setTimeout(() => set({ error: null }), 3000);
    }
  },
  
  // Update rankings based on votes
  updateRankings: () => {
    const votes = get().votes;
    const rankings = Object.entries(votes)
      .map(([id, count]) => ({ 
        id, 
        count,
        name: get().getLLMById(id)?.name || id
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    set({ rankings });
  },
  
  // Fetch latest stats
  fetchStats: async () => {
    try {
      const stats = await voteManager.getStats();
      set({ stats, lastUpdate: new Date() });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },
  
  // Get LLM by ID
  getLLMById: (id) => {
    return get().llms.find(llm => llm.id === id);
  },
  
  // Get user's vote for an LLM
  getUserVote: (llmId) => {
    return get().userVotes[llmId] || 0;
  },
  
  // Get total votes for an LLM
  getVoteCount: (llmId) => {
    return get().votes[llmId] || 0;
  },
  
  // Check if LLM is trending (top 3)
  isTrending: (llmId) => {
    const rankings = get().rankings;
    const item = rankings.find(r => r.id === llmId);
    return item ? item.rank <= 3 : false;
  },
  
  // Get rank position for an LLM
  getRank: (llmId) => {
    const rankings = get().rankings;
    const item = rankings.find(r => r.id === llmId);
    return item ? item.rank : null;
  },
  
  // Manual sync with server
  syncWithServer: async () => {
    const fingerprint = get().fingerprint;
    if (!fingerprint) return;
    
    try {
      const syncResult = await voteManager.syncUserData(fingerprint);
      if (syncResult.success) {
        set({
          votes: syncResult.votes || get().votes,
          userVotes: syncResult.userVotes || get().userVotes,
          rankings: syncResult.rankings || get().rankings,
          stats: syncResult.stats || get().stats,
          lastUpdate: new Date(),
        });
      }
    } catch (error) {
      console.debug('Sync failed:', error);
    }
  },
  
  // Clear all data (for testing)
  clearAllStoredData: () => {
    fingerprintService.clearFingerprint();
    set({
      votes: {},
      userVotes: {},
      fingerprint: null,
      rankings: [],
      stats: {
        totalVotes: 0,
        uniqueVoters: 0,
        votesLastHour: 0,
        votesToday: 0,
        topModel: null,
        topModelVotes: 0,
      }
    });
  },
  
  // Cleanup on unmount
  cleanup: () => {
    voteManager.cleanup();
    set({ realtimeConnected: false });
  }
}));

export default useVoteStore;