# Prompt A — Restauration du design et des KPIs du dashboard

**Usage** : coller ce prompt dans Cursor après avoir lu tous les fichiers listés ci-dessous.  
**Fichiers à lire** :
- `client/src/pages/LoginPage.tsx`
- `client/src/pages/DashboardPage.tsx`
- `client/src/components/dashboard/KpiCard.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/lib/api.ts`
- `client/src/lib/utils.ts`
- `client/src/types/index.ts`
- `client/src/hooks/useRange.ts`
- `client/src/index.css`
- `client/src/Login.jsx` (référence design — NE PAS MODIFIER)
- `client/src/Login.css` (référence design — NE PAS MODIFIER)
- `client/src/Dashboard.jsx` (référence — NE PAS MODIFIER)
- `client/src/components/KpiCard.jsx` (référence — NE PAS MODIFIER)
- `client/src/components/KpiCard.css` (référence — NE PAS MODIFIER)

**Durée estimée** : 45-60 min.

---

## Diagnostic

### Problème 1 — Login page appauvrie

La nouvelle `LoginPage.tsx` a perdu le design wellness de l'ancienne `Login.jsx` :
- Gradient vert multi-teintes (`#064e3b → #059669`) remplacé par un gradient bleu générique
- Les cercles décoratifs (`::before` / `::after`) ont disparu
- 4 piliers wellness avec descriptions remplacés par 3 features sans descriptions
- Le wordmark `mo`/`od` bicolore a disparu
- Le spinner CSS animé a disparu
- L'animation d'entrée (`cardIn`) a disparu
- Le bouton CTA (`🌿 Accéder au dashboard`) remplacé par `Se connecter`

### Problème 2 — Dashboard KPIs réduits à 5 au lieu de 16

La nouvelle `DashboardPage.tsx` n'affiche que 5 KPIs (DAU, WAU, MAU, Stickiness, Objectifs) là où l'ancienne avait **16 KPIs organisés en 4 groupes thématiques** avec descriptions, sparklines et trends.

Les groupes manquants :
```
Croissance (3 KPIs)  → Utilisateurs total, Nouveaux/période, Événements total
Engagement (4 KPIs)  → DAU, WAU, MAU, Stickiness
Santé produit (4 KPIs) → Objectifs %, Eau moy., Mouvements moy., Série moy.
Rétention (5 KPIs)   → D+1, D+7, D+30, Jours actifs moy., Churn %
```

### Problème 3 — KpiCard sans sparkline ni variants

L'ancienne `KpiCard.jsx` avait :
- `sparklineData` prop + mini LineChart (28px de haut)
- `trendPct` prop avec affichage ▲/▼/→
- `sublabel` (ligne secondaire sous le label)
- 5 variants CSS : `acquisition` (vert), `engagement` (bleu), `health` (violet), `retention` (orange), `default`

### Problème 4 — Bandeau contexte produit manquant

L'onglet overview manque le bandeau MOOD (🌿 titre + description + 4 tags pills wellness).

### Architecture cible

```
LoginPage.tsx
├── Panneau gauche : gradient vert #064e3b→#059669, cercles déco, wordmark mo/od,
│   headline, 4 piliers wellness (icône + label + desc + backdrop-blur)
└── Panneau droit  : animation cardIn, spinner CSS, bouton 🌿

DashboardPage.tsx (onglet overview)
├── Bandeau contexte MOOD (🌿 + tags pills 💧🏃🎯🔥)
├── 4 groupes KPI (acquisition/engagement/health/retention)
│   chacun avec titre + description + grille de KpiCards
└── Graphiques existants (inchangés)

KpiCard.tsx
├── Props : label, metric, unit, icon, color, sparklineData?, sparklineKey?, sublabel?
├── Affichage : border-top colorée, icon box, value, sublabel, trend pill, sparkline
└── 5 variants de couleur mappés via colorMap étendu
```

---

## Étape 1 — Refondre `LoginPage.tsx`

### Fichier à modifier : `client/src/pages/LoginPage.tsx`

Remplacer l'intégralité du contenu par :

```tsx
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
        {/* Cercles décoratifs */}
        <div className="absolute -top-1/4 -right-1/4 w-2/3 aspect-square rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/4 -left-1/4 w-3/4 aspect-square rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center p-1">
            <img src="/favicon.svg" alt="" className="w-full h-full object-contain" />
          </div>
          <span className="text-3xl font-bold tracking-tight leading-none">
            <span className="text-white">mo</span><span style={{ color: '#a7f3d0' }}>od</span>
          </span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold leading-tight mb-3">
            Santé &amp; Bien-être,<br />mesurés avec précision.
          </h2>
          <p className="text-white/75 text-base leading-relaxed max-w-sm">
            Visualisez l'impact réel de MOOD sur les habitudes de santé de vos utilisateurs —
            hydratation, activité physique et régularité.
          </p>
        </div>

        {/* Piliers wellness */}
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

          {/* Logo mobile */}
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
                className="w-full px-4 py-3 rounded-xl border-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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
                className="w-full px-4 py-3 rounded-xl border-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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
                boxShadow: loading ? 'none' : undefined,
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
```

#### 1b. Ajouter les animations CSS dans `client/src/index.css`

Localiser (après les directives `@tailwind`) :
```css
@tailwind utilities;
```

Ajouter après :
```css
@layer utilities {
  .login-card-anim {
    animation: cardIn 0.4s ease;
  }
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.login-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Étape 2 — Enrichir `KpiCard.tsx` avec sparklines et variants

### Fichier à modifier : `client/src/components/dashboard/KpiCard.tsx`

Remplacer l'intégralité du contenu par :

```tsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, formatNumber, formatTrend } from '../../lib/utils';
import type { KpiMetric } from '../../types';

interface Props {
  label: string;
  metric: KpiMetric;
  unit?: string;
  icon?: string;
  sublabel?: string;
  sparklineData?: { [key: string]: number | string }[];
  sparklineKey?: string;
  variant?: 'acquisition' | 'engagement' | 'health' | 'retention' | 'default';
}

const variantMap = {
  acquisition: { accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5', border: '#059669' },
  engagement:  { accent: '#3b82f6', bg: '#eff6ff', iconBg: '#dbeafe', border: '#3b82f6' },
  health:      { accent: '#8b5cf6', bg: '#f5f3ff', iconBg: '#ede9fe', border: '#8b5cf6' },
  retention:   { accent: '#f59e0b', bg: '#fffbeb', iconBg: '#fef3c7', border: '#f59e0b' },
  default:     { accent: '#64748b', bg: '#f8fafc', iconBg: '#f1f5f9', border: '#64748b' },
};

export default function KpiCard({
  label,
  metric,
  unit = '',
  icon,
  sublabel,
  sparklineData,
  sparklineKey = 'count',
  variant = 'default',
}: Props) {
  const v = variantMap[variant];
  const TrendIcon = metric.trend > 0 ? TrendingUp : metric.trend < 0 ? TrendingDown : Minus;
  const trendColor = metric.trend > 0 ? 'text-emerald-600' : metric.trend < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col gap-2"
      style={{ borderTop: `3px solid ${v.border}` }}
    >
      {/* Header : icon + trend */}
      <div className="flex items-start justify-between">
        {icon && (
          <span
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl flex-shrink-0"
            style={{ background: v.iconBg }}
          >
            {icon}
          </span>
        )}
        <div className={cn('flex items-center gap-1 text-xs font-semibold', trendColor)}>
          <TrendIcon size={12} />
          <span>{formatTrend(metric.trend)}</span>
        </div>
      </div>

      {/* Value */}
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
          {typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value}{unit}
        </p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="h-7 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Tooltip
                content={() => null}
              />
              <Line
                type="monotone"
                dataKey={sparklineKey}
                stroke={v.accent}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

---

## Étape 3 — Créer `SegmentCards.tsx`

### Fichier à créer : `client/src/components/dashboard/SegmentCards.tsx`

```tsx
import type { SegmentData } from '../../types';

interface Props {
  data: SegmentData;
}

const SEGMENT_CONFIG = [
  { key: 'active'  as const, label: 'Actifs',   emoji: '💪', accent: '#059669', bg: '#ecfdf5', border: '#059669' },
  { key: 'dormant' as const, label: 'Dormants',  emoji: '😴', accent: '#f59e0b', bg: '#fffbeb', border: '#f59e0b' },
  { key: 'churned' as const, label: 'Churnés',  emoji: '💤', accent: '#ef4444', bg: '#fef2f2', border: '#ef4444' },
];

export default function SegmentCards({ data }: Props) {
  const total = (data.active ?? 0) + (data.dormant ?? 0) + (data.churned ?? 0);
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition"
           style={{ borderTop: '3px solid #64748b' }}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{total}</p>
        <p className="text-xs text-slate-400 mt-1">utilisateurs inscrits</p>
      </div>

      {/* Segments */}
      {SEGMENT_CONFIG.map((s) => {
        const count = data[s.key] ?? 0;
        return (
          <div
            key={s.key}
            className="relative bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition overflow-hidden"
            style={{ borderTop: `3px solid ${s.border}` }}
          >
            {/* Emoji watermark */}
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
```

---

## Étape 4 — Enrichir `DashboardPage.tsx`

### Fichier à modifier : `client/src/pages/DashboardPage.tsx`

#### 4a. Ajouter les imports manquants

Localiser :
```tsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Users, Activity, Target, Zap } from 'lucide-react';
```

Remplacer par :
```tsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import SegmentCards from '../components/dashboard/SegmentCards';
import type { SegmentData } from '../types';
```

#### 4b. Remplacer le rendu de l'onglet overview

Localiser le bloc entier :
```tsx
      {tab === 'overview' && (
        <>
          {(overview as OverviewData | undefined) && (
```

Remplacer par le bloc complet ci-dessous (jusqu'à la fermeture `</>`) :

```tsx
      {tab === 'overview' && (
        <>
          {/* ── Bandeau contexte produit ────────────────────────────── */}
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

          {/* ── Groupe Croissance ────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
               style={{ borderLeft: '4px solid #059669' }}>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Croissance</h2>
            <p className="text-xs text-slate-400 mb-4">Acquisition et croissance de la base d'utilisateurs de l'application MOOD.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                icon="👥"
                label="Utilisateurs"
                sublabel="Total cumul"
                metric={{ value: (overview as any)?.totalUsers ?? 0, trend: 0 }}
                variant="acquisition"
              />
              <KpiCard
                icon="⚡"
                label="Événements"
                sublabel="Total"
                metric={{ value: (overview as any)?.totalEvents ?? 0, trend: 0 }}
                variant="acquisition"
              />
              <KpiCard
                icon="🌱"
                label="Nouveaux aujourd'hui"
                sublabel="Inscriptions du jour"
                metric={{ value: (overview as any)?.newUsersToday ?? 0, trend: 0 }}
                variant="acquisition"
              />
            </div>
          </div>

          {/* ── Groupe Engagement ───────────────────────────────────── */}
          {kpis && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #3b82f6' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Engagement</h2>
              <p className="text-xs text-slate-400 mb-4">
                Régularité d'utilisation : à quelle fréquence les utilisateurs reviennent-ils logguer leur santé ?
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon="📱" label="DAU"        sublabel="Actifs aujourd'hui"  metric={(kpis as any).dau}        variant="engagement" />
                <KpiCard icon="📅" label="WAU"        sublabel="7 derniers jours"    metric={(kpis as any).wau}        variant="engagement" />
                <KpiCard icon="📆" label="MAU"        sublabel="30 derniers jours"   metric={(kpis as any).mau}        variant="engagement" />
                <KpiCard icon="🔗" label="Stickiness" sublabel="DAU / MAU"           metric={(kpis as any).stickiness} variant="engagement" unit="%" />
              </div>
            </div>
          )}

          {/* ── Groupe Santé produit ─────────────────────────────────── */}
          {kpis && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #8b5cf6' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Santé produit</h2>
              <p className="text-xs text-slate-400 mb-4">
                Est-ce que les utilisateurs atteignent leurs objectifs eau et mouvements quotidiens ?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <KpiCard icon="🎯" label="Objectifs atteints" sublabel={`Sur ${days} jours`} metric={(kpis as any).goalsRate} variant="health" unit="%" />
                <KpiCard icon="📱" label="Actifs aujourd'hui" sublabel="Connectés dans les 24h" metric={{ value: (overview as any)?.activeToday ?? 0, trend: 0 }} variant="health" />
              </div>
            </div>
          )}

          {/* ── Groupe Rétention ─────────────────────────────────────── */}
          {retention && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm"
                 style={{ borderLeft: '4px solid #f59e0b' }}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Rétention</h2>
              <p className="text-xs text-slate-400 mb-4">
                Sur la cohorte des 90 derniers jours, quel % revient à J+1, J+7, J+30 ?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard icon="📍" label="Rétention J+1"  sublabel="Retour le lendemain"  metric={{ value: (retention as any).d1,  trend: 0 }} variant="retention" unit="%" />
                <KpiCard icon="📌" label="Rétention J+7"  sublabel="Retour semaine 1"     metric={{ value: (retention as any).d7,  trend: 0 }} variant="retention" unit="%" />
                <KpiCard icon="🏆" label="Rétention J+30" sublabel="Habitude 30 jours"    metric={{ value: (retention as any).d30, trend: 0 }} variant="retention" unit="%" />
              </div>
            </div>
          )}

          {/* ── Segmentation ─────────────────────────────────────────── */}
          {segments && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Segmentation utilisateurs</h2>
              <SegmentCards data={segments as SegmentData} />
            </div>
          )}

          {/* ── Graphiques ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(analytics as any)?.dailyActiveUsers?.length > 0 && (
              <DauChart data={(analytics as any).dailyActiveUsers} />
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
```

#### 4c. Nettoyer les imports inutilisés dans DashboardPage.tsx

Supprimer les imports `Users, Activity, Target, Zap` de lucide-react s'ils ne sont plus utilisés, et ajouter l'import de `KpiCard` si absent :

Localiser :
```tsx
import KpiCard from '../components/dashboard/KpiCard';
```

S'il est absent, l'ajouter dans les imports.

---

## Critères de validation

### Login
- [ ] Panneau gauche affiche le gradient vert multi-teintes (`#064e3b → #059669`)
- [ ] Les 4 piliers wellness sont visibles avec icône + label + description
- [ ] Le panneau gauche est masqué sur mobile (< lg)
- [ ] Le bouton affiche `🌿 Accéder au dashboard` et `Connexion…` avec spinner lors du submit
- [ ] L'animation `cardIn` (fade + slide from bottom) se joue à l'ouverture de la page
- [ ] L'erreur s'affiche en rouge avec icône ⚠

### KpiCard
- [ ] Chaque card a une `borderTop` colorée selon son `variant`
- [ ] L'icône emoji est visible dans son carré coloré
- [ ] Le `sublabel` s'affiche sous le label
- [ ] La sparkline (mini LineChart 28px) s'affiche si `sparklineData` est fourni

### Dashboard
- [ ] Le bandeau 🌿 MOOD s'affiche en vert avec les 4 tags pills
- [ ] 4 groupes KPI s'affichent avec bordure gauche colorée et description
- [ ] Les SegmentCards affichent Total + Actifs💪 + Dormants😴 + Churnés💤 avec emoji watermark
- [ ] Les graphiques existants (DauChart, EventTrendsChart, etc.) sont toujours visibles

### TypeScript
- [ ] `npx tsc --noEmit` dans `client/` sans erreur.

---

## Livrable

Créer `client/docs/PROMPT-A-dashboard-design.RESULTAT.md` avec :
1. Fichiers créés / modifiés.
2. Erreurs rencontrées et résolutions.
3. Tableau de verdicts (✅ / ❌ par critère).
4. Verdict global : **OK** ou **BLOQUÉ**.

---

*Passer ensuite à PROMPT-B pour : onglet Données, onglet Backups, Header health check + auto-refresh, UserDetailPage enrichi.*
