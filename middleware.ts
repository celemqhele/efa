import { NextResponse, type NextRequest } from 'next/server'

// Lightweight cookie check only — no @supabase/ssr in Edge Runtime.
// Actual auth + role verification happens inside each protected server component.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Supabase stores the session in cookies named like "sb-<ref>-auth-token"
  const hasSession = request.cookies.getAll().some((c) =>
    c.name.includes('-auth-token')
  )

  const isProtected = ['/profile', '/notifications'].some((p) =>
    pathname.startsWith(p)
  )
  const isAdmin = pathname.startsWith('/admin')

  if (!hasSession && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logos|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
