import { Server as SocketIOServer, Socket } from 'socket.io';
import { socketAuthMiddleware, isAuthenticatedSocket, AuthenticatedSocket } from './SocketAuthMiddleware';
import { presenceManager } from './PresenceManager';
import { MongoMessageRepository } from '../database/mongodb/MongoMessageRepository';
import { MongoConversationRepository } from '../database/mongodb/MongoConversationRepository';
import { MongoChannelRepository } from '../database/mongodb/MongoChannelRepository';
import { MessageService } from '../../application/services/MessageService';
import { ConversationService } from '../../application/services/ConversationService';
import { ChannelService } from '../../application/services/ChannelService';
import { chatTokenService } from '../../application/auth/ChatTokenService';

// Initialize repositories
const messageRepository = new MongoMessageRepository();
const conversationRepository = new MongoConversationRepository();
const channelRepository = new MongoChannelRepository();

// Initialize services
const messageService = new MessageService(
  messageRepository,
  conversationRepository,
  channelRepository
);
const conversationService = new ConversationService(conversationRepository);
const channelService = new ChannelService(channelRepository);

// Socket event payloads
interface JoinConversationPayload {
  conversationId: string;
}

interface JoinChannelPayload {
  channelId: string;
  legalEntityName?: string;
}

interface SendMessagePayload {
  target: 'conversation' | 'channel';
  targetId: string;  // conversationId or channelId
  content: string;
}

interface GetMessagesPayload {
  target: 'conversation' | 'channel';
  targetId: string;
  cursor?: string;  // ISO date string
  limit?: number;
}

// Error codes
const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export function setupSocketServer(io: SocketIOServer): void {
  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket) => {
    let targetChannelId: string | undefined;
    let roomName: string | undefined;
    if (!isAuthenticatedSocket(socket)) {
      socket.disconnect();
      return;
    }

    const authenticatedSocket = socket as AuthenticatedSocket;
    const user = authenticatedSocket.data.user;
    targetChannelId = user.channelId;
    

    console.log(`User connected: ${user.userId} (${user.username || 'unknown'})`);

    // Track presence
    presenceManager.addConnection(user.userId, socket.id);

    // Notify others that user is online
    socket.broadcast.emit('user:online', { userId: user.userId });

    // --- Event Handlers ---

    // Join a legal entity channel
    socket.on('channel:join', async (payload: JoinChannelPayload) => {
      try {
        if (!payload?.channelId) {
          socket.emit('error', { code: ErrorCodes.INVALID_PAYLOAD, message: 'legalEntityId is required' });
          socket.disconnect();
          return;
        }

        if (targetChannelId !== payload.channelId) {
          console.log('Cannot access this channel');
          socket.emit('error', { code: ErrorCodes.FORBIDDEN, message: 'Cannot access this channel' });
          return;
        }

        // Check read permission
        // if (!chatTokenService.canReadChannel(user, payload.channelId)) {
        //   socket.emit('error', { code: ErrorCodes.FORBIDDEN, message: 'No read access to this channel' });
        //   return;
        // }

        // Get or create channel
        const channel = await channelService.getOrCreateChannelById(payload.channelId);

        // Join the room
        roomName = `channel:${channel._id.toString()}`;
        socket.join(roomName);

        // Send recent messages
        // const messages = await messageService.getChannelMessages(channel._id.toString());
        // socket.emit('channel:joined', {
        //   channel,
        //   messages: messages.data,
        //   hasMore: messages.hasMore,
        // });

        console.log(`User ${user.userId} joined channel ${channel._id}`);
      } catch (error) {
        console.error('Error joining channel:', error);
        socket.emit('error', { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to join channel' });
      }
    });

    // Send a message
    socket.on('message:send', async (payload: SendMessagePayload) => {
      try {
        if (!payload?.target || !payload?.targetId || !payload?.content) {
          socket.emit('error', { code: ErrorCodes.INVALID_PAYLOAD, message: 'target, targetId, and content are required' });
          return;
        }
        let message;

        if (payload.target === 'channel') {
          // Get channel and validate write permission
          const channel = await channelRepository.findById(payload.targetId);
          if (!channel) {
            socket.emit('error', { code: ErrorCodes.NOT_FOUND, message: 'Channel not found' });
            socket.disconnect();
            return;
          }

          // if (!chatTokenService.canWriteChannel(user, channel.legalEntityId)) {
          //   socket.emit('error', { code: ErrorCodes.FORBIDDEN, message: 'No write access to this channel' });
          //   return;
          // }

          message = await messageService.sendMessage({
            senderId: user.userId,
            senderName: user.username || user.userId,
            content: payload.content,
            channelId: payload.targetId,
          });

          roomName = `channel:${payload.targetId}`;
        } else {
          console.log('Invalid target type');
          socket.emit('error', { code: ErrorCodes.INVALID_PAYLOAD, message: 'Invalid target type' });
          return;
        }
       

        // Broadcast message to room
        io.to(roomName).emit('message:new', { message });

        console.log(`Message sent by ${user.userId} to ${roomName}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to send message' });
      }
    });

    socket.on('message:new', (payload: MessageWithId) => {
      console.log('message:new => ', payload);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const wentOffline = presenceManager.removeConnection(user.userId, socket.id);
      
      if (wentOffline) {
        // Notify others that user is offline
        socket.broadcast.emit('user:offline', { userId: user.userId });
      }
      socket.removeAllListeners();

      console.log(`User disconnected: ${user.userId}`);
    });
  });

  console.log('Socket.IO server setup complete');
}

// Export services for REST routes
export { messageService, conversationService, channelService };

