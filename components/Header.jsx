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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={32} className="text-primary" />
            </motion.div>
            <div>
              <h1 className="text-xl font-light text-gradient font-sora tracking-tight">LLM Popularity Tracker</h1>
              <p className="text-xs text-muted-foreground/70 font-light font-inter">Vote for your favorite AI models</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-light font-inter"
            >
              2025 Edition
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