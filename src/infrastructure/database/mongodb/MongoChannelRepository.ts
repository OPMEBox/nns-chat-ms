import { Collection } from 'mongodb';
import { getDatabase } from '../../../config/database';
import { IChannelRepository } from '../../../domain/repositories/IChannelRepository';
import {
  Channel,
  ChannelWithId,
  CreateChannelInput,
  createChannel,
} from '../../../domain/entities/Channel';
import { LastMessage } from '../../../domain/entities/Conversation';

export class MongoChannelRepository implements IChannelRepository {
  private get collection(): Collection<Channel> {
    return getDatabase().collection<Channel>('channels');
  }

  async create(input: CreateChannelInput): Promise<ChannelWithId> {
    const channel = createChannel(input);
    await this.collection.insertOne(channel);
    
    return channel as ChannelWithId;
  }

  async findOrCreate(input: CreateChannelInput): Promise<ChannelWithId> {
    // Try to find existing channel
    const idToFind = input._id ?? input.legalEntityId;
    const existing = await this.findById(idToFind);
    if (existing) {
      return existing;
    }

    // Create new channel
    try {
      return await this.create(input);
    } catch (error: unknown) {
      // Handle race condition - another request might have created it
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const found = await this.findByLegalEntityId(input.legalEntityId);
        if (found) {
          return found;
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ChannelWithId | null> {
    const channel = await this.collection.findOne({ _id: id as any });
    return channel as ChannelWithId | null;
  }

  async findByLegalEntityId(legalEntityId: string): Promise<ChannelWithId | null> {
    const channel = await this.collection.findOne({ legalEntityId });
    return channel as ChannelWithId | null;
  }

  async findManyByLegalEntityId(legalEntityId: string): Promise<ChannelWithId[]> {
    const channels = await this.collection
      .find({ legalEntityId })
      .sort({ updatedAt: -1 })
      .toArray();

    return channels as ChannelWithId[];
  }

  async findByLegalEntityIds(legalEntityIds: string[]): Promise<ChannelWithId[]> {
    const channels = await this.collection
      .find({ legalEntityId: { $in: legalEntityIds } })
      .sort({ updatedAt: -1 })
      .toArray();
    
    return channels as ChannelWithId[];
  }

  async findAll(): Promise<ChannelWithId[]> {
    const channels = await this.collection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();
    
    return channels as ChannelWithId[];
  }

  async updateLastMessage(channelId: string, lastMessage: LastMessage): Promise<void> {
    await this.collection.updateOne(
      { _id: channelId as any },
      { 
        $set: { 
          lastMessage,
          updatedAt: new Date(),
        } 
      }
    );
  }

  async findOrCreateBidChannel(
    auctionBidId: string,
    legalEntityId: string,
    legalEntityName: string
  ): Promise<ChannelWithId> {
    // Channel id is the auctionBidId
    const existing = await this.findById(auctionBidId);
    if (existing) {
      return existing;
    }

    try {
      return await this.create({
        _id: auctionBidId,
        legalEntityId,
        legalEntityName,
      });
    } catch (error: unknown) {
      // Handle race condition where another request created it concurrently
      if (error && typeof error === 'object' && 'code' in error && (error as any).code === 11000) {
        const found = await this.findById(auctionBidId);
        if (found) {
          return found;
        }
      }
      throw error;
    }
  }
}
