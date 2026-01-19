import { IMessageRepository, PaginatedResult } from '../../domain/repositories/IMessageRepository';
import { MessageWithId, CreateMessageInput, createSystemMessage } from '../../domain/entities/Message';
import { LastMessage } from '../../domain/entities/Conversation';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { IChannelRepository } from '../../domain/repositories/IChannelRepository';

export interface SendMessageInput {
  senderId: string;
  senderName: string;
  content: string;
  conversationId?: string;
  channelId?: string;
}

export class MessageService {
  constructor(
    private messageRepository: IMessageRepository,
    private conversationRepository: IConversationRepository,
    private channelRepository: IChannelRepository
  ) {}

  /**
   * Send a message to a conversation or channel
   */
  async sendMessage(input: SendMessageInput): Promise<MessageWithId> {
    if (!input.conversationId && !input.channelId) {
      throw new Error('Either conversationId or channelId must be provided');
    }

    const messageInput: CreateMessageInput = {
      senderId: input.senderId,
      senderName: input.senderName,
      content: input.content,
      conversationId: input.conversationId,
      channelId: input.channelId,
      contentType: 'text',
    };

    const message = await this.messageRepository.create(messageInput);

    // Update last message in conversation or channel
    const lastMessage: LastMessage = {
      content: input.content,
      senderId: input.senderId,
      senderName: input.senderName,
      createdAt: message.createdAt,
    };

    if (input.conversationId) {
      await this.conversationRepository.updateLastMessage(
        input.conversationId,
        lastMessage
      );
    } else if (input.channelId) {
      await this.channelRepository.updateLastMessage(
        input.channelId,
        lastMessage
      );
    }

    return message;
  }

  /**
   * Create a system message
   */
  async createSystemMessage(
    target: { conversationId?: string; channelId?: string },
    content: string
  ): Promise<MessageWithId> {
    const systemMsg = createSystemMessage(target, content);
    return this.messageRepository.create({
      ...target,
      senderId: systemMsg.senderId,
      senderName: systemMsg.senderName,
      content: systemMsg.content,
      contentType: systemMsg.contentType,
    });
  }

  /**
   * Get messages from a conversation with pagination
   */
  async getConversationMessages(
    conversationId: string,
    cursor?: Date,
    limit: number = 50
  ): Promise<PaginatedResult<MessageWithId>> {
    return this.messageRepository.findByConversationId(conversationId, {
      cursor,
      limit,
    });
  }

  /**
   * Get messages from a channel with pagination
   */
  async getChannelMessages(
    channelId: string,
    cursor?: Date,
    limit: number = 50
  ): Promise<PaginatedResult<MessageWithId>> {
    return this.messageRepository.findByChannelId(channelId, {
      cursor,
      limit,
    });
  }
}

