'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, X, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';
import { toast } from 'sonner';

export default function LLMCard({ llm, index }) {
  const [imageError, setImageError] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  const { vote, getUserVote, getVoteCount, getUpvoteCount, getDownvoteCount, isTrending, getRank } = useVoteStore();
  
  const userVote = getUserVote(llm.id);
  const voteCount = getVoteCount(llm.id);
  const upvoteCount = getUpvoteCount(llm.id);
  const downvoteCount = getDownvoteCount(llm.id);
  const trending = isTrending(llm.id);
  const rank = getRank(llm.id);
  
  const totalEngagement = upvoteCount + downvoteCount;
  const upvotePercentage = totalEngagement > 0 ? Math.round((upvoteCount / totalEngagement) * 100) : 0;
  
  const handleVote = async (voteType) => {
    if (voteType === 0) {
      const result = await vote(llm.id, 0);
      if (result && result.success) {
        toast.success('Vote removed');
      }
    } else if (userVote !== voteType) {
      const result = await vote(llm.id, voteType);
      if (result && result.success) {
        toast.success(voteType === 1 ? 'Upvoted!' : 'Downvoted!');
      }
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      whileHover={{ y: -2, scale: 1.02 }}
      className="group relative bg-card/80 hover:bg-card/95 border border-border/30 hover:border-border/50 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-lg transition-all duration-300 backdrop-blur-sm"
    >
      {/* Rank Badge */}
      {rank && rank <= 3 && (
        <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-10 border-2 border-background
          ${rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' : ''}
          ${rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-800' : ''}
          ${rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' : ''}
        `}>
          {rank}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
            {!imageError ? (
              <img 
                src={llm.logo} 
                alt={`${llm.company} logo`}
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-8 h-8 bg-muted-foreground/20 rounded flex items-center justify-center">
                <span className="text-xs font-mono text-muted-foreground">
                  {llm.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-foreground truncate font-sora mb-1">
            {llm.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{llm.company}</span>
            <span>•</span>
            <span>{llm.releaseYear}</span>
          </div>
        </div>
      </div>

      {/* Voting Section */}
      <div className="flex items-center justify-between">
        {/* Vote Buttons - Vertical Stack */}
        <div className="flex flex-col gap-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => handleVote(1)}
            disabled={userVote === 1}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md transition-all duration-200 touch-manipulation flex items-center justify-center ${
              userVote === 1
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border border-green-500/30'
            }`}
            aria-label="Upvote"
            title={userVote === 1 ? "You upvoted this" : "Upvote"}
          >
            <ChevronUp size={14} strokeWidth={2.5} />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => handleVote(-1)}
            disabled={userVote === -1}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md transition-all duration-200 touch-manipulation flex items-center justify-center ${
              userVote === -1
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30'
            }`}
            aria-label="Downvote"
            title={userVote === -1 ? "You downvoted this" : "Downvote"}
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Net Score */}
        <div className="text-center">
          <div className={`text-xl sm:text-2xl font-bold font-mono leading-none ${
            voteCount > 0 ? 'text-green-400' : voteCount < 0 ? 'text-red-400' : 'text-muted-foreground'
          }`}>
            {voteCount > 0 ? '+' : ''}{voteCount}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">net score</div>
        </div>

        {/* Vote Breakdown */}
        <div className="flex flex-col gap-1 items-end">
          <div className="flex items-center gap-1 text-xs">
            <ChevronUp size={12} className="text-green-400" />
            <span className="text-green-400 font-medium min-w-[16px] text-right">{upvoteCount}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <ChevronDown size={12} className="text-red-400" />
            <span className="text-red-400 font-medium min-w-[16px] text-right">{downvoteCount}</span>
          </div>
        </div>

        {/* Clear Vote Button */}
        {userVote !== 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => handleVote(0)}
            className="w-6 h-6 rounded-full bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all touch-manipulation flex items-center justify-center ml-2"
            aria-label="Clear vote"
            title="Remove your vote"
          >
            <X size={12} strokeWidth={2} />
          </motion.button>
        )}
      </div>

      {/* Optional: Total engagement info */}
      {totalEngagement > 0 && (
        <div className="mt-3 pt-3 border-t border-border/20 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground/60">
            <BarChart3 size={10} />
            <span>{totalEngagement} total votes</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}