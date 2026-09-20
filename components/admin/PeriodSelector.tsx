'use client'

import { CalendarDays } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function PeriodSelector({ value }: { value: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return <label className="admin-period"><CalendarDays size={17} /><select value={value} aria-label="Période analysée" onChange={event => { const params = new URLSearchParams(searchParams.toString()); params.set('period', event.target.value); router.replace(`${pathname}?${params.toString()}`) }}><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option></select></label>
}
