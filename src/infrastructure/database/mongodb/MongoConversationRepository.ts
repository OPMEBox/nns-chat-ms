import { Collection, ObjectId } from 'mongodb';
import { getDatabase } from '../../../config/database';
import { IConversationRepository } from '../../../domain/repositories/IConversationRepository';
import {
  Conversation,
  ConversationWithId,
  CreateConversationInput,
  LastMessage,
  createConversation,
  createParticipantsKey,
} from '../../../domain/entities/Conversation';

export class MongoConversationRepository implements IConversationRepository {
  private get collection(): Collection<Conversation> {
    return getDatabase().collection<Conversation>('conversations');
  }

  async create(input: CreateConversationInput): Promise<ConversationWithId> {
    const conversation = createConversation(input);
    const result = await this.collection.insertOne(conversation);
    
    return {
      ...conversation,
      _id: result.insertedId,
    };
  }

  async findOrCreate(input: CreateConversationInput): Promise<ConversationWithId> {
    const participantsKey = createParticipantsKey(input.participantA, input.participantB);
    
    // Try to find existing conversation
    const existing = await this.findByParticipantsKey(participantsKey);
    if (existing) {
      return existing;
    }

    // Create new conversation
    try {
      return await this.create(input);
    } catch (error: unknown) {
      // Handle race condition - another request might have created it
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const found = await this.findByParticipantsKey(participantsKey);
        if (found) {
          return found;
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ConversationWithId | null> {
    const conversation = await this.collection.findOne({ 
      _id: new ObjectId(id) 
    });
    return conversation as ConversationWithId | null;
  }

  async findByParticipantsKey(participantsKey: string): Promise<ConversationWithId | null> {
    const conversation = await this.collection.findOne({ participantsKey });
    return conversation as ConversationWithId | null;
  }

  async findByUserId(userId: string): Promise<ConversationWithId[]> {
    const conversations = await this.collection
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .toArray();
    
    return conversations as ConversationWithId[];
  }

  async updateLastMessage(conversationId: string, lastMessage: LastMessage): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(conversationId) },
      { 
        $set: { 
          lastMessage,
          updatedAt: new Date(),
        } 
      }
    );
  }
}

