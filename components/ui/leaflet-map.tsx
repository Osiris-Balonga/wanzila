'use client'

import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_CONFIG } from '@/lib/constants'
import { getAvailability, hasCoordinates, isOnDuty } from '@/lib/pharmacies'
import type { MapProps } from './map'

const marker = (pharmacy: MapProps['pharmacies'][number], selected: boolean) => L.divIcon({
  html: '<span class="map-pin__body"><span class="map-pin__cross" aria-hidden="true">+</span></span>',
  className: `wanzila-pin${selected ? ' is-selected' : ''}${pharmacy.duty_status === 'confirmed' ? ' is-on-duty' : ''}${getAvailability(pharmacy) === 'closed' ? ' is-closed' : ''}`,
  iconSize: [28, 34], iconAnchor: [14, 33],
})
const userIcon = L.divIcon({
  className: 'wanzila-user-location',
  html: '<span class="wanzila-user-location__pulse"></span><span class="wanzila-user-location__dot"></span>',
  iconSize: [44, 44], iconAnchor: [22, 22],
})

function MapCamera({ route, pharmacies, resetKey, restoreView, layoutKey }: Pick<MapProps, 'route' | 'pharmacies' | 'resetKey' | 'restoreView' | 'layoutKey'>) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize({ pan: false, animate: false })
    const timer = window.setTimeout(() => map.invalidateSize({ pan: false, animate: false }), 240)
    return () => window.clearTimeout(timer)
  }, [map, layoutKey])
  useEffect(() => {
    if (restoreView) {
      map.flyTo(restoreView.center, restoreView.zoom, { duration: 0.35 })
    } else if (route?.coordinates && route.coordinates.length > 1) {
      const mobile = map.getSize().x < 720
      map.fitBounds(L.latLngBounds(route.coordinates), mobile
        ? { paddingTopLeft: [30, 125], paddingBottomRight: [30, 130], maxZoom: 15 }
        : { padding: [56, 56], maxZoom: 16 })
    } else {
      const points = pharmacies.filter(hasCoordinates)
      if (map.getSize().x < 720 && points.length > 5) map.setView([-4.263, 15.268], 13, { animate: false })
      else if (points.length) map.fitBounds(L.latLngBounds(points.map(p => [p.latitude, p.longitude])), { padding: [48, 48], maxZoom: 14 })
    }
  }, [map, route, pharmacies, resetKey, restoreView])
  return null
}

function ViewportReporter({ onViewportChange }: Pick<MapProps, 'onViewportChange'>) {
  const map = useMapEvents({ moveend: () => { const center = map.getCenter(); onViewportChange?.({ center: [center.lat, center.lng], zoom: map.getZoom() }) } })
  return null
}

function PharmacyMapPreview({ pharmacy }: { pharmacy: MapProps['pharmacies'][number] }) {
  const availability = getAvailability(pharmacy)
  const status = isOnDuty(pharmacy)
    ? 'Ouverte · de garde aujourd’hui'
    : availability === 'open' ? 'Ouverte maintenant' : availability === 'closed' ? 'Fermée' : null
  return <div className="map-preview-card">
    <div className="map-preview-card__media">
      {pharmacy.photo_url ? <img src={pharmacy.photo_url} alt="" onError={event => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling?.classList.add('is-visible') }} /> : null}
      <span className={`map-preview-card__placeholder${pharmacy.photo_url ? '' : ' is-visible'}`} aria-hidden="true"><b>+</b></span>
    </div>
    <div className="map-preview-card__body">
      <strong>{pharmacy.name}</strong>
      <span>{pharmacy.neighborhood || pharmacy.borough || 'Brazzaville'}</span>
      {status ? <small className={availability === 'closed' ? 'is-closed' : 'is-open'}>{status}</small> : null}
    </div>
  </div>
}

export function LeafletMap({ pharmacies, route, userPosition, height = '100%', className = '', onMarkerClick, focusPharmacy, tileStyle = 'clean', layoutKey, resetKey, restoreView, onViewportChange }: MapProps) {
  return <div className={`${className} leaflet-map-shell`} style={{ height }}>
    <MapContainer center={MAP_CONFIG.defaultCenter} zoom={MAP_CONFIG.defaultZoom} className="h-full w-full" zoomControl={false} attributionControl={false}>
      {tileStyle === 'clean' ? <>
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={20}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={20}
        />
      </> : <TileLayer
        attribution={tileStyle === 'satellite' ? 'Imagery &copy; Google Maps' : 'Map data &copy; Google Maps'}
        url={`https://{s}.google.com/vt/lyrs=${tileStyle === 'satellite' ? 's' : 'm'}&x={x}&y={y}&z={z}`}
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        maxZoom={20}
      />}
      <MapCamera pharmacies={pharmacies} route={route} resetKey={resetKey} restoreView={restoreView} layoutKey={layoutKey} />
      <ViewportReporter onViewportChange={onViewportChange} />
      {pharmacies.filter(hasCoordinates).map(pharmacy => <Marker
        key={pharmacy.id}
        position={[pharmacy.latitude, pharmacy.longitude]}
        icon={marker(pharmacy, pharmacy.id === focusPharmacy?.id)}
        eventHandlers={{ click: () => onMarkerClick?.(pharmacy) }}
      ><Tooltip className="map-preview-tooltip" direction="top" offset={[0, -25]} opacity={1}><PharmacyMapPreview pharmacy={pharmacy} /></Tooltip></Marker>)}
      {userPosition && <Marker position={userPosition} icon={userIcon} title="Votre position" />}
      {route && <Polyline positions={route.coordinates} pathOptions={{ color: '#6537e9', weight: 6, opacity: 0.9 }} />}
    </MapContainer>
    <div className="map-attribution" aria-label="Attribution cartographique">
      {tileStyle === 'clean'
        ? <a href="https://www.esri.com/" target="_blank" rel="noreferrer">© Esri</a>
        : <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">© Google Maps</a>}
    </div>
  </div>
}
