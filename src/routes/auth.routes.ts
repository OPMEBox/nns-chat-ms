import { Router, Request, Response } from 'express';
import { chatTokenService, GenerateTokenInput, LegalEntityPermission } from '../application/auth/ChatTokenService';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

export const authRoutes = Router();

// Internal API key middleware for Main API communication
function validateInternalApiKey(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-internal-api-key'] as string;
  if (!apiKey || apiKey !== env.internalApiKey) {
    res.status(401).json({ error: 'Invalid internal API key' });
    return;
  }

  next();
}

interface GenerateTokenBody {
  userId: string;
  username?: string;
  roles: string[];
  legalEntities: Array<{
    id: string;
    name?: string;
    canRead: boolean;
    canWrite: boolean;
  }>;
}

authRoutes.post('/create/token', validateInternalApiKey, (req: Request, res: Response) => {
  try {
    const {token} = req.body;
    console.log('token ====> ', token);
    console.log('process.env.MAIN_API_JWT_SECRET ====> ', process.env.MAIN_API_JWT_SECRET);
    console.log('req.headers ====> ', req.headers);

    const decoded = jwt.verify(token, process.env.MAIN_API_JWT_SECRET as string);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const createdToken = chatTokenService.generateToken({
      userId: decoded.userId,
      username: decoded.username,
      roles: decoded.roles,
      legalEntities: decoded.legalEntities,
    });

    res.json({ token: createdToken });
  } catch (error) {
    console.error('Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

/**
 * POST /auth/internal/token
 * Internal endpoint for Main API to generate chat tokens
 * Protected by internal API key
 */
authRoutes.post('/internal/token', validateInternalApiKey, (req: Request, res: Response) => {
  try {
    const body = req.body as GenerateTokenBody;

    if (!body.userId || !body.roles) {
      res.status(400).json({ error: 'userId and roles are required' });
      return;
    }

    const input: GenerateTokenInput = {
      userId: body.userId,
      username: body.username,
      roles: body.roles,
      legalEntities: body.legalEntities || [],
    };

    const token = chatTokenService.generateToken(input);

    // Calculate expiration time
    const expiresInMs = parseExpiration(env.jwtExpiresIn);

    res.json({
      chatToken: token,
      expiresIn: expiresInMs / 1000, // Return in seconds
    });
  } catch (error) {
    console.error('Error generating chat token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

/**
 * POST /auth/verify
 * Verify a chat token (useful for debugging/health checks)
 */
authRoutes.post('/verify', (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token: string };

    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    const user = chatTokenService.verifyToken(token);

    if (!user) {
      res.status(401).json({ valid: false, error: 'Invalid or expired token' });
      return;
    }

    res.json({ valid: true, user });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Helper to parse expiration string (e.g., "24h", "7d")
function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // Default 24 hours
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

