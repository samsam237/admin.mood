import type { SegmentData } from '../../types';

interface Props {
  data: SegmentData;
}

const SEGMENT_CONFIG = [
  { key: 'active'  as const, label: 'Actifs',   emoji: '💪', accent: '#059669', border: '#059669' },
  { key: 'dormant' as const, label: 'Dormants',  emoji: '😴', accent: '#f59e0b', border: '#f59e0b' },
  { key: 'churned' as const, label: 'Churnés',  emoji: '💤', accent: '#ef4444', border: '#ef4444' },
];

export default function SegmentCards({ data }: Props) {
  const total = (data.active ?? 0) + (data.dormant ?? 0) + (data.churned ?? 0);
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition"
           style={{ borderTop: '3px solid #64748b' }}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{total}</p>
        <p className="text-xs text-slate-400 mt-1">utilisateurs inscrits</p>
      </div>

      {SEGMENT_CONFIG.map((s) => {
        const count = data[s.key] ?? 0;
        return (
          <div
            key={s.key}
            className="relative bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition overflow-hidden"
            style={{ borderTop: `3px solid ${s.border}` }}
          >
            <span className="absolute right-3 top-2 text-4xl opacity-10 select-none pointer-events-none">
              {s.emoji}
            </span>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{count}</p>
            <p className="text-xs mt-1" style={{ color: s.accent }}>
              {pct(count)}% du total
            </p>
          </div>
        );
      })}
    </div>
  );
}
