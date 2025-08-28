import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import enhancedCacheManager from './cache-enhanced.js';
import scaledDbManager from './database-scaled.js';
import logger from './logger.js';

class WebSocketServer {
  constructor() {
    this.io = null;
    this.rooms = new Map();
    this.userConnections = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      roomSubscriptions: new Map()
    };
  }

  async initialize(server, options = {}) {
    try {
      // Create Socket.IO server
      this.io = new Server(server, {
        cors: {
          origin: process.env.CORS_ORIGIN || '*',
          methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        maxHttpBufferSize: 1e6,
        allowEIO3: true,
        ...options
      });

      // Setup Redis adapter
      await this.setupRedisAdapter();

      // Setup middleware
      this.setupMiddleware();

      // Setup event handlers
      this.setupEventHandlers();

      // Setup metrics collection
      this.setupMetrics();

      logger.info('WebSocket server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  async setupRedisAdapter() {
    try {
      const pubClient = scaledDbManager.getRedis('pubsub');
      const subClient = pubClient.duplicate();
      
      this.io.adapter(createAdapter(pubClient, subClient));
      
      logger.info('Redis adapter configured for Socket.IO');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
      // Fallback to in-memory adapter
      logger.warn('Using in-memory adapter (not suitable for multi-instance)');
    }
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const fingerprint = socket.handshake.auth.fingerprint;
        
        if (!fingerprint) {
          return next(new Error('Authentication failed: No fingerprint'));
        }

        // Check for restrictions
        const restriction = await enhancedCacheManager.checkRestriction(fingerprint);
        if (restriction && restriction.restricted) {
          return next(new Error('Access restricted'));
        }

        // Rate limiting per connection
        const rateLimitKey = `ws_connect:${fingerprint}`;
        const rateLimit = await enhancedCacheManager.checkRateLimit(rateLimitKey, 10, 60000);
        
        if (rateLimit.exceeded) {
          return next(new Error('Connection rate limit exceeded'));
        }

        socket.fingerprint = fingerprint;
        socket.userId = socket.handshake.auth.userId || fingerprint;
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(error);
      }
    });

    // Logging middleware
    this.io.use((socket, next) => {
      logger.debug('WebSocket connection attempt', {
        fingerprint: socket.fingerprint,
        ip: socket.handshake.address
      });
      next();
    });
  }

  setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      // Track user connection
      this.trackUserConnection(socket);

      logger.info('WebSocket client connected', {
        id: socket.id,
        fingerprint: socket.fingerprint
      });

      // Auto-join user to their personal room
      socket.join(`user:${socket.fingerprint}`);

      // Handle room subscriptions
      socket.on('subscribe', async (data) => {
        await this.handleSubscribe(socket, data);
      });

      socket.on('unsubscribe', async (data) => {
        await this.handleUnsubscribe(socket, data);
      });

      // Handle vote events
      socket.on('vote', async (data) => {
        await this.handleVote(socket, data);
      });

      // Handle sync request
      socket.on('sync', async (callback) => {
        await this.handleSync(socket, callback);
      });

      // Handle stats request
      socket.on('getStats', async (callback) => {
        await this.handleGetStats(socket, callback);
      });

      // Handle ping for latency measurement
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback({ timestamp: Date.now() });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.metrics.activeConnections--;
        this.untrackUserConnection(socket);
        
        logger.info('WebSocket client disconnected', {
          id: socket.id,
          fingerprint: socket.fingerprint,
          reason
        });
      });

      // Send initial data
      await this.sendInitialData(socket);
    });
  }

  trackUserConnection(socket) {
    if (!this.userConnections.has(socket.fingerprint)) {
      this.userConnections.set(socket.fingerprint, new Set());
    }
    this.userConnections.get(socket.fingerprint).add(socket.id);
  }

  untrackUserConnection(socket) {
    const connections = this.userConnections.get(socket.fingerprint);
    if (connections) {
      connections.delete(socket.id);
      if (connections.size === 0) {
        this.userConnections.delete(socket.fingerprint);
      }
    }
  }

  async handleSubscribe(socket, data) {
    try {
      const { type, id } = data;
      
      // Validate subscription type
      const validTypes = ['llm', 'rankings', 'stats', 'all'];
      if (!validTypes.includes(type)) {
        socket.emit('error', { message: 'Invalid subscription type' });
        return;
      }

      const room = `${type}:${id || 'global'}`;
      socket.join(room);

      // Track room subscription
      if (!this.metrics.roomSubscriptions.has(room)) {
        this.metrics.roomSubscriptions.set(room, 0);
      }
      this.metrics.roomSubscriptions.set(
        room,
        this.metrics.roomSubscriptions.get(room) + 1
      );

      socket.emit('subscribed', { room, type, id });
      
      logger.debug('Client subscribed to room', {
        socketId: socket.id,
        room
      });
    } catch (error) {
      logger.error('Subscribe error:', error);
      socket.emit('error', { message: 'Subscription failed' });
    }
  }

  async handleUnsubscribe(socket, data) {
    try {
      const { type, id } = data;
      const room = `${type}:${id || 'global'}`;
      
      socket.leave(room);
      
      // Update room subscription count
      if (this.metrics.roomSubscriptions.has(room)) {
        const count = this.metrics.roomSubscriptions.get(room) - 1;
        if (count <= 0) {
          this.metrics.roomSubscriptions.delete(room);
        } else {
          this.metrics.roomSubscriptions.set(room, count);
        }
      }

      socket.emit('unsubscribed', { room });
      
      logger.debug('Client unsubscribed from room', {
        socketId: socket.id,
        room
      });
    } catch (error) {
      logger.error('Unsubscribe error:', error);
      socket.emit('error', { message: 'Unsubscription failed' });
    }
  }

  async handleVote(socket, data) {
    try {
      const { llmId, voteType } = data;
      
      // Rate limiting for votes
      const rateLimitKey = `ws_vote:${socket.fingerprint}`;
      const rateLimit = await enhancedCacheManager.checkRateLimit(rateLimitKey, 60, 60000);
      
      if (rateLimit.exceeded) {
        socket.emit('voteError', {
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        });
        return;
      }

      // Process vote (delegate to vote manager)
      // This is a placeholder - integrate with your vote manager
      socket.emit('voteConfirmed', {
        llmId,
        voteType,
        timestamp: Date.now()
      });

      // Broadcast update to relevant rooms
      this.broadcastVoteUpdate(llmId, {
        fingerprint: socket.fingerprint,
        voteType
      });
    } catch (error) {
      logger.error('Vote handling error:', error);
      socket.emit('voteError', { error: 'Vote failed' });
    }
  }

  async handleSync(socket, callback) {
    try {
      // Get latest data from cache
      const [votes, rankings, stats] = await Promise.all([
        enhancedCacheManager.getAllVotes(),
        enhancedCacheManager.getRankings(),
        enhancedCacheManager.getStats()
      ]);

      const userVotes = await enhancedCacheManager.getUserVotes(socket.fingerprint);

      if (typeof callback === 'function') {
        callback({
          success: true,
          data: {
            votes: votes || {},
            userVotes: userVotes || {},
            rankings: rankings || [],
            stats: stats || {}
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Sync error:', error);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Sync failed'
        });
      }
    }
  }

  async handleGetStats(socket, callback) {
    try {
      const stats = await enhancedCacheManager.getStats();
      
      if (typeof callback === 'function') {
        callback({
          success: true,
          stats: stats || {},
          connectionStats: {
            totalConnections: this.metrics.totalConnections,
            activeConnections: this.metrics.activeConnections,
            roomSubscriptions: this.metrics.roomSubscriptions.size
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Get stats error:', error);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'Failed to get stats'
        });
      }
    }
  }

  async sendInitialData(socket) {
    try {
      const [votes, rankings, stats] = await Promise.all([
        enhancedCacheManager.getAllVotes(),
        enhancedCacheManager.getRankings(),
        enhancedCacheManager.getStats()
      ]);

      const userVotes = await enhancedCacheManager.getUserVotes(socket.fingerprint);

      socket.emit('initialData', {
        votes: votes || {},
        userVotes: userVotes || {},
        rankings: rankings || [],
        stats: stats || {},
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to send initial data:', error);
      socket.emit('error', { message: 'Failed to load initial data' });
    }
  }

  // Broadcast methods
  broadcastVoteUpdate(llmId, voteData) {
    const updateData = {
      type: 'voteUpdate',
      llmId,
      ...voteData,
      timestamp: Date.now()
    };

    // Broadcast to specific LLM room
    this.io.to(`llm:${llmId}`).emit('voteUpdate', updateData);
    
    // Broadcast to global room
    this.io.to('all:global').emit('voteUpdate', updateData);
  }

  broadcastRankingsUpdate(rankings) {
    const updateData = {
      type: 'rankingsUpdate',
      rankings,
      timestamp: Date.now()
    };

    this.io.to('rankings:global').emit('rankingsUpdate', updateData);
    this.io.to('all:global').emit('rankingsUpdate', updateData);
  }

  broadcastStatsUpdate(stats) {
    const updateData = {
      type: 'statsUpdate',
      stats,
      timestamp: Date.now()
    };

    this.io.to('stats:global').emit('statsUpdate', updateData);
    this.io.to('all:global').emit('statsUpdate', updateData);
  }

  // Setup metrics collection
  setupMetrics() {
    setInterval(() => {
      // Calculate messages per second
      // This would need actual message counting implementation
      
      logger.debug('WebSocket metrics', {
        totalConnections: this.metrics.totalConnections,
        activeConnections: this.metrics.activeConnections,
        uniqueUsers: this.userConnections.size,
        activeRooms: this.metrics.roomSubscriptions.size
      });
    }, 60000); // Every minute
  }

  // Get server statistics
  getStats() {
    return {
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      uniqueUsers: this.userConnections.size,
      rooms: Array.from(this.metrics.roomSubscriptions.entries()).map(([room, count]) => ({
        room,
        subscribers: count
      }))
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down WebSocket server...');
    
    // Notify all clients
    this.io.emit('serverShutdown', {
      message: 'Server is shutting down',
      timestamp: Date.now()
    });

    // Close all connections
    this.io.close();
    
    logger.info('WebSocket server shut down successfully');
  }
}

// Singleton instance
const wsServer = new WebSocketServer();

export default wsServer;