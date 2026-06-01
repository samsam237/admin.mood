import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getUserDetail } from '../lib/api';
import { useRange } from '../hooks/useRange';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatDate, truncateId } from '../lib/utils';

function fmtBytes(b: number | null | undefined): string {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

const STAT_VARIANTS = {
  neutral:    { accent: '#64748b', iconBg: '#f1f5f9' },
  engagement: { accent: '#3b82f6', iconBg: '#dbeafe' },
  health:     { accent: '#8b5cf6', iconBg: '#ede9fe' },
  water:      { accent: '#0ea5e9', iconBg: '#e0f2fe' },
  move:       { accent: '#059669', iconBg: '#d1fae5' },
};

interface HistoryRow {
  date: string;
  water: number;
  movements: number;
  goalsReached: boolean;
}

interface UserDetailResponse {
  user: { userId: string; email: string | null; createdAt: string };
  stats: { avgWater: number; avgMovements?: number; goalsRate: number; totalDays: number };
  history: HistoryRow[];
  recentEvents: { type: string; timestamp: string; payload: Record<string, unknown> | null }[];
  backups: { backupId: string; createdAt: string; sizeBytes: number }[];
}

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

  const { user, stats, history = [], recentEvents = [], backups = [] } = data as UserDetailResponse;

  const chartHistory = [...history].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last14 = chartHistory.slice(-14);
  const hasDualChart = history?.some((r) => r.movements > 0);

  const statCards = [
    { icon: '📅', label: "Inscrit le",         value: new Date(user.createdAt).toLocaleDateString('fr-FR'),         sub: "Date d'inscription", variant: 'neutral'    as const },
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

      {chartHistory.length > 0 && (
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
              <LineChart data={chartHistory}>
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip labelFormatter={formatDate} />
                <Legend iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="water"     stroke="#0ea5e9" strokeWidth={2} dot={false} name="💧 Eau" />
                <Line type="monotone" dataKey="movements" stroke="#059669" strokeWidth={2} dot={false} name="🏃 Mouvements" />
              </LineChart>
            ) : (
              <AreaChart data={chartHistory}>
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip labelFormatter={formatDate} formatter={(v: number) => [v, '💧 verres']} />
                <Area type="monotone" dataKey="water" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={2} dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {last14.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Objectifs — 14 derniers jours</h3>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {last14.map((r, i) => (
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
                  {r.date ? String(r.date).slice(5) : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            ■ = objectif atteint · □ = non atteint
          </p>
        </div>
      )}

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
            {recentEvents?.map((e, i) => (
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
              {backups.map((b) => (
                <tr key={b.backupId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">{truncateId(b.backupId)}</td>
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
