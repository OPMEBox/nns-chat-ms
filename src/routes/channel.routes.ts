import { Router, Request, Response } from 'express';
import { ChannelUser, ChatTokenPayload, chatTokenService, ChatUser } from '../application/auth/ChatTokenService';
import { channelService, messageService } from '../infrastructure/websocket/SocketServer';
import { env } from '../config/env';

export const channelRoutes = Router();

// Middleware to authenticate internal API key
function authenticateInternalApiKey(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-internal-api-key'];

  if (!apiKey) {
    res.status(401).json({ error: 'No API key provided' });
    return;
  }

  if (apiKey !== env.internalApiKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

// Middleware to authenticate chat token from header
function authenticateChatToken(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const user = chatTokenService.verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user to request
  (req as Request & { chatUser: ChatUser }).chatUser = user;
  next();
}

function authenticatToConnect(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const decoded = chatTokenService.decodeToken(token as string, process.env.MAIN_API_JWT_SECRET);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const channelUser = {
    userId: decoded.userId,
    username: decoded.username,
    channelId: req.params.channelId,
  };
  (req as Request & { channelUser: ChannelUser }).channelUser = channelUser;
  next();
}

channelRoutes.get('/connect/:channelId', authenticatToConnect, async (req: Request, res: Response) => {
  const { channelUser } = req as Request & { channelUser: ChannelUser };
  console.log('channelUser => ', channelUser);
  const token = chatTokenService.generateTokenForConnect(channelUser);
  res.json({ token });
});

/**
 * GET /channels
 * Get all channels accessible by the authenticated user
 */
channelRoutes.get('/', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const channels = await channelService.getUserChannels(user);
    res.json({ channels });
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

/**
 * GET /channels/:id
 * Get a specific channel by ID
 */
channelRoutes.get('/:id', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const { id } = req.params;

    const channel = await channelService.getChannel(user, id);
    res.json({ channel });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.name === 'ForbiddenError') {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    console.error('Error getting channel:', error);
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

/**
 * GET /channels/legal-entity/:legalEntityId
 * Get or create a channel for a legal entity
 */
channelRoutes.get(
  '/legal-entity/:legalEntityId',
  authenticateChatToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & { chatUser: ChatUser }).chatUser;
      const { legalEntityId } = req.params;
      const { name } = req.query;

      const channel = await channelService.getOrCreateChannel(
        user,
        legalEntityId,
        (name as string) || 'Unknown'
      );
      res.json({ channel });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ForbiddenError') {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Error getting/creating channel:', error);
      res.status(500).json({ error: 'Failed to get channel' });
    }
  }
);

/**
 * GET /channels/:id/messages
 * Get messages from a channel with pagination
 */
channelRoutes.get('/:id/messages', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const { id } = req.params;
    const { cursor, limit } = req.query;

    // Validate access
    const channel = await channelService.getChannel(user, id);

    const cursorDate = cursor ? new Date(cursor as string) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    const messages = await messageService.getChannelMessages(id, cursorDate, limitNum);
    res.json(messages);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.name === 'ForbiddenError') {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    console.error('Error getting channel messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * GET /channels/:id/permissions
 * Check user's permissions for a channel
 */
channelRoutes.get(
  '/:id/permissions',
  authenticateChatToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & { chatUser: ChatUser }).chatUser;
      const { id } = req.params;

      const channel = await channelService.getChannel(user, id);

      res.json({
        channelId: id,
        canRead: chatTokenService.canReadChannel(user, channel.legalEntityId),
        canWrite: chatTokenService.canWriteChannel(user, channel.legalEntityId),
        isAdmin: chatTokenService.isAdmin(user),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.name === 'ForbiddenError') {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Failed to check permissions' });
    }
  }
);

/**
 * GET /channels/internal/:channelId/messages
 * Internal endpoint for Main API to fetch channel messages
 * Authenticated via X-Internal-API-Key header
 */
channelRoutes.get(
  '/internal/:channelId/messages',
  authenticateInternalApiKey,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { cursor, limit } = req.query;

      // Get or create the channel by ID (using legalEntityId as channelId)
      const channel = await channelService.getOrCreateChannelById(channelId);

      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      const cursorDate = cursor ? new Date(cursor as string) : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;

      const result = await messageService.getChannelMessages(channel._id, cursorDate, limitNum);
      console.log('result => ', result);
      res.json({
        messages: result.data,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor?.toISOString(),
      });
    } catch (error: unknown) {
      console.error('Error getting channel messages (internal):', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }
);
