import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE_PREFIX = 'sb-'
const SESSION_COOKIE_SUFFIX = '-auth-token'

function hasSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith(SESSION_COOKIE_PREFIX) && name.endsWith(SESSION_COOKIE_SUFFIX))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Local-only guard: no network calls here (Supabase auth validation happens
  // server-side in the protected layouts/pages). Presence of the session cookie
  // is enough to let the request through — pages re-validate with getUser().
  const isProtected = ['/profile', '/notifications'].some((p) => pathname.startsWith(p))
  const isAdmin = pathname.startsWith('/admin')
  const loggedIn = hasSession(request)

  if (!loggedIn && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (loggedIn && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/notifications/:path*',
    '/admin/:path*',
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
  ],
}