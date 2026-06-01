# Conception technique — mood-admin

## Stack technique

| Couche | Technologie | Justification |
|---|---|---|
| Backend runtime | Node.js 20 + TypeScript | Typage fort, meilleure maintenabilité |
| Framework HTTP | Express 5 | Léger, maîtrisé, suffisant pour ce volume |
| ORM | Prisma 5 | Type-safety, migrations versionnées, Neon compatible |
| Base de données | PostgreSQL (Neon) | Scalable, online, sans opération serveur SQLite |
| Auth | JWT + bcryptjs | Simple, sans état, suffisant pour admin unique |
| Frontend | React 18 + TypeScript + Vite | Rapide, écosystème riche |
| UI | Tailwind CSS + shadcn/ui | Composants professionnels, accessibles, customisables |
| State serveur | TanStack Query v5 | Cache, auto-refresh, retries |
| Routing | React Router v6 | Standard de facto |
| Graphiques | Recharts | Léger, composable, compatible React |
| Déploiement | Docker monolithique | Un seul service, Express sert le frontend buildé |

---

## Architecture

```
mood-admin/
├── server/                    # Backend TypeScript
│   ├── src/
│   │   ├── index.ts           # Express app + server
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # JWT middleware
│   │   ├── alertChecker.ts    # Cron alertes (1h)
│   │   └── routes/
│   │       ├── auth.ts        # POST /api/auth/login
│   │       ├── ingestion.ts   # POST public (events, stats, users)
│   │       ├── analytics.ts   # GET analytics, kpis, retention
│   │       ├── users.ts       # GET users, segments, detail
│   │       ├── events.ts      # GET events, trends
│   │       ├── alerts.ts      # GET/PATCH alerts
│   │       ├── export.ts      # GET export CSV
│   │       └── userData.ts    # RGPD, sauvegardes user
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── package.json
│   └── tsconfig.json
├── client/                    # Frontend React TypeScript
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx            # Router + auth guard
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── UserDetailPage.tsx
│   │   ├── components/
│   │   │   ├── layout/        # AppLayout, Sidebar, Header
│   │   │   ├── dashboard/     # Overview, KpiCard, Charts
│   │   │   ├── users/         # UserTable, UserFilters
│   │   │   ├── events/        # EventTable, EventFilters
│   │   │   └── ui/            # shadcn composants
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useRange.ts
│   │   ├── lib/
│   │   │   ├── api.ts         # Axios client
│   │   │   └── utils.ts       # cn(), formatters
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── docs/
├── Dockerfile
├── .env.example
└── package.json               # Scripts racine (dev, build, start)
```

---

## Schéma de base de données (PostgreSQL)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Neon pooler URL
  directUrl = env("DIRECT_URL")         // Neon direct URL (migrations)
}

model Admin {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("admins")
}

model AppUser {
  id        Int      @id @default(autoincrement())
  userId    String   @unique @map("user_id")  // Firebase UID
  email     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  events      Event[]
  stats       DailyStat[]
  backups     UserBackupMeta[]
  consents    DataConsent[]
  auditLogs   AuditLog[]

  @@map("app_users")
}

model Event {
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id")
  type      String
  payload   Json?
  timestamp DateTime @default(now())
  createdAt DateTime @default(now()) @map("created_at")

  user AppUser @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
  @@index([type])
  @@index([timestamp])
  @@map("events")
}

model DailyStat {
  id           Int      @id @default(autoincrement())
  userId       String   @map("user_id")
  date         DateTime @db.Date
  water        Int      @default(0)
  movements    Int      @default(0)
  goalsReached Boolean  @default(false) @map("goals_reached")
  createdAt    DateTime @default(now()) @map("created_at")

  user AppUser @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
  @@index([date])
  @@map("daily_stats")
}

model Alert {
  id          Int      @id @default(autoincrement())
  type        String
  message     String
  threshold   Float?
  triggeredAt DateTime @default(now()) @map("triggered_at")
  isRead      Boolean  @default(false) @map("is_read")

  @@index([isRead])
  @@map("alerts")
}

model DataConsent {
  id         Int      @id @default(autoincrement())
  userId     String   @map("user_id")
  scope      String
  version    String
  acceptedAt DateTime @default(now()) @map("accepted_at")

  user AppUser @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([userId, scope])
  @@map("data_consents")
}

model UserBackupMeta {
  id         Int      @id @default(autoincrement())
  userId     String   @map("user_id")
  backupId   String   @unique @map("backup_id")
  sizeBytes  Int      @map("size_bytes")
  checksum   String
  createdAt  DateTime @default(now()) @map("created_at")

  user AppUser @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
  @@map("user_backup_meta")
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  actorType String   @map("actor_type")   // "admin" | "user"
  actorId   String   @map("actor_id")
  action    String
  resource  String
  details   String?
  createdAt DateTime @default(now()) @map("created_at")

  user AppUser? @relation(fields: [actorId], references: [userId])

  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## Connexion Neon — points critiques

Neon fournit deux URLs :

```env
# URL poolée (PgBouncer) — requêtes runtime
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require"

# URL directe — migrations Prisma (pas de pooler)
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
```

**Pourquoi deux URLs ?** Prisma Migrate ne fonctionne pas derrière PgBouncer en mode transaction (les sessions sont nécessaires). Le pooler est utilisé uniquement pour les requêtes applicatives.

---

## Décisions d'architecture

| Décision | Alternative écartée | Raison |
|---|---|---|
| Express 5 | Fastify / Hono | Équipe maîtrise Express, migration inutile |
| Prisma | Drizzle / pg brut | Migrations versionnées, type-safety, studio |
| shadcn/ui | MUI / Mantine | Composants copiés (pas de dep), full Tailwind, accessible |
| TanStack Query v5 | SWR / fetch manuel | Cache, deduplication, refetch intervals |
| Monolithe Docker | Séparation front/back | Un seul service à déployer sur Dokploy |
| JWT 7j admin | Sessions | Stateless, pas de stockage serveur |
| Polling 30s | WebSocket | Complexité inutile pour un admin unique |

---

## Variables d'environnement

```env
# Serveur
NODE_ENV=production
PORT=3001

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require

# Auth
JWT_SECRET=changeme-minimum-32-chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# Stockage sauvegardes user (fichiers locaux)
USER_BACKUP_DIR=./data/user_backups
BACKUP_RETENTION_DAYS=30
```

---

## Flux de données — Ingestion

```
App Flutter
    │ POST /api/events | /api/stats | /api/users
    ▼
Express (routes/ingestion.ts)
    │ Validation (zod)
    ▼
Prisma upsert/create
    ▼
PostgreSQL (Neon)
```

## Flux de données — Analytics

```
Browser (TanStack Query, refetch 30s)
    │ GET /api/kpis?days=30
    ▼
Express (routes/analytics.ts)
    │ Prisma queries (groupBy, count, etc.)
    ▼
PostgreSQL
    │
    ▼
JSON response → Recharts
```

## Flux alertes

```
setInterval(1h)
    │
alertChecker.ts
    │ Query: nouveaux users 48h, rétention J7, activité 24h
    ▼
Prisma upsert Alert (évite doublons par type+date)
    ▼
Frontend poll /api/alerts toutes les 30s → badge rouge
```
