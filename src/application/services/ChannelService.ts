import { IChannelRepository } from '../../domain/repositories/IChannelRepository';
import { ChannelWithId, CreateChannelInput } from '../../domain/entities/Channel';
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

export class ChannelService {
  constructor(private channelRepository: IChannelRepository) {}

  /**
   * Get or create a channel for a legal entity
   * Only ADMINs or users belonging to the legal entity can access
   */
  async getOrCreateChannel(
    user: ChatUser,
    legalEntityId: string,
    legalEntityName: string
  ): Promise<ChannelWithId> {
    // Validate user can access this channel
    if (!chatTokenService.canReadChannel(user, legalEntityId)) {
      throw new ForbiddenError('No read access to this channel');
    }

    return this.channelRepository.findOrCreate({
      legalEntityId,
      legalEntityName,
    });
  }
  /**
   * Get or create a channel for a legal entity
   * Only ADMINs or users belonging to the legal entity can access
   */
  async getOrCreateChannelById(
    id: string
  ): Promise<ChannelWithId> {
    // Validate user can access this channel
    // if (!chatTokenService.canReadChannel(user, legalEntityId)) {
    //   throw new ForbiddenError('No read access to this channel');
    // }

    return this.channelRepository.findOrCreate({
      _id: id,
      legalEntityId: id,
      legalEntityName: '',
    });
  }

  /**
   * Join a channel (get it and validate access)
   */
  async joinChannel(user: ChatUser, legalEntityId: string): Promise<ChannelWithId> {
    // Validate user can read this channel
    if (!chatTokenService.canReadChannel(user, legalEntityId)) {
      throw new ForbiddenError('No read access to this channel');
    }

    const channel = await this.channelRepository.findByLegalEntityId(legalEntityId);

    if (!channel) {
      throw new NotFoundError('Channel not found for this legal entity');
    }

    return channel;
  }

  /**
   * Get a channel by ID
   */
  async getChannel(user: ChatUser, channelId: string): Promise<ChannelWithId> {
    const channel = await this.channelRepository.findById(channelId);

    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    // Validate user can access this channel
    if (!chatTokenService.canReadChannel(user, channel.legalEntityId)) {
      throw new ForbiddenError('No read access to this channel');
    }

    return channel;
  }

  /**
   * Get all channels accessible by a user
   */
  async getUserChannels(user: ChatUser): Promise<ChannelWithId[]> {
    // ADMINs can see all channels
    if (chatTokenService.isAdmin(user)) {
      return this.channelRepository.findAll();
    }

    // Get channels for user's legal entities
    const readableLegalEntityIds = chatTokenService.getReadableLegalEntityIds(user);
    
    if (readableLegalEntityIds.length === 0) {
      return [];
    }

    return this.channelRepository.findByLegalEntityIds(readableLegalEntityIds);
  }

  /**
   * Check if user can send messages to a channel
   */
  canSendMessage(user: ChatUser, channel: ChannelWithId): boolean {
    return chatTokenService.canWriteChannel(user, channel.legalEntityId);
  }

  /**
   * Validate write permission and throw if not allowed
   */
  validateWritePermission(user: ChatUser, channel: ChannelWithId): void {
    if (!this.canSendMessage(user, channel)) {
      throw new ForbiddenError('No write access to this channel');
    }
  }
}

