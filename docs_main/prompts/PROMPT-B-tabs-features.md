# Prompt B — Onglets Données & Backups + Header avancé + UserDetail enrichi

**Usage** : coller ce prompt dans Cursor APRÈS avoir appliqué PROMPT-A avec succès.  
**Fichiers à lire** :
- `client/src/pages/DashboardPage.tsx`
- `client/src/pages/UserDetailPage.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/lib/api.ts`
- `client/src/types/index.ts`
- `server/src/routes/analytics.ts`
- `server/src/routes/events.ts`
- `server/src/routes/users.ts`
- `server/src/index.ts`
- `server/src/prisma.ts`
- `client/src/Dashboard.jsx` (référence — NE PAS MODIFIER)
- `client/src/UserDetail.jsx` (référence — NE PAS MODIFIER)
- `client/src/Layout.jsx` (référence — NE PAS MODIFIER)

**Durée estimée** : 60-90 min.

---

## Diagnostic

### Problème 1 — Onglet Données manquant

L'ancienne version avait un onglet "Données" avec :
- 2 AreaCharts (💧 Eau mL/j et 🏃 Mouvements/j cumulés sur la période)
- Une table paginée : User ID, Date, Eau, Mouvements, Objectifs (badge ✅/❌)

Le nouveau backend n'a pas de route `/api/stats` pour les données paginées par utilisateur.

### Problème 2 — Onglet Backups manquant

L'ancienne version avait un onglet "Backups" avec :
- Panel "Sauvegardes système" : bouton créer + liste des backups (nom + taille Ko)
- Panel "Sauvegardes utilisateurs" : table paginée (User ID, Backup ID, Date, Taille)

Le nouveau backend n'a pas de route de gestion des backups.

### Problème 3 — Header sans health check ni auto-refresh

L'ancienne `Layout.jsx` avait :
- Un dot de santé serveur (vert pulsant / orange / rouge) avec `checkHealth()` toutes les 30s
- Un toggle auto-refresh avec indicateur visuel ON/OFF
- Un bouton refresh manuel

### Problème 4 — UserDetail avec seulement 3 stats sur 8

L'ancienne version avait 8 stats cartes :
📅 Inscription · 💓 Dernière activité · ⚡ Événements count · 📊 Jours actifs · 🎯 Objectifs % · 💧 Eau moy. · 🏃 Mouvements moy. · 💾 Backups count

Plus : graphique dual-line (eau + mouvements), mini goal strip 14 jours (carrés colorés), section sauvegardes.

### Architecture cible

```
Backend (nouvelles routes)
├── GET  /api/stats         → stats paginées (userId, date, water, movements, goalsReached)
├── GET  /api/admin/backups → liste backups utilisateurs (userBackupMeta)
└── POST /api/admin/backups → déclenche un backup (no-op si non implémenté, retourne 200)

Frontend
├── DashboardPage.tsx  → 5 onglets (+ Données + Backups)
├── DataTab.tsx        → nouveau composant
├── BackupsTab.tsx     → nouveau composant
├── Header.tsx         → health dot + auto-refresh toggle
└── UserDetailPage.tsx → 8 stats + dual chart + goal strip
```

---

## Étape 1 — Ajouter les routes backend manquantes

### Fichier à modifier : `server/src/routes/analytics.ts`

#### 1a. Ajouter la route `/stats`

Localiser (fin du fichier, avant `export default router`) :
```typescript
export default router;
```

Insérer avant :
```typescript
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page:  z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(200).default(50),
    days:  z.coerce.number().optional(),
  });
  const { page, limit, days } = schema.parse(req.query);
  const skip = (page - 1) * limit;
  const since = days ? subDays(new Date(), days) : undefined;

  try {
    const where = since ? { date: { gte: since } } : {};
    const [data, total] = await Promise.all([
      prisma.dailyStat.findMany({ where, skip, take: limit, orderBy: { date: 'desc' } }),
      prisma.dailyStat.count({ where }),
    ]);
    res.json({
      data: data.map((s) => ({
        userId:       s.userId,
        date:         s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10),
        water:        s.water,
        movements:    s.movements,
        goalsReached: s.goalsReached,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[stats/list]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
```

Ajouter aussi l'import de `z` si absent en haut du fichier :
```typescript
import { z } from 'zod';
```

### Fichier à modifier : `server/src/routes/users.ts`

#### 1b. Ajouter la route `/admin/backups`

Localiser (fin du fichier, avant `export default router`) :
```typescript
export default router;
```

Insérer avant :
```typescript
router.get('/admin/backups', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    page:  z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(200).default(50),
  });
  const { page, limit } = schema.parse(req.query);
  const skip = (page - 1) * limit;
  try {
    const [data, total] = await Promise.all([
      prisma.userBackupMeta.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.userBackupMeta.count(),
    ]);
    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('[admin/backups]', err);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

router.post('/admin/backups', async (_req: Request, res: Response): Promise<void> => {
  // Point d'extension : déclencher un backup système ici si implémenté
  res.json({ ok: true, message: 'Backup triggered (no-op)' });
});
```

### Fichier à modifier : `server/src/index.ts`

#### 1c. Monter la route `/stats` (analyticsRouter la couvre déjà via `/api`)

Vérifier que `analyticsRouter` est bien monté sur `/api` — si oui, `/api/stats` est automatiquement disponible. Aucune modification nécessaire.

---

## Étape 2 — Mettre à jour `api.ts`

### Fichier à modifier : `client/src/lib/api.ts`

Localiser :
```typescript
export const getStats = (params: Record<string, unknown>) =>
  api.get('/stats', { params }).then((r) => r.data);
```

Remplacer par :
```typescript
export const getStats = (params?: Record<string, unknown>) =>
  api.get('/stats', { params }).then((r) => r.data);

export const getAdminBackups = (page = 1, limit = 50) =>
  api.get('/admin/backups', { params: { page, limit } }).then((r) => r.data);

export const createBackup = () =>
  api.post('/admin/backups').then((r) => r.data);
```

---

## Étape 3 — Créer `DataTab.tsx`

### Fichier à créer : `client/src/components/dashboard/DataTab.tsx`

```tsx
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { getStats, getAnalytics, exportCsv } from '../../lib/api';
import { useRange } from '../../hooks/useRange';
import { formatDate } from '../../lib/utils';
import Pagination from '../ui/Pagination';

export default function DataTab() {
  const { days } = useRange();
  const [page, setPage] = useState(1);

  const { data: analytics } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => getAnalytics(days),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', page, days],
    queryFn: () => getStats({ page, limit: 50, days }),
    placeholderData: keepPreviousData,
  });

  const waterSeries  = (analytics as any)?.dailyWater        ?? [];
  const statsList    = (stats as any)?.data                  ?? [];
  const statsTotal   = (stats as any)?.total                 ?? 0;

  return (
    <div className="space-y-6">

      {/* Bandeau contexte */}
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-5 py-4">
        <span className="text-xl">💧</span>
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-0.5">Données santé quotidiennes</p>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Volume d'eau (verres), mouvements et atteinte des objectifs par utilisateur, agrégés par jour.
          </p>
        </div>
      </div>

      {/* Graphiques */}
      {waterSeries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">💧 Eau (verres/j)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={waterSeries}>
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip labelFormatter={formatDate} formatter={(v: number) => [v, 'verres']} />
                <Area type="monotone" dataKey="avg" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table + export */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Données détaillées</h3>
          <button
            onClick={() => exportCsv('stats', { days })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-700">
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">💧 Eau</th>
              <th className="px-4 py-3 font-medium">🏃 Mouvements</th>
              <th className="px-4 py-3 font-medium">Objectif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {statsList.map((s: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{s.userId?.slice(0, 16)}…</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.date}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.water}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.movements}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.goalsReached
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {s.goalsReached ? '✅ Atteint' : '❌ Non atteint'}
                  </span>
                </td>
              </tr>
            ))}
            {statsList.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucune donnée</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {stats && <Pagination page={page} total={statsTotal} limit={50} onChange={setPage} />}
    </div>
  );
}
```

---

## Étape 4 — Créer `BackupsTab.tsx`

### Fichier à créer : `client/src/components/dashboard/BackupsTab.tsx`

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getAdminBackups, createBackup } from '../../lib/api';
import Pagination from '../ui/Pagination';

function fmtBytes(b: number): string {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

export default function BackupsTab() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: backups } = useQuery({
    queryKey: ['admin-backups', page],
    queryFn: () => getAdminBackups(page, 50),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-backups'] }),
  });

  const list  = (backups as any)?.data  ?? [];
  const total = (backups as any)?.total ?? 0;

  return (
    <div className="space-y-6">

      {/* Panel sauvegardes utilisateurs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">💾 Sauvegardes utilisateurs</h3>
            <p className="text-xs text-slate-400 mt-0.5">Backups des données mobiles envoyés par l'application MOOD.</p>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {mutation.isPending ? 'En cours…' : '+ Créer un backup'}
          </button>
        </div>

        {list.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">Aucune sauvegarde utilisateur enregistrée.</p>
            <p className="text-xs mt-1">Les backups apparaissent quand l'application mobile synchronise ses données.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-700">
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Backup ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Taille</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {list.map((b: any) => (
                <tr key={b.backupId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{b.userId?.slice(0, 16)}…</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{b.backupId?.slice(0, 16)}…</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(b.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtBytes(b.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {backups && <Pagination page={page} total={total} limit={50} onChange={setPage} />}
    </div>
  );
}
```

---

## Étape 5 — Ajouter les 2 onglets dans `DashboardPage.tsx`

### Fichier à modifier : `client/src/pages/DashboardPage.tsx`

#### 5a. Ajouter les imports

Localiser :
```tsx
import UsersTab from '../components/users/UsersTab';
import EventsTab from '../components/events/EventsTab';
```

Remplacer par :
```tsx
import UsersTab from '../components/users/UsersTab';
import EventsTab from '../components/events/EventsTab';
import DataTab from '../components/dashboard/DataTab';
import BackupsTab from '../components/dashboard/BackupsTab';
```

#### 5b. Ajouter les 2 nouveaux onglets dans TABS

Localiser :
```tsx
const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'events', label: 'Événements' },
];
```

Remplacer par :
```tsx
const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'users',    label: 'Utilisateurs' },
  { id: 'events',   label: 'Événements' },
  { id: 'data',     label: 'Données' },
  { id: 'backups',  label: 'Backups' },
];
```

#### 5c. Ajouter le rendu des 2 nouveaux onglets

Localiser :
```tsx
      {tab === 'users' && <UsersTab />}
      {tab === 'events' && <EventsTab />}
```

Remplacer par :
```tsx
      {tab === 'users'   && <UsersTab />}
      {tab === 'events'  && <EventsTab />}
      {tab === 'data'    && <DataTab />}
      {tab === 'backups' && <BackupsTab />}
```

---

## Étape 6 — Enrichir `Header.tsx` avec health check et auto-refresh

### Fichier à modifier : `client/src/components/layout/Header.tsx`

Remplacer l'intégralité du contenu par :

```tsx
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Moon, Sun, RefreshCw } from 'lucide-react';
import { getAlerts, getHealth, markAlertRead } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRange } from '../../hooks/useRange';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../types';

export default function Header() {
  const { logout, username } = useAuth();
  const { days, setDays } = useRange();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const [autoRefresh, setAutoRefresh] = useState(false);

  /* Alertes */
  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: 30_000,
  });

  /* Health check toutes les 30s */
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const isHealthy = (health as any)?.status === 'ok';

  /* Auto-refresh toutes les 30s (invalide tous les caches React Query) */
  useQuery({
    queryKey: ['auto-refresh-tick'],
    queryFn: async () => {
      queryClient.invalidateQueries();
      return null;
    },
    refetchInterval: autoRefresh ? 30_000 : false,
    enabled: autoRefresh,
  });

  const unread = (alerts as Alert[]).filter((a) => !a.isRead).length;

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleManualRefresh = () => queryClient.invalidateQueries();

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-3">

      {/* Période */}
      <div className="flex gap-1">
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              days === d
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {d}j
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Health dot */}
      <div className="flex items-center gap-1.5" title={isHealthy ? 'Serveur OK' : 'Serveur inaccessible'}>
        <span className={`relative flex h-2.5 w-2.5`}>
          {isHealthy && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline">
          {isHealthy ? 'API' : 'Hors ligne'}
        </span>
      </div>

      {/* Refresh manuel */}
      <button
        onClick={handleManualRefresh}
        title="Rafraîchir"
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
      >
        <RefreshCw size={16} />
      </button>

      {/* Auto-refresh toggle */}
      <button
        onClick={() => setAutoRefresh(!autoRefresh)}
        title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
          autoRefresh
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        {autoRefresh ? '30s ●' : '30s ○'}
      </button>

      {/* Alertes */}
      <div className="relative">
        <button
          onClick={() => {
            refetchAlerts();
            if (unread > 0) {
              (alerts as Alert[]).filter((a) => !a.isRead).forEach((a) => markAlertRead(a.id));
            }
          }}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Dark mode */}
      <button onClick={toggleDark} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <span className="text-sm text-slate-600 dark:text-slate-400">{username}</span>

      <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        <LogOut size={18} />
      </button>
    </header>
  );
}
```

---

## Étape 7 — Enrichir `UserDetailPage.tsx`

### Fichier à modifier : `client/src/pages/UserDetailPage.tsx`

Remplacer l'intégralité du contenu par :

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getUserDetail } from '../lib/api';
import { useRange } from '../hooks/useRange';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatDate } from '../lib/utils';

function fmtBytes(b: number | null | undefined): string {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

const STAT_VARIANTS = {
  neutral:    { accent: '#64748b', bg: '#f8fafc', iconBg: '#f1f5f9' },
  engagement: { accent: '#3b82f6', bg: '#eff6ff', iconBg: '#dbeafe' },
  health:     { accent: '#8b5cf6', bg: '#f5f3ff', iconBg: '#ede9fe' },
  water:      { accent: '#0ea5e9', bg: '#f0f9ff', iconBg: '#e0f2fe' },
  move:       { accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
};

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { days } = useRange();

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', userId, days],
    queryFn: () => getUserDetail(userId!, days),
    enabled: !!userId,
  });

  if (isLoading) return <div className="p-8 text-slate-400">Chargement…</div>;
  if (!data)     return <div className="p-8 text-red-500">Utilisateur introuvable</div>;

  const { user, stats, history, recentEvents, backups } = data as any;

  /* Historique inversé pour goal strip */
  const last14 = [...(history ?? [])].slice(-14);
  const hasDualChart = history?.some((r: any) => r.movements > 0);

  const statCards = [
    { icon: '📅', label: "Inscrit le",         value: new Date(user.createdAt).toLocaleDateString('fr-FR'),         sub: 'Date d\'inscription', variant: 'neutral'    as const },
    { icon: '💓', label: 'Dernière activité',  value: recentEvents?.[0] ? new Date(recentEvents[0].timestamp).toLocaleDateString('fr-FR') : '—', sub: 'Dernier événement', variant: 'engagement' as const },
    { icon: '⚡', label: 'Événements',         value: recentEvents?.length ?? 0,   sub: `${days} derniers jours`,  variant: 'engagement' as const },
    { icon: '📊', label: 'Jours actifs',       value: stats.totalDays,              sub: `${days} derniers jours`, variant: 'engagement' as const },
    { icon: '🎯', label: 'Objectifs atteints', value: `${stats.goalsRate}%`,         sub: 'Taux de réussite',       variant: 'health'     as const },
    { icon: '💧', label: 'Eau moyenne',        value: `${stats.avgWater}`,           sub: 'verres/jour',            variant: 'water'      as const },
    { icon: '🏃', label: 'Mouvements moy.',    value: stats.avgMovements ?? '—',     sub: 'par jour',               variant: 'move'       as const },
    { icon: '💾', label: 'Sauvegardes',        value: backups?.length ?? 0,          sub: 'fichiers',               variant: 'neutral'    as const },
  ];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {user.email ?? <span className="font-mono text-base">{user.userId}</span>}
          </h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">{user.userId}</p>
        </div>
      </div>

      {/* 8 stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const v = STAT_VARIANTS[s.variant];
          return (
            <div
              key={s.label}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
              style={{ borderTop: `3px solid ${v.accent}` }}
            >
              <span className="w-8 h-8 flex items-center justify-center text-lg rounded-lg mb-2" style={{ background: v.iconBg }}>
                {s.icon}
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{String(s.value)}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
              <p className="text-xs text-slate-400">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Graphique santé (dual-line si mouvements dispo) */}
      {history?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📈</span>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Évolution santé</h3>
              <p className="text-xs text-slate-400">Eau (verres) et mouvements par jour</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {hasDualChart ? (
              <LineChart data={history}>
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip labelFormatter={formatDate} />
                <Legend iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="water"     stroke="#0ea5e9" strokeWidth={2} dot={false} name="💧 Eau" />
                <Line type="monotone" dataKey="movements" stroke="#059669" strokeWidth={2} dot={false} name="🏃 Mouvements" />
              </LineChart>
            ) : (
              <AreaChart data={history}>
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip labelFormatter={formatDate} formatter={(v: number) => [v, '💧 verres']} />
                <Area type="monotone" dataKey="water" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={2} dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Goal strip — 14 derniers jours */}
      {last14.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Objectifs — 14 derniers jours</h3>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {last14.map((r: any, i: number) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-5 h-5 rounded"
                  style={{
                    background: r.goalsReached ? '#059669' : '#e2e8f0',
                    border: r.goalsReached ? 'none' : '1px solid #cbd5e1',
                  }}
                  title={`${r.date} : ${r.goalsReached ? 'Atteint' : 'Non atteint'}`}
                />
                <span className="text-xs text-slate-400" style={{ fontSize: '9px' }}>
                  {r.date?.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            ■ = objectif atteint · □ = non atteint
          </p>
        </div>
      )}

      {/* Événements récents */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">⚡ Événements récents</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-50 dark:border-slate-700">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {recentEvents?.map((e: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-mono">{e.type}</span>
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">{new Date(e.timestamp).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-2 text-slate-400 text-xs font-mono truncate max-w-[200px]">
                  {e.payload ? JSON.stringify(e.payload).slice(0, 80) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sauvegardes */}
      {backups?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">💾 Sauvegardes</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-50 dark:border-slate-700">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Backup ID</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Taille</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {backups.map((b: any) => (
                <tr key={b.backupId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">{b.backupId?.slice(0, 16)}…</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{new Date(b.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{fmtBytes(b.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

---

## Critères de validation

### Onglet Données
- [ ] L'onglet "Données" est visible dans la navbar des tabs
- [ ] Le graphique Eau (verres/j) s'affiche si des données existent
- [ ] La table affiche les colonnes : User ID, Date, Eau, Mouvements, Objectif (badge ✅/❌)
- [ ] Le bouton Export CSV est présent
- [ ] La pagination fonctionne

### Onglet Backups
- [ ] L'onglet "Backups" est visible dans la navbar des tabs
- [ ] Le bouton "+ Créer un backup" est présent et cliquable
- [ ] La table affiche User ID, Backup ID, Date, Taille
- [ ] Si aucune donnée : affichage du message 📭

### Header
- [ ] Un dot vert pulsant est visible (santé serveur OK)
- [ ] Le dot devient orange si le serveur est injoignable
- [ ] Le bouton 🔄 refresh invalide tous les caches React Query
- [ ] Le bouton "30s ○ / ●" toggle l'auto-refresh (vert quand actif)

### UserDetail
- [ ] 8 stats cartes affichées avec border-top colorée selon variant
- [ ] Le graphique dual-line (eau + mouvements) s'affiche si des mouvements existent
- [ ] Le goal strip 14 jours s'affiche avec carrés verts (atteint) / gris (non atteint)
- [ ] La colonne Payload est visible dans la table événements
- [ ] La section Sauvegardes s'affiche si `backups.length > 0`

### Backend
- [ ] `GET /api/stats` retourne `{ data, total, page, limit }`
- [ ] `GET /api/admin/backups` retourne `{ data, total, page, limit }`
- [ ] `POST /api/admin/backups` retourne `{ ok: true }`

### TypeScript
- [ ] `npx tsc --noEmit` dans `server/` sans erreur.
- [ ] `npx tsc --noEmit` dans `client/` sans erreur (le cas échéant, corriger les `any` si demandé).

---

## Livrable

Créer `client/docs/PROMPT-B-tabs-features.RESULTAT.md` avec :
1. Fichiers créés / modifiés.
2. Erreurs rencontrées et résolutions.
3. Tableau de verdicts (✅ / ❌ par critère).
4. Verdict global : **OK** ou **BLOQUÉ**.

---

*Après ce prompt : supprimer les fichiers JSX de référence (`client/src/Dashboard.jsx`, `Login.jsx`, etc.) devenus inutiles, puis commit + push + `docker compose up -d --build` sur le serveur.*
