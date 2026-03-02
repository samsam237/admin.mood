import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from 'recharts';
import { getUserDetail } from './api';
import { useRange } from './RangeContext';
import './Tables.css';
import './UserDetail.css';

/* ── Carte stat utilisateur ─────────────────────────────────────── */
function StatCard({ icon, value, label, sub, variant = '' }) {
  return (
    <div className={`ud-stat-card ud-stat-card--${variant}`}>
      <span className="ud-stat-icon" aria-hidden>{icon}</span>
      <span className="ud-stat-value">{value}</span>
      <span className="ud-stat-label">{label}</span>
      {sub && <span className="ud-stat-sub">{sub}</span>}
    </div>
  );
}

export default function UserDetail() {
  const { userId: userIdParam } = useParams();
  const userId = useMemo(() => decodeURIComponent(userIdParam || ''), [userIdParam]);
  const { days } = useRange();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    getUserDetail(userId, days)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, days]);

  if (loading && !data) return <div className="page-loading">Chargement…</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!data) return null;

  const u = data.user;
  const recentEvents = data.recentEvents || [];
  const backups = data.backups || [];
  const statsSeries = (data.statsSeries || []).slice().reverse();

  function fmtDateTime(iso) {
    return iso ? new Date(iso).toLocaleString('fr-FR') : '—';
  }
  function fmtDate(iso) {
    return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
  }
  function fmtBytes(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  /* Métriques santé dérivées */
  const totalGoalDays = statsSeries.filter((s) => s.goals_reached).length;
  const goalRate = statsSeries.length > 0
    ? Math.round((totalGoalDays / statsSeries.length) * 100)
    : null;
  const avgWater = statsSeries.length > 0
    ? Math.round(statsSeries.reduce((s, r) => s + (r.water || 0), 0) / statsSeries.length)
    : null;
  const avgMove = statsSeries.length > 0
    ? Math.round(statsSeries.reduce((s, r) => s + (r.movements || 0), 0) / statsSeries.length)
    : null;

  const CHART_TOOLTIP = {
    contentStyle: {
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      fontSize: '12px',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
    },
  };

  return (
    <div className="page-block">

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div className="ud-header">
        <div className="ud-header-id">
          <span className="ud-header-icon">👤</span>
          <div>
            <code className="ud-user-id">{u.user_id}</code>
            {u.email && <span className="ud-user-email">{u.email}</span>}
          </div>
        </div>
        <Link to="/" className="ud-back-link">← Retour au dashboard</Link>
      </div>

      {/* ── Cartes stats ─────────────────────────────────────────── */}
      <div className="ud-stats-grid">
        <StatCard icon="📅" value={fmtDate(u.created_at)} label="Inscription" sub="Date de création du compte" variant="neutral" />
        <StatCard icon="💓" value={fmtDateTime(data.lastActivity)} label="Dernière activité" sub="Dernier événement enregistré" variant="neutral" />
        <StatCard icon="⚡" value={data.eventCount ?? '—'} label="Événements" sub="Total depuis l'inscription" variant="engagement" />
        <StatCard icon="📊" value={data.activeDaysInPeriod ?? '—'} label="Jours actifs" sub={`Sur les ${days} derniers jours`} variant="engagement" />
        {goalRate != null && (
          <StatCard icon="🎯" value={`${goalRate}%`} label="Objectifs atteints" sub={`Sur ${statsSeries.length} jours avec données`} variant="health" />
        )}
        {avgWater != null && (
          <StatCard icon="💧" value={`${avgWater} mL`} label="Eau moyenne" sub="mL d'eau par jour" variant="water" />
        )}
        {avgMove != null && (
          <StatCard icon="🏃" value={avgMove} label="Mouvements moy." sub="Mouvements par jour" variant="move" />
        )}
        <StatCard icon="💾" value={backups.length} label="Sauvegardes" sub="Backups de données disponibles" variant="neutral" />
      </div>

      {/* ── Graphique santé ──────────────────────────────────────── */}
      {statsSeries.length > 0 && (
        <section className="ud-chart-section">
          <div className="ud-section-header">
            <span className="ud-section-icon">📈</span>
            <div>
              <h2 className="ud-section-title">Suivi santé — {days} derniers jours</h2>
              <p className="ud-section-desc">Évolution de l'hydratation et de l'activité physique quotidiennes.</p>
            </div>
          </div>
          <div className="ud-chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={statsSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="water" name="💧 Eau (mL)" stroke="var(--color-water, #0ea5e9)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="movements" name="🏃 Mouvements" stroke="var(--color-primary-dark)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mini légende objectifs */}
          <div className="ud-goal-strip">
            {statsSeries.slice(-14).map((s) => (
              <div
                key={s.date}
                className={`ud-goal-day ud-goal-day--${s.goals_reached ? 'yes' : 'no'}`}
                title={`${s.date} — Objectifs ${s.goals_reached ? 'atteints' : 'non atteints'}`}
              />
            ))}
            <span className="ud-goal-strip-label">14 derniers jours — 🎯 objectifs</span>
          </div>
        </section>
      )}

      {/* ── Événements récents ────────────────────────────────────── */}
      <section className="ud-section">
        <div className="ud-section-header">
          <span className="ud-section-icon">⚡</span>
          <div>
            <h2 className="ud-section-title">Derniers événements</h2>
            <p className="ud-section-desc">Actions enregistrées sur l'application MOOD.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Date / heure</th><th>Type</th><th>Payload</th></tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr><td colSpan={3}>Aucun événement enregistré.</td></tr>
              ) : (
                recentEvents.map((e) => (
                  <tr key={e.id}>
                    <td>{e.timestamp ? new Date(e.timestamp).toLocaleString('fr-FR') : '—'}</td>
                    <td><span className="ud-event-type-badge">{e.type}</span></td>
                    <td className="payload-cell">
                      {typeof e.payload === 'object'
                        ? JSON.stringify(e.payload).slice(0, 120) + (JSON.stringify(e.payload).length > 120 ? '…' : '')
                        : (e.payload || '—').slice(0, 120)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Sauvegardes ──────────────────────────────────────────── */}
      {backups.length > 0 && (
        <section className="ud-section">
          <div className="ud-section-header">
            <span className="ud-section-icon">💾</span>
            <div>
              <h2 className="ud-section-title">Sauvegardes utilisateur</h2>
              <p className="ud-section-desc">Historique des sauvegardes de données personnelles.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Backup ID</th><th>Date</th><th>Taille</th></tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.backup_id}>
                    <td><code>{b.backup_id}</code></td>
                    <td>{fmtDateTime(b.created_at)}</td>
                    <td>{fmtBytes(b.size_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
