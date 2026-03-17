import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';

export interface LegalEntityPermission {
  id: string;
  name?: string;
  canRead: boolean;
  canWrite: boolean;
}

export interface ChatUser {
  chatUserId: string;
  username?: string;
  roles: string[];
  legalEntities: LegalEntityPermission[];
  userId?: string;
  channelId?: string;
}

export interface ChannelUser {
  userId: string;
  username?: string;
  channelId: string;
  roles: string[];
  legalEntities: LegalEntityPermission[];
}

export interface ChatTokenPayload extends ChatUser {
  iat: number;
  exp: number;
}

export interface ChannelTokenPayload extends ChannelUser {
  iat: number;
  exp: number;
}

export interface GenerateTokenInput {
  userId: string;
  username?: string;
  roles: string[];
  legalEntities: LegalEntityPermission[];
}

export interface GenerateTokenForConnectInput {
  userId: string;
  username?: string;
  channelId: string;
  roles: string[];
  legalEntities: LegalEntityPermission[];
}

export class ChatTokenService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = env.jwtSecret;
    this.jwtExpiresIn = env.jwtExpiresIn;
  }

  /**
   * Generate a chat-specific JWT token
   * Called by Main API to create a chat token for authenticated users
   */
  generateToken(input: GenerateTokenInput): string {
    const payload: Omit<ChatTokenPayload, 'iat' | 'exp'> = {
      chatUserId: input.userId,
      username: input.username,
      roles: input.roles,
      legalEntities: input.legalEntities,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as SignOptions);
  }

  generateTokenForConnect(input: GenerateTokenForConnectInput): string {
    const payload: Omit<ChannelTokenPayload, 'iat' | 'exp'> = {
      userId: input.userId,
      username: input.username,
      channelId: input.channelId,
      roles: input.roles,
      legalEntities: input.legalEntities,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as SignOptions);
  }

  decodeToken(token: string, jwtSecret?: string): ChannelTokenPayload {
    return jwt.verify(token, jwtSecret || this.jwtSecret) as ChannelTokenPayload;
  }

  /**
   * Verify and decode a chat token
   * Returns null if token is invalid or expired
   */
  verifyToken(token: string): ChatUser | null {
    try {
      const decoded = this.decodeToken(token);
      return {
        chatUserId: decoded.userId,
        userId: decoded.userId,
        username: decoded.username,
        channelId: decoded.channelId,
        roles: decoded.roles ?? [],
        legalEntities: decoded.legalEntities ?? [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if user is an ADMIN
   */
  isAdmin(user: ChatUser): boolean {
    return user.roles.includes('ADMIN');
  }

  /**
   * Check if user has read access to a legal entity channel
   */
  canReadChannel(user: ChatUser, legalEntityId: string): boolean {
    // ADMINs can read all channels
    if (this.isAdmin(user)) {
      return true;
    }

    // Check if user has read permission for this legal entity
    const permission = user.legalEntities.find(le => le.id === legalEntityId);
    return permission?.canRead === true;
  }

  /**
   * Check if user has write access to a legal entity channel
   */
  canWriteChannel(user: ChatUser, legalEntityId: string): boolean {
    // ADMINs can write to all channels
    if (this.isAdmin(user)) {
      return true;
    }

    // Check if user has write permission for this legal entity
    const permission = user.legalEntities.find(le => le.id === legalEntityId);
    return permission?.canWrite === true;
  }

  /**
   * Check if user can participate in a direct conversation
   * Users can only have direct conversations with:
   * - ADMINs (if they are suppliers)
   * - Anyone (if they are ADMINs)
   */
  canStartDirectConversation(user: ChatUser, targetUserId: string): boolean {
    // ADMINs can start conversations with anyone
    if (this.isAdmin(user)) {
      return true;
    }

    // Suppliers can start conversations (validation that target is ADMIN happens elsewhere)
    return true;
  }

  /**
   * Get all legal entity IDs the user has read access to
   */
  getReadableLegalEntityIds(user: ChatUser): string[] {
    if (this.isAdmin(user)) {
      return []; // ADMINs see all, handled separately
    }

    return user.legalEntities
      .filter(le => le.canRead)
      .map(le => le.id);
  }
}

// Singleton instance
export const chatTokenService = new ChatTokenService();

