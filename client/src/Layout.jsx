import { useCallback, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { logout, getAlerts, markAlertRead, getHealth } from './api';
import { RangeProvider, useRange } from './RangeContext';
import './Layout.css';

/* ── Icônes SVG inline (Lucide 18×18) ──────────────────────────────────── */
function Svg({ children, title }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const IcoSun = () => <Svg><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Svg>;
const IcoMoon = () => <Svg><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Svg>;
const IcoBell = () => <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>;
const IcoLogout = () => <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const IcoRefresh = () => <Svg><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Svg>;
const IcoChevronLeft = () => <Svg><polyline points="15 18 9 12 15 6"/></Svg>;

/* ── Onglets du dashboard ──────────────────────────────────────────────── */
const DASHBOARD_TABS = [
  { tab: 'overview', label: 'Vue d\'ensemble' },
  { tab: 'users',    label: 'Utilisateurs' },
  { tab: 'events',   label: 'Événements' },
  { tab: 'data',     label: 'Données' },
  { tab: 'backups',  label: 'Backups' },
];

function LayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  const isUserDetail = /^\/users\/[^/]+$/.test(location.pathname);

  const [alerts, setAlerts] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const { days, setDays, autoRefresh, setAutoRefresh, triggerRefresh } = useRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = isDashboard ? (searchParams.get('tab') || 'overview') : null;

  /* Dark mode */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  /* Alertes au montage */
  useEffect(() => {
    getAlerts()
      .then((d) => setAlerts(d.alerts || []))
      .catch(() => setAlerts([]));
  }, []);

  /* Health check toutes les 30 s */
  const checkHealth = useCallback(() => {
    getHealth()
      .then((d) => setHealth(d.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setHealth('error'));
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, [checkHealth]);

  /* Auto-refresh */
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => triggerRefresh(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, triggerRefresh]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleMarkRead(id) {
    markAlertRead(id)
      .then(() => setAlerts((prev) => prev.filter((a) => a.id !== id)))
      .catch(() => {});
  }

  return (
    <div className="layout">

      {/* ── Top navbar ──────────────────────────────────────────────────── */}
      <header className="layout-header">

        {/* Brand */}
        <div className="layout-brand">
          <img src="/app_icon.png" alt="" className="layout-logo" />
          <span className="brand-text">
            <span className="brand-mo">mo</span><span className="brand-od">od</span>
          </span>
          <span className="layout-brand-sep" aria-hidden>·</span>
          <span className="layout-brand-sub">Santé &amp; Bien-être</span>
        </div>

        {/* Navigation tabs (dashboard) */}
        {isDashboard && (
          <nav className="layout-tabs" role="tablist" aria-label="Sections">
            {DASHBOARD_TABS.map(({ tab, label }) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={currentTab === tab}
                className={`layout-tab${currentTab === tab ? ' layout-tab--active' : ''}`}
                onClick={() => setSearchParams({ tab })}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* UserDetail — lien retour */}
        {isUserDetail && (
          <nav className="layout-tabs">
            <NavLink to="/" className="layout-tab layout-tab--back">
              <IcoChevronLeft />
              <span>Tableau de bord</span>
            </NavLink>
          </nav>
        )}

        {/* Contrôles */}
        <div className="layout-controls">

          {/* Sélecteur de période */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="layout-period-select"
            aria-label="Période d'analyse"
          >
            <option value={7}>7 j</option>
            <option value={14}>14 j</option>
            <option value={30}>30 j</option>
            <option value={60}>60 j</option>
            <option value={90}>90 j</option>
          </select>

          {/* Indicateur santé serveur */}
          <div
            className={`layout-health-dot layout-health-dot--${health ?? 'loading'}`}
            title={
              health === 'ok' ? 'Serveur opérationnel'
                : health === 'error' ? 'Serveur hors ligne'
                : 'Vérification…'
            }
            role="status"
            aria-label={`Serveur : ${health ?? 'chargement'}`}
          />

          {/* Refresh manuel */}
          <button
            type="button"
            className="layout-ctrl-btn"
            onClick={triggerRefresh}
            title="Rafraîchir les données"
            aria-label="Rafraîchir"
          >
            <IcoRefresh />
          </button>

          {/* Auto-refresh 30 s */}
          <button
            type="button"
            className={`layout-ctrl-btn${autoRefresh ? ' layout-ctrl-btn--on' : ''}`}
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? 'Désactiver le rafraîchissement auto' : 'Activer le rafraîchissement toutes les 30 s'}
            aria-pressed={autoRefresh}
          >
            <IcoRefresh />
            <span className="layout-ctrl-label">{autoRefresh ? '30s' : 'Auto'}</span>
          </button>

          {/* Dark mode */}
          <button
            type="button"
            className="layout-ctrl-btn"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label={darkMode ? 'Mode clair' : 'Mode sombre'}
          >
            {darkMode ? <IcoSun /> : <IcoMoon />}
          </button>

          {/* Alertes */}
          <button
            type="button"
            className="layout-ctrl-btn layout-alerts-btn"
            onClick={() => {
              setPanelOpen(true);
              getAlerts().then((d) => setAlerts(d.alerts || [])).catch(() => {});
            }}
            title="Alertes"
            aria-label={`Alertes${alerts.length > 0 ? ` (${alerts.length})` : ''}`}
          >
            <IcoBell />
            {alerts.length > 0 && (
              <span className="layout-alerts-badge" aria-hidden>{alerts.length}</span>
            )}
          </button>

          {/* Déconnexion */}
          <button
            type="button"
            className="layout-ctrl-btn layout-logout"
            onClick={handleLogout}
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <IcoLogout />
          </button>
        </div>
      </header>

      {/* ── Contenu principal ──────────────────────────────────────────── */}
      <main className="layout-main">
        <div className="layout-main-inner">
          <Outlet />
        </div>
      </main>

      {/* ── Panneau alertes ────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="alerts-overlay" onClick={() => setPanelOpen(false)} aria-hidden />
      )}
      <div
        className={`alerts-panel${panelOpen ? ' alerts-panel--open' : ''}`}
        role="dialog"
        aria-label="Alertes"
        aria-modal
      >
        <div className="alerts-panel-header">
          <h2>Alertes</h2>
          <button
            type="button"
            className="alerts-panel-close"
            onClick={() => setPanelOpen(false)}
            aria-label="Fermer"
          >×</button>
        </div>
        <div className="alerts-panel-list">
          {alerts.length === 0 ? (
            <p className="alerts-panel-empty">Aucune alerte non lue.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="alerts-panel-item">
                <div className="alerts-panel-item-type">{a.type}</div>
                <div className="alerts-panel-item-message">{a.message}</div>
                <div className="alerts-panel-item-time">
                  {a.triggered_at ? new Date(a.triggered_at).toLocaleString('fr-FR') : ''}
                </div>
                <button
                  type="button"
                  className="alerts-panel-item-read"
                  onClick={() => handleMarkRead(a.id)}
                >
                  Marquer comme lu
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <RangeProvider>
      <LayoutInner />
    </RangeProvider>
  );
}
