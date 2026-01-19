import { Router, Request, Response } from 'express';
import { chatTokenService, ChatUser } from '../application/auth/ChatTokenService';
import { conversationService, messageService } from '../infrastructure/websocket/SocketServer';

export const conversationRoutes = Router();

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

/**
 * GET /conversations
 * Get all conversations for the authenticated user
 */
conversationRoutes.get('/', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const conversations = await conversationService.getUserConversations(user);
    res.json({ conversations });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /conversations/:id
 * Get a specific conversation by ID
 */
conversationRoutes.get('/:id', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const { id } = req.params;

    const conversation = await conversationService.getConversation(user, id);
    res.json({ conversation });
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
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * POST /conversations
 * Start a new conversation with another user
 */
conversationRoutes.post('/', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const { targetUserId } = req.body as { targetUserId: string };

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    const conversation = await conversationService.getOrCreateConversation(user, targetUserId);
    res.json({ conversation });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ForbiddenError') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /conversations/:id/messages
 * Get messages from a conversation with pagination
 */
conversationRoutes.get('/:id/messages', authenticateChatToken, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { chatUser: ChatUser }).chatUser;
    const { id } = req.params;
    const { cursor, limit } = req.query;

    // Validate access
    const canAccess = await conversationService.canAccessConversation(user, id);
    if (!canAccess) {
      res.status(403).json({ error: 'Cannot access this conversation' });
      return;
    }

    const cursorDate = cursor ? new Date(cursor as string) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    const messages = await messageService.getConversationMessages(id, cursorDate, limitNum);
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

