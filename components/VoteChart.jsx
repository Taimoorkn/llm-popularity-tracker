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
  ReferenceLine,
  Cell,
} from 'recharts';
import useVoteStore from '@/store/useVoteStore';
import { BarChart3, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

export default function VoteChart({ sortBy = 'votes' }) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const { votes, llms, getVoteCount, getUpvoteCount, getDownvoteCount } = useVoteStore();
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Prepare enhanced chart data with upvotes/downvotes
  const allChartData = llms.map((llm) => {
    const netVotes = votes[llm.id] || 0;
    const upvoteCount = getUpvoteCount(llm.id);
    const downvoteCount = getDownvoteCount(llm.id);
    const totalEngagement = upvoteCount + downvoteCount;
    
    return {
      name: llm.name,
      netVotes: netVotes,
      upvotes: upvoteCount,
      downvotes: -downvoteCount, // Make negative for downward bars
      totalEngagement: totalEngagement,
      upvotePercentage: totalEngagement > 0 ? Math.round((upvoteCount / totalEngagement) * 100) : 0,
      color: llm.color || 'from-gray-500 to-gray-600',
      id: llm.id,
      company: llm.company,
    };
  }).sort((a, b) => {
    // Use the same sorting logic as the main page
    if (sortBy === 'votes') {
      return b.netVotes - a.netVotes; // Sort by net votes descending
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
  
  // Enhanced tooltip with upvote/downvote breakdown
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const actualDownvotes = Math.abs(data.downvotes); // Convert back to positive for display
      
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 pointer-events-none min-w-[180px]"
        >
          <p className="font-semibold text-foreground text-sm mb-2">{data.name}</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-green-400" />
                <span className="text-muted-foreground">Upvotes:</span>
              </div>
              <span className="text-green-400 font-bold">{data.upvotes}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TrendingDown size={12} className="text-red-400" />
                <span className="text-muted-foreground">Downvotes:</span>
              </div>
              <span className="text-red-400 font-bold">{actualDownvotes}</span>
            </div>
            
            <div className="border-t border-border/30 pt-1.5 mt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Net Score:</span>
                <span className={`font-bold ${
                  data.netVotes > 0 ? 'text-green-400' : 
                  data.netVotes < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {data.netVotes > 0 ? '+' : ''}{data.netVotes}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Engagement:</span>
                <span className="text-blue-400 font-bold">{data.totalEngagement}</span>
              </div>
              
              {data.totalEngagement > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Approval:</span>
                  <span className="text-primary font-bold">{data.upvotePercentage}%</span>
                </div>
              )}
            </div>
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/80 border border-border/30 hover:border-border/50 rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={isMobile ? 20 : 24} className="text-primary" />
          <span className="font-sora">Vote Breakdown {sortBy === 'votes' ? '(by Score)' : sortBy === 'name' ? '(by Name)' : '(by Company)'}</span>
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
        height={isMobile ? 320 : 450}
        style={{ 
          backgroundColor: 'transparent',
        }}
      >
        <BarChart 
          data={chartData} 
          margin={{ 
            top: 20, 
            right: isMobile ? 0 : 30, 
            left: isMobile ? 0 : -16, 
            bottom: isMobile ? 10 : 80 
          }}
          style={{ backgroundColor: 'transparent' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
          <XAxis
            dataKey="name"
            angle={-45}
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
            width={isMobile ? 40 : 50}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            wrapperStyle={{ 
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none'
            }}
          />
          
          {/* Zero reference line */}
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" strokeOpacity={0.7} />
          
          {/* Upvotes bars (positive, going up) */}
          <Bar 
            dataKey="upvotes" 
            radius={[2, 2, 0, 0]}
            maxBarSize={isMobile ? 40 : 60}
          >
            {chartData.map((entry, index) => (
              <Cell key={`upvote-${index}`} fill={getBarColor(entry.color)} />
            ))}
          </Bar>
          
          {/* Downvotes bars (negative, going down with 70% opacity) */}
          <Bar 
            dataKey="downvotes" 
            fillOpacity={0.7}
            radius={[0, 0, 2, 2]}
            maxBarSize={isMobile ? 40 : 60}
          >
            {chartData.map((entry, index) => (
              <Cell key={`downvote-${index}`} fill={getBarColor(entry.color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Pagination dots */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
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
    </motion.div>
  );
}