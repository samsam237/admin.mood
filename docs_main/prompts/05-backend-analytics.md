# Prompt 05 — Routes analytics, KPIs, utilisateurs

## Contexte
Backend `mood-admin` : routes protégées pour le dashboard analytics. Ce prompt crée `/api/overview`, `/api/kpis`, `/api/analytics`, `/api/retention`, `/api/users/segments`, `/api/users`, `/api/admin/users/:id`, `/api/events`, `/api/events/trends`, `/api/stats`.

## Prérequis
- Prompts 01 à 04 complétés
- Données en base (ou seed de test)

## Instructions

### `server/src/routes/analytics.ts`

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { startOfDay, subDays } from 'date-fns'; // npm install date-fns

const router = Router();

const daysSchema = z.coerce.number().min(1).max(365).default(30);

// ─── GET /api/overview ────────────────────────────────────────────────────────

router.get('/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const yesterday = subDays(now, 1);

    const [totalUsers, totalEvents, activeToday, newUsersToday, topEvents] = await Promise.all([
      prisma.appUser.count(),
      prisma.event.count(),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT user_id) as count FROM events
        WHERE timestamp >= ${yesterday}
      `,
      prisma.appUser.count({ where: { createdAt: { gte: startOfDay(now) } } }),
      prisma.$queryRaw<{ type: string; count: bigint }[]>`
        SELECT type, COUNT(*) as count FROM events
        WHERE timestamp >= ${subDays(now, 7)}
        GROUP BY type ORDER BY count DESC LIMIT 5
      `,
    ]);

    res.json({
      totalUsers,
      totalEvents,
      activeToday: Number(activeToday[0]?.count ?? 0),
      newUsersToday,
      topEventTypes: topEvents.map((e) => ({ type: e.type, count: Number(e.count) })),
    });
  } catch (err) {
    console.error('[analytics/overview]', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ─── GET /api/kpis?days=30 ───────────────────────────────────────────────────

router.get('/kpis', async (req: Request, res: Response): Promise<void> => {
  const days = daysSchema.parse(req.query.days);
  const now = new Date();
  const periodStart = subDays(now, days);
  const prevStart = subDays(now, days * 2);

  try {
    const [dauCur, dauPrev, wauCur, wauPrev, mauCur, mauPrev, goalsCur, goalsPrev] =
      await Promise.all([
        // DAU courant
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 1)}`,
        // DAU précédent (J-2)
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 2)} AND timestamp < ${subDays(now, 1)}`,
        // WAU courant
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 7)}`,
        // WAU précédent
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 14)} AND timestamp < ${subDays(now, 7)}`,
        // MAU courant
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 30)}`,
        // MAU précédent
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 60)} AND timestamp < ${subDays(now, 30)}`,
        // Goals courant
        prisma.$queryRaw<[{ rate: number }]>`
          SELECT COALESCE(AVG(CASE WHEN goals_reached THEN 100.0 ELSE 0 END), 0) as rate
          FROM daily_stats WHERE date >= ${periodStart}`,
        // Goals précédent
        prisma.$queryRaw<[{ rate: number }]>`
          SELECT COALESCE(AVG(CASE WHEN goals_reached THEN 100.0 ELSE 0 END), 0) as rate
          FROM daily_stats WHERE date >= ${prevStart} AND date < ${periodStart}`,
      ]);

    const toNum = (r: [{ count: bigint }]) => Number(r[0]?.count ?? 0);
    const trend = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100 * 10) / 10;

    const dau = toNum(dauCur);
    const mau = toNum(mauCur);

    res.json({
      dau: { value: dau, trend: trend(dau, toNum(dauPrev)) },
      wau: { value: toNum(wauCur), trend: trend(toNum(wauCur), toNum(wauPrev)) },
      mau: { value: mau, trend: trend(mau, toNum(mauPrev)) },
      stickiness: { value: mau > 0 ? Math.round((dau / mau) * 100 * 10) / 10 : 0, trend: 0 },
      goalsRate: {
        value: Math.round(Number(goalsCur[0]?.rate ?? 0) * 10) / 10,
        trend: trend(Number(goalsCur[0]?.rate ?? 0), Number(goalsPrev[0]?.rate ?? 0)),
      },
    });
  } catch (err) {
    console.error('[analytics/kpis]', err);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// ─── GET /api/analytics?days=30 ──────────────────────────────────────────────

router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  const days = daysSchema.parse(req.query.days);
  const since = subDays(new Date(), days);

  try {
    const [dauSeries, eventSeries, waterSeries] = await Promise.all([
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', timestamp) as date, COUNT(DISTINCT user_id) as count
        FROM events WHERE timestamp >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', timestamp) as date, COUNT(*) as count
        FROM events WHERE timestamp >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ date: Date; avg: number }[]>`
        SELECT date, AVG(water) as avg
        FROM daily_stats WHERE date >= ${since}
        GROUP BY date ORDER BY date`,
    ]);

    res.json({
      dailyActiveUsers: dauSeries.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      dailyEvents: eventSeries.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      dailyWater: waterSeries.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        avg: Math.round(Number(r.avg) * 10) / 10,
      })),
    });
  } catch (err) {
    console.error('[analytics/analytics]', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ─── GET /api/retention ───────────────────────────────────────────────────────

router.get('/retention', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cohortSince = subDays(new Date(), 90);

    const [d1, d7, d30, cohortTotal] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT e.user_id) as count FROM app_users u
        JOIN events e ON e.user_id = u.user_id
          AND e.timestamp >= u.created_at + INTERVAL '1 day'
          AND e.timestamp < u.created_at + INTERVAL '2 days'
        WHERE u.created_at >= ${cohortSince}`,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT e.user_id) as count FROM app_users u
        JOIN events e ON e.user_id = u.user_id
          AND e.timestamp >= u.created_at + INTERVAL '7 days'
          AND e.timestamp < u.created_at + INTERVAL '8 days'
        WHERE u.created_at >= ${cohortSince}`,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT e.user_id) as count FROM app_users u
        JOIN events e ON e.user_id = u.user_id
          AND e.timestamp >= u.created_at + INTERVAL '30 days'
          AND e.timestamp < u.created_at + INTERVAL '31 days'
        WHERE u.created_at >= ${cohortSince}`,
      prisma.appUser.count({ where: { createdAt: { gte: cohortSince } } }),
    ]);

    const pct = (n: bigint) =>
      cohortTotal > 0 ? Math.round((Number(n) / cohortTotal) * 100 * 10) / 10 : 0;

    res.json({
      d1: pct(d1[0]?.count ?? 0n),
      d7: pct(d7[0]?.count ?? 0n),
      d30: pct(d30[0]?.count ?? 0n),
      cohortSize: cohortTotal,
    });
  } catch (err) {
    console.error('[analytics/retention]', err);
    res.status(500).json({ error: 'Failed to fetch retention' });
  }
});

export default router;
```

### `server/src/routes/users.ts`

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { subDays } from 'date-fns';

const router = Router();

// GET /api/users/segments
router.get('/users/segments', async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  try {
    const [active, dormant, total] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT user_id) as count FROM events WHERE timestamp >= ${subDays(now, 7)}`,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT user_id) as count FROM events
        WHERE timestamp >= ${subDays(now, 30)} AND timestamp < ${subDays(now, 7)}`,
      prisma.appUser.count(),
    ]);
    const activeN = Number(active[0]?.count ?? 0);
    const dormantN = Number(dormant[0]?.count ?? 0);
    res.json({ active: activeN, dormant: dormantN, churned: total - activeN - dormantN });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

// GET /api/users
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    segment: z.enum(['active', 'dormant', 'churned']).optional(),
    q: z.string().optional(),
  });
  const { page, limit, segment, q } = schema.parse(req.query);
  const skip = (page - 1) * limit;
  const now = new Date();

  try {
    // Sous-requête pour filtrer par segment
    let segmentFilter = '';
    if (segment === 'active') {
      segmentFilter = `AND u.user_id IN (SELECT DISTINCT user_id FROM events WHERE timestamp >= '${subDays(now, 7).toISOString()}')`;
    } else if (segment === 'dormant') {
      segmentFilter = `AND u.user_id IN (SELECT DISTINCT user_id FROM events WHERE timestamp >= '${subDays(now, 30).toISOString()}' AND timestamp < '${subDays(now, 7).toISOString()}')`;
    } else if (segment === 'churned') {
      segmentFilter = `AND u.user_id NOT IN (SELECT DISTINCT user_id FROM events WHERE timestamp >= '${subDays(now, 30).toISOString()}')`;
    }

    const searchFilter = q
      ? `AND (u.email ILIKE '%${q.replace(/'/g, "''")}%' OR u.user_id ILIKE '%${q.replace(/'/g, "''")}%')`
      : '';

    const [users, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT u.id, u.user_id, u.email, u.created_at,
               MAX(e.timestamp) as last_active_at,
               COUNT(e.id) as event_count
        FROM app_users u
        LEFT JOIN events e ON e.user_id = u.user_id
        WHERE 1=1 ${segmentFilter} ${searchFilter}
        GROUP BY u.id, u.user_id, u.email, u.created_at
        ORDER BY last_active_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${skip}
      `),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count FROM app_users u WHERE 1=1 ${segmentFilter} ${searchFilter}
      `),
    ]);

    res.json({
      data: users.map((u) => ({
        userId: u.user_id,
        email: u.email,
        createdAt: u.created_at,
        lastActiveAt: u.last_active_at,
        eventCount: Number(u.event_count),
      })),
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error('[users/list]', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:userId
router.get('/admin/users/:userId', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const days = z.coerce.number().default(30).parse(req.query.days);
  const since = subDays(new Date(), days);

  try {
    const [user, recentEvents, history, backups] = await Promise.all([
      prisma.appUser.findUnique({ where: { userId } }),
      prisma.event.findMany({
        where: { userId, timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: { type: true, timestamp: true, payload: true },
      }),
      prisma.dailyStat.findMany({
        where: { userId, date: { gte: since } },
        orderBy: { date: 'desc' },
      }),
      prisma.userBackupMeta.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const avgWater = history.length
      ? history.reduce((s, r) => s + r.water, 0) / history.length
      : 0;
    const goalsRate = history.length
      ? (history.filter((r) => r.goalsReached).length / history.length) * 100
      : 0;

    res.json({
      user: { userId: user.userId, email: user.email, createdAt: user.createdAt },
      stats: {
        avgWater: Math.round(avgWater * 10) / 10,
        goalsRate: Math.round(goalsRate * 10) / 10,
        totalDays: history.length,
      },
      history: history.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        water: r.water,
        movements: r.movements,
        goalsReached: r.goalsReached,
      })),
      recentEvents,
      backups,
    });
  } catch (err) {
    console.error('[users/detail]', err);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

export default router;
```

### `server/src/routes/events.ts`

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { subDays } from 'date-fns';

const router = Router();

// GET /api/events
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(200).default(50),
    type: z.string().optional(),
    userId: z.string().optional(),
    days: z.coerce.number().optional(),
  });
  const { page, limit, type, userId, days } = schema.parse(req.query);
  const skip = (page - 1) * limit;
  const since = days ? subDays(new Date(), days) : undefined;

  try {
    const where = {
      ...(type && { type }),
      ...(userId && { userId }),
      ...(since && { timestamp: { gte: since } }),
    };
    const [data, total] = await Promise.all([
      prisma.event.findMany({ where, skip, take: limit, orderBy: { timestamp: 'desc' } }),
      prisma.event.count({ where }),
    ]);
    res.json({ data, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/trends
router.get('/events/trends', async (req: Request, res: Response): Promise<void> => {
  const days = z.coerce.number().default(30).parse(req.query.days);
  const since = subDays(new Date(), days);

  try {
    const rows = await prisma.$queryRaw<{ date: Date; type: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', timestamp) as date, type, COUNT(*) as count
      FROM events WHERE timestamp >= ${since}
      GROUP BY 1, 2 ORDER BY 1
    `;

    // Pivot : { date, type1: N, type2: N, ... }
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const d = row.date.toISOString().slice(0, 10);
      byDate[d] = byDate[d] ?? { date: d };
      byDate[d][row.type] = Number(row.count);
    }

    res.json(Object.values(byDate));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event trends' });
  }
});

export default router;
```

### Monter les routes dans `index.ts`

```typescript
import analyticsRouter from './routes/analytics.js';
import usersRouter from './routes/users.js';
import eventsRouter from './routes/events.js';

// Après authMiddleware
app.use('/api', analyticsRouter);
app.use('/api', usersRouter);
app.use('/api', eventsRouter);
```

## Validation
- [ ] `GET /api/overview` retourne `totalUsers`, `totalEvents`, etc.
- [ ] `GET /api/kpis?days=30` retourne DAU, WAU, MAU avec tendance
- [ ] `GET /api/retention` retourne `{ d1, d7, d30, cohortSize }`
- [ ] `GET /api/users?segment=active` retourne uniquement les actifs
- [ ] `GET /api/events/trends?days=7` retourne un tableau avec les types en colonnes
- [ ] Aucune valeur `BigInt` brute dans les réponses JSON

## Pièges à éviter
- `$queryRaw` retourne des `BigInt` — toujours convertir avec `Number()`
- `DATE_TRUNC('day', timestamp)` retourne un objet `Date` dans Prisma — appeler `.toISOString().slice(0, 10)` pour avoir `YYYY-MM-DD`
- `$queryRawUnsafe` pour les requêtes avec interpolation dynamique (segment filter) — vérifier l'absence d'injection SQL en nettoyant les inputs au préalable avec Zod
- Installer `date-fns` : `cd server && npm install date-fns`
