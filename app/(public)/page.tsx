'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import { Bookmark, Clock3, Layers2, LoaderCircle, LocateFixed, MapPin, Navigation, PanelLeft, PlusCircle, RotateCcw, Search, Siren, SlidersHorizontal, X } from 'lucide-react'
import { Map } from '@/components/ui/map'
import { CityWeather } from '@/components/wanzila/CityWeather'
import { PharmacyDetails, type RouteState } from '@/components/wanzila/PharmacyDetails'
import { DataErrorState, MapSkeleton, PharmacyListSkeleton } from '@/components/wanzila/LoadingStates'
import { PharmacyRow } from '@/components/wanzila/PharmacyRow'
import { AppSplash } from '@/components/wanzila/AppSplash'
import { filterPharmacies, hasCoordinates, loadPharmacies } from '@/lib/pharmacies'
import { createAnalyticsId, trackEvent } from '@/lib/analytics'
import { EMERGENCY_CONTACT } from '@/lib/constants'
import type { Pharmacy, SearchFilters } from '@/types/database'
import type { RouteInfo } from '@/types/route'

type Tab = 'map' | 'saved' | 'contribute'
type SheetSize = 'peek' | 'full'
type TileStyle = 'clean' | 'roadmap' | 'satellite'
const STORAGE_KEY = 'wanzila:saved:v1'
const DEFAULT_FILTERS: SearchFilters = { query: '', category: 'all', availability: 'all' }
const NEARBY_LIMIT = 10

function distanceBetween(origin: [number, number], pharmacy: Pharmacy) {
  if (!hasCoordinates(pharmacy)) return Number.POSITIVE_INFINITY
  const radians = (value: number) => value * Math.PI / 180
  const earthRadius = 6_371_000
  const latitudeDelta = radians(pharmacy.latitude - origin[0])
  const longitudeDelta = radians(pharmacy.longitude - origin[1])
  const startLatitude = radians(origin[0])
  const endLatitude = radians(pharmacy.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

const tabs: { id: Tab; label: string; Icon: typeof MapPin }[] = [
  { id: 'map', label: 'Carte', Icon: MapPin },
  { id: 'saved', label: 'Enregistrés', Icon: Bookmark },
  { id: 'contribute', label: 'Contribuer', Icon: PlusCircle },
]

function SearchControls({ filters, onChange, onReset, pharmacies, nearbyActive = false, onDisableNearby, mobile = false }: {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onReset: () => void
  pharmacies: Pharmacy[]
  nearbyActive?: boolean
  onDisableNearby?: () => void
  mobile?: boolean
}) {
  const filterStripRef = useRef<HTMLDivElement>(null)
  const [filterEdges, setFilterEdges] = useState({ atStart: true, atEnd: true })
  const neighborhoods = useMemo(() => [...new Set(pharmacies.map(p => p.neighborhood).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr')), [pharmacies])
  const boroughs = useMemo(() => [...new Set(pharmacies.map(p => p.borough).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr')), [pharmacies])
  const updateFilterEdges = useCallback(() => {
    const strip = filterStripRef.current
    if (!strip) return
    setFilterEdges({ atStart: strip.scrollLeft <= 2, atEnd: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2 })
  }, [])
  useEffect(() => {
    if (!mobile) return
    const frame = window.requestAnimationFrame(updateFilterEdges)
    window.addEventListener('resize', updateFilterEdges)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', updateFilterEdges) }
  }, [mobile, pharmacies.length, updateFilterEdges])
  return <div className={`search-controls${mobile ? ' search-controls--mobile' : ''}`}>
    <label className="search-field">
      <Search size={21} aria-hidden="true" />
      <span className="sr-only">Rechercher une pharmacie ou un quartier</span>
      <input value={filters.query} onChange={event => onChange({ ...filters, query: event.target.value })} placeholder="Rechercher une pharmacie, un quartier…" />
      {filters.query && <button aria-label="Effacer la recherche et réinitialiser la carte" onClick={onReset}><X size={17} /></button>}
      {mobile && <Image className="mobile-search__brand" src="/brand-app-icon.png" width={34} height={34} alt="Wanzila" priority />}
    </label>
    <div ref={filterStripRef} className={`filter-strip${mobile ? ` filter-strip--mobile${filterEdges.atStart ? ' is-at-start' : ''}${filterEdges.atEnd ? ' is-at-end' : ''}` : ''}`} aria-label="Filtres de recherche" onScroll={updateFilterEdges}>
      {nearbyActive && <button className="filter-chip filter-chip--nearby is-active" onClick={onDisableNearby} aria-label="Désactiver le tri par proximité"><LocateFixed size={15} /><span>À proximité</span><X size={13} /></button>}
      {(filters.query || filters.category !== DEFAULT_FILTERS.category || filters.availability !== 'all' || filters.neighborhood || filters.borough) && <button className="filter-chip filter-chip--reset" onClick={onReset}><RotateCcw size={14} /> Réinitialiser</button>}
      <label className="filter-chip filter-chip--select"><SlidersHorizontal size={15} /><span className="sr-only">Type de pharmacie</span><select aria-label="Type de pharmacie" value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value as SearchFilters['category'] })}><option value="all">Tous les types</option><option value="on_duty">De garde aujourd’hui</option><option value="night_pharmacy">De nuit</option><option value="pharmacy">Classiques</option></select></label>
      <label className="filter-chip filter-chip--select"><Clock3 size={15} /><span className="sr-only">Disponibilité</span><select aria-label="Disponibilité" value={filters.availability || 'all'} onChange={event => onChange({ ...filters, availability: event.target.value as SearchFilters['availability'] })}><option value="all">Tous les statuts</option><option value="open">Ouvertes</option><option value="closed">Fermées</option><option value="unknown">À confirmer</option></select></label>
      <label className="filter-chip filter-chip--select"><MapPin size={15} /><span className="sr-only">Quartier</span><select value={filters.neighborhood || ''} onChange={event => onChange({ ...filters, neighborhood: event.target.value })}><option value="">Quartier</option>{neighborhoods.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="filter-chip filter-chip--select"><span className="sr-only">Arrondissement</span><select value={filters.borough || ''} onChange={event => onChange({ ...filters, borough: event.target.value })}><option value="">Arrondissement</option>{boroughs.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
  </div>
}

function EmptyState({ kind }: { kind: 'saved' | 'search' }) {
  return <div className="empty-state">
    <Image src="/illustrations/saved-empty.webp" width={188} height={188} alt="" />
    <h2>{kind === 'saved' ? 'Aucune pharmacie enregistrée' : 'Aucune pharmacie trouvée'}</h2>
    <p>{kind === 'saved' ? 'Ouvrez une pharmacie sur la carte, puis touchez Enregistrer pour la retrouver ici.' : 'Essayez d’autres filtres ou réinitialisez la recherche.'}</p>
  </div>
}

function ContributeState({ onClose }: { onClose?: () => void }) {
  return <div className="coming-soon">
    {onClose && <button className="icon-button coming-soon__close" aria-label="Fermer contribuer" onClick={onClose}><X size={20} /></button>}
    <Image src="/illustrations/contribute.webp" width={190} height={190} alt="" />
    <h1>Contribuer</h1><p>Disponible prochainement</p>
    <span>Vous pourrez bientôt proposer des informations pour améliorer la carte.</span>
  </div>
}

const tileOptions: { id: TileStyle; label: string; description: string; preview: string }[] = [
  { id: 'clean', label: 'Carte claire', description: 'Lecture simplifiée', preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/13/4192/4443' },
  { id: 'roadmap', label: 'Carte routière', description: 'Google Maps', preview: 'https://mt0.google.com/vt/lyrs=m&x=4443&y=4192&z=13' },
  { id: 'satellite', label: 'Satellite', description: 'Vue aérienne', preview: 'https://mt0.google.com/vt/lyrs=s&x=4443&y=4192&z=13' },
]

function TilePicker({ value, onChange, onClose }: { value: TileStyle; onChange: (value: TileStyle) => void; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="tile-picker-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="tile-picker" role="dialog" aria-modal="true" aria-labelledby="tile-picker-title">
      <header><h2 id="tile-picker-title">Type de carte</h2><button className="icon-button" onClick={onClose} aria-label="Fermer le choix de carte"><X size={20} /></button></header>
      <div className="tile-picker__options">
        {tileOptions.map(option => <button key={option.id} className={value === option.id ? 'is-selected' : ''} onClick={() => { onChange(option.id); onClose() }} aria-pressed={value === option.id}>
          <span className="tile-picker__preview"><img src={option.preview} alt="" /></span>
          <strong>{option.label}</strong><small>{option.description}</small>
        </button>)}
      </div>
    </section>
  </div>
}

export default function HomePage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [tab, setTab] = useState<Tab>('map')
  const [selected, setSelected] = useState<Pharmacy | null>(null)
  const [sheetSize, setSheetSize] = useState<SheetSize>('peek')
  const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [tileStyle, setTileStyle] = useState<TileStyle>('clean')
  const [tilePickerOpen, setTilePickerOpen] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [mapReset, setMapReset] = useState(0)
  const [restoreView, setRestoreView] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [nearbyPosition, setNearbyPosition] = useState<[number, number] | null>(null)
  const [nearbyStatus, setNearbyStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle')
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [routeState, setRouteState] = useState<RouteState>({ status: 'idle' })
  const [routeFocusMode, setRouteFocusMode] = useState(false)
  const requestRef = useRef(0)
  const dragStart = useRef<number | null>(null)
  const dragStartHeight = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const currentViewport = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const viewBeforeSelection = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const trackedSearch = useRef('')
  const activeSearchId = useRef<string | null>(null)
  const trackViewport = useCallback((view: { center: [number, number]; zoom: number }) => { currentViewport.current = view }, [])
  const fetchPharmacyData = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    loadPharmacies()
      .then(data => {
        setPharmacies(data)
        const verificationDates = data.flatMap(pharmacy => [
          pharmacy.place_verified_at,
          ...pharmacy.duty_periods.map(period => period.verified_at),
        ]).filter((value): value is string => Boolean(value)).map(value => new Date(value).getTime()).filter(Number.isFinite)
        const latestVerification = verificationDates.length ? Math.max(...verificationDates) : null
        trackEvent('data_snapshot_loaded', {
          pharmacy_count: data.length,
          located_count: data.filter(hasCoordinates).length,
          confirmed_duty_count: data.filter(pharmacy => pharmacy.duty_status === 'confirmed').length,
          latest_verification_at: latestVerification ? new Date(latestVerification).toISOString() : 'unknown',
          data_age_hours: latestVerification ? Math.max(0, Math.round((Date.now() - latestVerification) / 3_600_000)) : -1,
        })
      })
      .catch(error => setLoadError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPharmacyData()
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(value)) setSavedIds(value.filter((id): id is string => typeof id === 'string'))
    } catch { /* Ignore damaged or blocked local storage. */ }
    setStorageReady(true)
  }, [fetchPharmacyData])

  useEffect(() => {
    if (storageReady) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds)) } catch { /* Saving remains optional on restricted browsers. */ }
    }
  }, [savedIds, storageReady])

  useEffect(() => {
    if (!pharmacies.length) return
    const id = new URLSearchParams(window.location.search).get('pharmacy')
    const match = pharmacies.find(item => item.id === id)
    if (match) { setSelected(match); setSheetSize('peek') }
  }, [pharmacies])

  useEffect(() => {
    if (routeState.status === 'ready' && route) setRouteFocusMode(true)
  }, [route, routeState.status])

  const visible = useMemo(() => filterPharmacies(pharmacies, filters), [pharmacies, filters])
  const nearbyDistances = useMemo(() => {
    if (!nearbyPosition || nearbyStatus !== 'active') return new globalThis.Map<string, number>()
    return new globalThis.Map(visible.filter(hasCoordinates).map(pharmacy => [pharmacy.id, distanceBetween(nearbyPosition, pharmacy)]))
  }, [nearbyPosition, nearbyStatus, visible])
  const displayed = useMemo(() => nearbyStatus === 'active'
    ? [...visible].filter(hasCoordinates).sort((a, b) => (nearbyDistances.get(a.id) ?? Infinity) - (nearbyDistances.get(b.id) ?? Infinity)).slice(0, NEARBY_LIMIT)
    : visible, [nearbyDistances, nearbyStatus, visible])
  const saved = useMemo(() => pharmacies.filter(pharmacy => savedIds.includes(pharmacy.id)), [pharmacies, savedIds])
  const visiblePoints = useMemo(() => displayed.filter(hasCoordinates), [displayed])
  const mapPharmacies = useMemo(() => {
    if (selected && hasCoordinates(selected) && !visiblePoints.some(point => point.id === selected.id)) return [...visiblePoints, selected]
    return visiblePoints
  }, [visiblePoints, selected])

  useEffect(() => {
    const query = filters.query.trim()
    if (query.length < 2) {
      trackedSearch.current = ''
      return
    }
    if (query === trackedSearch.current) return
    const timer = window.setTimeout(() => {
      trackedSearch.current = query
      activeSearchId.current = createAnalyticsId()
      trackEvent('search_performed', {
        search_id: activeSearchId.current,
        search_type: 'text',
        query_length: query.length,
        result_count: visible.length,
        category: filters.category,
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [filters.query, visible.length])

  const clearRoute = useCallback(() => {
    requestRef.current += 1
    setRoute(null)
    setPosition(null)
    setRouteState({ status: 'idle' })
    setRouteFocusMode(false)
  }, [])

  const openPharmacy = useCallback((pharmacy: Pharmacy) => {
    clearRoute()
    trackEvent('pharmacy_viewed', {
      pharmacy_id: pharmacy.id,
      on_duty: pharmacy.duty_status === 'confirmed',
      source: activeSearchId.current ? 'search' : 'browse',
      ...(activeSearchId.current ? { search_id: activeSearchId.current } : {}),
    })
    viewBeforeSelection.current = currentViewport.current
    setRestoreView(null)
    setSelected(pharmacy)
    setPanelCollapsed(false)
    setSheetSize('peek')
    setTab('map')
  }, [clearRoute])

  const closePharmacy = () => {
    clearRoute()
    setSelected(null)
    if (viewBeforeSelection.current) setRestoreView({ ...viewBeforeSelection.current, key: Date.now() })
    viewBeforeSelection.current = null
  }

  const disableNearby = useCallback(() => {
    setNearbyPosition(null)
    setNearbyStatus('idle')
    setNearbyError(null)
    setRestoreView(null)
    setMapReset(value => value + 1)
  }, [])

  const locateNearbyPharmacies = useCallback(async () => {
    if (nearbyStatus === 'active' && nearbyPosition) {
      setRestoreView(null)
      setMapReset(value => value + 1)
      return
    }
    setNearbyStatus('loading')
    setNearbyError(null)
    try {
      if (!navigator.geolocation) throw new Error('La géolocalisation n’est pas disponible sur ce navigateur.')
      const location = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }))
      const origin: [number, number] = [location.coords.latitude, location.coords.longitude]
      clearRoute()
      setSelected(null)
      setTab('map')
      setFilters(current => ({ ...current, neighborhood: undefined, borough: undefined }))
      setNearbyPosition(origin)
      setNearbyStatus('active')
      setRestoreView(null)
      setMapReset(value => value + 1)
      trackEvent('nearby_pharmacies_enabled', { accuracy_meters: Math.round(location.coords.accuracy) })
    } catch (error) {
      const denied = typeof error === 'object' && error !== null && 'code' in error && error.code === 1
      setNearbyStatus('error')
      setNearbyError(denied ? 'Localisation refusée. Autorisez-la dans votre navigateur pour voir les pharmacies proches.' : error instanceof Error ? error.message : 'Votre position n’a pas pu être récupérée.')
      trackEvent('nearby_pharmacies_failed', { reason: denied ? 'permission_denied' : 'location_unavailable' })
    }
  }, [clearRoute, nearbyPosition, nearbyStatus])

  const resetFilters = () => {
    clearRoute()
    setNearbyPosition(null)
    setNearbyStatus('idle')
    setNearbyError(null)
    activeSearchId.current = null
    trackedSearch.current = ''
    setFilters(DEFAULT_FILTERS)
    setRestoreView(null)
    setSelected(null)
    setTab('map')
    setSheetSize('peek')
    setMapReset(value => value + 1)
  }

  const changeFilters = (next: SearchFilters) => {
    setRestoreView(null)
    if (next.query !== filters.query) activeSearchId.current = null
    else if (next.category !== filters.category || next.availability !== filters.availability || next.neighborhood !== filters.neighborhood || next.borough !== filters.borough) {
      activeSearchId.current = createAnalyticsId()
      trackEvent('search_performed', {
        search_id: activeSearchId.current,
        search_type: 'filter',
        result_count: filterPharmacies(pharmacies, next).length,
        category: next.category,
        availability: next.availability || 'all',
        area_filter: Boolean(next.neighborhood || next.borough),
      })
    }
    setFilters(next)
  }

  const selectTab = (next: Tab) => {
    clearRoute()
    setSelected(null)
    setRestoreView(null)
    setTab(next)
    if (next !== 'map') setPanelCollapsed(false)
    setSheetSize('peek')
  }

  const startSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragStart.current = event.clientY
    dragStartHeight.current = event.currentTarget.parentElement?.getBoundingClientRect().height ?? null
    dragMoved.current = false
    setSheetDragHeight(dragStartHeight.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    const delta = event.clientY - dragStart.current
    if (Math.abs(delta) > 8) dragMoved.current = true
    if (dragStartHeight.current !== null) {
      const maxHeight = Math.max(260, window.innerHeight - 160)
      setSheetDragHeight(Math.max(96, Math.min(maxHeight, dragStartHeight.current - delta)))
    }
  }

  const finishSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    const delta = event.clientY - dragStart.current
    dragStart.current = null
    dragStartHeight.current = null
    setSheetDragHeight(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (delta < -45) {
      setSheetSize('full')
      return
    }
    if (delta > 55) {
      if (sheetSize === 'full') setSheetSize('peek')
      else if (selected) closePharmacy()
      else selectTab('map')
    }
  }

  const cancelSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStart.current = null
    dragStartHeight.current = null
    dragMoved.current = false
    setSheetDragHeight(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const toggleSaved = (id: string) => setSavedIds(current => {
    const saved = !current.includes(id)
    trackEvent('pharmacy_save_changed', { pharmacy_id: id, saved })
    return saved ? [...current, id] : current.filter(item => item !== id)
  })

  const startRoute = useCallback(async (pharmacy: Pharmacy) => {
    if (!hasCoordinates(pharmacy)) return
    const searchId = activeSearchId.current
    trackEvent('route_started', {
      pharmacy_id: pharmacy.id,
      on_duty: pharmacy.duty_status === 'confirmed',
      source: searchId ? 'search' : 'browse',
      ...(searchId ? { search_id: searchId } : {}),
    })
    if (!viewBeforeSelection.current) viewBeforeSelection.current = currentViewport.current
    const requestId = ++requestRef.current
    setSelected(pharmacy)
    setTab('map')
    setSheetSize('peek')
    setRestoreView(null)
    setRoute(null)
    setPosition(null)
    setRouteState({ status: 'loading' })
    setRouteFocusMode(false)
    try {
      if (!navigator.geolocation) throw new Error('La géolocalisation est indisponible sur ce navigateur.')
      const location = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }))
      if (requestId !== requestRef.current) return
      const origin: [number, number] = [location.coords.latitude, location.coords.longitude]
      setPosition(origin)
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${pharmacy.longitude},${pharmacy.latitude}?overview=full&geometries=geojson`
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
      if (!response.ok) throw new Error('Le service d’itinéraire est indisponible.')
      const data = await response.json()
      const result = data.routes?.[0]
      const coordinates = result?.geometry?.coordinates
      if (data.code !== 'Ok' || !Array.isArray(coordinates) || coordinates.length < 2 || !Number.isFinite(result.distance) || !Number.isFinite(result.duration)) throw new Error('Aucun trajet routier trouvé.')
      if (requestId !== requestRef.current) return
      setRoute({ distance: result.distance, duration: result.duration, coordinates: coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude]) })
      setRouteState({ status: 'ready' })
      trackEvent('route_ready', {
        pharmacy_id: pharmacy.id,
        distance_km: Number((result.distance / 1000).toFixed(1)),
        duration_minutes: Math.max(1, Math.round(result.duration / 60)),
        ...(searchId ? { search_id: searchId } : {}),
      })
    } catch (error) {
      if (requestId !== requestRef.current) return
      setRoute(null)
      const isLocationError = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
      trackEvent('route_failed', {
        pharmacy_id: pharmacy.id,
        reason: isLocationError ? 'location_unavailable' : 'routing_unavailable',
        ...(searchId ? { search_id: searchId } : {}),
      })
      setRouteState({ status: 'error', message: isLocationError ? 'Position indisponible. Autorisez la géolocalisation puis réessayez.' : error instanceof Error ? error.message : 'Le trajet n’a pas pu être calculé.' })
    }
  }, [])

  const details = selected && <PharmacyDetails pharmacy={selected} saved={savedIds.includes(selected.id)} onSave={() => toggleSaved(selected.id)} onClose={closePharmacy} onRoute={() => startRoute(selected)} route={route} routeState={routeState} />
  const selectedSheet = selected && <PharmacyDetails pharmacy={selected} saved={savedIds.includes(selected.id)} onSave={() => toggleSaved(selected.id)} onClose={closePharmacy} onRoute={() => startRoute(selected)} route={route} routeState={routeState} compact={sheetSize === 'peek'} />

  const list = tab === 'saved' ? saved : displayed
  const listTitle = tab === 'saved' ? 'Mes pharmacies enregistrées' : nearbyStatus === 'active' ? 'Pharmacies près de vous' : filters.category === 'on_duty' ? 'Pharmacies de garde aujourd’hui' : 'Pharmacies à Brazzaville'
  const sheetOpen = Boolean(selected) || tab !== 'map'

  return <div className={`wanzila-app${panelCollapsed ? ' is-panel-collapsed' : ''}`}>
    <AppSplash />
    <nav className="desktop-rail" aria-label="Navigation principale">
      <button className="desktop-rail__panel-toggle desktop-rail__panel-toggle--primary" onClick={() => setPanelCollapsed(value => !value)} aria-expanded={!panelCollapsed} aria-controls="desktop-pharmacy-panel" title={panelCollapsed ? 'Afficher le panneau' : 'Masquer le panneau'}><PanelLeft size={23} /><span>Panneau</span></button>
      <div className="desktop-rail__tabs">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => selectTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={21} fill={id === 'saved' && tab === id ? 'currentColor' : 'none'} /><span>{label}</span></button>)}</div>
      <a className="desktop-rail__emergency" href={EMERGENCY_CONTACT.href} onClick={() => trackEvent('emergency_call_started')} aria-label={`Appeler les urgences médicales au ${EMERGENCY_CONTACT.number}`}><Siren size={20} /><span>Urgence<br />{EMERGENCY_CONTACT.number}</span></a>
      <span className="desktop-rail__city"><MapPin size={15} /> Brazzaville</span>
    </nav>

    <aside id="desktop-pharmacy-panel" className="desktop-panel" aria-label={selected ? 'Fiche pharmacie' : listTitle} aria-hidden={panelCollapsed} inert={panelCollapsed ? true : undefined}>
      {selected && tab === 'map' ? <div className="desktop-panel__inner">{details}</div>
        : tab === 'contribute' ? <div className="desktop-panel__inner"><ContributeState /></div>
          : <><div className="desktop-panel__head"><SearchControls filters={filters} onChange={changeFilters} onReset={resetFilters} pharmacies={pharmacies} nearbyActive={nearbyStatus === 'active'} onDisableNearby={disableNearby} /><div className="panel-heading"><div><h1>{listTitle}</h1>{loading ? <span className="skeleton-block panel-heading__skeleton" aria-hidden="true" /> : <p>{tab === 'saved' ? `${saved.length} pharmacie${saved.length > 1 ? 's' : ''} enregistrée${saved.length > 1 ? 's' : ''} sur cet appareil` : nearbyStatus === 'active' ? `${displayed.length} pharmacie${displayed.length > 1 ? 's' : ''} les plus proche${displayed.length > 1 ? 's' : ''}` : `${visible.length} pharmacie${visible.length > 1 ? 's' : ''} · ${visible.filter(hasCoordinates).length} sur la carte`}</p>}</div></div></div><div className="desktop-panel__list">{loading && <PharmacyListSkeleton />}{loadError && <DataErrorState message={loadError} onRetry={fetchPharmacyData} />}{!loading && !loadError && list.length === 0 && <EmptyState kind={tab === 'saved' ? 'saved' : 'search'} />}{!loading && !loadError && list.map(pharmacy => <PharmacyRow key={pharmacy.id} pharmacy={pharmacy} distance={tab === 'map' ? nearbyDistances.get(pharmacy.id) : undefined} saved={savedIds.includes(pharmacy.id)} onOpen={() => openPharmacy(pharmacy)} onSave={() => toggleSaved(pharmacy.id)} onRoute={() => startRoute(pharmacy)} />)}</div></>}
    </aside>

    <main className="map-stage" aria-label="Carte des pharmacies de Brazzaville">
      {loading ? <MapSkeleton className="map-stage__map" /> : <Map pharmacies={mapPharmacies} route={route} userPosition={position ?? nearbyPosition} focusPharmacy={selected} tileStyle={tileStyle} layoutKey={panelCollapsed} resetKey={mapReset} restoreView={restoreView} onViewportChange={trackViewport} onMarkerClick={openPharmacy} height="100%" className="map-stage__map" />}
      {loadError && <div className="mobile-data-error"><DataErrorState message={loadError} onRetry={fetchPharmacyData} /></div>}
      <div className="mobile-search"><SearchControls filters={filters} onChange={changeFilters} onReset={resetFilters} pharmacies={pharmacies} nearbyActive={nearbyStatus === 'active'} onDisableNearby={disableNearby} mobile />{filters.query.trim() && !selected && tab === 'map' && <div className="mobile-search-results"><strong>{displayed.length} résultat{displayed.length > 1 ? 's' : ''}</strong>{displayed.slice(0, 5).map(pharmacy => <button key={pharmacy.id} onClick={() => openPharmacy(pharmacy)}>{pharmacy.name}<span>{pharmacy.neighborhood || pharmacy.borough || 'Brazzaville'}</span></button>)}{displayed.length === 0 && <p>Aucune pharmacie trouvée.</p>}</div>}</div>
      <CityWeather />
      <div className={`map-tools${selected && sheetSize === 'peek' && !routeFocusMode ? ' has-detail' : ''}${sheetOpen && !routeFocusMode && (!selected || sheetSize === 'full') ? ' is-obscured' : ''}`}><a className="map-tools__emergency" href={EMERGENCY_CONTACT.href} onClick={() => trackEvent('emergency_call_started')} aria-label={`Appeler les urgences médicales au ${EMERGENCY_CONTACT.number}`} title={`${EMERGENCY_CONTACT.label} · ${EMERGENCY_CONTACT.number}`}><Siren size={21} /></a><button className={`${nearbyStatus === 'active' ? 'is-active' : ''}${nearbyStatus === 'loading' ? ' is-loading' : ''}`} aria-label={nearbyStatus === 'active' ? 'Recentrer sur les pharmacies proches' : 'Afficher les pharmacies proches'} title={nearbyStatus === 'active' ? 'Recentrer sur votre position' : 'Pharmacies à proximité'} onClick={locateNearbyPharmacies} disabled={nearbyStatus === 'loading'} aria-pressed={nearbyStatus === 'active'}>{nearbyStatus === 'loading' ? <LoaderCircle size={21} /> : <LocateFixed size={21} />}</button><button aria-label="Choisir le fond de carte" title="Choisir le fond de carte" onClick={() => setTilePickerOpen(true)}><Layers2 size={21} /></button></div>
      {nearbyError && <p className="nearby-message" role="alert">{nearbyError}</p>}

      {tilePickerOpen && <TilePicker value={tileStyle} onChange={setTileStyle} onClose={() => setTilePickerOpen(false)} />}

      {routeFocusMode && route && selected && <div className="mobile-route-summary" role="status">
        <button className="mobile-route-summary__details" onClick={() => setRouteFocusMode(false)} aria-label="Afficher la fiche de l’itinéraire"><Navigation size={19} /><span><strong>{(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min</strong><small>Vers {selected.name}</small></span></button>
        <button className="mobile-route-summary__close" onClick={clearRoute} aria-label="Quitter l’itinéraire"><X size={19} /></button>
      </div>}

      <div className={`mobile-sheet${selected ? ' is-detail' : ''}${selected && routeState.status !== 'idle' ? ' has-route-status' : ''}${sheetSize === 'full' ? ' is-full' : ''}${!sheetOpen || routeFocusMode ? ' is-hidden' : ''}`} style={sheetDragHeight !== null ? { height: `${sheetDragHeight}px`, transition: 'none' } : undefined}>
        <div className="mobile-sheet__handle-zone" onPointerDown={startSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={finishSheetDrag} onPointerCancel={cancelSheetDrag}><button className="mobile-sheet__handle" aria-label={sheetSize === 'full' ? 'Réduire la fiche' : 'Développer la fiche'} onClick={() => { if (dragMoved.current) { dragMoved.current = false; return } setSheetSize(value => value === 'peek' ? 'full' : 'peek') }} /></div>
        <div className="mobile-sheet__content">{selected ? selectedSheet : tab === 'saved' ? <div className="mobile-sheet__list"><div className="panel-heading"><div><h1>Mes pharmacies enregistrées</h1><p>{saved.length} pharmacie{saved.length > 1 ? 's' : ''} sur cet appareil</p></div><button className="icon-button" aria-label="Fermer les enregistrés" onClick={() => selectTab('map')}><X size={20} /></button></div>{saved.length === 0 && <EmptyState kind="saved" />}{saved.map(pharmacy => <PharmacyRow key={pharmacy.id} pharmacy={pharmacy} saved onOpen={() => openPharmacy(pharmacy)} onSave={() => toggleSaved(pharmacy.id)} onRoute={() => startRoute(pharmacy)} />)}</div> : <ContributeState onClose={() => selectTab('map')} />}</div>
      </div>
      <nav className="mobile-tabs" aria-label="Navigation principale">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => selectTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={22} fill={id === 'saved' && tab === id ? 'currentColor' : 'none'} /><span>{label}</span></button>)}</nav>
    </main>
  </div>
}
