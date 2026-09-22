import type { DutyPeriod, Pharmacy, SearchFilters } from '@/types/database'

export async function loadPharmacies(): Promise<Pharmacy[]> {
  const [baseResponse, dutyResponse] = await Promise.all([
    fetch('/data/pharmacies', { cache: 'no-store' }),
    fetch('/data/on-duty-pharmacies.json', { cache: 'no-store' }),
  ])
  if (!baseResponse.ok || !dutyResponse.ok) throw new Error('Impossible de charger les pharmacies. Réessayez plus tard.')
  const [base, duty]: unknown[] = await Promise.all([baseResponse.json(), dutyResponse.json()])
  if (!Array.isArray(base) || !Array.isArray(duty)) throw new Error('Les données des pharmacies sont invalides.')
  const byId = new Map((base as Pharmacy[]).map(pharmacy => [pharmacy.id, pharmacy]))
  for (const pharmacy of duty as Pharmacy[]) byId.set(pharmacy.id, { ...byId.get(pharmacy.id), ...pharmacy })
  return [...byId.values()]
}

export function getActiveDutyPeriod(pharmacy: Pharmacy, at = new Date()): DutyPeriod | undefined {
  if (pharmacy.duty_status !== 'confirmed') return undefined
  return pharmacy.duty_periods.find(period => new Date(period.starts_at) <= at && at < new Date(period.ends_at))
}

export function isOnDuty(pharmacy: Pharmacy, at = new Date()): boolean {
  return Boolean(getActiveDutyPeriod(pharmacy, at))
}

export function getAvailability(pharmacy: Pharmacy, at = new Date()): 'open' | 'closed' | 'unknown' {
  if (isOnDuty(pharmacy, at)) return 'open'
  const hours = pharmacy.opening_hours
  if (!hours) return 'unknown'
  const current = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Brazzaville', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  const toMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
  const now = toMinutes(current)
  const start = toMinutes(hours.daily_start)
  const end = toMinutes(hours.daily_end)
  if (![now, start, end].every(Number.isFinite)) return 'unknown'
  return start < end ? (now >= start && now < end ? 'open' : 'closed') : (now >= start || now < end ? 'open' : 'closed')
}

export function filterPharmacies(pharmacies: Pharmacy[], filters: SearchFilters): Pharmacy[] {
  const normalize = (value: string) => value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const query = normalize(filters.query.trim())
  return pharmacies.filter(pharmacy => {
    const matchesQuery = !query || [pharmacy.name, pharmacy.full_address, pharmacy.city, pharmacy.neighborhood, pharmacy.borough]
      .some(value => value && normalize(value).includes(query))
    const matchesCategory = filters.category === 'all' || pharmacy.category === filters.category
    return matchesQuery && matchesCategory
      && (!filters.duty || filters.duty === 'all' || isOnDuty(pharmacy))
      && (!filters.availability || filters.availability === 'all' || getAvailability(pharmacy) === filters.availability)
      && (!filters.neighborhood || pharmacy.neighborhood === filters.neighborhood)
      && (!filters.borough || pharmacy.borough === filters.borough)
  })
}

export function hasCoordinates(pharmacy: Pharmacy): pharmacy is Pharmacy & { latitude: number; longitude: number } {
  return typeof pharmacy.latitude === 'number' && Number.isFinite(pharmacy.latitude)
    && typeof pharmacy.longitude === 'number' && Number.isFinite(pharmacy.longitude)
}
