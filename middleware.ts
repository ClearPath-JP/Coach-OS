import { NextResponse, type NextRequest } from 'next/server'

// Universal auth safety-net: if a /coach or /admin page is requested with NO Supabase
// auth cookie at all, bounce to /login. Server components remain the authoritative check
// (this only catches the obviously-logged-out case; it never mutates cookies/session).
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth-token')
  )
  if (!hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // Only guard app pages; never match API, _next, static assets, or auth pages.
  matcher: ['/coach/:path*', '/admin/:path*'],
}
