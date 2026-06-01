import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminJwtPayload } from './types/index';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export function signToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AdminJwtPayload {
  return jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminJwtPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    req.admin = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}
