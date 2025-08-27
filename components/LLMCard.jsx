'use client';

import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';
import { toast } from 'sonner';

export default function LLMCard({ llm, index }) {
  const { vote, getUserVote, getVoteCount, isTrending, getRank } = useVoteStore();
  
  const userVote = getUserVote(llm.id);
  const voteCount = getVoteCount(llm.id);
  const trending = isTrending(llm.id);
  const rank = getRank(llm.id);
  
  const handleVote = async (voteType) => {
    if (userVote === voteType) {
      // Remove vote if clicking the same button
      await vote(llm.id, 0);
      toast.success('Vote removed');
    } else {
      await vote(llm.id, voteType);
      toast.success(voteType === 1 ? 'Upvoted!' : 'Downvoted!');
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      className="relative bg-card border border-border rounded-lg p-4 card-glow transition-all duration-300"
    >
      {/* Rank Badge */}
      {rank && rank <= 3 && (
        <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${rank === 1 ? 'bg-yellow-500 text-black' : ''}
          ${rank === 2 ? 'bg-gray-400 text-black' : ''}
          ${rank === 3 ? 'bg-orange-600 text-white' : ''}
        `}>
          #{rank}
        </div>
      )}
      
      {/* Trending Badge */}
      {trending && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1 right-1 bg-accent/20 text-accent px-2 py-1 rounded-full text-xs flex items-center gap-1"
        >
          <TrendingUp size={10} />
          Hot
        </motion.div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{llm.logo}</span>
        <div>
          <h3 className="text-lg font-bold text-foreground">{llm.name}</h3>
          <p className="text-sm text-muted-foreground">{llm.company}</p>
        </div>
      </div>
      
      {/* Vote Section */}
      <div className="flex items-center justify-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleVote(1)}
          className={`p-2 rounded-lg transition-all ${
            userVote === 1
              ? 'bg-success text-white'
              : 'bg-card-hover hover:bg-success/20 text-success'
          }`}
          aria-label="Upvote"
        >
          <ChevronUp size={18} />
        </motion.button>
        
        <span className={`text-lg font-bold px-3 min-w-[60px] text-center ${
          voteCount > 0 ? 'text-success' : voteCount < 0 ? 'text-danger' : 'text-muted-foreground'
        }`}>
          {voteCount > 0 ? '+' : ''}{voteCount}
        </span>
        
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleVote(-1)}
          className={`p-2 rounded-lg transition-all ${
            userVote === -1
              ? 'bg-danger text-white'
              : 'bg-card-hover hover:bg-danger/20 text-danger'
          }`}
          aria-label="Downvote"
        >
          <ChevronDown size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
}