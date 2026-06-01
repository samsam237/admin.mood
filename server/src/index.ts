import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth';
import ingestionRouter from './routes/ingestion';
import analyticsRouter from './routes/analytics';
import usersRouter from './routes/users';
import eventsRouter from './routes/events';
import alertsRouter from './routes/alerts';
import exportRouter from './routes/export';
import { authMiddleware } from './auth';
import { startAlertChecker } from './alertChecker';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

const app = express();
const PORT = parseInt(process.env.PORT || '3050', 10);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

// BigInt → number pour JSON.stringify
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);

// ─── Routes publiques ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), version: '1.0.0' });
});
app.use('/api/auth', authRouter);
app.use('/api', ingestionRouter);

// ─── Routes protégées ─────────────────────────────────────────────────────────
app.use('/api', authMiddleware);
app.use('/api', analyticsRouter);
app.use('/api', usersRouter);
app.use('/api', eventsRouter);
app.use('/api', alertsRouter);
app.use('/api', exportRouter);

// ─── Serve client en production ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    startAlertChecker();
  }
});
