import { Message, MessageWithId, CreateMessageInput } from '../entities/Message';

export interface PaginationOptions {
  cursor?: Date;  // createdAt of last message (for infinite scroll)
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: Date;
}

export interface IMessageRepository {
  /**
   * Create a new message
   */
  create(input: CreateMessageInput): Promise<MessageWithId>;

  /**
   * Find messages by conversation ID with pagination
   */
  findByConversationId(
    conversationId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<MessageWithId>>;

  /**
   * Find messages by channel ID with pagination
   */
  findByChannelId(
    channelId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<MessageWithId>>;

  /**
   * Find a single message by ID
   */
  findById(id: string): Promise<MessageWithId | null>;
}

