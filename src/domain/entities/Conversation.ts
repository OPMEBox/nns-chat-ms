import { ObjectId } from 'mongodb';

export interface LastMessage {
  content: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
}

export interface Conversation {
  _id?: ObjectId;
  participantsKey: string;  // Sorted "userA:userB" for uniqueness
  participants: [string, string];  // Both user IDs
  lastMessage?: LastMessage;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWithId extends Conversation {
  _id: ObjectId;
}

export interface CreateConversationInput {
  participantA: string;
  participantB: string;
}

/**
 * Creates a unique participants key by sorting the IDs
 * This ensures the same key regardless of order
 */
export function createParticipantsKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

export function createConversation(input: CreateConversationInput): Conversation {
  const participants: [string, string] = [input.participantA, input.participantB];
  const participantsKey = createParticipantsKey(input.participantA, input.participantB);
  const now = new Date();

  return {
    participantsKey,
    participants,
    createdAt: now,
    updatedAt: now,
  };
}

