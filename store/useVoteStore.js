import { create } from 'zustand';
import axios from 'axios';
import { llmData } from '@/lib/llm-data';
import fingerprintService from '@/lib/fingerprint';

const useVoteStore = create((set, get) => ({
  llms: llmData,
  votes: {},
  userVotes: {},
  rankings: [],
  stats: {
    totalVotes: 0,
    votesToday: 0,
    votesLastHour: 0,
    trending: [],
    topModel: null,
  },
  loading: false,
  error: null,
  lastUpdate: null,
  fingerprint: null,
  
  // Initialize votes and fingerprint
  initializeVotes: async () => {
    console.log('🚀 [INIT] Starting vote store initialization...');
    set({ loading: true, error: null });
    try {
      // Get fingerprint first
      console.log('🔍 [INIT] Getting fingerprint...');
      const fingerprint = await fingerprintService.getFingerprintWithFallbacks();
      console.log('🔍 [INIT] Fingerprint obtained:', fingerprint.substring(0, 8) + '...');
      set({ fingerprint });
      
      // Load votes from localStorage first for immediate UI update
      console.log('💾 [INIT] Loading votes from localStorage...');
      const localVotes = get().loadVotesFromLocalStorage();
      if (localVotes.userVotes && Object.keys(localVotes.userVotes).length > 0) {
        console.log('💾 [INIT] Found local user votes:', Object.keys(localVotes.userVotes).length, 'votes');
        set({ userVotes: localVotes.userVotes });
      } else {
        console.log('💾 [INIT] No local user votes found');
      }
      
      // Then sync with server
      console.log('📡 [INIT] Syncing with server...');
      const response = await axios.post('/api/vote/sync', { fingerprint });
      console.log('📡 [INIT] Server sync response:', {
        votesCount: response.data.votes ? Object.keys(response.data.votes).length : 0,
        userVotesCount: response.data.userVotes ? Object.keys(response.data.userVotes).length : 0,
        hasRankings: !!response.data.rankings,
        hasStats: !!response.data.stats
      });
      
      const serverData = {
        votes: response.data.votes || {},
        userVotes: response.data.userVotes || {},
        rankings: response.data.rankings || [],
        stats: response.data.stats || get().stats,
        loading: false,
        lastUpdate: new Date(),
      };
      
      console.log('📡 [INIT] Setting server data:', {
        totalVotes: Object.values(serverData.votes).reduce((sum, count) => sum + Math.abs(count), 0),
        userVotesCount: Object.keys(serverData.userVotes).length
      });
      
      set(serverData);
      
      // Update rankings and stats after loading
      get().updateRankings();
      
      // Save to localStorage
      get().saveVotesToLocalStorage(serverData);
      console.log('✅ [INIT] Vote store initialization completed successfully');
      
    } catch (error) {
      console.error('❌ [INIT] Failed to load votes:', error);
      
      // Try to load from localStorage as fallback
      const localData = get().loadVotesFromLocalStorage();
      if (localData.votes) {
        console.log('💾 [INIT] Using localStorage fallback data');
        set({ 
          ...localData,
          loading: false, 
          error: 'Using offline data',
        });
      } else {
        console.log('🔄 [INIT] Initializing with zero votes');
        set({ 
          loading: false, 
          error: 'Failed to load votes',
        });
        // Initialize with zero votes
        const initialVotes = {};
        llmData.forEach(llm => {
          initialVotes[llm.id] = 0;
        });
        set({ votes: initialVotes });
      }
    }
  },
  
  // Vote for an LLM
  vote: async (llmId, voteType) => {
    console.log('🗳️ [VOTE] Starting vote process:', { llmId, voteType });
    
    const currentUserVote = get().userVotes[llmId] || 0;
    const fingerprint = get().fingerprint;
    
    console.log('🗳️ [VOTE] Current state:', { 
      currentUserVote, 
      fingerprint: fingerprint ? fingerprint.substring(0, 8) + '...' : 'none',
      currentVotes: get().votes[llmId] || 0
    });
    
    if (!fingerprint) {
      console.error('❌ [VOTE] No fingerprint available');
      return;
    }
    
    // Optimistically update UI
    const optimisticVotes = { ...get().votes };
    const optimisticUserVotes = { ...get().userVotes };
    
    // Calculate vote change
    const voteChange = voteType - currentUserVote;
    optimisticVotes[llmId] = (optimisticVotes[llmId] || 0) + voteChange;
    
    console.log('🗳️ [VOTE] Vote change calculation:', { 
      voteChange, 
      oldVoteCount: get().votes[llmId] || 0,
      newVoteCount: optimisticVotes[llmId]
    });
    
    if (voteType === 0) {
      delete optimisticUserVotes[llmId];
    } else {
      optimisticUserVotes[llmId] = voteType;
    }
    
    const newState = { 
      votes: optimisticVotes,
      userVotes: optimisticUserVotes,
    };
    
    console.log('🗳️ [VOTE] Optimistic UI update:', { 
      newVoteCount: newState.votes[llmId],
      newUserVote: newState.userVotes[llmId] || 0
    });
    
    set(newState);
    
    // Save to localStorage immediately
    get().saveVotesToLocalStorage(newState);
    console.log('💾 [VOTE] Saved optimistic state to localStorage');
    
    try {
      console.log('📡 [VOTE] Sending request to server:', { fingerprint: fingerprint.substring(0, 8) + '...', llmId, voteType });
      
      const response = await axios.post('/api/vote', { 
        fingerprint, 
        llmId, 
        voteType 
      });
      
      console.log('📡 [VOTE] Server response:', {
        success: response.data.success,
        userVote: response.data.userVote,
        previousVote: response.data.previousVote,
        serverVoteCount: response.data.votes ? response.data.votes[llmId] : 'not provided'
      });
      
      if (response.data.success) {
        // Properly update the user vote for this specific LLM
        const updatedUserVotes = { ...get().userVotes };
        if (response.data.userVote === 0) {
          delete updatedUserVotes[llmId];
        } else {
          updatedUserVotes[llmId] = response.data.userVote;
        }
        
        // Use server's authoritative vote counts for all LLMs
        const serverState = {
          votes: response.data.votes || get().votes,
          userVotes: updatedUserVotes,
          lastUpdate: new Date(),
        };
        
        console.log('✅ [VOTE] Updating state with server data:', {
          finalVoteCount: serverState.votes[llmId],
          finalUserVote: serverState.userVotes[llmId] || 0
        });
        
        set(serverState);
        
        // Update rankings and stats
        get().updateRankings();
        
        // Save updated state to localStorage
        get().saveVotesToLocalStorage(serverState);
        console.log('💾 [VOTE] Saved final state to localStorage');
      }
    } catch (error) {
      console.error('❌ [VOTE] Server request failed:', error);
      console.log('⚠️ [VOTE] Keeping optimistic update in place');
      
      // Don't revert - keep the optimistic update as it's saved locally
      // Update rankings even if server sync fails
      get().updateRankings();
      
      set({ 
        error: 'Failed to sync vote with server',
      });
      
      // Clear error after 3 seconds
      setTimeout(() => set({ error: null }), 3000);
    }
  },
  
  // Update rankings based on votes
  updateRankings: () => {
    const votes = get().votes;
    const rankings = Object.entries(votes)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    // Calculate stats in real-time
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + Math.abs(count), 0);
    const topModel = rankings[0]?.id || null;
    const topModelName = topModel ? get().getLLMById(topModel)?.name || topModel : null;
    
    const updatedStats = {
      ...get().stats,
      totalVotes,
      votesToday: totalVotes, // For now, treat all votes as today's votes
      votesLastHour: totalVotes, // For now, treat all votes as last hour's votes  
      topModel: topModelName,
    };
    
    set({ rankings, stats: updatedStats });
  },
  
  // Fetch latest stats
  fetchStats: async () => {
    try {
      const response = await axios.get('/api/stats');
      set({
        stats: response.data.stats,
        rankings: response.data.rankings,
        lastUpdate: new Date(),
      });
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
  
  // Check if LLM is trending
  isTrending: (llmId) => {
    return get().stats.trending.includes(llmId);
  },
  
  // Get rank position for an LLM
  getRank: (llmId) => {
    const ranking = get().rankings.find(r => r.id === llmId);
    return ranking ? ranking.rank : null;
  },
  
  // Save votes to localStorage
  saveVotesToLocalStorage: (state) => {
    if (typeof window === 'undefined') return;
    
    try {
      const dataToSave = {
        votes: state.votes || get().votes,
        userVotes: state.userVotes || get().userVotes,
        lastUpdate: state.lastUpdate || get().lastUpdate,
        timestamp: new Date().toISOString(),
      };
      
      localStorage.setItem('llm-tracker-votes', JSON.stringify(dataToSave));
      sessionStorage.setItem('llm-tracker-votes-backup', JSON.stringify(dataToSave));
      
      // Also save with fingerprint as key for additional persistence
      const fingerprint = get().fingerprint;
      if (fingerprint) {
        localStorage.setItem(`llm-tracker-votes-${fingerprint}`, JSON.stringify(dataToSave));
      }
    } catch (error) {
      console.error('Failed to save votes to localStorage:', error);
    }
  },
  
  // Load votes from localStorage
  loadVotesFromLocalStorage: () => {
    if (typeof window === 'undefined') return {};
    
    try {
      // Try primary storage first
      let stored = localStorage.getItem('llm-tracker-votes');
      
      if (!stored) {
        // Try sessionStorage backup
        stored = sessionStorage.getItem('llm-tracker-votes-backup');
      }
      
      if (!stored) {
        // Try fingerprint-based storage
        const fingerprint = get().fingerprint;
        if (fingerprint) {
          stored = localStorage.getItem(`llm-tracker-votes-${fingerprint}`);
        }
      }
      
      if (stored) {
        const data = JSON.parse(stored);
        return {
          votes: data.votes || {},
          userVotes: data.userVotes || {},
          lastUpdate: data.lastUpdate ? new Date(data.lastUpdate) : null,
        };
      }
    } catch (error) {
      console.error('Failed to load votes from localStorage:', error);
    }
    
    return {};
  },
  
  // Sync with server for real-time updates
  syncWithServer: async () => {
    try {
      const fingerprint = get().fingerprint;
      if (!fingerprint) {
        console.debug('🔄 [SYNC] Skipping sync - no fingerprint available');
        return; // Skip sync if no fingerprint available
      }
      
      console.debug('🔄 [SYNC] Starting background sync...');
      const response = await axios.post('/api/vote/sync', { fingerprint });
      
      if (response.data) {
        const currentUserVotes = get().userVotes;
        
        // Only update if there are actual changes to prevent unnecessary re-renders
        const newVotes = response.data.votes || {};
        const newStats = response.data.stats || get().stats;
        const newRankings = response.data.rankings || [];
        
        // Check if votes have actually changed
        const votesChanged = JSON.stringify(newVotes) !== JSON.stringify(get().votes);
        const statsChanged = JSON.stringify(newStats) !== JSON.stringify(get().stats);
        
        console.debug('🔄 [SYNC] Sync data comparison:', {
          votesChanged,
          statsChanged,
          currentTotalVotes: Object.values(get().votes).reduce((sum, count) => sum + Math.abs(count), 0),
          newTotalVotes: Object.values(newVotes).reduce((sum, count) => sum + Math.abs(count), 0)
        });
        
        if (votesChanged || statsChanged) {
          console.debug('🔄 [SYNC] Updating state with new data from server');
          set({
            votes: newVotes,
            rankings: newRankings,
            stats: newStats,
            lastUpdate: new Date(),
            // Keep user votes from current state, don't override with server
            userVotes: { ...currentUserVotes, ...(response.data.userVotes || {}) },
          });
          
          // Update local storage with new data
          get().saveVotesToLocalStorage({
            votes: newVotes,
            userVotes: currentUserVotes,
            lastUpdate: new Date(),
          });
          console.debug('🔄 [SYNC] Background sync completed with updates');
        } else {
          console.debug('🔄 [SYNC] No changes detected, skipping update');
        }
      }
    } catch (error) {
      // Silently fail - this is background sync
      console.debug('❌ [SYNC] Background sync failed:', error.message);
    }
  },
  
  // Clear all stored data (for testing or user request)
  clearAllStoredData: () => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('llm-tracker-votes');
      sessionStorage.removeItem('llm-tracker-votes-backup');
      
      // Clear fingerprint-based storage
      const fingerprint = get().fingerprint;
      if (fingerprint) {
        localStorage.removeItem(`llm-tracker-votes-${fingerprint}`);
      }
      
      // Clear fingerprint
      fingerprintService.clearFingerprint();
      
      // Reset state
      const initialVotes = {};
      llmData.forEach(llm => {
        initialVotes[llm.id] = 0;
      });
      
      set({
        votes: initialVotes,
        userVotes: {},
        fingerprint: null,
      });
    } catch (error) {
      console.error('Failed to clear stored data:', error);
    }
  },
}));

export default useVoteStore;