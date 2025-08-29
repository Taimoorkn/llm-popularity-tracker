'use client';

import { motion } from 'framer-motion';
import { Sparkles, Github } from 'lucide-react';

export default function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={24} className="sm:w-8 sm:h-8 text-primary" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-light text-gradient font-sora tracking-tight truncate">LLM Popularity Tracker</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground/70 font-light font-inter truncate">Vote for your favorite AI models</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-light font-inter whitespace-nowrap"
            >
              <span className="hidden sm:inline">2025 Edition</span>
              <span className="sm:hidden">2025</span>
            </motion.div>
            {/* <motion.a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github size={20} />
            </motion.a> */}
          </div>
        </div>
      </div>
    </motion.header>
  );
}