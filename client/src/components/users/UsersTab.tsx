import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { getUsers, exportCsv } from '../../lib/api';
import type { AppUser } from '../../types';
import SegmentBadge from '../ui/SegmentBadge';
import Pagination from '../ui/Pagination';

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
