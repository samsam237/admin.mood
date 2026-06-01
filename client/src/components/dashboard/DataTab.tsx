import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { getStats, getAnalytics, exportCsv } from '../../lib/api';
import { useRange } from '../../hooks/useRange';
import { formatDate, truncateId } from '../../lib/utils';
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

  const waterSeries = (analytics as { dailyWater?: { date: string; avg: number }[] })?.dailyWater ?? [];
  const statsList = (stats as { data?: Record<string, unknown>[] })?.data ?? [];
  const statsTotal = (stats as { total?: number })?.total ?? 0;

  return (
    <div className="space-y-6">

      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-5 py-4">
        <span className="text-xl">💧</span>
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-0.5">Données santé quotidiennes</p>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Volume d'eau (verres), mouvements et atteinte des objectifs par utilisateur, agrégés par jour.
          </p>
        </div>
      </div>

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
            {statsList.map((s, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{truncateId(s.userId as string | undefined)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{String(s.date ?? '')}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{String(s.water ?? '')}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{String(s.movements ?? '')}</td>
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
