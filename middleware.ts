import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/data/admin_users')) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new NextResponse('Lecture seule', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  return NextResponse.next()
}

export const config = { matcher: '/data/:path*' }
