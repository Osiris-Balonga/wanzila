import { NextResponse } from 'next/server'

const ALLOWED_EVENTS = new Set([
  'data_snapshot_loaded',
  'search_performed',
  'pharmacy_viewed',
  'route_started',
  'route_ready',
  'route_failed',
  'pharmacy_call_started',
  'pharmacy_save_changed',
  'emergency_call_started',
])

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    if (!payload || !ALLOWED_EVENTS.has(payload.event) || !payload.properties || typeof payload.properties !== 'object' || Array.isArray(payload.properties)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const properties = Object.fromEntries(Object.entries(payload.properties)
      .filter(([key, value]) => key.length <= 50 && ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 30))
    console.info(JSON.stringify({ type: 'wanzila_metric', event: payload.event, properties, recorded_at: new Date().toISOString() }))
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
