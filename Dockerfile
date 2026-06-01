# Client doit être pré-buildé localement avant docker build :
#   cd client && npm run build
#   docker build -t mood-admin .

# ─── Stage 1 : dépendances serveur ────────────────────────────────────────────
FROM node:20-slim AS server-deps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ─── Stage 2 : build TypeScript ───────────────────────────────────────────────
FROM node:20-slim AS server-builder
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --no-audit --no-fund
COPY server/ ./
RUN npm run build

# ─── Stage 3 : image finale ───────────────────────────────────────────────────
FROM node:20-slim AS runner

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY server/package*.json ./server/

# Client pré-buildé localement
COPY client/dist ./client/dist

RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3050

ENV NODE_ENV=production PORT=3050

CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
