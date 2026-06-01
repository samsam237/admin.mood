# Prompt 09 — Frontend : pages Users, Events, Stats, UserDetail

## Contexte
Frontend `mood-admin` : pages de listing avec filtres et pagination, et page de détail utilisateur. Ce prompt crée les composants pour les onglets Users, Events, Stats et la page `/users/:userId`.

## Prérequis
- Prompts 07 et 08 complétés
- Composants de base disponibles (`cn`, `useRange`, `api.ts`)

## Instructions

### 1. Composant réutilisable Pagination — `client/src/components/ui/Pagination.tsx`

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-600 dark:text-slate-400">
      <span>{total.toLocaleString()} résultats</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span>Page {page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

### 2. Badge statut — `client/src/components/ui/SegmentBadge.tsx`

```tsx
import { cn } from '@/lib/utils';

const map: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  dormant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  churned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const labels: Record<string, string> = { active: 'Actif', dormant: 'Dormant', churned: 'Churné' };

export default function SegmentBadge({ segment }: { segment: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[segment] ?? 'bg-slate-100 text-slate-500')}>
      {labels[segment] ?? segment}
    </span>
  );
}
```

### 3. Onglet Users — `client/src/components/users/UsersTab.tsx`

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { getUsers, exportCsv } from '@/lib/api';
import { AppUser } from '@/types';
import SegmentBadge from '@/components/ui/SegmentBadge';
import Pagination from '@/components/ui/Pagination';

const SEGMENTS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'dormant', label: 'Dormants' },
  { value: 'churned', label: 'Churnés' },
];

export default function UsersTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['users', page, segment, search],
    queryFn: () => getUsers({ page, limit: 20, segment: segment || undefined, q: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setSegment(s.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                segment === s.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email ou ID…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition">
            Chercher
          </button>
        </form>

        <button
          onClick={() => exportCsv('users')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-700">
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Segment</th>
              <th className="px-4 py-3 font-medium">Événements</th>
              <th className="px-4 py-3 font-medium">Dernière activité</th>
              <th className="px-4 py-3 font-medium">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {data?.data.map((user: AppUser) => (
              <tr
                key={user.userId}
                onClick={() => navigate(`/users/${user.userId}`)}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 dark:text-white">{user.email ?? '—'}</p>
                  <p className="text-xs text-slate-400 font-mono">{user.userId.slice(0, 16)}…</p>
                </td>
                <td className="px-4 py-3">
                  <SegmentBadge segment={user.segment ?? ''} />
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{user.eventCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-500">
                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun utilisateur trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={page} total={data.total} limit={20} onChange={setPage} />}
    </div>
  );
}
```

### 4. Onglet Events — `client/src/components/events/EventsTab.tsx`

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getEvents, exportCsv } from '@/lib/api';
import { useRange } from '@/hooks/useRange';
import { Event } from '@/types';
import Pagination from '@/components/ui/Pagination';

export default function EventsTab() {
  const { days } = useRange();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const { data } = useQuery({
    queryKey: ['events', page, type, days],
    queryFn: () => getEvents({ page, limit: 50, type: type || undefined, days }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          placeholder="Filtrer par type…"
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={() => exportCsv('events', { days: String(days), type })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-700">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {data?.data.map((e: Event) => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-mono">
                    {e.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{e.userId.slice(0, 16)}…</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(e.timestamp).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={page} total={data.total} limit={50} onChange={setPage} />}
    </div>
  );
}
```

### 5. Dashboard Page — mise à jour avec onglets

Mettre à jour `DashboardPage.tsx` pour intégrer les onglets :

```tsx
import { useSearchParams } from 'react-router-dom';
import UsersTab from '@/components/users/UsersTab';
import EventsTab from '@/components/events/EventsTab';
// ... imports existants

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'events', label: 'Événements' },
  { id: 'stats', label: 'Statistiques' },
];

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'overview';
  // ... reste du code existant

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams(t.id === 'overview' ? {} : { tab: t.id })}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewContent kpis={kpis} analytics={analytics} retention={retention} segments={segments} trends={trends} overview={overview} />}
      {tab === 'users' && <UsersTab />}
      {tab === 'events' && <EventsTab />}
    </div>
  );
}
```

### 6. Page UserDetail — `client/src/pages/UserDetailPage.tsx`

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getUserDetail } from '@/lib/api';
import { useRange } from '@/hooks/useRange';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '@/lib/utils';

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
  if (!data) return <div className="p-8 text-red-500">Utilisateur introuvable</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{data.user.email ?? data.user.userId}</h1>
          <p className="text-sm text-slate-500 font-mono">{data.user.userId}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Jours actifs', value: data.stats.totalDays },
          { label: 'Eau moy. (verres)', value: `${data.stats.avgWater}` },
          { label: 'Objectifs atteints', value: `${data.stats.goalsRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Historique eau */}
      {data.history.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Consommation d'eau (verres)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.history}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
              <Tooltip labelFormatter={formatDate} />
              <Area type="monotone" dataKey="water" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Événements récents */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Événements récents</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-50 dark:border-slate-700">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {data.recentEvents.map((e: { type: string; timestamp: string }, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-mono">{e.type}</span>
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">{new Date(e.timestamp).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Validation
- [ ] Onglet "Utilisateurs" affiche la table paginée
- [ ] Filtrer par segment "Actifs" réduit la liste
- [ ] Recherche par email fonctionne
- [ ] Clic sur une ligne navigue vers `/users/:userId`
- [ ] Page détail affiche stats, graphique eau et événements récents
- [ ] Export CSV Users télécharge un fichier
- [ ] Onglet "Événements" affiche les events avec filtre type

## Pièges à éviter
- La navigation onglets via `useSearchParams` permet le retour arrière navigateur (contrairement au state local)
- `useNavigate(-1)` sur la page détail revient à la liste — ne pas hardcoder `/`
- La table Users avec beaucoup de colonnes peut déborder sur mobile — prévoir `overflow-x-auto` sur le container si nécessaire
