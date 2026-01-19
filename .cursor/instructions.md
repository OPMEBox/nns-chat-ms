# Chat Microservice - Developer Guide

Real-time chat microservice for the NNS platform, supporting direct conversations and LegalEntity inbox channels.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Database**: MongoDB
- **Auth**: JWT tokens

## Quick Start

### Development

```bash
# Install dependencies
yarn install

# Start MongoDB (Docker)
docker compose up mongo -d

# Run in dev mode (hot reload)
yarn dev
```

### Production

```bash
yarn build
yarn start
```

### Docker (Full Stack)

```bash
docker compose up -d
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAT_PORT` | Server port | `3001` |
| `CHAT_JWT_SECRET` | JWT secret for chat tokens | Required in production |
| `CHAT_JWT_EXPIRES_IN` | Token expiration | `24h` |
| `MONGODB_URI` | MongoDB connection string | Required in production |
| `INTERNAL_API_KEY` | Key for Main API communication | `internal-key` |
| `MAIN_API_URL` | Main API base URL | `http://localhost:3333` |

---

## Authentication Flow

This service is **independent** from the Main API. Users authenticate with Main API first, then Main API generates a chat token.

```
Main API owns authentication → Chat Service trusts Main API-issued tokens
```

### Token Generation Flow

1. User authenticates with Main API → receives Main JWT
2. Client requests chat token from Main API (`POST /chat/token`)
3. Main API calls Chat Service (`POST /auth/internal/token`) with internal API key
4. Chat Service returns chat-specific JWT
5. Client connects to WebSocket with chat token

### Chat Token Payload

```typescript
{
  chatUserId: string;      // User ID from Main API
  username?: string;       // Display name
  roles: string[];         // ['ADMIN'] or ['SUPPLIER', etc.]
  legalEntities: [{
    id: string;
    name?: string;
    canRead: boolean;
    canWrite: boolean;
  }];
  iat: number;             // Issued at
  exp: number;             // Expiration
}
```

---

## REST API Reference

All endpoints (except internal) require `Authorization: Bearer <chatToken>` header.

### Authentication (Internal)

#### Generate Chat Token
```http
POST /auth/internal/token
X-Internal-API-Key: <internalApiKey>
Content-Type: application/json

{
  "userId": "user123",
  "username": "John Doe",
  "roles": ["SUPPLIER"],
  "legalEntities": [
    { "id": "le123", "name": "Acme Corp", "canRead": true, "canWrite": true }
  ]
}
```

**Response:**
```json
{
  "chatToken": "eyJhbG...",
  "expiresIn": 86400
}
```

#### Verify Token
```http
POST /auth/verify
Content-Type: application/json

{ "token": "eyJhbG..." }
```

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/conversations` | List user's conversations |
| `GET` | `/conversations/:id` | Get conversation details |
| `POST` | `/conversations` | Start new conversation (`{ targetUserId }`) |
| `GET` | `/conversations/:id/messages` | Get messages (`?cursor=<ISO>&limit=50`) |

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/channels` | List accessible channels |
| `GET` | `/channels/:id` | Get channel details |
| `GET` | `/channels/legal-entity/:id` | Get/create channel by legal entity |
| `GET` | `/channels/:id/messages` | Get messages (`?cursor=<ISO>&limit=50`) |
| `GET` | `/channels/:id/permissions` | Check user permissions |

### Health Check

```http
GET /health
→ { "status": "ok", "service": "chat-microservice" }
```

---

## WebSocket Events

Connect with: `io(CHAT_URL, { auth: { token: chatToken } })`

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `conversation:join` | `{ conversationId }` | Join conversation room |
| `conversation:start` | `{ targetUserId }` | Start new conversation |
| `channel:join` | `{ legalEntityId, legalEntityName? }` | Join channel room |
| `message:send` | `{ target, targetId, content }` | Send message |
| `messages:get` | `{ target, targetId, cursor?, limit? }` | Load more messages |
| `conversations:list` | - | Get conversations list |
| `channels:list` | - | Get channels list |

**`message:send` payload:**
```typescript
{
  target: 'conversation' | 'channel';
  targetId: string;  // conversationId or channelId
  content: string;
}
```

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `conversation:joined` | `{ conversationId, messages, hasMore }` | Joined conversation |
| `conversation:started` | `{ conversation, messages, hasMore }` | New conversation created |
| `channel:joined` | `{ channel, messages, hasMore }` | Joined channel |
| `message:new` | `{ message }` | New message received |
| `messages:loaded` | `{ target, targetId, messages, hasMore, nextCursor }` | Paginated messages |
| `conversations:listed` | `{ conversations }` | Conversations list |
| `channels:listed` | `{ channels }` | Channels list |
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId }` | User went offline |
| `error` | `{ code, message }` | Error occurred |

### Error Codes

- `UNAUTHORIZED` - Invalid/missing token
- `FORBIDDEN` - No permission for operation
- `NOT_FOUND` - Resource not found
- `INVALID_PAYLOAD` - Missing/invalid fields
- `INTERNAL_ERROR` - Server error

---

## Permission Model

### User Types

| Role | Channel Access | Direct Conversations |
|------|----------------|---------------------|
| **ADMIN** | All channels (read/write) | Can message anyone |
| **SUPPLIER** | Only permitted legal entities | Can message ADMINs |

### Channel Permissions

Permissions are embedded in the chat token per legal entity:

```typescript
legalEntities: [
  { id: "le123", canRead: true, canWrite: true },   // Full access
  { id: "le456", canRead: true, canWrite: false },  // Read-only
]
```

- `canRead` → Can view channel messages
- `canWrite` → Can send messages to channel

**Important:** Permissions cannot be modified within chat service. They must be updated in Main API.

---

## Architecture

```
src/
├── domain/           # Business entities and repository interfaces
│   ├── entities/     # Message, Conversation, Channel
│   └── repositories/ # Interface definitions
├── application/      # Services and business logic
│   ├── auth/         # ChatTokenService
│   └── services/     # Message, Conversation, Channel services
├── infrastructure/   # External implementations
│   ├── database/     # MongoDB repositories
│   └── websocket/    # Socket.io server, presence, auth middleware
└── routes/           # REST API endpoints
```

### Data Model

**Conversations** (Direct 1-1)
- Unique by sorted `participantsKey`: `"userA:userB"` (alphabetical)
- Always between exactly 2 users

**Channels** (LegalEntity Inbox)
- One channel per legal entity
- Unique by `legalEntityId`

**Messages**
- Append-only (never updated)
- Content types: `text`, `system`, `file`
- Indexed by `conversationId/channelId + createdAt`

### MongoDB Collections

| Collection | Key Indexes |
|------------|-------------|
| `conversations` | `participantsKey` (unique), `participants` |
| `channels` | `legalEntityId` (unique) |
| `messages` | `conversationId + createdAt`, `channelId + createdAt` |

### Pagination

All message queries use **cursor-based pagination**:
- Default limit: 50 messages
- Sort: `createdAt DESC` (newest first)
- Cursor: ISO date string of last message

---

## Example: Client Integration

```typescript
import { io } from 'socket.io-client';

// 1. Get chat token from Main API
const { chatToken } = await fetch('/api/chat/token', {
  headers: { Authorization: `Bearer ${mainToken}` }
}).then(r => r.json());

// 2. Connect to chat service
const socket = io('http://localhost:3001', {
  auth: { token: chatToken }
});

// 3. Listen for events
socket.on('message:new', ({ message }) => {
  console.log('New message:', message);
});

socket.on('error', ({ code, message }) => {
  console.error(`Error [${code}]:`, message);
});

// 4. Join a channel
socket.emit('channel:join', {
  legalEntityId: 'le123',
  legalEntityName: 'Acme Corp'
});

socket.on('channel:joined', ({ channel, messages, hasMore }) => {
  console.log('Joined channel:', channel);
  console.log('Recent messages:', messages);
});

// 5. Send a message
socket.emit('message:send', {
  target: 'channel',
  targetId: channel._id,
  content: 'Hello from the client!'
});

// 6. Load more messages (pagination)
socket.emit('messages:get', {
  target: 'channel',
  targetId: channel._id,
  cursor: messages[messages.length - 1].createdAt,
  limit: 50
});
```

---

## Key Rules

1. **Token Validation**: Every request/event validates the token
2. **Permission Check**: Every read/write checks permissions from token
3. **Internal API Key**: Main API communication requires `X-Internal-API-Key` header
4. **No Direct DB Access**: Main API never directly queries chat DB
5. **Presence is In-Memory**: Not persisted (future: Redis for horizontal scaling)
