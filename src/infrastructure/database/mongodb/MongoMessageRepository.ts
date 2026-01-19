import { Collection, ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database';
import {
  IMessageRepository,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/IMessageRepository';
import {
  Message,
  MessageWithId,
  CreateMessageInput,
  createMessage,
} from '../../../domain/entities/Message';

export class MongoMessageRepository implements IMessageRepository {
  private get collection(): Collection<Message> {
    return getDatabase().collection<Message>('messages');
  }

  async create(input: CreateMessageInput): Promise<MessageWithId> {
    const message = createMessage(input);
    const result = await this.collection.insertOne(message);
    
    return {
      ...message,
      _id: result.insertedId,
    };
  }

  async findByConversationId(
    conversationId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<MessageWithId>> {
    const query: Record<string, unknown> = { conversationId };
    
    if (options.cursor) {
      query.createdAt = { $lt: options.cursor };
    }

    const messages = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit + 1) // Fetch one extra to check if there are more
      .toArray();

    const hasMore = messages.length > options.limit;
    const data = hasMore ? messages.slice(0, options.limit) : messages;

    return {
      data: data as MessageWithId[],
      hasMore,
      nextCursor: hasMore && data.length > 0 
        ? data[data.length - 1].createdAt 
        : undefined,
    };
  }

  async findByChannelId(
    channelId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<MessageWithId>> {
    const query: Record<string, unknown> = { channelId };
    
    if (options.cursor) {
      query.createdAt = { $lt: options.cursor };
    }

    const messages = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit + 1)
      .toArray();

    const hasMore = messages.length > options.limit;
    const data = hasMore ? messages.slice(0, options.limit) : messages;

    return {
      data: data as MessageWithId[],
      hasMore,
      nextCursor: hasMore && data.length > 0 
        ? data[data.length - 1].createdAt 
        : undefined,
    };
  }

  async findById(id: string): Promise<MessageWithId | null> {
    const message = await this.collection.findOne({ 
      _id: new ObjectId(id) 
    });
    return message as MessageWithId | null;
  }
}

