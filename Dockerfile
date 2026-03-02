FROM node:20-alpine

WORKDIR /usr/src/app

# Copie des manifests
COPY package.json package-lock.json* ./

# Installation des deps serveur + client (sans scripts)
RUN npm install --omit=dev

# Copie du code serveur et client
COPY server ./server
COPY client ./client

# Build du client React
RUN cd client && npm install && npm run build

# Exposition du port API / dashboard
EXPOSE 3001

# Variables d'environnement par défaut (override par Dockploy)
ENV NODE_ENV=production
ENV PORT=3001

# Commande de démarrage
CMD ["npm", "start"]

