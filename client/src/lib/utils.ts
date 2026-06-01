import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatTrend(trend: number | null | undefined): string {
  if (trend == null || Number.isNaN(trend)) return '—';
  if (trend > 0) return `+${trend.toFixed(1)}%`;
  if (trend < 0) return `${trend.toFixed(1)}%`;
  return '—';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Tronque un identifiant (userId, backupId…) sans planter si null/undefined. */
export function truncateId(value: string | null | undefined, max = 16): string {
  const s = value == null ? '' : String(value);
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
