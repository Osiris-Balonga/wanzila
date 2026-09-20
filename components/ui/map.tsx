'use client'

import dynamic from 'next/dynamic'
import { MapSkeleton } from '@/components/wanzila/LoadingStates'
import type { Pharmacy } from '@/types/database'
import type { RouteInfo } from '@/types/route'

export interface MapProps {
  pharmacies: Pharmacy[]
  route?: RouteInfo | null
  userPosition?: [number, number] | null
  height?: string
  className?: string
  onMarkerClick?: (pharmacy: Pharmacy) => void
  focusPharmacy?: Pharmacy | null
  tileStyle?: 'clean' | 'roadmap' | 'satellite'
  layoutKey?: string | number | boolean
  resetKey?: number
  restoreView?: { center: [number, number]; zoom: number; key: number } | null
  onViewportChange?: (view: { center: [number, number]; zoom: number }) => void
}

export const Map = dynamic<MapProps>(() => import('./leaflet-map').then(module => module.LeafletMap), {
  ssr: false,
  loading: () => <MapSkeleton className="h-full min-h-[320px]" />,
})
