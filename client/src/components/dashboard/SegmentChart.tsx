import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SegmentData } from '../../types';

interface Props { data: SegmentData }

export default function SegmentChart({ data }: Props) {
  const chartData = [
    { name: 'Actifs', value: data.active, color: '#22c55e' },
    { name: 'Dormants', value: data.dormant, color: '#f59e0b' },
    { name: 'Churnés', value: data.churned, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Segmentation</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
            {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [v, 'Users']} />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
