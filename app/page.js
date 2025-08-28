'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, TrendingUp } from 'lucide-react';
import { Toaster } from 'sonner';
import Header from '@/components/Header';
import LLMCard from '@/components/LLMCard';
import StatsPanel from '@/components/StatsPanel';
import VoteChart from '@/components/VoteChart';
import useVoteStore from '@/store/useVoteStore';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // votes, name, company
  const [showChart, setShowChart] = useState(true);
  
  const { llms, initializeVotes, rankings, loading } = useVoteStore();
  
  useEffect(() => {
    initializeVotes();
    
    // Set up polling for real-time updates (every 5 seconds)
    const pollInterval = setInterval(() => {
      // Silently sync with server to get latest votes
      useVoteStore.getState().syncWithServer();
    }, 5000); // Poll every 5 seconds for better real-time experience
    
    // Clean up on unmount
    return () => clearInterval(pollInterval);
  }, [initializeVotes]);
  
  // Filter LLMs but maintain stable ordering
  const filteredLLMs = llms
    .filter(llm => 
      llm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      llm.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      llm.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  // Create stable sorted order that doesn't change based on vote changes
  const stableSortedLLMs = [...filteredLLMs].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'company') {
      return a.company.localeCompare(b.company);
    } else if (sortBy === 'votes') {
      // Use initial vote counts from data, not dynamic rankings
      const aInitialRank = llms.findIndex(llm => llm.id === a.id);
      const bInitialRank = llms.findIndex(llm => llm.id === b.id);
      return aInitialRank - bInitialRank;
    }
    return 0;
  });
  
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-right" theme="dark" />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl md:text-3xl font-light text-foreground mb-3 font-sora">
            Which LLM Rules in 2025?
          </h2>
          <p className="text-muted-foreground/80 max-w-xl mx-auto text-sm font-light font-inter leading-relaxed">
            Cast your vote for the AI models you love. Upvote your favorites, downvote the ones you don&apos;t prefer.
            Every vote counts in determining the community&apos;s choice!
          </p>
        </motion.div>
        
        {/* Stats Panel */}
        <StatsPanel />
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60" size={18} />
            <input
              type="text"
              placeholder="Search LLMs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card/50 border border-border/30 rounded-lg text-foreground text-sm font-light placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-card/70 transition-all font-inter"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-card/50 border border-border/30 rounded-lg text-foreground text-sm font-light focus:outline-none focus:border-primary/50 focus:bg-card/70 transition-all font-inter"
            >
              <option value="votes">Sort by Votes</option>
              <option value="name">Sort by Name</option>
              <option value="company">Sort by Company</option>
            </select>
          </div>
        </div>
        
        {/* Chart - Always visible */}
        <div className="mb-8">
          <VoteChart />
        </div>
        
        {/* LLM Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <motion.div
            layout
            className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
          >
            {stableSortedLLMs.map((llm, index) => (
              <LLMCard key={llm.id} llm={llm} index={index} />
            ))}
          </motion.div>
        )}
        
        {stableSortedLLMs.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground text-lg">
              No LLMs found matching your search.
            </p>
          </motion.div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/30 mt-12 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground/60 text-sm font-light font-inter">
            Made with ❤️ by the AI Community | 2025
          </p>
          <p className="text-xs text-muted-foreground/40 mt-1.5 font-light font-inter">
            Vote responsibly. Each user can upvote or downvote any model.
          </p>
        </div>
      </footer>
    </div>
  );
}