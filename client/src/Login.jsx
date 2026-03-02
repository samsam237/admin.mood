import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from './api';
import './Login.css';

const WELLNESS_PILLARS = [
  { icon: '💧', label: 'Hydratation', desc: 'Suivi de l\'apport en eau quotidien' },
  { icon: '🏃', label: 'Activité', desc: 'Mouvements et exercice physique' },
  { icon: '🎯', label: 'Objectifs', desc: 'Buts personnels quotidiens' },
  { icon: '🔥', label: 'Habitudes', desc: 'Séries et régularité à long terme' },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await login(username, password);
      localStorage.setItem('token', token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">

      {/* ── Panneau gauche — identité wellness ─────────────────────── */}
      <div className="login-visual" aria-hidden>
        <div className="login-visual-brand">
          <img src="/app_icon.png" alt="" className="login-visual-logo" />
          <span className="login-visual-wordmark">
            <span className="brand-mo">mo</span><span className="brand-od">od</span>
          </span>
        </div>

        <div className="login-visual-headline">
          <h2>Santé &amp; Bien-être,<br />mesurés avec précision.</h2>
          <p>
            Visualisez l'impact réel de MOOD sur les habitudes de santé de vos utilisateurs —
            hydratation, activité physique et régularité.
          </p>
        </div>

        <div className="login-pillars">
          {WELLNESS_PILLARS.map((p) => (
            <div key={p.label} className="login-pillar">
              <span className="login-pillar-icon">{p.icon}</span>
              <div className="login-pillar-text">
                <span className="login-pillar-label">{p.label}</span>
                <span className="login-pillar-desc">{p.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="login-visual-footer">Tableau de bord Analytics — Accès administrateur</p>
      </div>

      {/* ── Panneau droit — formulaire ──────────────────────────────── */}
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-logo-sm">
              <img src="/app_icon.png" alt="MOOD" className="login-logo-sm" />
              <span>
                <span className="brand-mo">mo</span><span className="brand-od">od</span>
              </span>
            </div>
            <h1>Connexion</h1>
            <p className="login-subtitle">Accédez au tableau de bord santé de vos utilisateurs.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-username">Identifiant</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                <span className="login-error-icon">⚠</span>
                {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? <><span className="login-btn-spinner" />Connexion…</>
                : <><span>🌿</span> Accéder au dashboard</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
