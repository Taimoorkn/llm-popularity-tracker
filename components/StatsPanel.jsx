'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Trophy, Activity } from 'lucide-react';
import useVoteStore from '@/store/useVoteStore';

export default function StatsPanel() {
  const { stats, fetchStats } = useVoteStore();
  
  useEffect(() => {
    // Fetch stats initially and every 30 seconds
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);
  
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
      value: stats.topModel ? stats.topModel.replace(/-/g, ' ').toUpperCase() : 'None',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      small: true,
    },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            {stat.label === 'Last Hour' && stats.votesLastHour > 0 && (
              <TrendingUp size={16} className="text-success" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
          <p className={`${stat.small ? 'text-lg' : 'text-2xl'} font-bold text-foreground`}>
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}