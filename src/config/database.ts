import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(env.mongodbUri);
    await client.connect();
    db = client.db();
    
    console.log('Connected to MongoDB');
    
    // Create indexes
    await createIndexes(db);
    
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

async function createIndexIfNotExists(
  collection: ReturnType<Db['collection']>,
  key: Record<string, 1 | -1>,
  options: { unique?: boolean; name: string },
): Promise<void> {
  const existingNames = (await collection.indexes()).map((idx) => idx.name);
  if (existingNames.includes(options.name)) {
    return;
  }
  await collection.createIndex(key, options);
}

async function createIndexes(database: Db): Promise<void> {
  console.log('Creating database indexes...');

  const conversations = database.collection('conversations');
  await createIndexIfNotExists(
    conversations,
    { participantsKey: 1 },
    { unique: true, name: 'conversations_participantsKey_unique' },
  );
  await createIndexIfNotExists(conversations, { participants: 1 }, { name: 'conversations_participants_1' });
  await createIndexIfNotExists(conversations, { updatedAt: -1 }, { name: 'conversations_updatedAt_-1' });

  const channels = database.collection('channels');
  // Drop legacy unique index on legalEntityId if it exists to allow multiple
  // channels per legal entity (e.g. per-auctionBid channels)
  const channelIndexes = await channels.indexes();
  const legacyUniqueIndex = channelIndexes.find(
    (idx) => idx.name === 'channels_legalEntityId_unique'
  );
  if (legacyUniqueIndex) {
    await channels.dropIndex('channels_legalEntityId_unique');
  }
  await createIndexIfNotExists(
    channels,
    { legalEntityId: 1 },
    { name: 'channels_legalEntityId_1' },
  );
  await createIndexIfNotExists(channels, { updatedAt: -1 }, { name: 'channels_updatedAt_-1' });

  const messages = database.collection('messages');
  await createIndexIfNotExists(
    messages,
    { conversationId: 1, createdAt: -1 },
    { name: 'messages_conversationId_1_createdAt_-1' },
  );
  await createIndexIfNotExists(
    messages,
    { channelId: 1, createdAt: -1 },
    { name: 'messages_channelId_1_createdAt_-1' },
  );

  console.log('Database indexes created successfully');
}

