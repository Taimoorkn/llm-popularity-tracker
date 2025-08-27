'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { useVoteStore } from '@/store/useVoteStore';
import { toast } from 'sonner';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export function useWebSocket(fingerprint) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const pingInterval = useRef(null);
  
  const updateVotes = useVoteStore((state) => state.updateVotes);
  const updateUserVotes = useVoteStore((state) => state.updateUserVotes);
  const updateRankings = useVoteStore((state) => state.updateRankings);
  const updateStats = useVoteStore((state) => state.updateStats);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        fingerprint: fingerprint || 'anonymous'
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
      
      // Subscribe to global updates
      socket.emit('subscribe', { type: 'all', id: 'global' });
      
      // Start ping interval for latency measurement
      startPingInterval();
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      stopPingInterval();
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt reconnection
        setTimeout(() => connect(), 1000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        toast.error('Connection to server lost. Please refresh the page.');
      }
    });

    // Data event handlers
    socket.on('initialData', (data) => {
      console.log('Received initial data');
      if (data.votes) updateVotes(data.votes);
      if (data.userVotes) updateUserVotes(data.userVotes);
      if (data.rankings) updateRankings(data.rankings);
      if (data.stats) updateStats(data.stats);
    });

    socket.on('voteUpdate', (data) => {
      console.log('Vote update received:', data);
      // Update specific vote count
      if (data.llmId && data.voteCount !== undefined) {
        updateVotes({ [data.llmId]: data.voteCount });
      }
    });

    socket.on('rankingsUpdate', (data) => {
      console.log('Rankings update received');
      if (data.rankings) {
        updateRankings(data.rankings);
      }
    });

    socket.on('statsUpdate', (data) => {
      console.log('Stats update received');
      if (data.stats) {
        updateStats(data.stats);
      }
    });

    socket.on('voteConfirmed', (data) => {
      console.log('Vote confirmed:', data);
      toast.success('Vote recorded successfully');
    });

    socket.on('voteError', (data) => {
      console.error('Vote error:', data);
      toast.error(data.error || 'Failed to record vote');
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      toast.error(error.message || 'Connection error occurred');
    });

    socket.on('serverShutdown', (data) => {
      console.warn('Server shutdown notification:', data);
      toast.warning('Server is restarting. Please wait...');
    });

    socketRef.current = socket;
  }, [fingerprint, updateVotes, updateUserVotes, updateRankings, updateStats]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      stopPingInterval();
    }
  }, []);

  // Send vote through WebSocket
  const sendVote = useCallback((llmId, voteType) => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected, vote will be sent via HTTP');
      return false;
    }

    socketRef.current.emit('vote', { llmId, voteType });
    return true;
  }, []);

  // Subscribe to specific updates
  const subscribe = useCallback((type, id) => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected');
      return;
    }

    socketRef.current.emit('subscribe', { type, id });
  }, []);

  // Unsubscribe from updates
  const unsubscribe = useCallback((type, id) => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected');
      return;
    }

    socketRef.current.emit('unsubscribe', { type, id });
  }, []);

  // Request data sync
  const requestSync = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected');
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      socketRef.current.emit('sync', (response) => {
        if (response.success) {
          if (response.data) {
            if (response.data.votes) updateVotes(response.data.votes);
            if (response.data.userVotes) updateUserVotes(response.data.userVotes);
            if (response.data.rankings) updateRankings(response.data.rankings);
            if (response.data.stats) updateStats(response.data.stats);
          }
          resolve(response);
        } else {
          reject(new Error(response.error || 'Sync failed'));
        }
      });
    });
  }, [updateVotes, updateUserVotes, updateRankings, updateStats]);

  // Get connection stats
  const getStats = useCallback(() => {
    if (!socketRef.current?.connected) {
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      socketRef.current.emit('getStats', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to get stats'));
        }
      });
    });
  }, []);

  // Ping for latency measurement
  const startPingInterval = useCallback(() => {
    if (pingInterval.current) return;

    pingInterval.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const start = Date.now();
        socketRef.current.emit('ping', (response) => {
          const roundTrip = Date.now() - start;
          setLatency(roundTrip);
        });
      }
    }, 10000); // Every 10 seconds
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
  }, []);

  // Effect to manage connection lifecycle
  useEffect(() => {
    if (fingerprint) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [fingerprint, connect, disconnect]);

  // Reconnection on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && fingerprint && !socketRef.current?.connected) {
        console.log('Page visible, attempting reconnection');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fingerprint, connect]);

  // Reconnection on online status change
  useEffect(() => {
    const handleOnline = () => {
      if (fingerprint && !socketRef.current?.connected) {
        console.log('Network online, attempting reconnection');
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fingerprint, connect]);

  return {
    connected,
    latency,
    sendVote,
    subscribe,
    unsubscribe,
    requestSync,
    getStats,
    connect,
    disconnect
  };
}