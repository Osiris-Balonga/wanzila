export type AnalyticsEvent =
  | 'data_snapshot_loaded'
  | 'search_performed'
  | 'pharmacy_viewed'
  | 'route_started'
  | 'route_ready'
  | 'route_failed'
  | 'pharmacy_call_started'
  | 'pharmacy_save_changed'
  | 'emergency_call_started'

type AnalyticsProperties = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: { track: (event: string, properties?: AnalyticsProperties) => void }
  }
}

export function createAnalyticsId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function trackEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (typeof window === 'undefined') return
  try { window.umami?.track(event, properties) } catch { /* Analytics must never interrupt the product flow. */ }
  const body = JSON.stringify({ event, properties })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
}
