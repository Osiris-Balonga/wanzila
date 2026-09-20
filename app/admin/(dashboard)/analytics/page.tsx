import { Bookmark, CheckCircle2, Navigation, Phone, Search, TrendingUp } from 'lucide-react'
import { ConversionFunnel } from '@/components/admin/AdminCharts'
import { AdminTrendChart } from '@/components/admin/AdminTrendChart'
import { PeriodSelector } from '@/components/admin/PeriodSelector'
import { RefreshAnalyticsButton } from '@/components/admin/RefreshAnalyticsButton'
import { getAdminAnalytics, percentageChange } from '@/lib/admin-analytics'

function clampPeriod(raw?: string) {
  const value = Number(raw)
  return value === 7 || value === 90 ? value : 30
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = clampPeriod((await searchParams).period)
  const analytics = await getAdminAnalytics(period)
  const metrics = [
    { label: 'Recherches', value: analytics.totals.searches, previous: analytics.previous.searches, icon: Search },
    { label: 'Fiches consultées', value: analytics.totals.views, previous: analytics.previous.views, icon: Bookmark },
    { label: 'Itinéraires demandés', value: analytics.totals.routeStarted, previous: analytics.previous.routeStarted, icon: Navigation },
    { label: 'Trajets calculés', value: analytics.totals.routeReady, previous: analytics.previous.routeReady, icon: CheckCircle2, success: true },
  ]
  const actions = [
    { label: 'Appeler', value: analytics.totals.calls, icon: Phone },
    { label: 'Enregistrer', value: analytics.totals.saves, icon: Bookmark },
    { label: 'Rechercher', value: analytics.totals.searches, icon: Search },
    { label: 'Itinéraire', value: analytics.totals.routeStarted, icon: Navigation },
  ]
  const maxAction = Math.max(1, ...actions.map(action => action.value))
  const mobile = analytics.devices.find(device => device.name.toLowerCase().includes('mobile'))?.value ?? analytics.devices[0]?.value ?? 0
  const deviceTotal = analytics.devices.reduce((total, device) => total + device.value, 0)
  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><h1>Analytique</h1><p>Comprendre l’usage et les parcours dans Wanzila</p></div><div className="admin-page-header__actions"><RefreshAnalyticsButton /><PeriodSelector value={period} /></div></header>

      <section className="admin-kpis" aria-label="Indicateurs analytiques">{metrics.map(({ label, value, previous, icon: Icon, success }) => { const delta = percentageChange(value, previous); return <article key={label}><span className={`admin-kpi-icon${success ? ' is-success' : ''}`}><Icon /></span><div><span className="admin-kpi-value"><strong>{value.toLocaleString('fr-FR')}</strong><small className={delta >= 0 ? 'is-positive' : 'is-negative'}><TrendingUp size={14} /> {delta >= 0 ? '+' : ''}{delta} %</small></span><p>{label}</p></div></article> })}</section>

      <div className="admin-analytics-grid">
        <section className="admin-panel admin-analytics-trend"><header><div><h2>Évolution des interactions</h2><p>Nombre d’événements par jour sur la période</p></div></header><AdminTrendChart points={analytics.trend} /></section>
        <ConversionFunnel data={analytics} title="Conversion globale" />
        <section className="admin-panel admin-actions"><header><h2>Actions les plus utilisées</h2><p>Nombre d’utilisations sur la période</p></header>{actions.map(({ label, value, icon: Icon }) => <div key={label}><span><Icon size={17} />{label}</span><i><b style={{ width: `${value / maxAction * 100}%` }} /></i><strong>{value.toLocaleString('fr-FR')}</strong></div>)}</section>
        <section className="admin-panel admin-devices"><header><div><h2>Appareils</h2><p>Répartition des utilisateurs</p></div></header><div className="admin-devices__content"><div className="admin-donut" style={{ '--mobile': `${mobile * 3.6}deg` } as React.CSSProperties}><strong>{deviceTotal ? '100' : '0'} %</strong><span>des sessions</span></div><ul>{analytics.devices.map((device, index) => <li key={device.name}><i className={`device-color-${index + 1}`} /><span>{device.name}</span><strong>{device.value} %</strong></li>)}</ul></div></section>
      </div>
    </div>
  )
}
