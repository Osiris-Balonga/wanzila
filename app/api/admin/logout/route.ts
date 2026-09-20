import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || (new URL(request.url).protocol.replace(':', ''))
  const origin = request.headers.get('origin') || (host ? `${protocol}://${host}` : request.url)
  const response = NextResponse.redirect(new URL('/admin/login', origin), 303)
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/admin', maxAge: 0 })
  return response
}
