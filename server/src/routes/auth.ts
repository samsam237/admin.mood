import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signToken } from '../auth';
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
