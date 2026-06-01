import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatNumber, formatTrend } from '../../lib/utils';
import type { KpiMetric } from '../../types';

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
