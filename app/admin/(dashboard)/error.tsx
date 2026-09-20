'use client'

import Image from 'next/image'
import { RefreshCw } from 'lucide-react'

export default function AdminDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="admin-page admin-dashboard-error">
      <Image src="/brand-app-icon.png" width={82} height={82} alt="" />
      <h1>Impossible de charger le tableau de bord</h1>
      <p>Les informations n’ont pas pu être récupérées. Vérifiez votre connexion puis réessayez.</p>
      <button type="button" onClick={reset}><RefreshCw size={17} /> Réessayer</button>
    </div>
  )
}
