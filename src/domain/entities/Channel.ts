import { randomUUID } from 'crypto';
import { LastMessage } from './Conversation';

export interface Channel {
  _id?: string;
  legalEntityId: string;     // Unique - one inbox per company
  legalEntityName: string;   // Denormalized for display
  lastMessage?: LastMessage;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelWithId extends Channel {
  _id: string;
}

export interface CreateChannelInput {
  _id?: string;
  legalEntityId: string;
  legalEntityName: string;
}

export function createChannel(input: CreateChannelInput): Channel {
  const now = new Date();

  return {
    _id: input._id ?? input.legalEntityId ?? randomUUID(),
    legalEntityId: input.legalEntityId,
    legalEntityName: input.legalEntityName,
    createdAt: now,
    updatedAt: now,
  };
}
