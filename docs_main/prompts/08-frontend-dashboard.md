# Prompt 08 — Frontend : Dashboard Overview + KPI Cards + Charts

## Contexte
Frontend `mood-admin` : page principale du dashboard avec les KPIs, graphiques de tendances, rétention et segmentation. Ce prompt crée `DashboardPage`, `KpiCard`, et tous les composants de visualisation.

## Prérequis
- Prompt 07 complété (layout, auth, hooks fonctionnels)
- Backend analytique opérationnel

## Instructions

### 1. Composant KpiCard — `client/src/components/dashboard/KpiCard.tsx`

```tsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatNumber, formatTrend } from '@/lib/utils';
import { KpiMetric } from '@/types';

interface Props {
  label: string;
  metric: KpiMetric;
  unit?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
};

export default function KpiCard({ label, metric, unit = '', icon, color = 'blue' }: Props) {
  const TrendIcon = metric.trend > 0 ? TrendingUp : metric.trend < 0 ? TrendingDown : Minus;
  const trendColor = metric.trend > 0 ? 'text-green-500' : metric.trend < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatNumber(metric.value)}{unit}
          </p>
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-xl', colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
      <div className={cn('flex items-center gap-1.5 mt-3 text-sm font-medium', trendColor)}>
        <TrendIcon size={14} />
        <span>{formatTrend(metric.trend)}</span>
        <span className="text-slate-400 font-normal">vs période préc.</span>
      </div>
    </div>
  );
}
```

### 2. Graphique DAU — `client/src/components/dashboard/DauChart.tsx`

```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '@/lib/utils';

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
```

### 3. Graphique Rétention — `client/src/components/dashboard/RetentionChart.tsx`

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RetentionData } from '@/types';

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
```

### 4. Graphique Segmentation — `client/src/components/dashboard/SegmentChart.tsx`

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SegmentData } from '@/types';

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
```

### 5. Graphique tendances events — `client/src/components/dashboard/EventTrendsChart.tsx`

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDate } from '@/lib/utils';

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
            <Bar key={type} dataKey={type} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === types.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 6. Page Dashboard — `client/src/pages/DashboardPage.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { Users, Activity, Target, Zap, Eye, BarChart2 } from 'lucide-react';
import { useRange } from '@/hooks/useRange';
import { getKpis, getAnalytics, getRetention, getSegments, getEventTrends, getOverview } from '@/lib/api';
import KpiCard from '@/components/dashboard/KpiCard';
import DauChart from '@/components/dashboard/DauChart';
import RetentionChart from '@/components/dashboard/RetentionChart';
import SegmentChart from '@/components/dashboard/SegmentChart';
import EventTrendsChart from '@/components/dashboard/EventTrendsChart';

export default function DashboardPage() {
  const { days } = useRange();
  const opts = { placeholderData: keepPreviousData, refetchInterval: 30_000 };

  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: getOverview, ...opts });
  const { data: kpis } = useQuery({ queryKey: ['kpis', days], queryFn: () => getKpis(days), ...opts });
  const { data: analytics } = useQuery({ queryKey: ['analytics', days], queryFn: () => getAnalytics(days), ...opts });
  const { data: retention } = useQuery({ queryKey: ['retention'], queryFn: getRetention, ...opts });
  const { data: segments } = useQuery({ queryKey: ['segments'], queryFn: getSegments, ...opts });
  const { data: trends } = useQuery({ queryKey: ['trends', days], queryFn: () => getEventTrends(days), ...opts });

  if (!kpis) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview pills */}
      {overview && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total users', value: overview.totalUsers },
            { label: 'Total events', value: overview.totalEvents },
            { label: 'Actifs aujourd\'hui', value: overview.activeToday },
            { label: 'Nouveaux aujourd\'hui', value: overview.newUsersToday },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-2 border border-slate-100 dark:border-slate-700 shadow-sm flex gap-2 items-center">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="DAU" metric={kpis.dau} icon={<Activity size={18} />} color="blue" />
        <KpiCard label="WAU" metric={kpis.wau} icon={<Users size={18} />} color="purple" />
        <KpiCard label="MAU" metric={kpis.mau} icon={<Users size={18} />} color="green" />
        <KpiCard label="Stickiness" metric={kpis.stickiness} unit="%" icon={<Zap size={18} />} color="orange" />
        <KpiCard label="Objectifs" metric={kpis.goalsRate} unit="%" icon={<Target size={18} />} color="green" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analytics?.dailyActiveUsers && <DauChart data={analytics.dailyActiveUsers} />}
        {trends && <EventTrendsChart data={trends} />}
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {retention && <RetentionChart data={retention} />}
        {segments && <SegmentChart data={segments} />}
      </div>
    </div>
  );
}
```

## Validation
- [ ] Le dashboard affiche 5 KpiCards avec valeurs et tendances
- [ ] Le graphique DAU affiche une courbe sur la plage sélectionnée
- [ ] Changer la plage (7j → 90j) met à jour les graphiques sans flash blanc
- [ ] Le graphique de rétention affiche les 3 barres J1/J7/J30
- [ ] Le donut de segmentation affiche les 3 segments
- [ ] Le stacked bar des tendances affiche les types d'événements

## Pièges à éviter
- `keepPreviousData` (TanStack Query v5) évite le flash blanc au changement de plage — l'importer depuis `@tanstack/react-query`
- `refetchInterval: 30_000` sur chaque query — ne pas oublier, sinon les données ne se mettent pas à jour automatiquement
- `ResponsiveContainer` de Recharts nécessite un parent avec une hauteur définie — le `h-[200px]` ou le `height={200}` interne suffit
- Vérifier que `data` n'est pas `undefined` avant de passer aux composants graphiques (utiliser `&&`)
