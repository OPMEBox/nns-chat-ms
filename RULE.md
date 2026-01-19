# Chat Microservice Rules

This document defines the architectural rules and guidelines for the Chat Microservice.

## Core Principles

### 1. Independence from Main API

The chat microservice is **independent** from the main API:
- Has its own database (MongoDB)
- Has its own JWT tokens (chat tokens)
- Does NOT directly access Main API's database
- Receives user/permission data via chat tokens

### 2. Authentication Flow

```
Main API owns authentication → Chat Service trusts Main API-issued tokens
```

- Users authenticate with Main API first
- Main API generates chat tokens via internal endpoint
- Chat tokens contain all necessary permissions (no DB lookups needed)
- Chat tokens have shorter lifetime than main tokens (24h default)

### 3. Permission Model

Chat permissions are determined by the chat token payload:

```typescript
{
  chatUserId: string,
  roles: string[],           // ['ADMIN'] or ['SUPPLIER', etc.]
  legalEntities: [{
    id: string,
    canRead: boolean,
    canWrite: boolean
  }]
}
```

**Rules:**
- ADMIN users can access ALL channels
- Supplier users can only access channels for their legal entities
- Read/write permissions are checked on every operation
- Permissions cannot be modified within chat service

### 4. Do NOT Re-implement Business Logic

The chat service should ONLY check:
- Is user part of conversation?
- Is user allowed to read this channel?
- Is user allowed to write to this channel?

All other business rules stay in the Main API.

## Data Model Rules

### Conversations (Direct 1-1)

- Always between exactly 2 users
- Unique by sorted `participantsKey` (prevents duplicates)
- Format: `"userA:userB"` where userA < userB alphabetically

### Channels (LegalEntity Inbox)

- One channel per legal entity
- Unique by `legalEntityId`
- All ADMIN users can access
- LegalEntity users access based on permissions

### Messages

- Append-only (never updated)
- Indexed by `conversationId/channelId + createdAt`
- Supports `contentType`: text, system, file
- System messages for events (user joined, etc.)

## WebSocket Rules

### Connection

- Authenticate on connect
- Disconnect on token expiration with reason `TOKEN_EXPIRED`
- Client responsible for reconnecting with fresh token

### Rooms

- One room per conversation: `conversation:{id}`
- One room per channel: `channel:{id}`
- User joins room when opening conversation/channel
- Messages broadcast to room only

### Presence

- In-memory tracking (not persisted)
- Supports multiple connections per user (tabs/devices)
- Future: Redis for horizontal scaling

## API Rules

### REST Endpoints

- Used for initial data loading
- Always require chat token in Authorization header
- Follow standard HTTP status codes

### WebSocket Events

- Used for real-time operations
- All events require authenticated socket
- Errors returned via `error` event

## Database Rules

### MongoDB Collections

1. `conversations` - Index: `participantsKey` (unique), `participants`
2. `channels` - Index: `legalEntityId` (unique)
3. `messages` - Index: `conversationId + createdAt`, `channelId + createdAt`

### Query Patterns

- Always use cursor-based pagination
- Default limit: 50 messages
- Sort by `createdAt DESC` (newest first)

## Security Rules

1. **Token Validation**: Every request/event must validate token
2. **Permission Check**: Every read/write must check permissions
3. **Internal API Key**: Main API communication uses shared secret
4. **No Direct DB Access**: Main API never directly queries chat DB

## Future Considerations

- **Horizontal Scaling**: Replace in-memory presence with Redis
- **File Attachments**: Add file upload service integration
- **Read Receipts**: Track message read status
- **Typing Indicators**: Real-time typing notifications

