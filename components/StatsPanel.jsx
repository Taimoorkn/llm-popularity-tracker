'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Trophy, Activity, ThumbsUp, ThumbsDown, Target } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';

export default function StatsPanel() {
  const { stats, voteStats } = useVoteStore();
  
  // Calculate additional statistics from voteStats
  const totalUpvotes = Object.values(voteStats).reduce((sum, stat) => sum + (stat.upvotes || 0), 0);
  const totalDownvotes = Object.values(voteStats).reduce((sum, stat) => sum + (stat.downvotes || 0), 0);
  const totalUniqueVoters = Object.values(voteStats).reduce((sum, stat) => sum + (stat.uniqueVoters || 0), 0);
  const engagementRate = totalUniqueVoters > 0 ? ((totalUpvotes + totalDownvotes) / totalUniqueVoters).toFixed(1) : 0;
  
  const statCards = [
    {
      icon: ThumbsUp,
      label: 'Total Upvotes',
      value: totalUpvotes,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: ThumbsDown,
      label: 'Total Downvotes',
      value: totalDownvotes,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: Users,
      label: 'Unique Voters',
      value: totalUniqueVoters,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Target,
      label: 'Engagement Rate',
      value: `${engagementRate}x`,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      small: true,
    },
    {
      icon: Trophy,
      label: 'Leading Model',
      value: stats.topModel || 'None',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      small: true,
    },
    {
      icon: Activity,
      label: 'Net Score',
      value: totalUpvotes - totalDownvotes,
      color: totalUpvotes - totalDownvotes >= 0 ? 'text-green-500' : 'text-red-500',
      bgColor: totalUpvotes - totalDownvotes >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      showSign: true,
    },
  ];
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
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
            {stat.showSign && typeof stat.value === 'number' && stat.value > 0 ? '+' : ''}
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}