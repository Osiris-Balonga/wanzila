import 'server-only'

import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Pharmacy } from '@/types/database'

type AnalyticsSource = 'umami' | 'demo'

export interface TrendPoint {
  label: string
  searches: number
  views: number
  routes: number
}

export interface AdminAnalytics {
  source: AnalyticsSource
  sourceDetail: string
  periodDays: number
  generatedAt: string
  totals: { searches: number; views: number; routeStarted: number; routeReady: number; calls: number; saves: number }
  previous: { searches: number; views: number; routeStarted: number; routeReady: number }
  trend: TrendPoint[]
  devices: { name: string; value: number }[]
}

export interface DataQuality {
  total: number
  confirmedDuty: number
  positioned: number
  phones: number
  freshnessLabel: string
}

const EVENT_NAMES = {
  searches: 'search_performed',
  views: 'pharmacy_viewed',
  routeStarted: 'route_started',
  routeReady: 'route_ready',
  calls: 'pharmacy_call_started',
  saves: 'pharmacy_save_changed',
} as const

const DEMO_7 = {
  totals: { searches: 248, views: 186, routeStarted: 159, routeReady: 146, calls: 42, saves: 28 },
  previous: { searches: 210, views: 165, routeStarted: 139, routeReady: 127 },
  trend: [
    { label: 'Lun', searches: 30, views: 21, routes: 18 },
    { label: 'Mar', searches: 45, views: 32, routes: 29 },
    { label: 'Mer', searches: 61, views: 45, routes: 40 },
    { label: 'Jeu', searches: 55, views: 42, routes: 38 },
    { label: 'Ven', searches: 82, views: 66, routes: 61 },
    { label: 'Sam', searches: 72, views: 57, routes: 51 },
    { label: 'Dim', searches: 66, views: 51, routes: 45 },
  ],
}

const DEMO_30 = {
  totals: { searches: 1284, views: 602, routeStarted: 179, routeReady: 165, calls: 412, saves: 298 },
  previous: { searches: 1146, views: 557, routeStarted: 149, routeReady: 143 },
  trend: [
    { label: '1 avr.', searches: 62, views: 31, routes: 14 },
    { label: '4 avr.', searches: 101, views: 59, routes: 25 },
    { label: '7 avr.', searches: 88, views: 57, routes: 23 },
    { label: '10 avr.', searches: 126, views: 72, routes: 34 },
    { label: '13 avr.', searches: 114, views: 68, routes: 31 },
    { label: '16 avr.', searches: 156, views: 91, routes: 45 },
    { label: '19 avr.', searches: 137, views: 79, routes: 39 },
    { label: '22 avr.', searches: 181, views: 119, routes: 64 },
    { label: '25 avr.', searches: 159, views: 101, routes: 48 },
    { label: '28 avr.', searches: 211, views: 114, routes: 69 },
    { label: '30 avr.', searches: 181, views: 100, routes: 50 },
  ],
}

function demoData(periodDays: number): AdminAnalytics {
  const fixture = periodDays <= 7 ? DEMO_7 : DEMO_30
  return {
    source: 'demo',
    sourceDetail: 'Les identifiants de lecture Umami ne sont pas encore configurés.',
    periodDays,
    generatedAt: new Date().toISOString(),
    ...fixture,
    devices: [
      { name: 'Mobile', value: 78 },
      { name: 'Ordinateur', value: 19 },
      { name: 'Tablette', value: 3 },
    ],
  }
}

function unavailableData(periodDays: number, detail: string): AdminAnalytics {
  return {
    source: 'demo',
    sourceDetail: detail,
    periodDays,
    generatedAt: new Date().toISOString(),
    totals: { searches: 0, views: 0, routeStarted: 0, routeReady: 0, calls: 0, saves: 0 },
    previous: { searches: 0, views: 0, routeStarted: 0, routeReady: 0 },
    trend: [],
    devices: [],
  }
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export { percentageChange }

type UmamiMetric = { x: string; y: number }
type UmamiSeriesPoint = { x?: string; t?: string; y: number }

function dateRange(periodDays: number, offsetDays = 0) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  end.setDate(end.getDate() - offsetDays)
  const start = new Date(end)
  start.setDate(end.getDate() - periodDays + 1)
  start.setHours(0, 0, 0, 0)
  return { startAt: start.getTime(), endAt: end.getTime() }
}

async function umamiFetch<T>(path: string, params: Record<string, string | number>) {
  const apiKey = process.env.UMAMI_API_KEY
  if (!apiKey) throw new Error('Missing UMAMI_API_KEY')
  const baseUrl = process.env.UMAMI_API_BASE_URL || 'https://api.umami.is/v1'
  const url = new URL(`${baseUrl.replace(/\/$/, '')}${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 },
  })
  if (!response.ok) throw new Error(`Umami request failed with ${response.status}`)
  return response.json() as Promise<T>
}

function totalsFromMetrics(metrics: UmamiMetric[]) {
  const counts = new Map(metrics.map(metric => [metric.x, Number(metric.y) || 0]))
  return {
    searches: counts.get(EVENT_NAMES.searches) ?? 0,
    views: counts.get(EVENT_NAMES.views) ?? 0,
    routeStarted: counts.get(EVENT_NAMES.routeStarted) ?? 0,
    routeReady: counts.get(EVENT_NAMES.routeReady) ?? 0,
    calls: counts.get(EVENT_NAMES.calls) ?? 0,
    saves: counts.get(EVENT_NAMES.saves) ?? 0,
  }
}

function buildTrend(series: UmamiSeriesPoint[], periodDays: number): TrendPoint[] {
  const relevant = new Set<string>([EVENT_NAMES.searches, EVENT_NAMES.views, EVENT_NAMES.routeStarted])
  const buckets = new Map<string, TrendPoint>()
  for (const point of series) {
    const eventName = point.x ?? ''
    if (!relevant.has(eventName)) continue
    const date = new Date(point.t ?? '')
    if (Number.isNaN(date.getTime())) continue
    const key = date.toISOString().slice(0, 10)
    const item = buckets.get(key) ?? {
      label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
      searches: 0,
      views: 0,
      routes: 0,
    }
    if (eventName === EVENT_NAMES.searches) item.searches += point.y
    if (eventName === EVENT_NAMES.views) item.views += point.y
    if (eventName === EVENT_NAMES.routeStarted) item.routes += point.y
    buckets.set(key, item)
  }
  const values = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
  const maxPoints = periodDays <= 7 ? 7 : 11
  if (values.length <= maxPoints) return values
  return values.filter((_, index) => index % Math.ceil(values.length / maxPoints) === 0).slice(0, maxPoints)
}

export async function getAdminAnalytics(periodDays = 30): Promise<AdminAnalytics> {
  const websiteId = process.env.UMAMI_WEBSITE_ID || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || 'f94a028b-83b4-4f9b-b922-c6924617cce2'
  if (!process.env.UMAMI_API_KEY) {
    return process.env.NODE_ENV === 'production'
      ? unavailableData(periodDays, 'La clé de lecture Umami n’est pas configurée.')
      : demoData(periodDays)
  }
  try {
    const current = dateRange(periodDays)
    const previous = dateRange(periodDays, periodDays)
    const [metrics, previousMetrics, series, devices] = await Promise.all([
      umamiFetch<UmamiMetric[]>(`/websites/${websiteId}/metrics`, { ...current, type: 'event' }),
      umamiFetch<UmamiMetric[]>(`/websites/${websiteId}/metrics`, { ...previous, type: 'event' }),
      umamiFetch<UmamiSeriesPoint[]>(`/websites/${websiteId}/events/series`, current),
      umamiFetch<UmamiMetric[]>(`/websites/${websiteId}/metrics`, { ...current, type: 'device' }),
    ])
    const totals = totalsFromMetrics(metrics)
    const trend = buildTrend(series, periodDays)
    const deviceTotal = devices.reduce((sum, item) => sum + item.y, 0)
    return {
      source: 'umami',
      sourceDetail: 'Les chiffres proviennent de votre projet Umami Cloud.',
      periodDays,
      generatedAt: new Date().toISOString(),
      totals,
      previous: totalsFromMetrics(previousMetrics),
      trend,
      devices: devices.slice(0, 3).map(item => ({ name: item.x || 'Inconnu', value: deviceTotal ? Math.round(item.y / deviceTotal * 100) : 0 })),
    }
  } catch (error) {
    console.error('Unable to load Umami analytics:', error)
    return process.env.NODE_ENV === 'production'
      ? unavailableData(periodDays, 'Umami est momentanément indisponible.')
      : { ...demoData(periodDays), sourceDetail: 'Umami est momentanément indisponible. Les données locales servent uniquement au développement.' }
  }
}

export async function getDataQuality(): Promise<DataQuality> {
  const databasePath = join(process.cwd(), 'db.json')
  const [raw, fileStats] = await Promise.all([readFile(databasePath, 'utf8'), stat(databasePath)])
  const database = JSON.parse(raw) as { pharmacies?: Pharmacy[] }
  const pharmacies = database.pharmacies ?? []
  const ageHours = Math.max(0, Math.round((Date.now() - fileStats.mtimeMs) / 3_600_000))
  const freshnessLabel = ageHours < 1 ? 'À l’instant' : ageHours < 24 ? `Il y a ${ageHours} h` : `Il y a ${Math.round(ageHours / 24)} j`
  return {
    total: pharmacies.length,
    confirmedDuty: pharmacies.filter(item => item.duty_status === 'confirmed').length,
    positioned: pharmacies.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).length,
    phones: pharmacies.filter(item => Boolean(item.phone)).length,
    freshnessLabel,
  }
}
