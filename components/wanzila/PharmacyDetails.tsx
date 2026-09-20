import { Bookmark, Clock3, MapPin, Navigation, Phone, X } from 'lucide-react'
import { hasCoordinates, isOnDuty } from '@/lib/pharmacies'
import { trackEvent } from '@/lib/analytics'
import { AvailabilityBadge, PharmacyArtwork } from './PharmacyArtwork'
import type { Pharmacy } from '@/types/database'
import type { RouteInfo } from '@/types/route'

export type RouteState = { status: 'idle' | 'loading' | 'ready' | 'error'; message?: string }

interface Props {
  pharmacy: Pharmacy
  saved: boolean
  onSave: () => void
  onClose: () => void
  onRoute: () => void
  route: RouteInfo | null
  routeState: RouteState
  compact?: boolean
}

function RouteFeedback({ route, routeState }: { route: RouteInfo | null; routeState: RouteState }) {
  if (routeState.status === 'loading') return <div className="route-skeleton" role="status" aria-label="Calcul de l’itinéraire"><span className="skeleton-block" /><span className="skeleton-block" /></div>
  if (routeState.status === 'error') return <p className="route-message route-message--error" role="alert">{routeState.message}</p>
  if (routeState.status === 'ready' && route) return <p className="route-message" role="status">Trajet en voiture : {(route.distance / 1000).toFixed(1)} km · environ {Math.round(route.duration / 60)} min</p>
  return null
}

export function PharmacyDetails({ pharmacy, saved, onSave, onClose, onRoute, route, routeState, compact = false }: Props) {
  const phone = pharmacy.phone?.split('/')[0].trim()
  const located = hasCoordinates(pharmacy)
  const onDuty = isOnDuty(pharmacy)
  const hours = pharmacy.opening_hours
  return <div className={`pharmacy-details${compact ? ' is-compact' : ''}`}>
    <div className="pharmacy-details__top">
      <PharmacyArtwork pharmacy={pharmacy} className="pharmacy-visual" />
      <div className="pharmacy-details__title">
        <div className="eyebrow">{pharmacy.category === 'night_pharmacy' ? 'Pharmacie de nuit' : 'Pharmacie'} · Brazzaville</div>
        <h2>{pharmacy.name}</h2>
        <AvailabilityBadge pharmacy={pharmacy} />
      </div>
      <button className="icon-button close-button" aria-label="Fermer la fiche" onClick={onClose}><X size={20} /></button>
    </div>

    {compact && <div className="pharmacy-details__preview">
      <p><MapPin size={15} /> {pharmacy.neighborhood || pharmacy.borough || pharmacy.full_address}</p>
      <div className="pharmacy-details__preview-actions">
        {located && <button className="action-button action-button--primary" onClick={onRoute}><Navigation size={17} /> Itinéraire</button>}
        {phone && <a className="action-button" href={`tel:${phone.replace(/\s/g, '')}`} onClick={() => trackEvent('pharmacy_call_started', { pharmacy_id: pharmacy.id })}><Phone size={17} /> Appeler</a>}
        <button className="action-button" onClick={onSave}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Enregistrée' : 'Enregistrer'}</button>
      </div>
      <RouteFeedback route={route} routeState={routeState} />
    </div>}

    {!compact && <div className="pharmacy-details__extended">
      <div className="pharmacy-details__actions">
        {located && <button className="action-tile action-tile--primary" onClick={onRoute} disabled={routeState.status === 'loading'} aria-busy={routeState.status === 'loading'}><Navigation size={19} /><span>Itinéraire</span></button>}
        {phone && <a className="action-tile" href={`tel:${phone.replace(/\s/g, '')}`} onClick={() => trackEvent('pharmacy_call_started', { pharmacy_id: pharmacy.id })}><Phone size={19} /><span>Appeler</span></a>}
        <button className="action-tile" onClick={onSave}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /><span>{saved ? 'Enregistrée' : 'Enregistrer'}</span></button>
      </div>
      <RouteFeedback route={route} routeState={routeState} />

      <div className="info-list">
        {pharmacy.phone && <div className="info-list__row"><Phone size={19} /><div><strong>{pharmacy.phone}</strong><span>Numéro de téléphone</span></div></div>}
        {pharmacy.full_address !== 'Adresse non renseignée' && <div className="info-list__row"><MapPin size={19} /><div><strong>{pharmacy.full_address}</strong><span>Brazzaville, Congo</span></div></div>}
        {(pharmacy.neighborhood || pharmacy.borough) && <div className="info-list__row"><MapPin size={19} /><div><strong>{pharmacy.neighborhood || pharmacy.borough}</strong><span>{pharmacy.borough && pharmacy.neighborhood ? `Arrondissement de ${pharmacy.borough}` : 'Quartier ou arrondissement'}</span></div></div>}
        {onDuty && <div className="info-list__row"><Clock3 size={19} /><div><strong>Ouverte aujourd’hui</strong><span>Pharmacie de garde selon le planning officiel.</span></div></div>}
        {!onDuty && hours && <div className="info-list__row"><Clock3 size={19} /><div><strong>Tous les jours · {hours.daily_start}–{hours.daily_end}</strong><span>Horaires publiés, à confirmer avant le déplacement.</span></div></div>}
        {located && <div className="info-list__row"><Navigation size={19} /><div><strong>Coordonnées GPS</strong><span>{pharmacy.latitude.toFixed(5)}, {pharmacy.longitude.toFixed(5)}</span></div></div>}
        {!located && <div className="info-list__row"><Navigation size={19} /><div><strong>Position précise indisponible</strong><span>Le trajet intégré sera proposé dès que le point sera confirmé.</span></div></div>}
      </div>
    </div>}
  </div>
}
