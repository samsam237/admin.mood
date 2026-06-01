import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

const userSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  email: z.string().email().optional(),
  createdAt: z.string().optional(),
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

router.post('/users', async (req: Request, res: Response): Promise<void> => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, email, createdAt } = parsed.data;

  try {
    await prisma.appUser.upsert({
      where: { userId },
      create: {
        userId,
        email,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
      update: { email: email ?? undefined },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ingestion/users]', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/events', async (req: Request, res: Response): Promise<void> => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, type, payload, timestamp } = parsed.data;

  try {
    await prisma.appUser.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await prisma.event.create({
      data: {
        userId,
        type,
        payload: payload !== undefined ? (payload as Prisma.InputJsonValue) : undefined,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[ingestion/events]', err);
    res.status(500).json({ error: 'Failed to store event' });
  }
});

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
