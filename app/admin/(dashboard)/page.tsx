import { AlertTriangle, CheckCircle2, Clock3, MapPin, Navigation, Search, Store, TrendingUp } from 'lucide-react'
import { ConversionFunnel } from '@/components/admin/AdminCharts'
import { AdminTrendChart } from '@/components/admin/AdminTrendChart'
import { PeriodSelector } from '@/components/admin/PeriodSelector'
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton'
import { getAdminAnalytics, getDataQuality, percentageChange } from '@/lib/admin-analytics'

function clampPeriod(raw?: string) {
  const value = Number(raw)
  return value === 30 || value === 90 ? value : 7
}

function Progress({ label, value, total, color = 'purple' }: { label: string; value: number; total: number; color?: 'purple' | 'green' }) {
  const rate = total ? Math.round(value / total * 100) : 0
  return <div className="admin-progress"><div><strong>{value} / {total}</strong><span>{label}</span><b>{rate} %</b></div><span className="admin-progress__track"><i className={color === 'green' ? 'is-green' : ''} style={{ width: `${Math.min(100, rate)}%` }} /></span></div>
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = clampPeriod((await searchParams).period)
  const [analytics, quality] = await Promise.all([getAdminAnalytics(period), getDataQuality()])
  const routeRate = analytics.totals.searches ? Math.round(analytics.totals.routeStarted / analytics.totals.searches * 100) : 0
  const successRate = analytics.totals.routeStarted ? Math.round(analytics.totals.routeReady / analytics.totals.routeStarted * 100) : 0
  const previousSuccessRate = analytics.previous.routeStarted ? Math.round(analytics.previous.routeReady / analytics.previous.routeStarted * 100) : 0
  const searchDelta = percentageChange(analytics.totals.searches, analytics.previous.searches)
  const routeDelta = percentageChange(analytics.totals.routeStarted, analytics.previous.routeStarted)
  const successDelta = successRate - previousSuccessRate
  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><h1>Vue d’ensemble</h1><p>Les indicateurs essentiels de Wanzila</p></div><div className="admin-page-header__actions"><RefreshAnalyticsButton /><PeriodSelector value={period} /></div></header>

      <section className="admin-kpis admin-kpis--overview" aria-label="Indicateurs essentiels">
        <article><span className="admin-kpi-icon"><Search /></span><div><span className="admin-kpi-value"><strong>{analytics.totals.searches.toLocaleString('fr-FR')}</strong><small className={searchDelta >= 0 ? 'is-positive' : 'is-negative'}><TrendingUp size={14} /> {searchDelta >= 0 ? '+' : ''}{searchDelta} %</small></span><p>Recherches</p></div></article>
        <article><span className="admin-kpi-icon"><Navigation /></span><div><span className="admin-kpi-value"><strong>{routeRate} %</strong><small className={routeDelta >= 0 ? 'is-positive' : 'is-negative'}><TrendingUp size={14} /> {routeDelta >= 0 ? '+' : ''}{routeDelta} %</small></span><p>Vers un itinéraire</p></div></article>
        <article><span className="admin-kpi-icon is-success"><CheckCircle2 /></span><div><span className="admin-kpi-value"><strong>{successRate} %</strong><small className={successDelta >= 0 ? 'is-positive' : 'is-negative'}><TrendingUp size={14} /> {successDelta >= 0 ? '+' : ''}{successDelta} pt</small></span><p>Itinéraires réussis</p></div></article>
        <article><span className="admin-kpi-icon"><Clock3 /></span><div><span className="admin-kpi-value"><strong>{quality.freshnessLabel}</strong><small className="is-positive"><i /> À jour</small></span><p>Fraîcheur des données</p></div></article>
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel admin-trend-panel"><header><div><h2>Recherches et itinéraires</h2><p>Évolution quotidienne sur la période sélectionnée</p></div></header><AdminTrendChart points={analytics.trend} /></section>
        <ConversionFunnel data={analytics} />
        <section className="admin-panel admin-quality"><header><h2>Qualité des données</h2><p>État de complétion des informations dans Wanzila</p></header><Progress label="gardes confirmées" value={quality.confirmedDuty} total={quality.total} /><Progress label="positions vérifiées" value={quality.positioned} total={quality.total} /><Progress label="téléphones disponibles" value={quality.phones} total={quality.total} color="green" /></section>
        <section className="admin-panel admin-takeaways"><header><h2>À retenir</h2><p>Insights clés sur la période</p></header><div><span className="is-good"><TrendingUp /></span><p><strong>La conversion vers l’itinéraire atteint {routeRate} %</strong><small>{analytics.totals.routeStarted.toLocaleString('fr-FR')} demandes d’itinéraire pour {analytics.totals.searches.toLocaleString('fr-FR')} recherches.</small></p></div><div><span className="is-warning"><AlertTriangle /></span><p><strong>{quality.total - quality.positioned} pharmacies restent à géolocaliser</strong><small>Complétez leurs positions pour améliorer la couverture de Brazzaville.</small></p></div></section>
      </div>
    </div>
  )
}
