import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { subDays } from 'date-fns';

const router = Router();

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
    console.error('[users/segments]', err);
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

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
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
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

router.get('/admin/users/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.params['userId'] as string;
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
    const avgMovements = history.length
      ? history.reduce((s, r) => s + r.movements, 0) / history.length
      : 0;
    const goalsRate = history.length
      ? (history.filter((r) => r.goalsReached).length / history.length) * 100
      : 0;

    res.json({
      user: { userId: user.userId, email: user.email, createdAt: user.createdAt },
      stats: {
        avgWater: Math.round(avgWater * 10) / 10,
        avgMovements: Math.round(avgMovements * 10) / 10,
        goalsRate: Math.round(goalsRate * 10) / 10,
        totalDays: history.length,
      },
      history: history.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
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

router.get('/admin/backups', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page:  z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(200).default(50),
  });
  const { page, limit } = schema.parse(req.query);
  const skip = (page - 1) * limit;
  try {
    const [data, total] = await Promise.all([
      prisma.userBackupMeta.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.userBackupMeta.count(),
    ]);
    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('[admin/backups]', err);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

router.post('/admin/backups', async (_req: Request, res: Response): Promise<void> => {
  res.json({ ok: true, message: 'Backup triggered (no-op)' });
});

export default router;
