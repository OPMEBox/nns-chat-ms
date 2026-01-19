import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { env, validateEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { setupSocketServer } from './infrastructure/websocket/SocketServer';
import { authRoutes } from './routes/auth.routes';
import { conversationRoutes } from './routes/conversation.routes';
import { channelRoutes } from './routes/channel.routes';

async function main(): Promise<void> {
  // Validate environment variables
  validateEnv();

  // Connect to MongoDB
  await connectDatabase();

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'chat-microservice' });
  });

  // REST Routes
  app.use('/auth', authRoutes);
  app.use('/conversations', conversationRoutes);
  app.use('/channels', channelRoutes);

  // #region agent log - Catch-all to log unhandled requests
  app.use('*', (req, res, next) => {
    console.log(`[DEBUG-E] Unhandled route: ${req.method} ${req.originalUrl}`);
    next();
  });
  // #endregion

  // Create HTTP server
  const httpServer = http.createServer(app);

  // #region agent log - Log ALL HTTP requests to see what paths are being hit
  httpServer.on('request', (req, res) => {
    console.log(`[DEBUG-A] HTTP Request: ${req.method} ${req.url} | Headers: upgrade=${req.headers.upgrade}, connection=${req.headers.connection}`);
  });
  
  httpServer.on('upgrade', (req, socket, head) => {
    console.log(`[DEBUG-B] HTTP Upgrade: ${req.url} | upgrade=${req.headers.upgrade}`);
  });
  // #endregion

  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // #region agent log - Using explicit path for clarity (this is the default)
    path: '/socket.io/',
    // #endregion
  });

  // #region agent log - Log Socket.IO engine events
  io.engine.on('connection_error', (err: any) => {
    console.log(`[DEBUG-C] Socket.IO Engine Error: code=${err.code}, message=${err.message}, context=${JSON.stringify(err.context)}`);
  });
  
  io.engine.on('initial_headers', (headers: any, req: any) => {
    console.log(`[DEBUG-D] Socket.IO Initial Headers for: ${req.url}`);
  });
  // #endregion

  // Setup WebSocket handlers
  setupSocketServer(io);

  // Start server
  httpServer.listen(env.port, () => {
    console.log(`Chat microservice running on port ${env.port}`);
    console.log(`WebSocket server ready`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    
    io.close();
    httpServer.close();
    await disconnectDatabase();
    
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Fatal error starting chat service:', error);
  process.exit(1);
});

