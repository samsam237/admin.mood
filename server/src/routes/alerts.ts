import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isRead: false },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    });
    res.json(alerts);
  } catch (err) {
    console.error('[alerts/list]', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

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
