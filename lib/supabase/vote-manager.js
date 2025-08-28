import { supabase } from './client'

class SupabaseVoteManager {
  constructor() {
    this.channel = null
    this.subscriptions = new Map()
  }

  // Initialize optimized realtime subscriptions (only aggregates, not individual votes)
  async initializeRealtime(onVoteUpdate, onStatsUpdate) {
    try {
      this.channel = supabase
        .channel('optimized-votes')
        // Listen to aggregate updates only (much fewer events)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'vote_stats_aggregate'
        }, (payload) => {
          console.log('📊 Aggregate update received:', payload.new?.llm_id)
          // Only update the specific LLM that changed
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
        // Listen to global stats updates
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'global_stats'
        }, (payload) => {
          console.log('🌍 Global stats update received')
          if (onStatsUpdate && payload.new) {
            onStatsUpdate({
              totalVotes: payload.new.total_votes,
              uniqueVoters: payload.new.unique_voters,
              votesLastHour: payload.new.votes_last_hour,
              votesToday: payload.new.votes_today,
              topModel: payload.new.top_model,
              topModelVotes: payload.new.top_model_votes
            })
          }
        })
        .subscribe((status) => {
          console.log('✅ Realtime subscription status:', status)
        })

      return true
    } catch (error) {
      console.error('❌ Failed to initialize realtime:', error)
      return false
    }
  }

  // Submit or update a vote
  async vote(llmId, fingerprint, voteType, metadata = {}) {
    try {
      // If vote is 0, remove the vote
      if (voteType === 0) {
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('llm_id', llmId)
          .eq('fingerprint', fingerprint)

        if (error) throw error

        return {
          success: true,
          previousVote: null,
          newVote: 0,
          voteCount: 0
        }
      }

      // Otherwise, call the database function to handle vote logic
      const { data, error } = await supabase
        .rpc('handle_vote', {
          p_llm_id: llmId,
          p_fingerprint: fingerprint,
          p_vote_type: voteType,
          p_ip_address: metadata.ip || null,
          p_user_agent: metadata.userAgent || null
        })

      if (error) throw error

      return {
        success: data.success,
        previousVote: data.previous_vote,
        newVote: data.new_vote,
        voteCount: data.vote_count
      }
    } catch (error) {
      console.error('Vote failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Get all vote counts from optimized aggregate table
  async getVoteCounts() {
    try {
      const { data, error } = await supabase
        .from('vote_stats_aggregate')
        .select('llm_id, total_votes')
        .order('total_votes', { ascending: false })

      if (error) throw error

      // Transform to object format
      const votes = {}
      data.forEach(item => {
        votes[item.llm_id] = item.total_votes || 0
      })

      return votes
    } catch (error) {
      console.error('Failed to get vote counts:', error)
      return {}
    }
  }

  // Get user's votes
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

  // Get all LLMs with vote counts from aggregate table
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

  // Get rankings from aggregate table
  async getRankings() {
    try {
      const { data, error } = await supabase
        .from('vote_stats_aggregate')
        .select('llm_id, total_votes')
        .order('total_votes', { ascending: false })
        .limit(10)

      if (error) throw error

      // Map to ranking format
      return (data || []).map((item, index) => ({
        id: item.llm_id,
        name: item.llm_id, // The store will resolve this to the actual name
        count: item.total_votes || 0,
        rank: index + 1
      }))
    } catch (error) {
      console.error('Failed to get rankings:', error)
      return []
    }
  }

  // Get statistics from optimized global stats table
  async getStats() {
    try {
      const { data, error } = await supabase
        .from('global_stats')
        .select('*')
        .single()

      if (error) throw error

      // Get top model name if we have one
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

  // Sync user data
  async syncUserData(fingerprint) {
    try {
      // Get user votes
      const userVotes = await this.getUserVotes(fingerprint)
      
      // Get all vote counts
      const voteCounts = await this.getVoteCounts()
      
      // Get rankings
      const rankings = await this.getRankings()
      
      // Get stats
      const stats = await this.getStats()

      return {
        success: true,
        userVotes,
        votes: voteCounts,
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

  // Clean up subscriptions
  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.subscriptions.clear()
  }
}

// Export singleton instance
export const voteManager = new SupabaseVoteManager()
export default voteManager