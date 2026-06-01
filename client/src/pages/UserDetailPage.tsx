import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getUserDetail } from '../lib/api';
import { useRange } from '../hooks/useRange';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '../lib/utils';

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
