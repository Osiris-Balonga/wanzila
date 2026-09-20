import { MapSkeleton, PharmacyListSkeleton } from '@/components/wanzila/LoadingStates'

export default function Loading() {
  return <div className="app-shell-skeleton">
    <aside className="app-shell-skeleton__rail" aria-hidden="true">
      <span className="skeleton-block app-shell-skeleton__logo" />
      <span className="skeleton-block app-shell-skeleton__nav" />
      <span className="skeleton-block app-shell-skeleton__nav" />
      <span className="skeleton-block app-shell-skeleton__nav" />
    </aside>
    <section className="app-shell-skeleton__panel">
      <span className="skeleton-block app-shell-skeleton__search" aria-hidden="true" />
      <span className="skeleton-block app-shell-skeleton__heading" aria-hidden="true" />
      <PharmacyListSkeleton />
    </section>
    <MapSkeleton className="app-shell-skeleton__map" />
    </div>
}
