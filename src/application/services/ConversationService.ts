import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { ConversationWithId, createParticipantsKey } from '../../domain/entities/Conversation';
import { ChatUser, chatTokenService } from '../auth/ChatTokenService';

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConversationService {
  constructor(private conversationRepository: IConversationRepository) {}

  /**
   * Get or create a direct conversation between two users
   */
  async getOrCreateConversation(
    user: ChatUser,
    targetUserId: string
  ): Promise<ConversationWithId> {
    // Validate user can start this conversation
    if (!chatTokenService.canStartDirectConversation(user, targetUserId)) {
      throw new ForbiddenError('You cannot start a conversation with this user');
    }

    // Cannot have a conversation with yourself
    if (user.chatUserId === targetUserId) {
      throw new ForbiddenError('Cannot create a conversation with yourself');
    }

    return this.conversationRepository.findOrCreate({
      participantA: user.chatUserId,
      participantB: targetUserId,
    });
  }

  /**
   * Get a conversation by ID
   * Validates that the user is a participant
   */
  async getConversation(
    user: ChatUser,
    conversationId: string
  ): Promise<ConversationWithId> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Check if user is a participant (or ADMIN)
    if (
      !chatTokenService.isAdmin(user) &&
      !conversation.participants.includes(user.chatUserId)
    ) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    return conversation;
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(user: ChatUser): Promise<ConversationWithId[]> {
    return this.conversationRepository.findByUserId(user.chatUserId);
  }

  /**
   * Check if a user can access a conversation
   */
  async canAccessConversation(
    user: ChatUser,
    conversationId: string
  ): Promise<boolean> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      return false;
    }

    // ADMINs can access all conversations
    if (chatTokenService.isAdmin(user)) {
      return true;
    }

    // Check if user is a participant
    return conversation.participants.includes(user.chatUserId);
  }

  /**
   * Find a conversation between two specific users
   */
  async findConversationBetweenUsers(
    userIdA: string,
    userIdB: string
  ): Promise<ConversationWithId | null> {
    const participantsKey = createParticipantsKey(userIdA, userIdB);
    return this.conversationRepository.findByParticipantsKey(participantsKey);
  }
}

