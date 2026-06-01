import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, formatNumber, formatTrend } from '../../lib/utils';
import type { KpiMetric } from '../../types';

interface Props {
  label: string;
  metric: KpiMetric;
  unit?: string;
  icon?: string;
  sublabel?: string;
  sparklineData?: { [key: string]: number | string }[];
  sparklineKey?: string;
  variant?: 'acquisition' | 'engagement' | 'health' | 'retention' | 'default';
}

const variantMap = {
  acquisition: { accent: '#059669', iconBg: '#d1fae5', border: '#059669' },
  engagement:  { accent: '#3b82f6', iconBg: '#dbeafe', border: '#3b82f6' },
  health:      { accent: '#8b5cf6', iconBg: '#ede9fe', border: '#8b5cf6' },
  retention:   { accent: '#f59e0b', iconBg: '#fef3c7', border: '#f59e0b' },
  default:     { accent: '#64748b', iconBg: '#f1f5f9', border: '#64748b' },
};

export default function KpiCard({
  label,
  metric,
  unit = '',
  icon,
  sublabel,
  sparklineData,
  sparklineKey = 'count',
  variant = 'default',
}: Props) {
  const v = variantMap[variant];
  const trend = metric.trend ?? 0;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col gap-2"
      style={{ borderTop: `3px solid ${v.border}` }}
    >
      <div className="flex items-start justify-between">
        {icon && (
          <span
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl flex-shrink-0"
            style={{ background: v.iconBg }}
          >
            {icon}
          </span>
        )}
        <div className={cn('flex items-center gap-1 text-xs font-semibold', trendColor)}>
          <TrendIcon size={12} />
          <span>{formatTrend(trend)}</span>
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
          {typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value}{unit}
        </p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>}
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <div className="h-7 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Tooltip content={() => null} />
              <Line
                type="monotone"
                dataKey={sparklineKey}
                stroke={v.accent}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
