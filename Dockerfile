FROM node:20-alpine

WORKDIR /usr/src/app

# Dépendances serveur (cacheable)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Code serveur
COPY server ./server

# Dépendances client (cacheable)
WORKDIR /usr/src/app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Code + build client (limite mémoire pour éviter OOM / cancel sur Dokploy)
COPY client ./
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

WORKDIR /usr/src/app

# Exposition du port API / dashboard
EXPOSE 3001

# Variables d'environnement par défaut (override par Dockploy)
ENV NODE_ENV=production
ENV PORT=3001

# Commande de démarrage
CMD ["npm", "start"]

