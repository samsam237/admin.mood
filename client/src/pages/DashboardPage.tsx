import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useRange } from '../hooks/useRange';
import { getKpis, getAnalytics, getRetention, getSegments, getEventTrends, getOverview } from '../lib/api';
import KpiCard from '../components/dashboard/KpiCard';
import SegmentCards from '../components/dashboard/SegmentCards';
import DauChart from '../components/dashboard/DauChart';
import RetentionChart from '../components/dashboard/RetentionChart';
import SegmentChart from '../components/dashboard/SegmentChart';
import EventTrendsChart from '../components/dashboard/EventTrendsChart';
import UsersTab from '../components/users/UsersTab';
import EventsTab from '../components/events/EventsTab';
import DataTab from '../components/dashboard/DataTab';
import BackupsTab from '../components/dashboard/BackupsTab';
import type { KpiData, OverviewData, RetentionData, SegmentData } from '../types';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'users',    label: 'Utilisateurs' },
  { id: 'events',   label: 'Événements' },
  { id: 'data',     label: 'Données' },
  { id: 'backups',  label: 'Backups' },
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

  const ov = overview as OverviewData | undefined;
  const kpi = kpis as KpiData | undefined;
  const ret = retention as RetentionData | undefined;
  const analyticsData = analytics as {
    dailyActiveUsers?: { date: string; count: number }[];
  } | undefined;

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

      {tab === 'users'   && <UsersTab />}
      {tab === 'events'  && <EventsTab />}
      {tab === 'data'    && <DataTab />}
      {tab === 'backups' && <BackupsTab />}

      {tab === 'overview' && (
        <>
          <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl px-5 py-4 mb-2">
            <span className="text-2xl flex-shrink-0">🌿</span>
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                MOOD — Application de santé et bien-être au quotidien
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed mb-2">
                Les utilisateurs suivent leur <strong>hydratation</strong> et leur <strong>activité physique</strong> chaque jour.
                Ce dashboard mesure l'adoption des habitudes santé, l'atteinte des objectifs et la fidélité dans le temps.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '💧 Hydratation', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                  { tag: '🏃 Activité physique', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
                  { tag: '🎯 Objectifs quotidiens', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
                  { tag: "🔥 Séries d'habitudes", color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
                ].map(({ tag, color }) => (
                  <span key={tag} className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
               style={{ borderLeft: '4px solid #059669' }}>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Croissance</h2>
            <p className="text-xs text-slate-400 mb-4">Acquisition et croissance de la base d'utilisateurs de l'application MOOD.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                icon="👥"
                label="Utilisateurs"
                sublabel="Total cumul"
                metric={{ value: ov?.totalUsers ?? 0, trend: 0 }}
                variant="acquisition"
              />
              <KpiCard
                icon="⚡"
                label="Événements"
                sublabel="Total"
                metric={{ value: ov?.totalEvents ?? 0, trend: 0 }}
                variant="acquisition"
              />
              <KpiCard
                icon="🌱"
                label="Nouveaux aujourd'hui"
                sublabel="Inscriptions du jour"
                metric={{ value: ov?.newUsersToday ?? 0, trend: 0 }}
                variant="acquisition"
              />
            </div>
          </div>

          {kpi && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #3b82f6' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Engagement</h2>
              <p className="text-xs text-slate-400 mb-4">
                Régularité d'utilisation : à quelle fréquence les utilisateurs reviennent-ils logguer leur santé ?
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon="📱" label="DAU"        sublabel="Actifs aujourd'hui"  metric={kpi.dau}        variant="engagement" />
                <KpiCard icon="📅" label="WAU"        sublabel="7 derniers jours"    metric={kpi.wau}        variant="engagement" />
                <KpiCard icon="📆" label="MAU"        sublabel="30 derniers jours"   metric={kpi.mau}        variant="engagement" />
                <KpiCard icon="🔗" label="Stickiness" sublabel="DAU / MAU"           metric={kpi.stickiness} variant="engagement" unit="%" />
              </div>
            </div>
          )}

          {kpi && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #8b5cf6' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Santé produit</h2>
              <p className="text-xs text-slate-400 mb-4">
                Est-ce que les utilisateurs atteignent leurs objectifs eau et mouvements quotidiens ?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <KpiCard icon="🎯" label="Objectifs atteints" sublabel={`Sur ${days} jours`} metric={kpi.goalsRate} variant="health" unit="%" />
                <KpiCard icon="📱" label="Actifs aujourd'hui" sublabel="Connectés dans les 24h" metric={{ value: ov?.activeToday ?? 0, trend: 0 }} variant="health" />
              </div>
            </div>
          )}

          {ret && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #f59e0b' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Rétention</h2>
              <p className="text-xs text-slate-400 mb-4">
                Sur la cohorte des 90 derniers jours, quel % revient à J+1, J+7, J+30 ?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard icon="📍" label="Rétention J+1"  sublabel="Retour le lendemain"  metric={{ value: ret.d1,  trend: 0 }} variant="retention" unit="%" />
                <KpiCard icon="📌" label="Rétention J+7"  sublabel="Retour semaine 1"     metric={{ value: ret.d7,  trend: 0 }} variant="retention" unit="%" />
                <KpiCard icon="🏆" label="Rétention J+30" sublabel="Habitude 30 jours"    metric={{ value: ret.d30, trend: 0 }} variant="retention" unit="%" />
              </div>
            </div>
          )}

          {segments && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Segmentation utilisateurs</h2>
              <SegmentCards data={segments as SegmentData} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(analyticsData?.dailyActiveUsers?.length ?? 0) > 0 && (
              <DauChart data={analyticsData!.dailyActiveUsers!} />
            )}
            {trends && Array.isArray(trends) && trends.length > 0 && (
              <EventTrendsChart data={trends as Record<string, unknown>[]} />
            )}
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
