'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Trophy, Activity } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';

export default function StatsPanel() {
  const { stats } = useVoteStore();
  
  const statCards = [
    {
      icon: Users,
      label: 'Total Votes',
      value: stats.totalVotes || 0,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Activity,
      label: 'Votes Today',
      value: stats.votesToday || 0,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: Clock,
      label: 'Last Hour',
      value: stats.votesLastHour || 0,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: Trophy,
      label: 'Leading',
      value: stats.topModel || 'None',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      small: true,
    },
  ];
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="flex justify-between bg-card border border-border rounded-lg p-3 sm:p-4"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon size={16} className={`sm:w-5 sm:h-5 ${stat.color}`} />
              </div>
              {stat.label === 'Last Hour' && stats.votesLastHour > 0 && (
                <TrendingUp size={14} className="sm:w-4 sm:h-4 text-success" />
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground/70 font-light font-inter leading-tight">{stat.label}</p>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-extralight text-foreground font-sora leading-none">
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}