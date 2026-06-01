import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import {
  getOverview, getAnalytics, getKpis, getRetention, getEventTrends,
  exportReport, getBackupList, runBackup,
  getUserSegments, getUsers, getEvents, getStats, getAdminUserBackups, exportCsv,
} from './api';
import { useRange } from './RangeContext';
import KpiCard from './components/KpiCard';
import './Overview.css';
import './Tables.css';
import './Dashboard.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fillDays(series, daysBack, valueKey = 'count') {
  const out = [];
  const map = new Map((series || []).map((d) => [d.day, d]));
  const today = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const short = day.slice(5);
    const row = map.get(day);
    out.push({ day: short, full: day, [valueKey]: row ? (row[valueKey] ?? row.total ?? 0) : 0 });
  }
  return out;
}

function trendFromSeries(series, valueKey = 'count') {
  if (!series || series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).reduce((s, d) => s + (d[valueKey] ?? 0), 0);
  const second = series.slice(mid).reduce((s, d) => s + (d[valueKey] ?? 0), 0);
  if (first === 0) return second > 0 ? 100 : 0;
  return Math.round(((second - first) / first) * 1000) / 10;
}

const CHART_STYLE = {
  contentStyle: {
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    fontSize: '12px',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  },
};
const CHART_MARGIN = { margin: { top: 8, right: 12, left: 0, bottom: 0 } };
const TREND_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const { days, refreshKey } = useRange();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  /* ── État global ─────────────────────────────────────────────────────── */
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [data, setData]                 = useState(null);
  const [analytics, setAnalytics]       = useState(null);
  const [kpis, setKpis]                 = useState(null);
  const [retention, setRetention]       = useState(null);
  const [trends, setTrends]             = useState(null);
  const [backups, setBackups]           = useState([]);
  const [retentionDays, setRetentionDays] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);

  /* ── État onglet Utilisateurs ────────────────────────────────────────── */
  const [segments, setSegments]         = useState(null);
  const [usersData, setUsersData]       = useState({ users: [], total: 0 });
  const [usersPage, setUsersPage]       = useState(1);
  const [usersSegment, setUsersSegment] = useState('');
  const [usersQ, setUsersQ]             = useState('');

  /* ── État onglet Événements ──────────────────────────────────────────── */
  const [eventsData, setEventsData]     = useState({ events: [], total: 0 });
  const [eventsPage, setEventsPage]     = useState(1);
  const [eventsType, setEventsType]     = useState('');
  const [eventsUserId, setEventsUserId] = useState('');

  /* ── État onglet Données ─────────────────────────────────────────────── */
  const [statsData, setStatsData]       = useState({ stats: [], total: 0 });
  const [statsPage, setStatsPage]       = useState(1);

  /* ── État onglet Backups ─────────────────────────────────────────────── */
  const [userBackupsData, setUserBackupsData] = useState({ backups: [], total: 0 });
  const [userBackupsPage, setUserBackupsPage] = useState(1);

  /* ── Chargement initial ──────────────────────────────────────────────── */
  useEffect(() => {
    setError('');
    setAnalyticsError(false);
    getOverview()
      .then((overview) => {
        setData(overview);
        setLoading(false);
        setLastUpdated(new Date());
        return Promise.all([
          getAnalytics(days).then(setAnalytics).catch(() => { setAnalytics(null); setAnalyticsError(true); }),
          getKpis(days).then(setKpis).catch(() => setKpis(null)),
          getRetention().then(setRetention).catch(() => setRetention(null)),
          getEventTrends(days).then(setTrends).catch(() => setTrends(null)),
          getBackupList().then((d) => { setBackups(d.backups || []); setRetentionDays(d.retentionDays); }).catch(() => {}),
          getUserSegments().then(setSegments).catch(() => setSegments(null)),
          getUsers(1, 50, '', '').then(setUsersData).catch(() => {}),
          getEvents(1, 50, { days }).then(setEventsData).catch(() => {}),
          getStats(1, 50, { days }).then(setStatsData).catch(() => {}),
          getAdminUserBackups(50, 0).then(setUserBackupsData).catch(() => {}),
        ]);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  /* ── Réaction au changement de période ───────────────────────────────── */
  useEffect(() => {
    if (!data) return;
    getAnalytics(days).then(setAnalytics).catch(() => { setAnalytics(null); setAnalyticsError(true); });
    getKpis(days).then(setKpis).catch(() => setKpis(null));
    getEventTrends(days).then(setTrends).catch(() => setTrends(null));
    getEvents(1, 50, { days }).then(setEventsData).catch(() => {});
    getStats(1, 50, { days }).then(setStatsData).catch(() => {});
    setEventsPage(1);
    setStatsPage(1);
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pagination Utilisateurs ─────────────────────────────────────────── */
  useEffect(() => {
    getUsers(usersPage, 50, usersSegment, usersQ).then(setUsersData).catch(() => {});
  }, [usersPage, usersSegment, usersQ]);

  /* ── Pagination Événements ───────────────────────────────────────────── */
  useEffect(() => {
    getEvents(eventsPage, 50, { days, type: eventsType || undefined, userId: eventsUserId || undefined }).then(setEventsData).catch(() => {});
  }, [eventsPage, eventsType, eventsUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pagination Données ──────────────────────────────────────────────── */
  useEffect(() => {
    getStats(statsPage, 50, { days }).then(setStatsData).catch(() => {});
  }, [statsPage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pagination Backups utilisateurs ────────────────────────────────── */
  useEffect(() => {
    getAdminUserBackups(50, (userBackupsPage - 1) * 50).then(setUserBackupsData).catch(() => {});
  }, [userBackupsPage]);

  if (loading && !data) return <div className="page-loading">Chargement…</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!data) return null;

  const { totalUsers, totalEvents, recentEvents } = data;
  const a = analytics || {};
  const eventsFilled      = fillDays(a.eventsPerDay, days);
  const usersFilled       = fillDays(a.newUsersPerDay, days);
  const waterFilled       = fillDays(a.waterPerDay, days, 'total');
  const movementsFilled   = fillDays(a.movementsPerDay, days, 'total');
  const activeUsersFilled = fillDays(kpis?.activeUsersPerDay, days);

  const trendEvents    = trendFromSeries(eventsFilled, 'count');
  const trendActive    = trendFromSeries(activeUsersFilled, 'count');
  const trendNewUsers  = trendFromSeries(usersFilled, 'count');

  const segmentColors = { active: 'segment-active', dormant: 'segment-dormant', churned: 'segment-churned' };
  const churnRate = segments?.total > 0
    ? Math.round((((segments?.segments?.find(s => s.id === 'churned')?.count) ?? 0) / segments.total) * 1000) / 10
    : null;

  const userTotalPages       = Math.ceil(usersData.total / 50) || 1;
  const eventTotalPages      = Math.ceil(eventsData.total / 50) || 1;
  const statsTotalPages      = Math.ceil(statsData.total / 50) || 1;
  const userBackupTotalPages = Math.ceil(userBackupsData.total / 50) || 1;

  const trendTypes = trends?.series ? Object.keys(trends.series) : [];
  const trendsChartData = (trends?.dates || []).map((d, i) => {
    const point = { date: d.slice(5) };
    trendTypes.forEach((t) => { point[t] = trends.series[t][i] ?? 0; });
    return point;
  });

  /* ── Rendu ───────────────────────────────────────────────────────────── */
  return (
    <div className="dashboard">

      {/* Barre contextuelle */}
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-left">
          {lastUpdated && (
            <span className="dashboard-last-updated">
              Données au {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="dashboard-toolbar-right">
          {activeTab === 'overview' && (
            <button
              type="button"
              className="btn-export btn-sm"
              onClick={() => { setExportingReport(true); exportReport().catch((e) => alert(e.message)).finally(() => setExportingReport(false)); }}
              disabled={exportingReport}
            >
              {exportingReport ? 'Export…' : '↓ Rapport CSV'}
            </button>
          )}
        </div>
      </div>

      {analyticsError && (
        <div className="dashboard-warning" role="alert">
          Les courbes n'ont pas pu être chargées. Vérifiez que le serveur API est démarré.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 1 — Vue d'ensemble
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="tab-content" role="tabpanel">

              {/* ── Bandeau contexte produit ────────────────────────────── */}
          <div className="dashboard-context-banner">
            <span className="dashboard-context-banner-icon">🌿</span>
            <div className="dashboard-context-banner-text">
              <p className="dashboard-context-banner-title">MOOD — Application de santé et bien-être au quotidien</p>
              <p className="dashboard-context-banner-desc">
                Les utilisateurs suivent leur <strong>hydratation</strong> et leur <strong>activité physique</strong> chaque jour.
                Ce dashboard mesure l'adoption des habitudes santé, l'atteinte des objectifs et la fidélité dans le temps.
              </p>
              <div className="dashboard-context-banner-tags">
                <span className="dashboard-context-tag dashboard-context-tag--water">💧 Hydratation</span>
                <span className="dashboard-context-tag dashboard-context-tag--move">🏃 Activité physique</span>
                <span className="dashboard-context-tag dashboard-context-tag--goal">🎯 Objectifs quotidiens</span>
                <span className="dashboard-context-tag dashboard-context-tag--streak">🔥 Séries d'habitudes</span>
              </div>
            </div>
          </div>

          {/* ── KPIs — 4 groupes ────────────────────────────────────────── */}
          <div className="dashboard-kpi-grid">

            {/* Croissance */}
            <div className="dashboard-kpi-group dashboard-kpi-group--acquisition">
              <h2 className="dashboard-kpi-group-title">Croissance</h2>
              <p className="dashboard-kpi-group-desc">Acquisition et croissance de la base d'utilisateurs de l'application MOOD.</p>
              <div className="dashboard-kpi-cards">
                <KpiCard icon="👥" value={totalUsers} label="Utilisateurs" sublabel="Total cumul" variant="acquisition" />
                <KpiCard
                  icon="🌱"
                  value={kpis?.newUsersPeriod ?? '—'}
                  label="Nouveaux"
                  sublabel={`Sur ${days} j`}
                  sparklineData={usersFilled}
                  sparklineKey="count"
                  trendPct={trendNewUsers}
                  variant="acquisition"
                />
                <KpiCard
                  icon="⚡"
                  value={totalEvents}
                  label="Événements"
                  sublabel="Total"
                  sparklineData={eventsFilled}
                  trendPct={trendEvents}
                  variant="acquisition"
                />
              </div>
            </div>

            {/* Engagement */}
            <div className="dashboard-kpi-group dashboard-kpi-group--engagement">
              <h2 className="dashboard-kpi-group-title">Engagement</h2>
              <p className="dashboard-kpi-group-desc">Régularité d'utilisation de l'app : à quelle fréquence les utilisateurs reviennent-ils logguer leur santé&nbsp;?</p>
              <div className="dashboard-kpi-cards">
                <KpiCard icon="📱" value={kpis?.dau ?? '—'} label="DAU" sublabel="Actifs aujourd'hui" variant="engagement" />
                <KpiCard icon="📅" value={kpis?.wau ?? '—'} label="WAU" sublabel="7 derniers jours" variant="engagement" />
                <KpiCard icon="📆" value={kpis?.mau ?? '—'} label="MAU" sublabel="30 derniers jours" variant="engagement" />
                <KpiCard
                  icon="🔗"
                  value={kpis?.stickinessPct != null ? `${kpis.stickinessPct}%` : '—'}
                  label="Stickiness"
                  sublabel="DAU / MAU"
                  sparklineData={activeUsersFilled}
                  trendPct={trendActive}
                  variant="engagement"
                />
              </div>
            </div>

            {/* Santé produit */}
            <div className="dashboard-kpi-group dashboard-kpi-group--health">
              <h2 className="dashboard-kpi-group-title">Santé produit</h2>
              <p className="dashboard-kpi-group-desc">Est-ce que les utilisateurs atteignent leurs objectifs eau (mL) et mouvements quotidiens&nbsp;? Qualité des habitudes formées.</p>
              <div className="dashboard-kpi-cards">
                <KpiCard
                  icon="🎯"
                  value={kpis?.goalAchievementPct != null ? `${kpis.goalAchievementPct}%` : '—'}
                  label="Objectifs atteints"
                  sublabel={`Sur ${days} j`}
                  variant="health"
                />
                <KpiCard
                  icon="💧"
                  value={kpis?.avgWater ?? '—'}
                  label="Eau moy."
                  sublabel="mL / j / user"
                  variant="health"
                />
                <KpiCard
                  icon="🏃"
                  value={kpis?.avgMovements ?? '—'}
                  label="Mouvements moy."
                  sublabel="/ j / user"
                  variant="health"
                />
                <KpiCard
                  icon="🔥"
                  value={retention?.avgStreak ?? '—'}
                  label="Série moy."
                  sublabel="jours consécutifs"
                  variant="health"
                />
              </div>
            </div>

            {/* Rétention */}
            <div className="dashboard-kpi-group dashboard-kpi-group--retention">
              <h2 className="dashboard-kpi-group-title">Rétention</h2>
              <p className="dashboard-kpi-group-desc">Fidélisation à long terme : les habitudes santé prises sur MOOD persistent-elles dans le temps&nbsp;?</p>
              <div className="dashboard-kpi-cards">
                <KpiCard icon="📍" value={retention?.retentionD1 != null ? `${retention.retentionD1}%` : '—'} label="D+1" sublabel="Retour lendemain" variant="retention" />
                <KpiCard icon="📌" value={retention?.retentionD7 != null ? `${retention.retentionD7}%` : '—'} label="D+7" sublabel="Retour semaine 1" variant="retention" />
                <KpiCard icon="🏆" value={retention?.retentionD30 != null ? `${retention.retentionD30}%` : '—'} label="D+30" sublabel="Habitude à 30 j" variant="retention" />
                <KpiCard icon="📊" value={retention?.avgActiveDaysLast30 ?? '—'} label="Jours actifs" sublabel="moy. / 30j" variant="retention" />
                {churnRate != null && (
                  <KpiCard icon="📉" value={`${churnRate}%`} label="Churn" sublabel="Utilisateurs perdus" variant="retention" />
                )}
              </div>
            </div>
          </div>

          {/* ── Graphiques ─────────────────────────────────────────────── */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3 className="chart-title">Utilisateurs actifs / jour</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={activeUsersFilled} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                    <Line type="monotone" dataKey="count" name="Actifs" stroke="var(--color-primary-dark)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="chart-card">
              <h3 className="chart-title">Événements / jour</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={eventsFilled} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                    <Line type="monotone" dataKey="count" name="Événements" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="chart-card">
              <h3 className="chart-title">Nouveaux utilisateurs / jour</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={usersFilled} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                    <Area type="monotone" dataKey="count" name="Nouveaux" fill="var(--color-secondary)" fillOpacity={0.15} stroke="var(--color-secondary)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="chart-card">
              <h3 className="chart-title">Dernières actions</h3>
              <div className="recent-feed">
                {recentEvents.slice(0, 8).map((e) => (
                  <div key={e.id} className="recent-feed-item">
                    <span className="recent-feed-type">{e.type}</span>
                    <code className="recent-feed-user">{e.user_id?.slice(0, 12)}</code>
                    <span className="recent-feed-time">
                      {e.timestamp ? new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
                {recentEvents.length === 0 && <span className="recent-feed-empty">Aucune action récente</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 2 — Utilisateurs
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="tab-content" role="tabpanel">
          <div className="dashboard-context-banner" style={{ marginBottom: '1rem' }}>
            <span className="dashboard-context-banner-icon">👤</span>
            <div className="dashboard-context-banner-text">
              <p className="dashboard-context-banner-title">Segmentation comportementale des utilisateurs MOOD</p>
              <p className="dashboard-context-banner-desc">
                <strong>Actifs</strong> : connectés dans les 7 derniers jours — en train de construire leurs habitudes santé. &nbsp;
                <strong>Dormants</strong> : inactifs 7–30 jours — à risque d'abandon du suivi. &nbsp;
                <strong>Churned</strong> : aucune activité depuis +30 jours — habitudes non maintenues.
              </p>
            </div>
          </div>
          {segments && (
            <div className="segment-cards">
              {segments.segments.map((s) => (
                <div key={s.id} className={`segment-card ${segmentColors[s.id] || ''}`}>
                  <span className="segment-value">{s.count}</span>
                  <span className="segment-label">{s.label}</span>
                  <span className="segment-pct">{s.percentage}%</span>
                </div>
              ))}
              <div className="segment-card" style={{ borderLeft: '4px solid var(--color-text-muted)' }}>
                <span className="segment-value">{segments.total}</span>
                <span className="segment-label">Total</span>
              </div>
            </div>
          )}

          <div className="filters">
            <label className="filter-segment">
              Segment :
              <select value={usersSegment} onChange={(e) => { setUsersSegment(e.target.value); setUsersPage(1); }}>
                <option value="">Tous</option>
                <option value="active">Actifs</option>
                <option value="dormant">Dormants</option>
                <option value="churned">Churned</option>
              </select>
            </label>
            <input
              type="text"
              placeholder="Rechercher user_id / email"
              value={usersQ}
              onChange={(e) => { setUsersQ(e.target.value); setUsersPage(1); }}
            />
            <button type="button" className="btn-export btn-sm" onClick={() => exportCsv('users', { segment: usersSegment, q: usersQ }).catch((e) => alert(e.message))}>
              Export CSV
            </button>
          </div>

          <div className="table-wrap table-compact">
            <table className="data-table">
              <thead>
                <tr><th>User ID</th><th>Email</th><th>Créé le</th><th>Dernière activité</th></tr>
              </thead>
              <tbody>
                {usersData.users.length === 0
                  ? <tr><td colSpan={4}>Aucun utilisateur</td></tr>
                  : usersData.users.map((u) => (
                    <tr key={u.user_id}>
                      <td><Link to={`/users/${encodeURIComponent(u.user_id)}`} className="link-user"><code>{u.user_id}</code></Link></td>
                      <td>{u.email || '—'}</td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{u.last_activity ? new Date(u.last_activity).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="dashboard-section-pagination">
            <button type="button" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>Précédent</button>
            <span>Page {usersPage} / {userTotalPages} · {usersData.total} utilisateurs</span>
            <button type="button" disabled={usersPage >= userTotalPages} onClick={() => setUsersPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 3 — Événements
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'events' && (
        <div className="tab-content" role="tabpanel">
          {trendTypes.length > 0 && (
            <div className="chart-card" style={{ marginBottom: '1rem' }}>
              <h3 className="chart-title">Tendances par type · {days} jours</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendsChartData} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {trendTypes.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} name={t} stroke={TREND_COLORS[i % TREND_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="filters">
            <input type="text" placeholder="Filtrer par type" value={eventsType} onChange={(e) => { setEventsType(e.target.value); setEventsPage(1); }} />
            <input type="text" placeholder="Filtrer par user ID" value={eventsUserId} onChange={(e) => { setEventsUserId(e.target.value); setEventsPage(1); }} />
            <button type="button" className="btn-export btn-sm" onClick={() => exportCsv('events', { days, type: eventsType, userId: eventsUserId }).catch((e) => alert(e.message))}>
              Export CSV
            </button>
          </div>

          <div className="table-wrap table-compact">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>User</th><th>Type</th><th>Payload</th></tr>
              </thead>
              <tbody>
                {eventsData.events.length === 0
                  ? <tr><td colSpan={4}>Aucun événement</td></tr>
                  : eventsData.events.map((e) => (
                    <tr key={e.id}>
                      <td>{e.timestamp ? new Date(e.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td><code>{e.user_id}</code></td>
                      <td><span className="event-type-badge">{e.type}</span></td>
                      <td className="payload-cell">{typeof e.payload === 'object' ? JSON.stringify(e.payload).slice(0, 60) + '…' : (e.payload || '—').slice(0, 60)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="dashboard-section-pagination">
            <button type="button" disabled={eventsPage <= 1} onClick={() => setEventsPage((p) => p - 1)}>Précédent</button>
            <span>Page {eventsPage} / {eventTotalPages} · {eventsData.total} événements</span>
            <button type="button" disabled={eventsPage >= eventTotalPages} onClick={() => setEventsPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 4 — Données
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'data' && (
        <div className="tab-content" role="tabpanel">
          <div className="dashboard-context-banner" style={{ marginBottom: '1rem' }}>
            <span className="dashboard-context-banner-icon">📊</span>
            <div className="dashboard-context-banner-text">
              <p className="dashboard-context-banner-title">Données de santé quotidiennes synchronisées depuis l'application MOOD</p>
              <p className="dashboard-context-banner-desc">
                Chaque entrée représente une journée d'un utilisateur : volume d'eau consommée (mL), nombre de mouvements enregistrés, et atteinte des objectifs personnels.
                Les objectifs sont individuels et définis par chaque utilisateur dans son profil.
              </p>
            </div>
          </div>
          <div className="charts-grid" style={{ marginBottom: '1rem' }}>
            <div className="chart-card">
              <h3 className="chart-title">💧 Eau (mL) / jour — cumul utilisateurs</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={waterFilled} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                    <Area type="monotone" dataKey="total" name="Eau (mL)" fill="var(--color-info)" fillOpacity={0.15} stroke="var(--color-info)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="chart-card">
              <h3 className="chart-title">🏃 Mouvements / jour — cumul utilisateurs</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={movementsFilled} {...CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip {...CHART_STYLE} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                    <Area type="monotone" dataKey="total" name="Mouvements" fill="var(--color-secondary)" fillOpacity={0.15} stroke="var(--color-secondary)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="filters" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-export btn-sm" onClick={() => exportCsv('stats', { days }).catch((e) => alert(e.message))}>
              Export CSV
            </button>
          </div>
          <div className="table-wrap table-compact">
            <table className="data-table">
              <thead>
                <tr><th>User ID</th><th>Date</th><th>Eau (mL)</th><th>Mouvements</th><th>Objectifs</th></tr>
              </thead>
              <tbody>
                {statsData.stats.length === 0
                  ? <tr><td colSpan={5}>Aucune statistique</td></tr>
                  : statsData.stats.map((s, i) => (
                    <tr key={s.user_id + s.date + i}>
                      <td><code>{s.user_id}</code></td>
                      <td>{s.date}</td>
                      <td>{s.water}</td>
                      <td>{s.movements}</td>
                      <td>
                        <span className={`goals-badge goals-badge--${s.goals_reached ? 'yes' : 'no'}`}>
                          {s.goals_reached ? 'Atteint' : 'Non atteint'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="dashboard-section-pagination">
            <button type="button" disabled={statsPage <= 1} onClick={() => setStatsPage((p) => p - 1)}>Précédent</button>
            <span>Page {statsPage} / {statsTotalPages} · {statsData.total} entrées</span>
            <button type="button" disabled={statsPage >= statsTotalPages} onClick={() => setStatsPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 5 — Backups
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'backups' && (
        <div className="tab-content" role="tabpanel">
          <div className="backups-grid">
            <section className="backup-panel">
              <h2 className="backup-panel-title">Sauvegardes système</h2>
              <div className="backup-block">
                <button
                  type="button"
                  className="btn-export btn-sm"
                  disabled={backupRunning}
                  onClick={() => {
                    setBackupRunning(true);
                    runBackup().then(() => getBackupList()).then((d) => setBackups(d.backups || [])).catch((e) => alert(e.message)).finally(() => setBackupRunning(false));
                  }}
                >
                  {backupRunning ? 'Création…' : '+ Créer un backup'}
                </button>
                {retentionDays != null && <span className="backup-meta">Rétention : {retentionDays} j</span>}
              </div>
              {backups.length > 0 ? (
                <ul className="backup-list">
                  {backups.map((b) => (
                    <li key={b.name}>
                      <code>{b.name}</code>
                      <span>{b.size != null ? `${Math.round(b.size / 1024)} Ko` : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="backup-empty">Aucun backup système.</p>
              )}
            </section>

            <section className="backup-panel">
              <h2 className="backup-panel-title">Sauvegardes utilisateurs</h2>
              <div className="table-wrap table-compact">
                <table className="data-table">
                  <thead>
                    <tr><th>User ID</th><th>Backup ID</th><th>Date</th><th>Taille</th></tr>
                  </thead>
                  <tbody>
                    {userBackupsData.backups.length === 0
                      ? <tr><td colSpan={4}>Aucune sauvegarde</td></tr>
                      : userBackupsData.backups.map((b) => (
                        <tr key={`${b.user_id}_${b.backup_id}`}>
                          <td><code>{b.user_id}</code></td>
                          <td><code>{b.backup_id?.slice(0, 16)}…</code></td>
                          <td>{b.created_at ? new Date(b.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                          <td>{b.size_bytes != null ? `${(b.size_bytes / 1024).toFixed(1)} Ko` : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {userBackupTotalPages > 1 && (
                <div className="dashboard-section-pagination">
                  <button type="button" disabled={userBackupsPage <= 1} onClick={() => setUserBackupsPage((p) => p - 1)}>Précédent</button>
                  <span>Page {userBackupsPage} / {userBackupTotalPages} · {userBackupsData.total} au total</span>
                  <button type="button" disabled={userBackupsPage >= userBackupTotalPages} onClick={() => setUserBackupsPage((p) => p + 1)}>Suivant</button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
