import { cn } from '../../lib/utils';

const map: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  dormant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  churned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const labels: Record<string, string> = { active: 'Actif', dormant: 'Dormant', churned: 'Churné' };

export default function SegmentBadge({ segment }: { segment: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[segment] ?? 'bg-slate-100 text-slate-500')}>
      {labels[segment] ?? segment}
    </span>
  );
}
