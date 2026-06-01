import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { subDays, startOfDay } from 'date-fns';

const router = Router();

const daysSchema = z.coerce.number().min(1).max(365).default(30);

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

router.get('/kpis', async (req: Request, res: Response): Promise<void> => {
  const days = daysSchema.parse(req.query.days);
  const now = new Date();
  const periodStart = subDays(now, days);
  const prevStart = subDays(now, days * 2);

  try {
    const [dauCur, dauPrev, wauCur, wauPrev, mauCur, mauPrev, goalsCur, goalsPrev] =
      await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 1)}`,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 2)} AND timestamp < ${subDays(now, 1)}`,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 7)}`,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 14)} AND timestamp < ${subDays(now, 7)}`,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 30)}`,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM events
          WHERE timestamp >= ${subDays(now, 60)} AND timestamp < ${subDays(now, 30)}`,
        prisma.$queryRaw<[{ rate: number }]>`
          SELECT COALESCE(AVG(CASE WHEN goals_reached THEN 100.0 ELSE 0 END), 0) as rate
          FROM daily_stats WHERE date >= ${periodStart}`,
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
        date: r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date).slice(0, 10),
        avg: Math.round(Number(r.avg) * 10) / 10,
      })),
    });
  } catch (err) {
    console.error('[analytics/analytics]', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

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
