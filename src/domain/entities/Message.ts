import { ObjectId } from 'mongodb';

export type MessageContentType = 'text' | 'system' | 'file';

export interface Message {
  _id?: ObjectId;
  conversationId?: string;  // For direct chats
  channelId?: string;       // For LegalEntity inbox
  senderId: string;
  senderName: string;
  content: string;
  contentType: MessageContentType;
  createdAt: Date;
}

export interface CreateMessageInput {
  conversationId?: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType?: MessageContentType;
}

export interface MessageWithId extends Message {
  _id: ObjectId;
}

export function createMessage(input: CreateMessageInput): Message {
  return {
    conversationId: input.conversationId,
    channelId: input.channelId,
    senderId: input.senderId,
    senderName: input.senderName,
    content: input.content,
    contentType: input.contentType || 'text',
    createdAt: new Date(),
  };
}

export function createSystemMessage(
  target: { conversationId?: string; channelId?: string },
  content: string
): Message {
  return {
    ...target,
    senderId: 'system',
    senderName: 'System',
    content,
    contentType: 'system',
    createdAt: new Date(),
  };
}

