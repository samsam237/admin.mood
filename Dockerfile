FROM node:20-alpine

WORKDIR /usr/src/app

# Dépendances serveur uniquement
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Code serveur
COPY server ./server

# Client pré-construit (build en local ou en CI : cd client && npm run build, puis commit client/dist)
# Évite timeout/OOM du build Vite sur Dokploy
COPY client/dist ./client/dist

# Exposition du port API / dashboard
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["npm", "start"]

