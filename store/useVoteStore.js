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
    set({ loading: true, error: null });
    try {
      // Get fingerprint first
      const fingerprint = await fingerprintService.getFingerprintWithFallbacks();
      set({ fingerprint });
      
      // Load votes from localStorage first for immediate UI update
      const localVotes = get().loadVotesFromLocalStorage();
      if (localVotes.userVotes && Object.keys(localVotes.userVotes).length > 0) {
        set({ userVotes: localVotes.userVotes });
      }
      
      // Then sync with server
      const response = await axios.post('/api/vote/sync', { fingerprint });
      const serverData = {
        votes: response.data.votes || {},
        userVotes: response.data.userVotes || {},
        rankings: response.data.rankings || [],
        stats: response.data.stats || get().stats,
        loading: false,
        lastUpdate: new Date(),
      };
      
      set(serverData);
      
      // Update rankings and stats after loading
      get().updateRankings();
      
      // Save to localStorage
      get().saveVotesToLocalStorage(serverData);
      
    } catch (error) {
      console.error('Failed to load votes:', error);
      
      // Try to load from localStorage as fallback
      const localData = get().loadVotesFromLocalStorage();
      if (localData.votes) {
        set({ 
          ...localData,
          loading: false, 
          error: 'Using offline data',
        });
      } else {
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
    const currentUserVote = get().userVotes[llmId] || 0;
    const fingerprint = get().fingerprint;
    
    if (!fingerprint) {
      console.error('No fingerprint available');
      return;
    }
    
    // Optimistically update UI
    const optimisticVotes = { ...get().votes };
    const optimisticUserVotes = { ...get().userVotes };
    
    // Calculate vote change
    const voteChange = voteType - currentUserVote;
    optimisticVotes[llmId] = (optimisticVotes[llmId] || 0) + voteChange;
    
    if (voteType === 0) {
      delete optimisticUserVotes[llmId];
    } else {
      optimisticUserVotes[llmId] = voteType;
    }
    
    const newState = { 
      votes: optimisticVotes,
      userVotes: optimisticUserVotes,
    };
    
    set(newState);
    
    // Save to localStorage immediately
    get().saveVotesToLocalStorage(newState);
    
    try {
      const response = await axios.post('/api/vote', { 
        fingerprint, 
        llmId, 
        voteType 
      });
      
      if (response.data.success) {
        const serverState = {
          votes: response.data.votes,
          userVotes: { ...get().userVotes, [llmId]: response.data.userVote },
          lastUpdate: new Date(),
        };
        
        set(serverState);
        
        // Update rankings and stats
        get().updateRankings();
        
        // Save updated state to localStorage
        get().saveVotesToLocalStorage(serverState);
      }
    } catch (error) {
      console.error('Vote failed:', error);
      
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