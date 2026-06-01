# Prompt 04 — Routes d'ingestion (API publique Flutter)

## Contexte
`mood-admin` reçoit des données de l'app Flutter via des endpoints publics (sans auth admin). Ce prompt crée les routes `POST /api/users`, `POST /api/events`, `POST /api/stats`.

## Prérequis
- Prompts 01, 02, 03 complétés
- Prisma schema appliqué (tables `app_users`, `events`, `daily_stats` existent)

## Instructions

### `server/src/routes/ingestion.ts`

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const userSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  email: z.string().email().optional(),
});

const eventSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const statsSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  water: z.number().int().min(0).default(0),
  movements: z.number().int().min(0).default(0),
  goalsReached: z.boolean().default(false),
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

router.post('/users', async (req: Request, res: Response): Promise<void> => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, email } = parsed.data;

  try {
    await prisma.appUser.upsert({
      where: { userId },
      create: { userId, email },
      update: { email: email ?? undefined },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ingestion/users]', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ─── POST /api/events ─────────────────────────────────────────────────────────

router.post('/events', async (req: Request, res: Response): Promise<void> => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, type, payload, timestamp } = parsed.data;

  try {
    // S'assurer que l'utilisateur existe (créer silencieusement si inconnu)
    await prisma.appUser.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await prisma.event.create({
      data: {
        userId,
        type,
        payload: payload ?? undefined,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[ingestion/events]', err);
    res.status(500).json({ error: 'Failed to store event' });
  }
});

// ─── POST /api/stats ──────────────────────────────────────────────────────────

router.post('/stats', async (req: Request, res: Response): Promise<void> => {
  const parsed = statsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, date, water, movements, goalsReached } = parsed.data;

  try {
    await prisma.appUser.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // Upsert : idempotent par (userId, date)
    await prisma.dailyStat.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: { userId, date: new Date(date), water, movements, goalsReached },
      update: { water, movements, goalsReached },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[ingestion/stats]', err);
    res.status(500).json({ error: 'Failed to store stats' });
  }
});

export default router;
```

### Monter dans `server/src/index.ts`

Les routes d'ingestion sont **publiques** (avant le middleware auth) :

```typescript
import ingestionRouter from './routes/ingestion.js';

// Après les routes auth, AVANT le authMiddleware global
app.use('/api', ingestionRouter);

// Ensuite le authMiddleware pour le reste
app.use('/api', authMiddleware);
```

## Validation
- [ ] `POST /api/users` avec `{"userId":"test_1","email":"a@b.com"}` retourne `{"ok":true}`
- [ ] Relancer la même requête → pas de doublon, retourne `{"ok":true}`
- [ ] `POST /api/events` avec `{"userId":"test_1","type":"screen_view"}` retourne `{"ok":true}`
- [ ] `POST /api/stats` avec `{"userId":"test_1","date":"2026-05-30","water":8,"movements":45,"goalsReached":true}` retourne `{"ok":true}`
- [ ] Relancer `POST /api/stats` avec la même date → mise à jour, pas d'erreur de contrainte unique
- [ ] Body invalide retourne `400` avec les détails Zod

## Pièges à éviter
- `POST /api/users`, `/events`, `/stats` doivent être montés **avant** `app.use('/api', authMiddleware)` — sinon l'app Flutter reçoit des 401
- L'upsert silencieux de l'utilisateur dans les routes events/stats évite les FK violations si l'app Flutter envoie des events avant d'appeler `POST /api/users`
- `date: new Date(date)` pour `@db.Date` — ne pas passer la string directement (Prisma la convertit mais c'est plus explicite avec `new Date`)
- La contrainte `@@unique([userId, date])` génère un nom composé `userId_date` dans Prisma — utiliser exactement `{ userId_date: { userId, date: new Date(date) } }`
