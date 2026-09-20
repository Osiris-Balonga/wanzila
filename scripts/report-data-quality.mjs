import { readFile } from 'node:fs/promises'

const fileUrl = new URL('../public/data/on-duty-pharmacies.json', import.meta.url)
const pharmacies = JSON.parse(await readFile(fileUrl, 'utf8'))
const now = new Date()
const active = pharmacies.filter(pharmacy => pharmacy.duty_status === 'confirmed' && pharmacy.duty_periods.some(period => new Date(period.starts_at) <= now && now < new Date(period.ends_at)))
const verificationDates = pharmacies.flatMap(pharmacy => [pharmacy.place_verified_at, ...pharmacy.duty_periods.map(period => period.verified_at)]).filter(Boolean).map(value => new Date(value))

console.table({
  total: pharmacies.length,
  activeNow: active.length,
  withCoordinates: pharmacies.filter(pharmacy => Number.isFinite(pharmacy.latitude) && Number.isFinite(pharmacy.longitude)).length,
  withPhone: pharmacies.filter(pharmacy => pharmacy.phone).length,
  withPhoto: pharmacies.filter(pharmacy => pharmacy.photo_url).length,
  oldestVerification: verificationDates.length ? new Date(Math.min(...verificationDates)).toISOString() : null,
  newestVerification: verificationDates.length ? new Date(Math.max(...verificationDates)).toISOString() : null,
})
