'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, TrendingUp, X } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';
import { toast } from 'sonner';

export default function LLMCard({ llm, index }) {
  const [imageError, setImageError] = useState(false);
  const { vote, getUserVote, getVoteCount, isTrending, getRank } = useVoteStore();
  
  const userVote = getUserVote(llm.id);
  const voteCount = getVoteCount(llm.id);
  const trending = isTrending(llm.id);
  const rank = getRank(llm.id);
  
  const handleVote = async (voteType) => {
    console.log('🎯 [CARD] Vote button clicked:', { 
      llm: llm.name, 
      llmId: llm.id, 
      voteType, 
      currentUserVote: userVote,
      currentVoteCount: voteCount 
    });
    
    if (voteType === 0) {
      // Clear vote
      console.log('🎯 [CARD] Clearing vote for', llm.name);
      const result = await vote(llm.id, 0);
      if (result && result.success) {
        toast.success('Vote removed');
      }
    } else if (userVote !== voteType) {
      // Only vote if it's different from current vote
      console.log('🎯 [CARD] Casting new vote for', llm.name, ':', voteType === 1 ? 'UPVOTE' : 'DOWNVOTE');
      const result = await vote(llm.id, voteType);
      if (result && result.success) {
        toast.success(voteType === 1 ? 'Upvoted!' : 'Downvoted!');
      }
    } else {
      console.log('🎯 [CARD] Same vote clicked, ignoring:', { llm: llm.name, voteType });
    }
    // If clicking the same vote button, do nothing (no toggle)
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="relative bg-gradient-to-br from-card/90 to-card/60 border border-border/30 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 backdrop-blur-sm"
    >
      {/* Rank Badge - smaller and more subtle */}
      {rank && rank <= 3 && (
        <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium shadow-sm
          ${rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-black' : ''}
          ${rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black' : ''}
          ${rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white' : ''}
        `}>
          {rank}
        </div>
      )}
      
      {/* Trending Badge - more subtle */}
      {trending && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1 left-1 bg-gradient-to-r from-red-500/80 to-pink-500/80 text-white px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5 shadow-sm"
        >
          <TrendingUp size={8} />
          <span className="font-inter">HOT</span>
        </motion.div>
      )}
      
      {/* Header with Logo and Info - more compact */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-md overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
          <img 
            src={llm.logo} 
            alt={`${llm.company} logo`}
            className="w-7 h-7 object-contain"
            onError={() => setImageError(true)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate font-sora leading-tight">{llm.name}</h3>
          <p className="text-xs text-muted-foreground/70 font-light font-inter mt-0.5">{llm.company}</p>
          <p className="text-[10px] text-muted-foreground/50 font-light font-inter">{llm.releaseYear}</p>
        </div>
      </div>
      
      {/* Vote Section - more compact */}
      <div className="flex items-center justify-between bg-black/10 backdrop-blur-sm rounded-md p-2">
        <motion.button
          whileTap={userVote !== 1 ? { scale: 0.9 } : {}}
          whileHover={userVote !== 1 ? { scale: 1.1 } : {}}
          onClick={() => handleVote(1)}
          disabled={userVote === 1}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
            userVote === 1
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm shadow-green-500/20 cursor-default'
              : 'bg-white/5 hover:bg-green-500/15 text-green-400 hover:text-green-300 border border-green-400/20 cursor-pointer'
          }`}
          aria-label="Upvote"
          title={userVote === 1 ? "You upvoted this" : "Upvote"}
        >
          <ChevronUp size={16} strokeWidth={2} />
        </motion.button>
        
        <div className="flex items-center gap-1.5">
          {/* Vote count */}
          <div className="flex flex-col items-center px-2">
            <span className={`text-sm font-medium font-mono ${
              voteCount > 0 ? 'text-green-400' : voteCount < 0 ? 'text-red-400' : 'text-gray-500'
            }`}>
              {voteCount > 0 ? '+' : ''}{voteCount}
            </span>
            <span className="text-[9px] text-muted-foreground/50 font-inter font-light">votes</span>
          </div>
          
          {/* Clear vote button - smaller */}
          {userVote !== 0 && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => handleVote(0)}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 border border-gray-500/20 transition-all"
              aria-label="Clear vote"
              title="Clear vote"
            >
              <X size={10} strokeWidth={2} />
            </motion.button>
          )}
        </div>
        
        <motion.button
          whileTap={userVote !== -1 ? { scale: 0.9 } : {}}
          whileHover={userVote !== -1 ? { scale: 1.1 } : {}}
          onClick={() => handleVote(-1)}
          disabled={userVote === -1}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
            userVote === -1
              ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm shadow-red-500/20 cursor-default'
              : 'bg-white/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 border border-red-400/20 cursor-pointer'
          }`}
          aria-label="Downvote"
          title={userVote === -1 ? "You downvoted this" : "Downvote"}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
}