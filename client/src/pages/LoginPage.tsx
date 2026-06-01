import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const WELLNESS_PILLARS = [
  { icon: '💧', label: 'Hydratation', desc: "Suivi de l'apport en eau quotidien" },
  { icon: '🏃', label: 'Activité', desc: 'Mouvements et exercice physique' },
  { icon: '🎯', label: 'Objectifs', desc: 'Buts personnels quotidiens' },
  { icon: '🔥', label: 'Habitudes', desc: "Séries et régularité à long terme" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(username, password);
      setAuth(data.token, data.username);
      navigate('/');
    } catch {
      setError('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche — identité wellness ─────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #064e3b 0%, #065f46 40%, #047857 70%, #059669 100%)' }}
      >
        <div className="absolute -top-1/4 -right-1/4 w-2/3 aspect-square rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/4 -left-1/4 w-3/4 aspect-square rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center p-1">
            <img src="/favicon.svg" alt="" className="w-full h-full object-contain" />
          </div>
          <span className="text-3xl font-bold tracking-tight leading-none">
            <span className="text-white">mo</span><span style={{ color: '#a7f3d0' }}>od</span>
          </span>
        </div>

        <div className="relative z-10">
          <h2 className="text-3xl font-bold leading-tight mb-3">
            Santé &amp; Bien-être,<br />mesurés avec précision.
          </h2>
          <p className="text-white/75 text-base leading-relaxed max-w-sm">
            Visualisez l'impact réel de MOOD sur les habitudes de santé de vos utilisateurs —
            hydratation, activité physique et régularité.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3">
          {WELLNESS_PILLARS.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="w-9 h-9 flex items-center justify-center text-xl rounded-lg flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)' }}>
                {p.icon}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-white">{p.label}</span>
                <span className="text-xs text-white/60">{p.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-white/40">
          Tableau de bord Analytics — Accès administrateur
        </p>
      </div>

      {/* ── Panneau droit — formulaire ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
        <div className="w-full max-w-sm login-card-anim">

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/favicon.svg" alt="MOOD" className="w-full h-full" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-emerald-700 dark:text-emerald-400">mo</span>
              <span className="text-slate-900 dark:text-white">od</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Connexion</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Accédez au tableau de bord santé de vos utilisateurs.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Identifiant
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-xl">
                <span className="flex-shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition disabled:opacity-80 disabled:cursor-not-allowed hover:-translate-y-px active:translate-y-0"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
              }}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Connexion…
                </>
              ) : (
                <><span>🌿</span> Accéder au dashboard</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
