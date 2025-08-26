'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, TrendingUp, Info } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';
import { toast } from 'sonner';

export default function LLMCard({ llm, index }) {
  const [showDetails, setShowDetails] = useState(false);
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
      className="relative bg-card border border-border rounded-lg p-6 card-glow transition-all duration-300"
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
          className="absolute top-2 right-2 bg-accent/20 text-accent px-2 py-1 rounded-full text-xs flex items-center gap-1"
        >
          <TrendingUp size={12} />
          Trending
        </motion.div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{llm.logo}</span>
          <div>
            <h3 className="text-xl font-bold text-foreground">{llm.name}</h3>
            <p className="text-sm text-muted-foreground">{llm.company}</p>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {llm.description}
      </p>
      
      {/* Vote Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
            <ChevronUp size={20} />
          </motion.button>
          
          <span className={`text-lg font-bold px-3 ${
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
            <ChevronDown size={20} />
          </motion.button>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-2 rounded-lg bg-card-hover hover:bg-primary/20 text-primary transition-all"
          aria-label="Show details"
        >
          <Info size={16} />
        </button>
      </div>
      
      {/* Details Section */}
      <motion.div
        initial={false}
        animate={{ height: showDetails ? 'auto' : 0 }}
        className="overflow-hidden"
      >
        <div className="pt-4 border-t border-border">
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Use Cases:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {llm.useCases.map((useCase, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Released: {llm.releaseYear}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}