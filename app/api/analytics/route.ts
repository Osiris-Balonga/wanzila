import { NextResponse } from 'next/server'

const ALLOWED_EVENTS = new Set(['search_performed', 'route_started', 'pharmacy_call_started', 'emergency_call_started'])

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    if (!payload || !ALLOWED_EVENTS.has(payload.event) || typeof payload.properties !== 'object') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    console.info(JSON.stringify({ type: 'wanzila_metric', event: payload.event, properties: payload.properties, recorded_at: new Date().toISOString() }))
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
