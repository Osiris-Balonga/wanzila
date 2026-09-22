'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { getAvailability, isOnDuty } from '@/lib/pharmacies'
import type { Pharmacy } from '@/types/database'

export function PharmacyArtwork({ pharmacy, className }: { pharmacy: Pharmacy; className: string }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => setPhotoFailed(false), [pharmacy.photo_url])
  const hasPhoto = Boolean(pharmacy.photo_url) && !photoFailed
  return <span className={`${className}${hasPhoto ? '' : ' has-no-photo'}`}>
    {hasPhoto
      ? <img src={pharmacy.photo_url!} alt={`Façade de ${pharmacy.name}`} loading={className === 'pharmacy-visual' ? 'eager' : 'lazy'} onError={() => setPhotoFailed(true)} />
      : <span className="pharmacy-artwork__placeholder" aria-label={`Aucune photo disponible pour ${pharmacy.name}`}><ImageOff aria-hidden="true" /><small>Aucune photo</small></span>}
  </span>
}

export function AvailabilityBadge({ pharmacy }: { pharmacy: Pharmacy }) {
  if (isOnDuty(pharmacy)) return <span className="status-badges"><span className="availability-badge availability-badge--duty">Ouverte · de garde aujourd’hui</span></span>
  const availability = getAvailability(pharmacy)
  const label = availability === 'open' ? 'Ouverte selon les horaires publiés' : availability === 'closed' ? 'Fermée selon les horaires publiés' : 'Horaires inconnus'
  return <span className="status-badges">
    <span className={`availability-badge availability-badge--${availability}`}>{label}</span>
  </span>
}
