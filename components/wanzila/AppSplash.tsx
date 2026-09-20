'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export function AppSplash() {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'hidden'>('visible')

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setPhase('leaving'), 520)
    const hideTimer = window.setTimeout(() => setPhase('hidden'), 800)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return <div className={`app-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="Ouverture de Wanzila">
    <div className="app-splash__brand">
      <Image src="/brand-app-icon.png" width={72} height={72} alt="" priority />
      <strong>Wanzila</strong>
    </div>
  </div>
}
