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
      await vote(llm.id, 0);
      toast.success('Vote removed');
    } else if (userVote !== voteType) {
      // Only vote if it's different from current vote
      console.log('🎯 [CARD] Casting new vote for', llm.name, ':', voteType === 1 ? 'UPVOTE' : 'DOWNVOTE');
      await vote(llm.id, voteType);
      toast.success(voteType === 1 ? 'Upvoted!' : 'Downvoted!');
    } else {
      console.log('🎯 [CARD] Same vote clicked, ignoring:', { llm: llm.name, voteType });
    }
    // If clicking the same vote button, do nothing (no toggle)
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      className="relative bg-gradient-to-br from-card to-card/80 border border-border/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm"
    >
      {/* Rank Badge */}
      {rank && rank <= 5 && (
        <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg
          ${rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black' : ''}
          ${rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black' : ''}
          ${rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white' : ''}
          ${rank === 4 ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white' : ''}
          ${rank === 5 ? 'bg-gradient-to-r from-green-400 to-green-500 text-white' : ''}
        `}>
          #{rank}
        </div>
      )}
      
      {/* Trending Badge */}
      {trending && (
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md"
        >
          <TrendingUp size={10} />
          HOT
        </motion.div>
      )}
      
      {/* Header with Logo and Info */}
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          {llm.image && !imageError ? (
            <img 
              src={llm.image} 
              alt={`${llm.company} logo`}
              className="w-10 h-10 object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-xl">{llm.logo}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">{llm.name}</h3>
          <p className="text-sm text-muted-foreground/80 font-medium">{llm.company}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{llm.releaseYear}</p>
        </div>
      </div>
      
      {/* Vote Section */}
      <div className="flex items-center justify-between bg-black/20 backdrop-blur-sm rounded-lg p-3">
        <motion.button
          whileTap={userVote !== 1 ? { scale: 0.95 } : {}}
          whileHover={userVote !== 1 ? { scale: 1.05 } : {}}
          onClick={() => handleVote(1)}
          disabled={userVote === 1}
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-md ${
            userVote === 1
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/30 cursor-default opacity-100'
              : 'bg-white/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border border-green-400/30 cursor-pointer'
          }`}
          aria-label="Upvote"
          title={userVote === 1 ? "You upvoted this" : "Upvote"}
        >
          <ChevronUp size={20} strokeWidth={2.5} />
        </motion.button>
        
        <div className="flex items-center gap-2">
          {/* Vote count */}
          <div className="flex flex-col items-center">
            <span className={`text-xl font-bold ${
              voteCount > 0 ? 'text-green-400' : voteCount < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {voteCount > 0 ? '+' : ''}{voteCount}
            </span>
            <span className="text-xs text-muted-foreground/60">votes</span>
          </div>
          
          {/* Clear vote button - only show if user has voted */}
          {userVote !== 0 && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => handleVote(0)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white border border-gray-400/30 transition-all"
              aria-label="Clear vote"
              title="Clear vote"
            >
              <X size={16} strokeWidth={2.5} />
            </motion.button>
          )}
        </div>
        
        <motion.button
          whileTap={userVote !== -1 ? { scale: 0.95 } : {}}
          whileHover={userVote !== -1 ? { scale: 1.05 } : {}}
          onClick={() => handleVote(-1)}
          disabled={userVote === -1}
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-md ${
            userVote === -1
              ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/30 cursor-default opacity-100'
              : 'bg-white/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-400/30 cursor-pointer'
          }`}
          aria-label="Downvote"
          title={userVote === -1 ? "You downvoted this" : "Downvote"}
        >
          <ChevronDown size={20} strokeWidth={2.5} />
        </motion.button>
      </div>
    </motion.div>
  );
}