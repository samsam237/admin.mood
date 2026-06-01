# ─── Stage 1 : dépendances serveur ────────────────────────────────────────────
FROM node:20-slim AS server-deps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ─── Stage 2 : build TypeScript serveur ───────────────────────────────────────
FROM node:20-slim AS server-builder
RUN apt-get update -y && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --no-audit --no-fund
COPY server/ ./
RUN npm run build

# ─── Stage 3 : build client React ─────────────────────────────────────────────
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package.json ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ─── Stage 4 : image finale ───────────────────────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY server/package*.json ./server/

COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3050

ENV NODE_ENV=production PORT=3050

CMD ["sh", "-c", "cd server && npx prisma db push && node dist/index.js"]
