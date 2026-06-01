# Prompt 06 — Alertes automatiques + export CSV

## Contexte
Backend `mood-admin` : système d'alertes automatiques (vérification horaire) et routes d'export CSV. Ce prompt crée `alertChecker.ts`, `routes/alerts.ts` et `routes/export.ts`.

## Prérequis
- Prompts 01 à 05 complétés
- Tables `alerts`, `app_users`, `events`, `daily_stats` en base

## Instructions

### `server/src/alertChecker.ts`

```typescript
import { prisma } from './prisma.js';
import { subDays, startOfDay } from 'date-fns';

type AlertType = 'no_new_users' | 'low_retention' | 'no_activity';

async function shouldCreateAlert(type: AlertType): Promise<boolean> {
  const today = startOfDay(new Date());
  const existing = await prisma.alert.findFirst({
    where: {
      type,
      isRead: false,
      triggeredAt: { gte: today },
    },
  });
  return !existing;
}

async function checkNoNewUsers(): Promise<void> {
  const threshold = subDays(new Date(), 2);
  const count = await prisma.appUser.count({ where: { createdAt: { gte: threshold } } });
  if (count === 0 && await shouldCreateAlert('no_new_users')) {
    await prisma.alert.create({
      data: {
        type: 'no_new_users',
        message: 'Aucun nouvel utilisateur inscrit depuis 48 heures.',
        threshold: 0,
      },
    });
    console.log('[alertChecker] Alert created: no_new_users');
  }
}

async function checkLowRetention(): Promise<void> {
  const threshold = 30;
  const cohortSince = subDays(new Date(), 60);

  const [retained, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT e.user_id) as count FROM app_users u
      JOIN events e ON e.user_id = u.user_id
        AND e.timestamp >= u.created_at + INTERVAL '7 days'
        AND e.timestamp < u.created_at + INTERVAL '8 days'
      WHERE u.created_at >= ${cohortSince}`,
    prisma.appUser.count({ where: { createdAt: { gte: cohortSince } } }),
  ]);

  if (total === 0) return;
  const rate = (Number(retained[0]?.count ?? 0) / total) * 100;

  if (rate < threshold && await shouldCreateAlert('low_retention')) {
    await prisma.alert.create({
      data: {
        type: 'low_retention',
        message: `Rétention J7 à ${rate.toFixed(1)}% — seuil de ${threshold}% non atteint.`,
        threshold,
      },
    });
    console.log(`[alertChecker] Alert created: low_retention (${rate.toFixed(1)}%)`);
  }
}

async function checkNoActivity(): Promise<void> {
  const since = subDays(new Date(), 1);
  const count = await prisma.event.count({ where: { timestamp: { gte: since } } });
  if (count === 0 && await shouldCreateAlert('no_activity')) {
    await prisma.alert.create({
      data: {
        type: 'no_activity',
        message: 'Aucun événement enregistré depuis 24 heures.',
        threshold: 0,
      },
    });
    console.log('[alertChecker] Alert created: no_activity');
  }
}

export async function runAlertChecker(): Promise<void> {
  try {
    await Promise.all([checkNoNewUsers(), checkLowRetention(), checkNoActivity()]);
  } catch (err) {
    console.error('[alertChecker] Error:', err);
  }
}

export function startAlertChecker(): void {
  runAlertChecker(); // run immédiatement au démarrage
  setInterval(runAlertChecker, 60 * 60 * 1000); // puis toutes les heures
  console.log('[alertChecker] Started (interval: 1h)');
}
```

### `server/src/routes/alerts.ts`

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

// GET /api/alerts — alertes non lues
router.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isRead: false },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PATCH /api/alerts/:id/read — acquitter
router.patch('/alerts/:id/read', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid alert id' });
    return;
  }
  try {
    await prisma.alert.update({ where: { id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Alert not found' });
  }
});

export default router;
```

### `server/src/routes/export.ts`

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { subDays } from 'date-fns';

const router = Router();

function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(',');
}

// GET /api/export/users
router.get('/export/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.write(toCsvRow(['userId', 'email', 'createdAt', 'updatedAt']) + '\n');
    for (const u of users) {
      res.write(toCsvRow([u.userId, u.email, u.createdAt.toISOString(), u.updatedAt.toISOString()]) + '\n');
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/events?days=30&type=screen_view
router.get('/export/events', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    days: z.coerce.number().optional(),
    type: z.string().optional(),
  });
  const { days, type } = schema.parse(req.query);
  const since = days ? subDays(new Date(), days) : undefined;

  try {
    const events = await prisma.event.findMany({
      where: {
        ...(type && { type }),
        ...(since && { timestamp: { gte: since } }),
      },
      orderBy: { timestamp: 'desc' },
      take: 100_000,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
    res.write(toCsvRow(['id', 'userId', 'type', 'timestamp']) + '\n');
    for (const e of events) {
      res.write(toCsvRow([e.id, e.userId, e.type, e.timestamp.toISOString()]) + '\n');
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/stats?days=30
router.get('/export/stats', async (req: Request, res: Response): Promise<void> => {
  const days = z.coerce.number().optional().parse(req.query.days);
  const since = days ? subDays(new Date(), days) : undefined;

  try {
    const stats = await prisma.dailyStat.findMany({
      where: since ? { date: { gte: since } } : undefined,
      orderBy: [{ date: 'desc' }, { userId: 'asc' }],
      take: 100_000,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="stats.csv"');
    res.write(toCsvRow(['userId', 'date', 'water', 'movements', 'goalsReached']) + '\n');
    for (const s of stats) {
      res.write(toCsvRow([s.userId, s.date.toISOString().slice(0, 10), s.water, s.movements, s.goalsReached]) + '\n');
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/report
router.get('/export/report', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, totalEvents] = await Promise.all([
      prisma.appUser.count(),
      prisma.event.count(),
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mood-report.csv"');

    res.write('# MOOD Admin Report\n');
    res.write(`# Generated: ${new Date().toISOString()}\n\n`);
    res.write('## Overview\n');
    res.write(toCsvRow(['metric', 'value']) + '\n');
    res.write(toCsvRow(['Total Users', totalUsers]) + '\n');
    res.write(toCsvRow(['Total Events', totalEvents]) + '\n\n');

    res.write('## Top Event Types (last 30 days)\n');
    const topTypes = await prisma.$queryRaw<{ type: string; count: bigint }[]>`
      SELECT type, COUNT(*) as count FROM events
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY type ORDER BY count DESC LIMIT 10
    `;
    res.write(toCsvRow(['type', 'count']) + '\n');
    for (const t of topTypes) {
      res.write(toCsvRow([t.type, Number(t.count)]) + '\n');
    }

    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Report generation failed' });
  }
});

export default router;
```

### Monter dans `index.ts` + démarrer alertChecker

```typescript
import alertsRouter from './routes/alerts.js';
import exportRouter from './routes/export.js';
import { startAlertChecker } from './alertChecker.js';

// Après authMiddleware
app.use('/api', alertsRouter);
app.use('/api', exportRouter);

// Au démarrage du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startAlertChecker();
});
```

## Validation
- [ ] `GET /api/alerts` retourne `[]` (pas d'alertes en dev si données récentes)
- [ ] `runAlertChecker()` manuellement crée des alertes si les conditions sont remplies
- [ ] `PATCH /api/alerts/1/read` marque l'alerte comme lue
- [ ] `GET /api/export/users` télécharge un fichier CSV valide
- [ ] Le CSV s'ouvre correctement dans Excel (vérifier les virgules et guillemets)

## Pièges à éviter
- `shouldCreateAlert` évite les doublons — ne pas supprimer cette vérification
- Pour les exports CSV, ne pas utiliser `res.json()` — utiliser `res.write()` + `res.end()` pour le streaming
- Les valeurs contenant des virgules doivent être entre guillemets (`toCsvRow` s'en charge)
- `startAlertChecker()` doit être appelé **après** `app.listen`, pas avant (risque de requêtes DB avant que l'app soit prête)
