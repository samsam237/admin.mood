import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
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

router.get('/export/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.write('﻿' + toCsvRow(['userId', 'email', 'createdAt', 'updatedAt']) + '\n');
    for (const u of users) {
      res.write(toCsvRow([u.userId, u.email, u.createdAt.toISOString(), u.updatedAt.toISOString()]) + '\n');
    }
    res.end();
  } catch (err) {
    console.error('[export/users]', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

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
    res.write('﻿' + toCsvRow(['id', 'userId', 'type', 'timestamp']) + '\n');
    for (const e of events) {
      res.write(toCsvRow([e.id, e.userId, e.type, e.timestamp.toISOString()]) + '\n');
    }
    res.end();
  } catch (err) {
    console.error('[export/events]', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

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
    res.write('﻿' + toCsvRow(['userId', 'date', 'water', 'movements', 'goalsReached']) + '\n');
    for (const s of stats) {
      const dateStr = s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10);
      res.write(toCsvRow([s.userId, dateStr, s.water, s.movements, s.goalsReached]) + '\n');
    }
    res.end();
  } catch (err) {
    console.error('[export/stats]', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

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
    console.error('[export/report]', err);
    res.status(500).json({ error: 'Report generation failed' });
  }
});

export default router;
