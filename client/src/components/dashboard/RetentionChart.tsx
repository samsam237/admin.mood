import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { RetentionData } from '../../types';

interface Props { data: RetentionData }

export default function RetentionChart({ data }: Props) {
  const chartData = [
    { label: 'J1', value: data.d1 },
    { label: 'J7', value: data.d7 },
    { label: 'J30', value: data.d30 },
  ];
  const colors = ['#0ea5e9', '#6366f1', '#8b5cf6'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rétention (cohorte)</h3>
        <span className="text-xs text-slate-400">{data.cohortSize} users</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} barSize={48}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
          <Tooltip formatter={(v: number) => [`${v}%`, 'Rétention']} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
