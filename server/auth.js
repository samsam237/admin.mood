import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export function createToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  req.admin = payload;
  next();
}

export async function login(username, password) {
  const db = getDb();
  const admin = db.prepare('SELECT id, username, password_hash FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return null;
  }
  return { username: admin.username, token: createToken(admin.username) };
}
