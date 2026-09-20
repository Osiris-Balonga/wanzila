import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, authenticateAdmin, signAdminSession } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || (new URL(request.url).protocol.replace(':', ''))
  const origin = request.headers.get('origin') || (host ? `${protocol}://${host}` : request.url)
  const formData = await request.formData()
  const email = String(formData.get('email') ?? '').slice(0, 254)
  const password = String(formData.get('password') ?? '').slice(0, 200)
  const admin = await authenticateAdmin(email, password)
  if (!admin) return NextResponse.redirect(new URL('/admin/login?error=credentials', origin), 303)

  const response = NextResponse.redirect(new URL('/admin', origin), 303)
  response.cookies.set(ADMIN_SESSION_COOKIE, signAdminSession(admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })
  return response
}
