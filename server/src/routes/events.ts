import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { subDays } from 'date-fns';

const router = Router();

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
    console.error('[events/list]', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/events/trends', async (req: Request, res: Response): Promise<void> => {
  const days = z.coerce.number().default(30).parse(req.query.days);
  const since = subDays(new Date(), days);

  try {
    const rows = await prisma.$queryRaw<{ date: Date; type: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', timestamp) as date, type, COUNT(*) as count
      FROM events WHERE timestamp >= ${since}
      GROUP BY 1, 2 ORDER BY 1
    `;

    const byDate: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const d = row.date.toISOString().slice(0, 10);
      byDate[d] = byDate[d] ?? { date: d };
      byDate[d][row.type] = Number(row.count);
    }

    res.json(Object.values(byDate));
  } catch (err) {
    console.error('[events/trends]', err);
    res.status(500).json({ error: 'Failed to fetch event trends' });
  }
});

export default router;
