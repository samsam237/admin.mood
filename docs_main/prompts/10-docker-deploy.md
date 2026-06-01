# Prompt 10 — Docker + Déploiement

## Contexte
`mood-admin` doit être conteneurisé en un seul service Docker : Express sert le frontend React buildé. Ce prompt crée le Dockerfile, le docker-compose et les scripts de déploiement pour Dokploy ou équivalent.

## Prérequis
- Prompts 01 à 09 complétés et fonctionnels en local
- `npm run build` côté client génère `client/dist/`
- Accès à un registre Docker ou déploiement direct

## Instructions

### 1. `Dockerfile`

```dockerfile
# ─── Stage 1 : dépendances serveur ───────────────────────────────────────────
FROM node:20-slim AS server-deps

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

# ─── Stage 2 : build serveur ─────────────────────────────────────────────────
FROM node:20-slim AS server-builder

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ─── Stage 3 : image finale ───────────────────────────────────────────────────
FROM node:20-slim AS runner

# Sécurité : utilisateur non-root
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copier les dépendances de production
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY server/package*.json ./server/

# Copier le client pré-buildé LOCALEMENT (voir note ci-dessous)
COPY client/dist ./client/dist

# Répertoire pour les sauvegardes user (volume monté)
RUN mkdir -p /app/data/user_backups && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

ENV NODE_ENV=production

# Appliquer les migrations puis démarrer
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
```

> **IMPORTANT — Issue #17** : Ne pas builder le client dans Docker (OOM).
> Builder `client/dist` localement avant de lancer `docker build` :
> ```bash
> cd client && npm run build && cd ..
> docker build -t mood-admin .
> ```

### 2. `docker-compose.yml` (développement local)

```yaml
version: '3.8'

services:
  mood-admin:
    build: .
    container_name: mood-admin
    ports:
      - "${PORT:-3001}:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      USER_BACKUP_DIR: /app/data/user_backups
      BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-30}
    volumes:
      - mood_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  mood_data:
```

### 3. `.dockerignore`

```
node_modules
*/node_modules
*/dist
client/dist  # sera copié depuis le build local
.env
.git
docs/
*.md
```

### 4. Script de build et déploiement — `scripts/deploy.sh`

```bash
#!/bin/bash
set -e

echo "==> Building client..."
cd client && npm run build && cd ..

echo "==> Building Docker image..."
docker build -t mood-admin:latest .

echo "==> Pushing to registry (si configuré)..."
# docker tag mood-admin:latest your-registry/mood-admin:latest
# docker push your-registry/mood-admin:latest

echo "==> Done. Run with: docker compose up -d"
```

```bash
chmod +x scripts/deploy.sh
```

### 5. `server/src/index.ts` — version complète de production

S'assurer que le serveur sert `client/dist` en production. Voici le bloc final complet pour `index.ts` :

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth.js';
import ingestionRouter from './routes/ingestion.js';
import analyticsRouter from './routes/analytics.js';
import usersRouter from './routes/users.js';
import eventsRouter from './routes/events.js';
import alertsRouter from './routes/alerts.js';
import exportRouter from './routes/export.js';
import { authMiddleware } from './auth.js';
import { startAlertChecker } from './alertChecker.js';

// Validation au démarrage
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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
app.use('/api', ingestionRouter); // POST /users, /events, /stats — sans auth

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
  app.get('*', (_req, res) => {
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
```

### 6. Déploiement sur Dokploy

1. Pré-builder le client localement : `cd client && npm run build`
2. Committer `client/dist/` (ou utiliser un artifact) — ou configurer Dokploy avec un build step local
3. Dans Dokploy, créer une application Docker :
   - **Build command** : `docker build -t mood-admin .`
   - **Port** : 3001
   - **Variables d'environnement** : renseigner `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - **Volume** : monter un volume persistant sur `/app/data`

4. Après le premier déploiement, vérifier que les migrations sont appliquées :
   ```bash
   docker exec mood-admin sh -c "cd server && npx prisma migrate status"
   ```

### 7. Seed de l'admin en production

Si l'admin n'existe pas (premier déploiement) :
```bash
docker exec mood-admin sh -c "cd server && npx prisma db seed"
```

## Validation
- [ ] `cd client && npm run build` génère `client/dist/` sans erreur
- [ ] `docker build -t mood-admin .` réussit
- [ ] `docker run -p 3001:3001 --env-file .env mood-admin` démarre
- [ ] `http://localhost:3001` sert la page de login React
- [ ] `http://localhost:3001/api/health` répond `{"status":"ok"}`
- [ ] Les migrations sont appliquées au démarrage (`prisma migrate deploy`)
- [ ] Le login admin fonctionne en production

## Pièges à éviter récapitulatifs

| Piège | Solution |
|---|---|
| Vite OOM dans Docker | Pré-builder `client/dist` localement |
| Prisma binary targets | `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` dans schema |
| Alpine vs Debian | Utiliser `node:20-slim` (Debian) — pas `node:20-alpine` |
| `DIRECT_URL` manquante | Requise pour `prisma migrate deploy` — toujours configurer les deux |
| JWT_SECRET court | Valider au démarrage — lever une erreur si < 32 chars |
| Routes ingestion auth | Monter ingestionRouter AVANT authMiddleware |
| BigInt JSON | `app.set('json replacer', ...)` dans Express |
| Port volume sauvegardes | Toujours monter `/app/data` comme volume persistant |
