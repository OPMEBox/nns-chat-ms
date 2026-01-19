import { Conversation, ConversationWithId, CreateConversationInput, LastMessage } from '../entities/Conversation';

export interface IConversationRepository {
  /**
   * Create a new conversation
   * Will fail if conversation already exists (due to unique participantsKey)
   */
  create(input: CreateConversationInput): Promise<ConversationWithId>;

  /**
   * Find or create a conversation between two users
   */
  findOrCreate(input: CreateConversationInput): Promise<ConversationWithId>;

  /**
   * Find a conversation by ID
   */
  findById(id: string): Promise<ConversationWithId | null>;

  /**
   * Find a conversation by participants key
   */
  findByParticipantsKey(participantsKey: string): Promise<ConversationWithId | null>;

  /**
   * Find all conversations for a user
   */
  findByUserId(userId: string): Promise<ConversationWithId[]>;

  /**
   * Update the last message in a conversation
   */
  updateLastMessage(conversationId: string, lastMessage: LastMessage): Promise<void>;
}

