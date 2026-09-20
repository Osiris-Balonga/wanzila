'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import { Bookmark, Layers2, MapPin, RotateCcw, Search, SlidersHorizontal, X, PlusCircle, Clock3, Siren } from 'lucide-react'
import { Map } from '@/components/ui/map'
import { CityWeather } from '@/components/wanzila/CityWeather'
import { PharmacyDetails, type RouteState } from '@/components/wanzila/PharmacyDetails'
import { DataErrorState, MapSkeleton, PharmacyListSkeleton } from '@/components/wanzila/LoadingStates'
import { PharmacyRow } from '@/components/wanzila/PharmacyRow'
import { filterPharmacies, hasCoordinates, loadPharmacies } from '@/lib/pharmacies'
import { trackEvent } from '@/lib/analytics'
import { EMERGENCY_CONTACT } from '@/lib/constants'
import type { Pharmacy, SearchFilters } from '@/types/database'
import type { RouteInfo } from '@/types/route'

type Tab = 'map' | 'saved' | 'contribute'
type SheetSize = 'peek' | 'full'
const STORAGE_KEY = 'wanzila:saved:v1'
const DEFAULT_FILTERS: SearchFilters = { query: '', category: 'on_duty', availability: 'all' }

const tabs: { id: Tab; label: string; Icon: typeof MapPin }[] = [
  { id: 'map', label: 'Carte', Icon: MapPin },
  { id: 'saved', label: 'Enregistrés', Icon: Bookmark },
  { id: 'contribute', label: 'Contribuer', Icon: PlusCircle },
]

function SearchControls({ filters, onChange, onReset, pharmacies, mobile = false }: {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onReset: () => void
  pharmacies: Pharmacy[]
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
      {(filters.query || filters.category !== DEFAULT_FILTERS.category || filters.availability !== 'all' || filters.neighborhood || filters.borough) && <button className="filter-chip filter-chip--reset" onClick={onReset}><RotateCcw size={14} /> Réinitialiser</button>}
      <label className="filter-chip filter-chip--select"><SlidersHorizontal size={15} /><span className="sr-only">Type de pharmacie</span><select aria-label="Type de pharmacie" value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value as SearchFilters['category'] })}><option value="on_duty">De garde aujourd’hui</option><option value="night_pharmacy">De nuit</option><option value="all">Toutes</option><option value="pharmacy">Classiques</option></select></label>
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
  const [tileStyle, setTileStyle] = useState<'standard' | 'humanitarian'>('standard')
  const [mapReset, setMapReset] = useState(0)
  const [restoreView, setRestoreView] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [routeState, setRouteState] = useState<RouteState>({ status: 'idle' })
  const requestRef = useRef(0)
  const dragStart = useRef<number | null>(null)
  const dragStartHeight = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const currentViewport = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const viewBeforeSelection = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const trackedSearch = useRef('')
  const trackViewport = useCallback((view: { center: [number, number]; zoom: number }) => { currentViewport.current = view }, [])
  const fetchPharmacyData = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    loadPharmacies()
      .then(setPharmacies)
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

  const visible = useMemo(() => filterPharmacies(pharmacies, filters), [pharmacies, filters])
  const saved = useMemo(() => pharmacies.filter(pharmacy => savedIds.includes(pharmacy.id)), [pharmacies, savedIds])
  const visiblePoints = useMemo(() => visible.filter(hasCoordinates), [visible])
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
      trackEvent('search_performed', { query_length: query.length, result_count: visible.length })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [filters.query, visible.length])

  const clearRoute = useCallback(() => {
    requestRef.current += 1
    setRoute(null)
    setPosition(null)
    setRouteState({ status: 'idle' })
  }, [])

  const openPharmacy = useCallback((pharmacy: Pharmacy) => {
    clearRoute()
    viewBeforeSelection.current = currentViewport.current
    setRestoreView(null)
    setSelected(pharmacy)
    setSheetSize('peek')
    setTab('map')
  }, [clearRoute])

  const closePharmacy = () => {
    clearRoute()
    setSelected(null)
    if (viewBeforeSelection.current) setRestoreView({ ...viewBeforeSelection.current, key: Date.now() })
    viewBeforeSelection.current = null
  }

  const resetFilters = () => {
    clearRoute()
    setFilters(DEFAULT_FILTERS)
    setRestoreView(null)
    setSelected(null)
    setTab('map')
    setSheetSize('peek')
    setMapReset(value => value + 1)
  }

  const changeFilters = (next: SearchFilters) => {
    setRestoreView(null)
    setFilters(next)
  }

  const selectTab = (next: Tab) => {
    clearRoute()
    setSelected(null)
    setRestoreView(null)
    setTab(next)
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

  const toggleSaved = (id: string) => setSavedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  const startRoute = useCallback(async (pharmacy: Pharmacy) => {
    if (!hasCoordinates(pharmacy)) return
    trackEvent('route_started', { pharmacy_id: pharmacy.id, on_duty: pharmacy.duty_status === 'confirmed' })
    if (!viewBeforeSelection.current) viewBeforeSelection.current = currentViewport.current
    const requestId = ++requestRef.current
    setSelected(pharmacy)
    setTab('map')
    setSheetSize('peek')
    setRestoreView(null)
    setRoute(null)
    setPosition(null)
    setRouteState({ status: 'loading' })
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
    } catch (error) {
      if (requestId !== requestRef.current) return
      setRoute(null)
      const isLocationError = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
      setRouteState({ status: 'error', message: isLocationError ? 'Position indisponible. Autorisez la géolocalisation puis réessayez.' : error instanceof Error ? error.message : 'Le trajet n’a pas pu être calculé.' })
    }
  }, [])

  const details = selected && <PharmacyDetails pharmacy={selected} saved={savedIds.includes(selected.id)} onSave={() => toggleSaved(selected.id)} onClose={closePharmacy} onRoute={() => startRoute(selected)} route={route} routeState={routeState} />
  const selectedSheet = selected && <PharmacyDetails pharmacy={selected} saved={savedIds.includes(selected.id)} onSave={() => toggleSaved(selected.id)} onClose={closePharmacy} onRoute={() => startRoute(selected)} route={route} routeState={routeState} compact={sheetSize === 'peek'} />

  const list = tab === 'saved' ? saved : visible
  const listTitle = tab === 'saved' ? 'Mes pharmacies enregistrées' : filters.category === 'on_duty' ? 'Pharmacies de garde aujourd’hui' : 'Pharmacies à Brazzaville'
  const sheetOpen = Boolean(selected) || tab !== 'map'

  return <div className="wanzila-app">
    <nav className="desktop-rail" aria-label="Navigation principale">
      <div className="brand"><Image className="brand__image" src="/brand-app-icon.png" width={50} height={50} alt="Logo Wanzila" priority /><strong>Wanzila</strong></div>
      <div className="desktop-rail__tabs">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => selectTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={21} fill={id === 'saved' && tab === id ? 'currentColor' : 'none'} /><span>{label}</span></button>)}</div>
      <a className="desktop-rail__emergency" href={EMERGENCY_CONTACT.href} onClick={() => trackEvent('emergency_call_started')} aria-label={`Appeler les urgences médicales au ${EMERGENCY_CONTACT.number}`}><Siren size={20} /><span>Urgence<br />{EMERGENCY_CONTACT.number}</span></a>
      <span className="desktop-rail__city"><MapPin size={15} /> Brazzaville</span>
    </nav>

    <aside className="desktop-panel" aria-label={selected ? 'Fiche pharmacie' : listTitle}>
      {selected && tab === 'map' ? <div className="desktop-panel__inner">{details}</div>
        : tab === 'contribute' ? <div className="desktop-panel__inner"><ContributeState /></div>
          : <><div className="desktop-panel__head"><SearchControls filters={filters} onChange={changeFilters} onReset={resetFilters} pharmacies={pharmacies} /><div className="panel-heading"><div><h1>{listTitle}</h1>{loading ? <span className="skeleton-block panel-heading__skeleton" aria-hidden="true" /> : <p>{tab === 'saved' ? `${saved.length} pharmacie${saved.length > 1 ? 's' : ''} enregistrée${saved.length > 1 ? 's' : ''} sur cet appareil` : `${visible.length} pharmacie${visible.length > 1 ? 's' : ''} · ${visible.filter(hasCoordinates).length} sur la carte`}</p>}</div></div></div><div className="desktop-panel__list">{loading && <PharmacyListSkeleton />}{loadError && <DataErrorState message={loadError} onRetry={fetchPharmacyData} />}{!loading && !loadError && list.length === 0 && <EmptyState kind={tab === 'saved' ? 'saved' : 'search'} />}{!loading && !loadError && list.map(pharmacy => <PharmacyRow key={pharmacy.id} pharmacy={pharmacy} saved={savedIds.includes(pharmacy.id)} onOpen={() => openPharmacy(pharmacy)} onSave={() => toggleSaved(pharmacy.id)} onRoute={() => startRoute(pharmacy)} />)}</div></>}
    </aside>

    <main className="map-stage" aria-label="Carte des pharmacies de Brazzaville">
      {loading ? <MapSkeleton className="map-stage__map" /> : <Map pharmacies={mapPharmacies} route={route} userPosition={position} focusPharmacy={selected} tileStyle={tileStyle} resetKey={mapReset} restoreView={restoreView} onViewportChange={trackViewport} onMarkerClick={openPharmacy} height="100%" className="map-stage__map" />}
      {loadError && <div className="mobile-data-error"><DataErrorState message={loadError} onRetry={fetchPharmacyData} /></div>}
      <div className="mobile-search"><SearchControls filters={filters} onChange={changeFilters} onReset={resetFilters} pharmacies={pharmacies} mobile />{filters.query.trim() && !selected && tab === 'map' && <div className="mobile-search-results"><strong>{visible.length} résultat{visible.length > 1 ? 's' : ''}</strong>{visible.slice(0, 5).map(pharmacy => <button key={pharmacy.id} onClick={() => openPharmacy(pharmacy)}>{pharmacy.name}<span>{pharmacy.neighborhood || pharmacy.borough || 'Brazzaville'}</span></button>)}{visible.length === 0 && <p>Aucune pharmacie trouvée.</p>}</div>}</div>
      <CityWeather />
      <div className={`map-tools${selected && sheetSize === 'peek' ? ' has-detail' : ''}${sheetOpen && (!selected || sheetSize === 'full') ? ' is-obscured' : ''}`}><a className="map-tools__emergency" href={EMERGENCY_CONTACT.href} onClick={() => trackEvent('emergency_call_started')} aria-label={`Appeler les urgences médicales au ${EMERGENCY_CONTACT.number}`} title={`${EMERGENCY_CONTACT.label} · ${EMERGENCY_CONTACT.number}`}><Siren size={21} /></a><button aria-label="Recentrer la carte" title="Recentrer la carte" onClick={() => { clearRoute(); setSelected(null); setRestoreView(null); setMapReset(value => value + 1) }}><RotateCcw size={21} /></button><button aria-label="Changer le fond de carte" title="Changer le fond de carte" onClick={() => setTileStyle(value => value === 'standard' ? 'humanitarian' : 'standard')}><Layers2 size={21} /></button></div>

      <div className={`mobile-sheet${selected ? ' is-detail' : ''}${selected && routeState.status !== 'idle' ? ' has-route-status' : ''}${sheetSize === 'full' ? ' is-full' : ''}${!sheetOpen ? ' is-hidden' : ''}`} style={sheetDragHeight !== null ? { height: `${sheetDragHeight}px`, transition: 'none' } : undefined}>
        <div className="mobile-sheet__handle-zone" onPointerDown={startSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={finishSheetDrag} onPointerCancel={cancelSheetDrag}><button className="mobile-sheet__handle" aria-label={sheetSize === 'full' ? 'Réduire la fiche' : 'Développer la fiche'} onClick={() => { if (dragMoved.current) { dragMoved.current = false; return } setSheetSize(value => value === 'peek' ? 'full' : 'peek') }} /></div>
        <div className="mobile-sheet__content">{selected ? selectedSheet : tab === 'saved' ? <div className="mobile-sheet__list"><div className="panel-heading"><div><h1>Mes pharmacies enregistrées</h1><p>{saved.length} pharmacie{saved.length > 1 ? 's' : ''} sur cet appareil</p></div><button className="icon-button" aria-label="Fermer les enregistrés" onClick={() => selectTab('map')}><X size={20} /></button></div>{saved.length === 0 && <EmptyState kind="saved" />}{saved.map(pharmacy => <PharmacyRow key={pharmacy.id} pharmacy={pharmacy} saved onOpen={() => openPharmacy(pharmacy)} onSave={() => toggleSaved(pharmacy.id)} onRoute={() => startRoute(pharmacy)} />)}</div> : <ContributeState onClose={() => selectTab('map')} />}</div>
      </div>
      <nav className="mobile-tabs" aria-label="Navigation principale">{tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => selectTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={22} fill={id === 'saved' && tab === id ? 'currentColor' : 'none'} /><span>{label}</span></button>)}</nav>
    </main>
  </div>
}
