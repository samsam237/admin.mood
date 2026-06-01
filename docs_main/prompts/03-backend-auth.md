# Prompt 03 — Auth backend (JWT + middleware)

## Contexte
Backend Express TypeScript pour `mood-admin`. Ce prompt implémente le système d'authentification : middleware JWT, route de login, et types partagés.

## Prérequis
- Prompts 01 et 02 complétés
- `server/src/prisma.ts` existe
- `bcryptjs` et `jsonwebtoken` installés

## Instructions

### 1. `server/src/types/index.ts`

```typescript
export interface AdminJwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  admin?: AdminJwtPayload;
}

// Pagination helper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// KPI avec tendance
export interface KpiMetric {
  value: number;
  trend: number; // % de variation vs période précédente
}
```

### 2. `server/src/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminJwtPayload } from './types/index.js';

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
```

### 3. `server/src/routes/auth.ts`

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { signToken } from '../auth.js';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const { username, password } = parsed.data;

  try {
    const admin = await prisma.admin.findUnique({ where: { username } });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ username: admin.username });
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### 4. Monter les routes dans `server/src/index.ts`

Ajouter après les imports et avant `app.listen` :

```typescript
import authRouter from './routes/auth.js';
import { authMiddleware } from './auth.js';

// Routes publiques
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: 'connected',
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Toutes les autres routes /api nécessitent auth
app.use('/api', authMiddleware);

// Routes protégées (à monter ici dans les prochains prompts)
// app.use('/api', analyticsRouter);
// ...
```

## Validation
- [ ] `POST http://localhost:3001/api/auth/login` avec `{"username":"admin","password":"changeme"}` retourne un token JWT
- [ ] `GET http://localhost:3001/api/health` retourne `{"status":"ok",...}` sans token
- [ ] `GET http://localhost:3001/api/analytics` sans token retourne `401`
- [ ] Token invalide retourne `401`

## Test rapide avec curl
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Appel protégé
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/health
```

## Pièges à éviter
- Ne jamais logger le mot de passe ou le token dans les `console.log`
- `bcrypt.compare` est asynchrone — utiliser `await`
- Les imports `.js` sont nécessaires en TypeScript ESM — si tu utilises CommonJS (le tsconfig ci-dessus), supprimer les `.js`
