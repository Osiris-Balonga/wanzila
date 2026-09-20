import { RefreshCw, TriangleAlert } from 'lucide-react'

export function PharmacyListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="pharmacy-list-skeleton" role="status" aria-label="Chargement des pharmacies">
    {Array.from({ length: rows }, (_, index) => <div className="pharmacy-skeleton" key={index} aria-hidden="true">
      <span className="skeleton-block pharmacy-skeleton__image" />
      <span className="pharmacy-skeleton__content">
        <span className="skeleton-block pharmacy-skeleton__title" />
        <span className="skeleton-block pharmacy-skeleton__line" />
        <span className="skeleton-block pharmacy-skeleton__badge" />
      </span>
      <span className="skeleton-block pharmacy-skeleton__actions" />
    </div>)}
  </div>
}

export function MapSkeleton({ className = '' }: { className?: string }) {
  return <div className={`map-skeleton ${className}`} role="status" aria-label="Chargement de la carte">
    <span className="map-skeleton__road map-skeleton__road--one" aria-hidden="true" />
    <span className="map-skeleton__road map-skeleton__road--two" aria-hidden="true" />
    <span className="map-skeleton__road map-skeleton__road--three" aria-hidden="true" />
    <span className="skeleton-block map-skeleton__pin" aria-hidden="true" />
  </div>
}

export function DataErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="data-error-state" role="alert">
    <span className="data-error-state__visual"><TriangleAlert aria-hidden="true" /></span>
    <h2>Impossible de charger les pharmacies</h2>
    <p>{message}</p>
    <button onClick={onRetry}><RefreshCw size={16} /> Réessayer</button>
  </div>
}
