# Prompt 02 — Schéma de base de données (Prisma + Neon)

## Contexte
`mood-admin` utilise PostgreSQL hébergé sur Neon. Prisma est l'ORM. Ce prompt crée le schéma complet, les migrations et le seed de l'admin par défaut.

## Prérequis
- Prompt 01 complété (structure projet créée)
- `server/node_modules` installé
- URLs Neon disponibles (pooler + directe)
- `.env` rempli avec `DATABASE_URL` et `DIRECT_URL`

## Instructions

### 1. Initialiser Prisma

```bash
cd server
npx prisma init --datasource-provider postgresql
```

Cela crée `prisma/schema.prisma` et met à jour `.env`. Remplacer le contenu par :

### 2. `server/prisma/schema.prisma`

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
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
  userId    String   @unique @map("user_id")
  email     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  events    Event[]
  stats     DailyStat[]
  backups   UserBackupMeta[]
  consents  DataConsent[]
  auditLogs AuditLog[]

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
  @@index([type, triggeredAt])
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
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id")
  backupId  String   @unique @map("backup_id")
  sizeBytes Int      @map("size_bytes")
  checksum  String
  createdAt DateTime @default(now()) @map("created_at")

  user AppUser @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
  @@map("user_backup_meta")
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  actorType String   @map("actor_type")
  actorId   String   @map("actor_id")
  action    String
  resource  String
  details   String?
  createdAt DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("audit_logs")
}
```

### 3. `server/src/prisma.ts` (singleton client)

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 4. `server/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists — skipping seed`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.create({ data: { username, passwordHash } });
  console.log(`Admin "${username}" created`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Ajouter dans `server/package.json` :
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

### 5. Appliquer les migrations

```bash
cd server

# Créer et appliquer la migration initiale
npx prisma migrate dev --name init

# Seeder l'admin
npx prisma db seed
```

**Attention** : `migrate dev` utilise `DIRECT_URL` (connexion directe Neon, pas le pooler). Vérifier que les deux variables sont dans `.env`.

### 6. Vérifier avec Prisma Studio

```bash
npx prisma studio
```

Ouvrir http://localhost:5555 — la table `admins` doit contenir une ligne.

## Validation
- [ ] `npx prisma migrate dev --name init` s'exécute sans erreur
- [ ] `npx prisma db seed` crée l'admin
- [ ] Prisma Studio montre toutes les tables créées
- [ ] `prisma generate` produit les types TypeScript

## Pièges à éviter
- `DATABASE_URL` (pooler) ≠ `DIRECT_URL` (direct) — ne jamais les inverser
- `binaryTargets` dans le schema est obligatoire pour que Docker fonctionne
- Le seed est idempotent (ne crée pas de doublon si relancé)
- `date` dans `DailyStat` est `@db.Date` (PostgreSQL `DATE`, pas `TIMESTAMP`) — important pour les requêtes groupées par jour
