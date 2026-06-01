import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '../../lib/utils';

interface Props {
  data: { date: string; count: number }[];
}

export default function DauChart({ data }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
        Utilisateurs actifs quotidiens
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            formatter={(v: number) => [v, 'DAU']}
            labelFormatter={formatDate}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Area type="monotone" dataKey="count" stroke="#0ea5e9" fill="url(#dauGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
