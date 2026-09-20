'use client'

import { RefreshCw, TriangleAlert } from 'lucide-react'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-white px-6 text-center">
    <div className="flex max-w-sm flex-col items-center">
      <span className="mb-5 grid size-20 place-items-center rounded-full bg-rose-50 text-rose-600"><TriangleAlert size={34} aria-hidden="true" /></span>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-950">Impossible d’afficher la page</h1>
      <p className="mb-6 text-sm leading-6 text-slate-600">Une erreur est survenue. Vérifiez votre connexion puis réessayez.</p>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-700 active:scale-95" onClick={reset}><RefreshCw size={16} /> Réessayer</button>
    </div>
  </main>
}
