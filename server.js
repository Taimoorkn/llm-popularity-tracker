import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io'; 
import logger from './lib/logger.js';
import { getVoteManager } from './lib/vote-manager-wrapper.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize vote manager
  let voteManager;
  try {
    voteManager = await getVoteManager();
    logger.info('Vote manager initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize vote manager:', error);
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  // Initialize WebSocket server
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // WebSocket connection handling
  io.on('connection', async (socket) => {
    logger.info('Client connected:', socket.id);
    
    // Send initial data
    try {
      const [votes, rankings, stats] = await Promise.all([
        voteManager.getVotes(),
        voteManager.getRankings(), 
        voteManager.getStats()
      ]);
      
      socket.emit('initialData', { votes, rankings, stats });
    } catch (error) {
      logger.error('Failed to send initial data:', error);
    }

    // Handle vote events
    socket.on('vote', async (data) => {
      try {
        const { fingerprint, llmId, voteType } = data;
        
        // Extract metadata from socket
        const metadata = {
          ip: socket.handshake.address || socket.conn.remoteAddress,
          userAgent: socket.handshake.headers['user-agent']
        };
        
        const result = await voteManager.vote(fingerprint, llmId, voteType, metadata);
        
        if (result.success) {
          // Broadcast vote update to all clients
          io.emit('voteUpdate', {
            llmId,
            newCount: result.votes[llmId],
            voteType
          });
        }
        
        socket.emit('voteResult', result);
      } catch (error) {
        logger.error('WebSocket vote error:', error);
        socket.emit('voteError', { error: error.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected:', socket.id);
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    logger.info(`Server running on http://${hostname}:${port}`);
  });
});