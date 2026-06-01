# Roadmap Agile — mood-admin

## Vue d'ensemble des sprints

| Sprint | Objectif | Statut |
|---|---|---|
| S0 | Setup projet, DB, auth backend | À faire |
| S1 | Ingestion + analytics backend | À faire |
| S2 | Alertes + export CSV | À faire |
| S3 | Frontend setup + login + layout | À faire |
| S4 | Dashboard overview + KPIs | À faire |
| S5 | Pages users + events + stats | À faire |
| S6 | Docker + déploiement | À faire |

---

## Sprint 0 — Setup projet, DB, auth

### User stories
- [ ] Initialiser la structure monorepo TypeScript
- [ ] Connecter Prisma à Neon (PostgreSQL)
- [ ] Appliquer les migrations et seeder l'admin
- [ ] Implémenter POST `/api/auth/login` avec JWT

### Tâches techniques
1. Init `server/` avec TypeScript + Express
2. Init `client/` avec Vite + React + TypeScript
3. Écrire `prisma/schema.prisma`
4. `prisma migrate dev` sur Neon
5. `prisma db seed` (admin par défaut)
6. Écrire `auth.ts` (bcrypt + JWT sign/verify)
7. Écrire middleware `authMiddleware`
8. Route `POST /api/auth/login`
9. Variables d'env + `.env.example`

### Issues connues — S0

#### Issue #1 — Neon : deux URLs requises pour Prisma
**Symptôme** : `prisma migrate dev` échoue avec "prepared statement already exists" ou timeout derrière le pooler.
**Cause** : PgBouncer en mode transaction ne supporte pas les prepared statements que Prisma utilise pour les migrations.
**Solution** :
```env
DATABASE_URL="postgresql://...@ep-xxx-pooler.region.neon.tech/db?sslmode=require"
DIRECT_URL="postgresql://...@ep-xxx.region.neon.tech/db?sslmode=require"
```
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
Toujours utiliser `DIRECT_URL` pour les migrations, `DATABASE_URL` (pooler) pour le runtime.

#### Issue #2 — `prisma generate` doit précéder `tsc`
**Symptôme** : `tsc` échoue avec "Cannot find module '@prisma/client'".
**Cause** : Le client Prisma est généré dans `node_modules/.prisma/client` uniquement après `prisma generate`.
**Solution** : Ajouter dans `package.json` :
```json
"scripts": {
  "build": "prisma generate && tsc"
}
```

#### Issue #3 — SSL Neon en développement local
**Symptôme** : `Error: self-signed certificate` ou connexion refusée.
**Cause** : Neon exige SSL même en dev.
**Solution** : Toujours inclure `?sslmode=require` dans l'URL. Ne jamais utiliser `rejectUnauthorized: false` en production.

#### Issue #4 — JWT_SECRET faible par défaut
**Symptôme** : Aucune erreur visible, mais sécurité compromise.
**Solution** : Valider au démarrage du serveur :
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

---

## Sprint 1 — Ingestion + Analytics backend

### User stories
- [ ] App Flutter peut envoyer des événements (`POST /api/events`)
- [ ] App Flutter peut envoyer des stats journalières (`POST /api/stats`)
- [ ] App Flutter peut s'enregistrer (`POST /api/users`)
- [ ] Admin peut interroger KPIs, rétention, overview
- [ ] Admin peut lister users avec segmentation

### Tâches techniques
1. Routes ingestion (avec validation Zod)
2. Routes analytics : `/kpis`, `/overview`, `/analytics`, `/retention`
3. Routes users : `/users`, `/users/segments`, `/admin/users/:id`
4. Routes events : `/events`, `/events/trends`
5. Route health : `/health`

### Issues connues — S1

#### Issue #5 — Calcul DAU/WAU/MAU avec PostgreSQL
**Symptôme** : Requête lente ou incorrecte avec Prisma `groupBy`.
**Cause** : Prisma ne supporte pas nativement les fenêtres temporelles relatives complexes.
**Solution** : Utiliser `prisma.$queryRaw` avec SQL natif PostgreSQL pour les calculs analytiques complexes :
```typescript
const dau = await prisma.$queryRaw<[{count: bigint}]>`
  SELECT COUNT(DISTINCT user_id) as count
  FROM events
  WHERE timestamp >= NOW() - INTERVAL '1 day'
`;
```
Attention : `$queryRaw` retourne des `BigInt` — convertir avec `Number()`.

#### Issue #6 — BigInt non sérialisable en JSON
**Symptôme** : `TypeError: Do not know how to serialize a BigInt`.
**Cause** : `JSON.stringify` ne gère pas `BigInt` natif.
**Solution** : Convertir systématiquement les résultats `$queryRaw` :
```typescript
const result = await prisma.$queryRaw<...>`SELECT COUNT(*) as n FROM ...`;
return Number(result[0].n); // BigInt → number
```
Ou configurer un replacer global dans Express :
```typescript
app.set('json replacer', (key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);
```

#### Issue #7 — Upsert utilisateur avec `userId` externe
**Symptôme** : Doublons ou erreurs de contrainte unique.
**Cause** : L'app Flutter peut envoyer `POST /api/users` plusieurs fois (re-install, reconnection).
**Solution** : Utiliser `prisma.appUser.upsert` :
```typescript
await prisma.appUser.upsert({
  where: { userId: dto.userId },
  create: { userId: dto.userId, email: dto.email },
  update: { email: dto.email, updatedAt: new Date() },
});
```

#### Issue #8 — Calcul rétention par cohorte
**Symptôme** : Taux de rétention toujours à 0% ou 100%.
**Cause** : La rétention doit se calculer sur la cohorte des utilisateurs inscrits un jour J et actifs à J+N, pas sur l'ensemble des users actifs.
**Solution** :
```sql
-- Taux de rétention J7
SELECT
  COUNT(DISTINCT e.user_id)::float / COUNT(DISTINCT u.user_id) * 100 as rate
FROM app_users u
JOIN events e ON e.user_id = u.user_id
  AND e.timestamp >= u.created_at + INTERVAL '7 days'
  AND e.timestamp < u.created_at + INTERVAL '8 days'
WHERE u.created_at >= NOW() - INTERVAL '60 days'
```

---

## Sprint 2 — Alertes + Export CSV

### User stories
- [ ] Alertes générées automatiquement toutes les heures
- [ ] Admin voit le badge d'alertes dans le header
- [ ] Admin peut acquitter une alerte
- [ ] Admin peut exporter users/events/stats en CSV
- [ ] Admin peut générer un rapport complet

### Tâches techniques
1. `alertChecker.ts` avec `setInterval`
2. Routes `/api/alerts` GET + PATCH
3. Routes `/api/export/:type` GET
4. Route `/api/export/report` GET
5. Génération CSV sans dépendance externe (template strings ou `csv-stringify`)

### Issues connues — S2

#### Issue #9 — Doublons d'alertes
**Symptôme** : Des dizaines d'alertes du même type créées toutes les heures.
**Cause** : L'alertChecker insère sans vérifier si une alerte du même type existe déjà aujourd'hui.
**Solution** : Upsert par `(type, date_trunc('day', triggered_at))` ou ajouter une contrainte unique `(type, date)` dans Prisma :
```typescript
// Vérifier avant d'insérer
const existing = await prisma.alert.findFirst({
  where: {
    type,
    isRead: false,
    triggeredAt: { gte: startOfDay(new Date()) },
  },
});
if (!existing) {
  await prisma.alert.create({ data: { type, message, threshold } });
}
```

#### Issue #10 — Export CSV de gros volumes
**Symptôme** : Timeout ou OOM sur export d'events avec beaucoup de données.
**Cause** : Charger 100k lignes en mémoire avant de les écrire.
**Solution** : Utiliser un stream Prisma + pipe vers la réponse :
```typescript
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
res.write('id,user_id,type,timestamp\n');

const cursor = await prisma.event.findMany({ take: 10000 }); // paginer si besoin
for (const row of cursor) {
  res.write(`${row.id},${row.userId},${row.type},${row.timestamp.toISOString()}\n`);
}
res.end();
```

---

## Sprint 3 — Frontend setup + login + layout

### User stories
- [ ] Page login fonctionnelle avec redirection
- [ ] Layout principal avec sidebar et header
- [ ] Navigation entre onglets du dashboard
- [ ] Badge d'alertes dans le header
- [ ] Dark mode toggle
- [ ] Indicateur santé serveur

### Tâches techniques
1. Init client React + Vite + TypeScript + Tailwind
2. Installer et configurer shadcn/ui
3. Configurer TanStack Query + Axios
4. `LoginPage.tsx` + hook `useAuth`
5. `AppLayout.tsx` + `Sidebar.tsx` + `Header.tsx`
6. Route guard (redirect si non authentifié)
7. `RangeSelector` global (7/14/30/60/90j)

### Issues connues — S3

#### Issue #11 — shadcn/ui init sur Vite (pas Next.js)
**Symptôme** : `npx shadcn-ui@latest init` plante ou génère une mauvaise config.
**Cause** : shadcn détecte Next.js par défaut.
**Solution** : Utiliser les options manuelles :
```bash
npx shadcn@latest init
# Choisir : Vite, TypeScript, Tailwind CSS
# Style : Default, couleur : Slate
# CSS variables : yes
```
Vérifier que `tailwind.config.ts` inclut les chemins corrects :
```ts
content: ["./index.html", "./src/**/*.{ts,tsx}"]
```

#### Issue #12 — Vite proxy CORS en développement
**Symptôme** : `CORS error` lors des appels API en dev.
**Cause** : Le client Vite (port 5173) appelle le serveur Express (port 3001) — domaines différents.
**Solution** : Configurer le proxy Vite :
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```
En production, Express sert `client/dist` — pas de CORS.

#### Issue #13 — Token JWT dans localStorage vs cookie
**Symptôme** : Débat sécurité localStorage (XSS) vs cookie (CSRF).
**Décision** : Pour cet admin interne, `localStorage` est acceptable. L'app n'a pas d'injection de scripts tiers. Ne pas utiliser `httpOnly` cookie pour éviter la complexité CSRF.
**Comment l'appliquer** : stocker `token` dans `localStorage`, l'injecter via intercepteur Axios.

---

## Sprint 4 — Dashboard overview + KPIs

### User stories
- [ ] Section Overview avec 6 KpiCards (DAU, WAU, MAU, Stickiness, Goals, Streak)
- [ ] Graphiques de tendances (area charts Recharts)
- [ ] Graphique rétention (J1/J7/J30 bar chart)
- [ ] Graphique events par type (stacked bar)
- [ ] Segmentation users (Active/Dormant/Churned donut)
- [ ] Auto-refresh toggle (30s)

### Issues connues — S4

#### Issue #14 — Recharts et TypeScript strict
**Symptôme** : Erreurs de type sur les props des composants Recharts.
**Cause** : Les types Recharts ne sont pas toujours stricts.
**Solution** : Typer les données en amont et utiliser `as` uniquement là où nécessaire. Éviter `any`.

#### Issue #15 — Flicker de données au changement de plage
**Symptôme** : Les graphiques flashent (données vides puis chargées) à chaque changement de plage.
**Cause** : TanStack Query invalide le cache à chaque changement de `queryKey`.
**Solution** : Utiliser `placeholderData: keepPreviousData` (v5) :
```typescript
const { data } = useQuery({
  queryKey: ['kpis', days],
  queryFn: () => api.getKpis(days),
  placeholderData: keepPreviousData,
});
```

---

## Sprint 5 — Pages users + events + stats

### User stories
- [ ] Table users paginée avec filtres et recherche
- [ ] Page détail utilisateur
- [ ] Table events avec filtres
- [ ] Table stats journalières
- [ ] Backups utilisateurs (liste + download)

### Issues connues — S5

#### Issue #16 — Pagination avec Prisma et Neon
**Symptôme** : Pagination lente sur grandes tables.
**Cause** : `OFFSET` est lent sur de grandes tables PostgreSQL.
**Solution** : Utiliser la pagination par curseur pour les tables events/stats qui peuvent être volumineuses :
```typescript
// Cursor-based pagination
const events = await prisma.event.findMany({
  take: limit,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { timestamp: 'desc' },
});
```
Pour les tables petites (users), `skip/take` classique est acceptable.

---

## Sprint 6 — Docker + déploiement

### Tâches techniques
1. `Dockerfile` multi-stage (build client → image finale)
2. `docker-compose.yml` pour développement local
3. `.env.example` complet
4. Script de démarrage avec `prisma migrate deploy` au boot
5. Health check Docker

### Issues connues — S6

#### Issue #17 — Vite OOM lors du `docker build`
**Symptôme** : Le build Docker plante avec "JavaScript heap out of memory" lors du `npm run build` côté client.
**Cause** : Vite est gourmand en mémoire. Certaines plateformes (Dokploy, Render) ont des builders contraints en RAM.
**Solution** : Pré-builder le client localement avant de construire l'image Docker :
```bash
# Localement
cd client && npm run build && cd ..
# Le Dockerfile COPY client/dist — pas de npm run build dans Docker
```
```dockerfile
# Dockerfile — NE PAS faire npm run build ici
COPY client/dist ./client/dist
```

#### Issue #18 — Prisma binary targets dans Docker
**Symptôme** : `Error: Query engine binary for current platform "linux-musl" not found`.
**Cause** : Prisma génère les binaires pour la plateforme locale (Windows/Mac), pas pour Alpine Linux.
**Solution** : Utiliser `node:20-slim` (Debian) plutôt qu'Alpine, OU spécifier les targets dans `schema.prisma` :
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```
La solution recommandée est `node:20-slim` (évite Alpine + musl).

#### Issue #19 — `prisma migrate deploy` au démarrage
**Symptôme** : L'app démarre avant que la DB soit prête.
**Cause** : Docker Compose démarre les services en parallèle. Avec Neon (service externe), la DB est toujours disponible, mais les migrations peuvent ne pas être appliquées.
**Solution** : Dans le script de démarrage Docker :
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```
Avec Neon, il n'y a pas de service local à attendre — juste les migrations.

#### Issue #20 — Variables d'env sensibles en production
**Symptôme** : `JWT_SECRET` ou mots de passe en clair dans le code ou les logs.
**Solution** : 
- Toujours utiliser les secrets Dokploy/Render (jamais de `.env` en prod)
- Valider les variables critiques au démarrage (voir Issue #4)
- Ne jamais logger les headers `Authorization`

---

## Backlog (hors MVP)

| Feature | Priorité | Notes |
|---|---|---|
| Notifications Slack/email sur alertes | P3 | Nécessite SendGrid ou webhook Slack |
| Authentification multi-admin | P3 | Ajouter table `admins` avec rôles |
| Internationalisation (i18n) | P3 | Actuellement FR uniquement |
| Tests E2E | P3 | Playwright |
| Tests unitaires routes | P2 | Vitest + supertest |
| Rate limiting ingestion | P2 | Éviter l'abus de l'API publique |
| Pagination cursor-based UI | P2 | Meilleure UX sur grandes listes |
