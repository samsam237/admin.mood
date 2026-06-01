# Prompt 01 — Initialisation du projet

## Contexte
Tu travailles sur `mood-admin`, un dashboard analytics pour une app mobile de santé. C'est un monorepo Node.js avec un backend Express + TypeScript et un frontend React + TypeScript + Vite. La base de données est PostgreSQL sur Neon (cloud). Ce prompt initialise la structure complète du projet.

## Objectif
Créer le squelette du monorepo avec les deux packages (`server/` et `client/`) configurés et prêts à accueillir le code métier.

## Prérequis
- Node.js 20 installé
- npm 10+
- Répertoire de travail vide `mood-admin/`

## Instructions

### 1. Package racine

Créer `package.json` à la racine :
```json
{
  "name": "mood-admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev",
    "build": "cd client && npm run build",
    "start": "cd server && npm start",
    "db:migrate": "cd server && npx prisma migrate dev",
    "db:deploy": "cd server && npx prisma migrate deploy",
    "db:seed": "cd server && npx prisma db seed",
    "db:studio": "cd server && npx prisma studio"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### 2. Backend — `server/`

#### `server/package.json`
```json
{
  "name": "mood-admin-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "prisma generate && tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "csv-stringify": "^6.4.6",
    "dotenv": "^16.4.5",
    "express": "^5.0.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "prisma": "^5.22.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.3"
  }
}
```

#### `server/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

#### `server/src/index.ts` (squelette)
```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Validation des variables critiques au démarrage
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// BigInt → number pour JSON.stringify
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);

// Routes (à ajouter dans les prochains prompts)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Serve client/dist en production
if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Note** : corriger le `import` statique en CommonJS (le code ci-dessus est illustratif — adapter selon le module system choisi) :
```typescript
import path from 'path';
// ...
app.use(express.static(path.join(__dirname, '../../client/dist')));
```

### 3. Frontend — `client/`

Initialiser avec Vite :
```bash
cd client
npm create vite@latest . -- --template react-ts
npm install
```

Puis installer les dépendances supplémentaires :
```bash
npm install @tanstack/react-query@^5.62.0 axios@^1.7.7 react-router-dom@^6.28.0 recharts@^2.13.3 lucide-react@^0.460.0 clsx@^2.1.1 tailwind-merge@^2.5.4
npm install -D tailwindcss@^3.4.15 postcss@^8.4.49 autoprefixer@^10.4.20 @tailwindcss/forms@^0.5.9
npx tailwindcss init -p
```

#### `client/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
} satisfies Config;
```

#### `client/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

#### `client/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

#### `client/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. Fichiers racine

#### `.env.example`
```env
NODE_ENV=development
PORT=3001

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require

# Auth
JWT_SECRET=changeme-minimum-32-chars-required
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# Sauvegardes user
USER_BACKUP_DIR=./data/user_backups
BACKUP_RETENTION_DAYS=30
```

#### `.gitignore`
```
node_modules/
dist/
client/dist/
.env
data/
*.db
```

### 5. Commandes d'installation

```bash
# Racine
npm install

# Server
cd server && npm install && cd ..

# Client
cd client && npm install && cd ..
```

## Validation
- [ ] `npm run dev:server` démarre sur le port 3001 sans erreur
- [ ] `GET http://localhost:3001/api/health` retourne `{ "status": "ok" }`
- [ ] `npm run dev:client` démarre sur le port 5173 sans erreur
- [ ] La page Vite par défaut s'affiche sur http://localhost:5173

## Pièges à éviter
- Ne pas oublier le `json replacer` BigInt dans Express (obligatoire pour les requêtes Prisma `$queryRaw`)
- Le proxy Vite `/api` est indispensable en dev pour éviter les erreurs CORS
- Ne jamais commiter `.env` — seul `.env.example` va dans git
