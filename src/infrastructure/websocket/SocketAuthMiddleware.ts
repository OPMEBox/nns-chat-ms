import { Socket } from 'socket.io';
import { ChannelUser, chatTokenService, ChatUser } from '../../application/auth/ChatTokenService';

// Socket data interface - user has roles and legalEntities from connect token
interface ChatSocketData {
  user?: ChatUser;
}

export interface AuthenticatedSocket extends Socket {
  data: ChatSocketData & {
    user: ChatUser;
  };
}

/**
 * Socket.IO middleware for JWT authentication
 * Validates the chat token on connection
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    return next(new Error('NO_TOKEN'));
  }

  const user = chatTokenService.verifyToken(token);

  if (!user) {
    return next(new Error('TOKEN_EXPIRED'));
  }

  // Attach user data to socket
  socket.data.user = user;

  next();
}

/**
 * Helper to safely get authenticated user from socket
 */
export function getAuthenticatedUser(socket: Socket): ChatUser | null {
  return socket.data.user || null;
}

/**
 * Type guard to check if socket is authenticated
 */
export function isAuthenticatedSocket(socket: Socket): socket is AuthenticatedSocket {
  return socket.data.user !== undefined;
}

