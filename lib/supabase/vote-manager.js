// lib/supabase/vote-manager.js
import { supabase } from './client'

class SupabaseVoteManager {
  constructor() {
    this.channel = null
    this.subscriptions = new Map()
    this.retryCount = 0
    this.maxRetries = 5
    this.retryDelay = 1000
    this.isConnecting = false
    this.connectionCallbacks = null
    this.statsInterval = null
  }

  // YOUR ORIGINAL initializeRealtime
  async initializeRealtime(onVoteUpdate, onStatsUpdate) {
    this.connectionCallbacks = { onVoteUpdate, onStatsUpdate }
    
    if (this.isConnecting) {
      console.log('🔄 Connection already in progress...')
      return false
    }
    
    this.isConnecting = true
    
    try {
      if (this.channel) {
        await this.cleanup()
      }
      
      this.channel = supabase
        .channel('optimized-votes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'vote_stats_aggregate'
        }, (payload) => {
          console.log('📊 Aggregate update received:', payload.new?.llm_id)
          if (onVoteUpdate && payload.new) {
            onVoteUpdate({
              llmId: payload.new.llm_id,
              votes: payload.new.total_votes,
              upvotes: payload.new.upvotes,
              downvotes: payload.new.downvotes,
              uniqueVoters: payload.new.unique_voters
            })
          }
        })
        .subscribe((status) => {
          console.log('✅ Realtime subscription status:', status)
          
          if (status === 'SUBSCRIBED') {
            this.retryCount = 0
            this.retryDelay = 1000
            this.isConnecting = false
            this.startStatsPolling(onStatsUpdate)
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.handleConnectionError()
          }
        })

      setTimeout(() => {
        if (this.isConnecting) {
          console.warn('⚠️ Connection timeout, attempting retry...')
          this.handleConnectionError()
        }
      }, 10000)

      this.isConnecting = false
      return true
    } catch (error) {
      console.error('❌ Failed to initialize realtime:', error)
      this.isConnecting = false
      this.handleConnectionError()
      return false
    }
  }
  
  startStatsPolling(onStatsUpdate) {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
    }
    
    this.fetchAndUpdateStats(onStatsUpdate)
    
    this.statsInterval = setInterval(() => {
      this.fetchAndUpdateStats(onStatsUpdate)
    }, 30000)
  }
  
  async fetchAndUpdateStats(onStatsUpdate) {
    try {
      const stats = await this.getStats()
      if (onStatsUpdate) {
        console.log('📊 Polling global stats update')
        onStatsUpdate({
          totalVotes: stats.totalVotes || 0,
          uniqueVoters: stats.uniqueVoters || 0,
          votesLastHour: stats.votesLastHour || 0,
          votesToday: stats.votesToday || 0,
          topModel: stats.topModel,
          topModelVotes: stats.topModelVotes || 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }
  
  async handleConnectionError() {
    this.isConnecting = false
    
    if (this.retryCount >= this.maxRetries) {
      console.error('🛑 Max retries reached, giving up on realtime connection')
      return
    }
    
    this.retryCount++
    const delay = Math.min(this.retryDelay * Math.pow(2, this.retryCount - 1), 30000)
    
    console.log(`🔄 Retrying connection in ${delay/1000}s (attempt ${this.retryCount}/${this.maxRetries})`)
    
    setTimeout(() => {
      if (this.connectionCallbacks) {
        this.initializeRealtime(
          this.connectionCallbacks.onVoteUpdate,
          this.connectionCallbacks.onStatsUpdate
        )
      }
    }, delay)
  }

  // YOUR ORIGINAL vote function (no p_use_queue parameter!)
  async vote(llmId, fingerprint, voteType, metadata = {}) {
    try {
      const { data, error } = await supabase
        .rpc('handle_vote', {
          p_llm_id: llmId,
          p_fingerprint: fingerprint,
          p_vote_type: voteType,
          p_ip_address: metadata.ip || null,
          p_user_agent: metadata.userAgent || null
        })

      if (error) {
        throw error
      }

      // Handle database rate limiting response
      if (!data.success && data.wait_seconds) {
        return {
          success: false,
          error: `Rate limited. Please wait ${Math.ceil(data.wait_seconds)} seconds before voting again.`,
          wait_seconds: data.wait_seconds
        }
      }

      return {
        success: data.success,
        previousVote: data.previous_vote,
        newVote: data.new_vote,
        voteCount: data.vote_count,
        message: data.message,
        wait_seconds: data.wait_seconds
      }
    } catch (error) {
      console.error('Vote failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // YOUR ORIGINAL getVoteCounts
  async getVoteCounts() {
    try {
      const { data, error } = await supabase
        .from('vote_stats_aggregate')
        .select('llm_id, total_votes, upvotes, downvotes')
        .order('total_votes', { ascending: false })

      if (error) throw error

      const votes = {}
      const upvotes = {}
      const downvotes = {}
      
      data.forEach(item => {
        votes[item.llm_id] = item.total_votes || 0
        upvotes[item.llm_id] = item.upvotes || 0
        downvotes[item.llm_id] = item.downvotes || 0
      })

      return { votes, upvotes, downvotes } // CHANGED: return object instead of just votes
    } catch (error) {
      console.error('Failed to get vote counts:', error)
      return { votes: {}, upvotes: {}, downvotes: {} } // CHANGED: return object
    }
  }

  async getUserVotes(fingerprint) {
    try {
      const { data, error } = await supabase
        .rpc('get_user_votes', {
          p_fingerprint: fingerprint
        })

      if (error) throw error
      return data || {}
    } catch (error) {
      console.error('Failed to get user votes:', error)
      return {}
    }
  }

  async getLLMsWithVotes() {
    try {
      const { data, error } = await supabase
        .from('vote_stats_aggregate')
        .select(`
          llm_id,
          total_votes,
          upvotes,
          downvotes,
          unique_voters,
          llms!inner(
            name,
            company,
            description,
            logo,
            image,
            color,
            release_year,
            use_cases
          )
        `)
        .order('total_votes', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to get LLMs with votes:', error)
      return []
    }
  }

  async getRankings() {
    try {
      const { data, error } = await supabase
        .from('vote_stats_aggregate')
        .select('llm_id, total_votes')
        .order('total_votes', { ascending: false })
        .limit(10)

      if (error) throw error

      return (data || []).map((item, index) => ({
        id: item.llm_id,
        name: item.llm_id,
        count: item.total_votes || 0,
        rank: index + 1
      }))
    } catch (error) {
      console.error('Failed to get rankings:', error)
      return []
    }
  }

  async getStats() {
    try {
      const { data, error } = await supabase
        .from('global_stats')
        .select('*')
        .single()

      if (error) throw error

      let topModelName = null
      if (data?.top_model) {
        const { data: llmData } = await supabase
          .from('llms')
          .select('name')
          .eq('id', data.top_model)
          .single()
        
        topModelName = llmData?.name || data.top_model
      }

      return {
        totalVotes: data?.total_votes || 0,
        uniqueVoters: data?.unique_voters || 0,
        votesLastHour: data?.votes_last_hour || 0,
        votesToday: data?.votes_today || 0,
        topModel: topModelName,
        topModelVotes: data?.top_model_votes || 0,
        lastUpdated: data?.last_updated || new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get stats:', error)
      return {
        totalVotes: 0,
        uniqueVoters: 0,
        votesLastHour: 0,
        votesToday: 0,
        topModel: null,
        topModelVotes: 0,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  async syncUserData(fingerprint) {
    try {
      const userVotes = await this.getUserVotes(fingerprint)
      const voteData = await this.getVoteCounts() // Now returns {votes, upvotes, downvotes}
      const rankings = await this.getRankings()
      const stats = await this.getStats()

      return {
        success: true,
        userVotes,
        votes: voteData.votes,
        upvotes: voteData.upvotes,
        downvotes: voteData.downvotes,
        rankings,
        stats
      }
    } catch (error) {
      console.error('Failed to sync user data:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
    this.subscriptions.clear()
    this.retryCount = 0
    this.isConnecting = false
    this.connectionCallbacks = null
  }
  
  async reconnect() {
    console.log('🔄 Manual reconnect requested')
    this.retryCount = 0
    this.retryDelay = 1000
    
    if (this.connectionCallbacks) {
      return this.initializeRealtime(
        this.connectionCallbacks.onVoteUpdate,
        this.connectionCallbacks.onStatsUpdate
      )
    }
    return false
  }
}

export const voteManager = new SupabaseVoteManager()
export default voteManager