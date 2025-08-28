import { supabase } from './client'

class SupabaseVoteManager {
  constructor() {
    this.channel = null
    this.subscriptions = new Map()
  }

  // Initialize realtime subscriptions
  async initializeRealtime(onVoteUpdate, onStatsUpdate) {
    try {
      // Subscribe to vote changes
      this.channel = supabase
        .channel('votes-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'votes'
          },
          async (payload) => {
            console.log('Vote change detected:', payload)
            
            // Fetch updated vote counts
            const counts = await this.getVoteCounts()
            if (onVoteUpdate) {
              onVoteUpdate(counts)
            }
            
            // Update stats
            const stats = await this.getStats()
            if (onStatsUpdate) {
              onStatsUpdate(stats)
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status)
        })

      return true
    } catch (error) {
      console.error('Failed to initialize realtime:', error)
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

  // Get all vote counts
  async getVoteCounts() {
    try {
      const { data, error } = await supabase
        .from('vote_counts')
        .select('*')
        .order('total_votes', { ascending: false })

      if (error) throw error

      // Transform to object format
      const votes = {}
      data.forEach(item => {
        votes[item.llm_id] = item.total_votes
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

  // Get all LLMs with vote counts
  async getLLMsWithVotes() {
    try {
      const { data, error } = await supabase
        .from('vote_counts')
        .select(`
          llm_id,
          name,
          company,
          total_votes,
          upvotes,
          downvotes,
          unique_voters,
          llms!inner(
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

  // Get rankings
  async getRankings() {
    try {
      const { data, error } = await supabase
        .from('vote_counts')
        .select('llm_id, name, total_votes')
        .order('total_votes', { ascending: false })
        .limit(10)

      if (error) throw error

      return data.map((item, index) => ({
        ...item,
        rank: index + 1
      }))
    } catch (error) {
      console.error('Failed to get rankings:', error)
      return []
    }
  }

  // Get statistics
  async getStats() {
    try {
      // Get total votes
      const { data: voteData, error: voteError } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })

      if (voteError) throw voteError

      // Get unique voters
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact' })

      if (sessionError) throw sessionError

      // Get top model
      const { data: topModel, error: topError } = await supabase
        .from('vote_counts')
        .select('name, total_votes')
        .order('total_votes', { ascending: false })
        .limit(1)
        .single()

      if (topError && topError.code !== 'PGRST116') throw topError

      // Get recent activity (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentVotes, error: recentError } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })
        .gte('created_at', oneHourAgo)

      if (recentError) throw recentError

      return {
        totalVotes: voteData?.length || 0,
        uniqueVoters: sessionData?.length || 0,
        topModel: topModel?.name || null,
        topModelVotes: topModel?.total_votes || 0,
        votesLastHour: recentVotes?.length || 0,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get stats:', error)
      return {
        totalVotes: 0,
        uniqueVoters: 0,
        topModel: null,
        topModelVotes: 0,
        votesLastHour: 0,
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