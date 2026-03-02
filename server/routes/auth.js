import { Router } from 'express';
import { login } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis' });
  }
  const result = await login(username, password);
  if (!result) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  res.json(result);
});

export default router;
