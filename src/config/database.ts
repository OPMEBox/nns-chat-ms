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

async function createIndexes(database: Db): Promise<void> {
  console.log('Creating database indexes...');
  
  // Conversations indexes
  const conversations = database.collection('conversations');
  await conversations.createIndex({ participantsKey: 1 }, { unique: true });
  await conversations.createIndex({ participants: 1 });
  await conversations.createIndex({ updatedAt: -1 });
  
  // Channels indexes
  const channels = database.collection('channels');
  await channels.createIndex({ legalEntityId: 1 }, { unique: true });
  await channels.createIndex({ updatedAt: -1 });
  
  // Messages indexes
  const messages = database.collection('messages');
  await messages.createIndex({ conversationId: 1, createdAt: -1 });
  await messages.createIndex({ channelId: 1, createdAt: -1 });
  
  console.log('Database indexes created successfully');
}

