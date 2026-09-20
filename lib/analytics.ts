export type AnalyticsEvent = 'search_performed' | 'route_started' | 'pharmacy_call_started' | 'emergency_call_started'

export function trackEvent(event: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify({ event, properties })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
}
