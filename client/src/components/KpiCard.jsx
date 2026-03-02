import { ResponsiveContainer, LineChart, Line } from 'recharts';
import './KpiCard.css';

/**
 * Carte KPI santé & analytics.
 * Props :
 *   value        — valeur principale affichée
 *   label        — libellé (uppercase, secondaire)
 *   sublabel     — sous-libellé (muted)
 *   icon         — emoji ou caractère affiché en haut à gauche
 *   sparklineData / sparklineKey — données mini-graphe
 *   trendPct     — % de tendance vs période précédente
 *   variant      — 'acquisition' | 'engagement' | 'health' | 'retention' | 'default'
 */
export default function KpiCard({
  value, label, sublabel, icon,
  sparklineData, sparklineKey = 'count',
  trendPct, variant = 'default',
}) {
  const hasTrend = trendPct != null && !Number.isNaN(trendPct);
  const trendUp   = hasTrend && trendPct > 0;
  const trendDown = hasTrend && trendPct < 0;

  return (
    <div className={`kpi-card kpi-card--${variant}`}>

      {/* Ligne haute : icône + badge tendance */}
      <div className="kpi-card-top">
        {icon
          ? <span className="kpi-card-icon" aria-hidden>{icon}</span>
          : <span className="kpi-card-icon-placeholder" />
        }
        {hasTrend && (
          <span className={`kpi-card-trend kpi-card-trend--${trendUp ? 'up' : trendDown ? 'down' : 'neutral'}`}>
            {trendUp ? '▲' : trendDown ? '▼' : '→'}&nbsp;{Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Valeur principale */}
      <span className="kpi-card-value">{value}</span>

      {/* Labels */}
      <span className="kpi-card-label">{label}</span>
      {sublabel && <span className="kpi-card-sublabel">{sublabel}</span>}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="kpi-card-sparkline">
          <ResponsiveContainer width="100%" height={28}>
            <LineChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Line
                type="monotone"
                dataKey={sparklineKey}
                stroke="var(--kpi-accent)"
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
