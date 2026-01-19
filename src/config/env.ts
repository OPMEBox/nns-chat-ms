import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.CHAT_PORT || '3001', 10),
  jwtSecret: process.env.CHAT_JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.CHAT_JWT_EXPIRES_IN || '24h',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat',
  internalApiKey: process.env.INTERNAL_API_KEY || 'internal-key',
  mainApiUrl: process.env.MAIN_API_URL || 'http://localhost:3333',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
export function validateEnv(): void {
  const required = ['CHAT_JWT_SECRET', 'MONGODB_URI'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && env.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

