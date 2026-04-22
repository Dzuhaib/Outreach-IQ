import { NextRequest, NextResponse } from 'next/server'

// Paths that never require authentication
const PUBLIC = [
  '/login',
  '/api/auth/',
  '/api/track/',
  '/_next/',
  '/favicon.ico',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sid = request.cookies.get('sid')?.value

  // Skip auth check for public paths
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    // Redirect already-authenticated users away from /login
    if (pathname === '/login' && sid) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return
  }

  // No session cookie → send to login
  if (!sid) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
