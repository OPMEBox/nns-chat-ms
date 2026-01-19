import { Channel, ChannelWithId, CreateChannelInput } from '../entities/Channel';
import { LastMessage } from '../entities/Conversation';

export interface IChannelRepository {
  /**
   * Create a new channel (LegalEntity inbox)
   * Will fail if channel already exists (due to unique legalEntityId)
   */
  create(input: CreateChannelInput): Promise<ChannelWithId>;

  /**
   * Find or create a channel for a legal entity
   */
  findOrCreate(input: CreateChannelInput): Promise<ChannelWithId>;

  /**
   * Find a channel by ID
   */
  findById(id: string): Promise<ChannelWithId | null>;

  /**
   * Find a channel by legal entity ID
   */
  findByLegalEntityId(legalEntityId: string): Promise<ChannelWithId | null>;

  /**
   * Find channels by multiple legal entity IDs
   */
  findByLegalEntityIds(legalEntityIds: string[]): Promise<ChannelWithId[]>;

  /**
   * Get all channels (for ADMIN users)
   */
  findAll(): Promise<ChannelWithId[]>;

  /**
   * Update the last message in a channel
   */
  updateLastMessage(channelId: string, lastMessage: LastMessage): Promise<void>;
}

