'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import useVoteStore from '@/store/useVoteStore';
import { BarChart3 } from 'lucide-react';

export default function VoteChart() {
  const [chartType, setChartType] = useState('bar');
  const { votes, llms } = useVoteStore();
  
  // Prepare chart data - show ALL LLMs with their vote counts
  const chartData = llms.map((llm) => {
    const voteCount = votes[llm.id] || 0;
    return {
      name: llm.name,
      votes: voteCount,
      color: llm.color || 'from-gray-500 to-gray-600',
      id: llm.id,
    };
  }).sort((a, b) => b.votes - a.votes); // Sort by votes descending
  
  // Extract gradient colors for bars
  const getBarColor = (color) => {
    const colors = color.match(/from-(\w+)-\d+\sto-(\w+)-\d+/);
    if (colors) {
      const colorMap = {
        green: '#10b981',
        emerald: '#10b981',
        orange: '#f59e0b',
        amber: '#f59e0b',
        blue: '#3b82f6',
        cyan: '#06b6d4',
        purple: '#8b5cf6',
        violet: '#8b5cf6',
        red: '#ef4444',
        pink: '#ec4899',
        indigo: '#6366f1',
        gray: '#6b7280',
        slate: '#64748b',
        teal: '#14b8a6',
        yellow: '#eab308',
      };
      return colorMap[colors[1]] || '#6b7280';
    }
    return '#6b7280';
  };
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg">
          <p className="font-bold text-foreground">{payload[0].payload.name}</p>
          <p className="text-sm text-muted-foreground">
            Votes: <span className="text-primary font-bold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={24} className="text-primary" />
          All LLM Votes
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('bar')}
            className={`p-2 rounded-lg transition-all ${chartType === 'bar' ? 'bg-primary text-white' : 'bg-card-hover text-muted-foreground'
              }`}
          >
            <BarChart3 size={16} />
          </button>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={120}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#27272a"
            interval={0}
          />
          <YAxis
            tick={{ fill: '#9ca3af' }}
            stroke="#27272a"
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}