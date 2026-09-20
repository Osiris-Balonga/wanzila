import { ChevronDown } from 'lucide-react'
import type { AdminAnalytics } from '@/lib/admin-analytics'

export function ConversionFunnel({ data, title = 'Parcours utilisateur' }: { data: AdminAnalytics; title?: string }) {
  const items = [
    { label: 'Recherche', value: data.totals.searches, width: '100%' },
    { label: 'Fiche consultée', value: data.totals.views, width: '80%' },
    { label: 'Itinéraire demandé', value: data.totals.routeStarted, width: '63%' },
    { label: 'Trajet calculé', value: data.totals.routeReady, width: '47%' },
  ]
  return (
    <section className="admin-panel admin-funnel-panel">
      <header><div><h2>{title}</h2><p>De la recherche à l’itinéraire calculé</p></div></header>
      <div className="admin-funnel">
        {items.map((item, index) => {
          const rate = data.totals.searches ? Math.round(item.value / data.totals.searches * 100) : 0
          return <div className="admin-funnel__row" key={item.label}><div className={`admin-funnel__shape admin-funnel__shape--${index + 1}`} style={{ width: item.width }}><strong>{item.value.toLocaleString('fr-FR')}</strong></div><div><strong>{rate} %</strong><span>{item.label}</span>{index < items.length - 1 ? <ChevronDown size={15} /> : null}</div></div>
        })}
      </div>
    </section>
  )
}
