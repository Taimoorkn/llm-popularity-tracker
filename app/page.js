'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Wifi, WifiOff } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import Header from '@/components/Header';
import LLMCard from '@/components/LLMCard';
import StatsPanel from '@/components/StatsPanel';
import VoteChart from '@/components/VoteChart';
import ErrorBoundary from '@/components/ErrorBoundary';
import useVoteStore from '@/store/useVoteStore';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('votes'); // votes, name, company
  
  const { 
    llms, 
    initializeVotes, 
    loading,
    realtimeConnected,
    cleanup,
    error
  } = useVoteStore();
  
  useEffect(() => {
    // Initialize Supabase connection
    initializeVotes();
    
    // Show connection status
    const timer = setTimeout(() => {
      if (realtimeConnected) {
        toast.success('Connected to real-time updates', {
          icon: <Wifi className="w-4 h-4" />,
          duration: 2000
        });
      }
    }, 2000);
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, []);
  
  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);
  
  // Filter and sort LLMs
  const filteredLLMs = llms
    .filter(llm => 
      llm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      llm.company.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  const sortedLLMs = [...filteredLLMs].sort((a, b) => {
    const store = useVoteStore.getState();
    
    if (sortBy === 'votes') {
      const aVotes = store.getVoteCount(a.id);
      const bVotes = store.getVoteCount(b.id);
      return bVotes - aVotes;
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'company') {
      return a.company.localeCompare(b.company);
    }
    return 0;
  });
  
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-right" theme="dark" />
      <Header />
      
      {/* Real-time Connection Indicator - Mobile Optimized */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border ${
            realtimeConnected 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          }`}
        >
          {realtimeConnected ? (
            <>
              <Wifi className="w-3 h-3" />
              <span className="hidden sm:inline">Live</span>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Connecting...</span>
            </>
          )}
        </motion.div>
      </div>
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        {/* Hero Section - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4 sm:mb-6 px-2"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground mb-2 sm:mb-3 font-sora leading-tight">
            Which LLM Rules in 2025?
          </h2>
          <p className="text-muted-foreground/80 max-w-xl mx-auto text-xs sm:text-sm font-light font-inter leading-relaxed px-4 sm:px-0">
            By the people. For the people.
          </p>
        </motion.div>
        
        {/* Stats Panel */}
        <ErrorBoundary 
          title="Stats unavailable" 
          message="Unable to load statistics. Voting still works!"
        >
          <StatsPanel />
        </ErrorBoundary>
        
        {/* Controls - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60" size={16} />
            <input
              type="text"
              placeholder="Search LLMs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-card/50 border border-border/30 rounded-lg text-foreground text-sm font-light placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-card/70 transition-all font-inter touch-manipulation"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 sm:py-2 bg-card/50 border border-border/30 rounded-lg text-foreground text-sm font-light focus:outline-none focus:border-primary/50 focus:bg-card/70 transition-all font-inter min-w-0 touch-manipulation"
            >
              <option value="votes">By Votes</option>
              <option value="name">By Name</option>
              <option value="company">By Company</option>
            </select>
          </div>
        </div>
        
        {/* Chart - Mobile Optimized */}
        <ErrorBoundary 
          title="Chart unavailable"
          message="Unable to display the voting chart."
        >
          <div className="mb-4 sm:mb-6 md:mb-8">
            <VoteChart sortBy={sortBy} />
          </div>
        </ErrorBoundary>
        
        {/* LLM Grid */}
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
            className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
          >
            <AnimatePresence mode="popLayout">
              {sortedLLMs.map((llm, index) => (
                <motion.div
                  key={llm.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    duration: 0.3,
                    delay: index * 0.02
                  }}
                >
                  <ErrorBoundary
                    title="Card error"
                    message={`Unable to display ${llm.name}`}
                    fallback={(error, reset) => (
                      <div className="bg-card/50 border border-red-500/20 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-2">Error loading {llm.name}</p>
                        <button 
                          onClick={reset}
                          className="text-xs text-primary hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  >
                    <LLMCard llm={llm} index={index} />
                  </ErrorBoundary>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        
        {sortedLLMs.length === 0 && !loading && (
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
      
      {/* Footer - Mobile Optimized */}
      <footer className="border-t border-border/30 mt-8 sm:mt-12 py-4 sm:py-6">
        <div className="container mx-auto px-3 sm:px-4 text-center">
          <p className="text-muted-foreground/60 text-xs sm:text-sm font-light font-inter leading-relaxed">
            Made with ❤️ by the Community
            <span className="hidden sm:inline"> | Real-time scheduled intervals powered by Supabase</span>
          </p>
          <p className="text-xs text-muted-foreground/40 mt-1 sm:mt-1.5 font-light font-inter">
            Vote responsibly. All votes update for everyone!
          </p>
        </div>
      </footer>
    </div>
  );
}