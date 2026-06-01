import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Users, Activity, Target, Zap } from 'lucide-react';
import { useRange } from '../hooks/useRange';
import { getKpis, getAnalytics, getRetention, getSegments, getEventTrends, getOverview } from '../lib/api';
import KpiCard from '../components/dashboard/KpiCard';
import DauChart from '../components/dashboard/DauChart';
import RetentionChart from '../components/dashboard/RetentionChart';
import SegmentChart from '../components/dashboard/SegmentChart';
import EventTrendsChart from '../components/dashboard/EventTrendsChart';
import UsersTab from '../components/users/UsersTab';
import EventsTab from '../components/events/EventsTab';
import type { KpiData, OverviewData, RetentionData, SegmentData } from '../types';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'events', label: 'Événements' },
];

export default function DashboardPage() {
  const { days } = useRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'overview';
  const opts = { placeholderData: keepPreviousData, refetchInterval: 30_000 };

  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: getOverview, ...opts });
  const { data: kpis } = useQuery({ queryKey: ['kpis', days], queryFn: () => getKpis(days), ...opts });
  const { data: analytics } = useQuery({ queryKey: ['analytics', days], queryFn: () => getAnalytics(days), ...opts });
  const { data: retention } = useQuery({ queryKey: ['retention'], queryFn: getRetention, ...opts });
  const { data: segments } = useQuery({ queryKey: ['segments'], queryFn: getSegments, ...opts });
  const { data: trends } = useQuery({ queryKey: ['trends', days], queryFn: () => getEventTrends(days), ...opts });

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams(t.id === 'overview' ? {} : { tab: t.id })}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'events' && <EventsTab />}

      {tab === 'overview' && (
        <>
          {(overview as OverviewData | undefined) && (
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Total users', value: (overview as OverviewData).totalUsers },
                { label: 'Total events', value: (overview as OverviewData).totalEvents },
                { label: "Actifs aujourd'hui", value: (overview as OverviewData).activeToday },
                { label: "Nouveaux aujourd'hui", value: (overview as OverviewData).newUsersToday },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-2 border border-slate-100 dark:border-slate-700 shadow-sm flex gap-2 items-center">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {kpis ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KpiCard label="DAU" metric={(kpis as KpiData).dau} icon={<Activity size={18} />} color="blue" />
              <KpiCard label="WAU" metric={(kpis as KpiData).wau} icon={<Users size={18} />} color="purple" />
              <KpiCard label="MAU" metric={(kpis as KpiData).mau} icon={<Users size={18} />} color="green" />
              <KpiCard label="Stickiness" metric={(kpis as KpiData).stickiness} unit="%" icon={<Zap size={18} />} color="orange" />
              <KpiCard label="Objectifs" metric={(kpis as KpiData).goalsRate} unit="%" icon={<Target size={18} />} color="green" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400">Chargement…</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(analytics as { dailyActiveUsers?: { date: string; count: number }[] } | undefined)?.dailyActiveUsers && (
              <DauChart data={(analytics as { dailyActiveUsers: { date: string; count: number }[] }).dailyActiveUsers} />
            )}
            {trends && <EventTrendsChart data={trends as Record<string, unknown>[]} />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {retention && <RetentionChart data={retention as RetentionData} />}
            {segments && <SegmentChart data={segments as SegmentData} />}
          </div>
        </>
      )}
    </div>
  );
}
