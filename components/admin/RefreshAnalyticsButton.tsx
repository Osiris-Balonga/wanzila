'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'

export function RefreshAnalyticsButton() {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  return <button
    className="admin-refresh"
    type="button"
    disabled={refreshing}
    aria-label="Actualiser les données analytiques"
    onClick={() => startTransition(() => router.refresh())}
  >
    <RefreshCw size={16} aria-hidden="true" />
    <span>{refreshing ? 'Actualisation…' : 'Actualiser'}</span>
  </button>
}
