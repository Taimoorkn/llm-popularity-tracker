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
  Legend,
} from 'recharts';
import useVoteStore from '@/store/useVoteStore';
import { BarChart3, ChevronLeft, ChevronRight, Users } from 'lucide-react';

export default function VoteChart({ sortBy = 'votes' }) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const { votes, llms, voteStats, getVoteCount, getUpvotes, getDownvotes, getUniqueVoters } = useVoteStore();
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Prepare chart data - show ALL LLMs with detailed vote stats
  const allChartData = llms.map((llm) => {
    const voteCount = votes[llm.id] || 0;
    const upvotes = getUpvotes(llm.id);
    const downvotes = getDownvotes(llm.id);
    const uniqueVoters = getUniqueVoters(llm.id);
    
    return {
      name: llm.name,
      total: voteCount,
      upvotes: upvotes,
      downvotes: downvotes,
      uniqueVoters: uniqueVoters,
      color: llm.color || 'from-gray-500 to-gray-600',
      id: llm.id,
      company: llm.company,
    };
  }).sort((a, b) => {
    // Use the same sorting logic as the main page
    if (sortBy === 'votes') {
      return b.total - a.total; // Sort by total votes descending
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name); // Sort by name ascending
    } else if (sortBy === 'company') {
      return a.company.localeCompare(b.company); // Sort by company ascending
    }
    return 0;
  });
  
  // Mobile pagination
  const itemsPerPage = isMobile ? 6 : allChartData.length;
  const totalPages = Math.ceil(allChartData.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const chartData = isMobile 
    ? allChartData.slice(startIndex, startIndex + itemsPerPage)
    : allChartData;
  
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
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 pointer-events-none max-w-xs"
        >
          <p className="font-semibold text-foreground text-sm mb-3">{data.name}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span>Upvotes: <span className="font-bold">{data.upvotes}</span></span>
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span>Downvotes: <span className="font-bold">{data.downvotes}</span></span>
            </div>
            <div className="flex items-center gap-2 text-blue-400 col-span-2">
              <Users size={12} />
              <span>Unique Voters: <span className="font-bold">{data.uniqueVoters}</span></span>
            </div>
          </div>
          <div className="border-t border-border/30 mt-3 pt-2">
            <p className="text-sm font-medium text-primary">
              Net Score: <span className={data.total >= 0 ? 'text-green-400' : 'text-red-400'}>
                {data.total > 0 ? '+' : ''}{data.total}
              </span>
            </p>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // Custom label formatter for mobile
  const formatLabel = (name) => {
    if (!isMobile) return name;
    
    // Truncate long names on mobile
    if (name.length > 8) {
      return name.substring(0, 6) + '...';
    }
    return name;
  };
  
  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };
  
  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 md:p-6"
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={isMobile ? 20 : 24} className="text-primary" />
          <span className="font-sora">All LLM {sortBy === 'votes' ? 'Votes' : sortBy === 'name' ? 'Names' : 'Companies'}</span>
        </h2>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              className={`p-2 rounded-lg bg-muted/10 text-muted-foreground transition-colors disabled:opacity-50 ${
                isMobile ? 'active:bg-muted/20' : 'md:hover:bg-muted/20'
              }`}
              disabled={currentPage === 0}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={nextPage}
              className={`p-2 rounded-lg bg-muted/10 text-muted-foreground transition-colors disabled:opacity-50 ${
                isMobile ? 'active:bg-muted/20' : 'md:hover:bg-muted/20'
              }`}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      
      <ResponsiveContainer 
        width="100%" 
        height={isMobile ? 280 : 400}
        style={{ 
          backgroundColor: 'transparent',
          cursor: 'pointer'
        }}
      >
        <BarChart 
          data={chartData} 
          margin={{ 
            top: 20, 
            right: isMobile ? 0 : 30, 
            left: isMobile ? 0 : -16, 
            bottom: isMobile ? 0 : 80 
          }}
          style={{ backgroundColor: 'transparent' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
          <XAxis
            dataKey="name"
            angle={isMobile ? -45 : -45}
            textAnchor="end"
            height={isMobile ? 60 : 80}
            tick={{ 
              fill: '#9ca3af', 
              fontSize: isMobile ? 10 : 11,
              fontFamily: 'var(--font-inter)'
            }}
            stroke="#27272a"
            interval={0}
            tickFormatter={formatLabel}
          />
          <YAxis
            tick={{ 
              fill: '#9ca3af', 
              fontSize: isMobile ? 10 : 12,
              fontFamily: 'var(--font-inter)'
            }}
            stroke="#27272a"
            domain={['dataMin - 1', 'dataMax + 1']}
            width={isMobile ? 35 : 50}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: 'transparent' }}
            wrapperStyle={{ 
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none'
            }}
          />
          <Legend 
            wrapperStyle={{ 
              fontSize: isMobile ? '10px' : '12px',
              paddingTop: '10px'
            }}
          />
          <Bar 
            dataKey="upvotes" 
            name="Upvotes"
            fill="#10b981"
            radius={[2, 2, 0, 0]}
            maxBarSize={isMobile ? 15 : 20}
          />
          <Bar 
            dataKey="downvotes" 
            name="Downvotes"
            fill="#ef4444"
            radius={[2, 2, 0, 0]}
            maxBarSize={isMobile ? 15 : 20}
          />
          <Bar 
            dataKey="total" 
            name="Net Score"
            radius={[4, 4, 0, 0]}
            maxBarSize={isMobile ? 25 : 35}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Pagination dots */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentPage 
                  ? 'bg-primary' 
                  : `bg-muted-foreground/30 ${isMobile ? 'active:bg-muted-foreground/60' : 'md:hover:bg-muted-foreground/50'}`
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Helper text for pagination */}
      {totalPages > 1 && (
        <p className="text-xs text-muted-foreground/70 text-center mt-3 font-light">
          {isMobile 
            ? `Tap arrows or dots to see more • Showing ${Math.min(itemsPerPage, chartData.length)} of ${allChartData.length} LLMs`
            : `Use arrows or click dots to navigate • Showing ${Math.min(itemsPerPage, chartData.length)} of ${allChartData.length} LLMs`
          }
        </p>
      )}
    </motion.div>
  );
}