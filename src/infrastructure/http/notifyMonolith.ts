import axios from 'axios';
import { env } from '../../config/env';

export interface ChatMessageNotifyPayload {
  channelId: string;
  legalEntityId: string;
  senderId: string;
  senderName?: string;
  messageId?: string;
  contentPreview?: string;
  createdAt?: string;
}

/**
 * Notify the monolith that a channel message was sent by an "external" sender
 * (e.g. Admin) so it can create an inbox entry for the legal entity.
 * Fire-and-forget; errors are logged but not thrown.
 */
export async function notifyMonolithChatMessage(payload: ChatMessageNotifyPayload): Promise<void> {
  const url = `${env.mainApiUrl}/chat/internal/notify`;
  try {
    await axios.post(url, payload, {
      headers: {
        'X-Internal-API-Key': env.internalApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (error) {
    console.error('Failed to notify monolith of chat message:', error);
  }
}

/**
 * Notify the monolith that a channel message was sent by a supplier (sender in legal entity)
 * so it can create inbox entries for all ADMIN users.
 * Fire-and-forget; errors are logged but not thrown.
 */
export async function notifyMonolithChatMessageToAdmins(payload: ChatMessageNotifyPayload): Promise<void> {
  const url = `${env.mainApiUrl}/chat/internal/notify-admins`;
  try {
    await axios.post(url, payload, {
      headers: {
        'X-Internal-API-Key': env.internalApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (error) {
    console.error('Failed to notify monolith (admins) of chat message:', error);
  }
}
