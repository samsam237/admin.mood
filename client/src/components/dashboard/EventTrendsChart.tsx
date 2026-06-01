import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDate } from '../../lib/utils';

const COLORS = ['#0ea5e9', '#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

interface Props { data: Record<string, unknown>[] }

export default function EventTrendsChart({ data }: Props) {
  const types = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== 'date') : [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Événements par type</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip labelFormatter={formatDate} />
          <Legend iconType="circle" iconSize={8} />
          {types.slice(0, 5).map((type, i) => (
            <Bar
              key={type}
              dataKey={type}
              stackId="a"
              fill={COLORS[i % COLORS.length]}
              radius={i === types.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
