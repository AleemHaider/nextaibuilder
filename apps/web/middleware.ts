// Phase 3 — Edge auth middleware
//
// How session detection works:
//   The Fastify API sets `nab_refresh` with `path: '/api/auth'`, which browsers
//   only send to /api/auth/* requests — not page requests. So middleware can't
//   read it directly. Instead, store/auth.ts writes a lightweight `nab_s=1`
//   cookie (path='/', no secrets) when any login or token refresh succeeds, and
//   clears it on logout. Middleware uses `nab_s` as the gate.
//
//   False-positive risk: nab_s may still exist after nab_refresh expires
//   (30-day max-age). In that case middleware lets the user through, useInitAuth()
//   fails the refresh call, clears nab_s, and client-side auth-guard redirects.
//   This resolves within the first paint, so it is an acceptable trade-off.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Require nab_s cookie (authenticated)
const STUDENT_PREFIXES = ['/dashboard', '/student']
const ADMIN_PREFIXES   = ['/admin']

// Redirect to dashboard/admin if nab_s present (guest-only pages)
const STUDENT_GUEST_PATHS = ['/login', '/signup']
const ADMIN_GUEST_PATHS   = ['/admin/login']

// Public pages that must be reachable WITHOUT a session and must NOT be
// redirected either way — they carry their own one-time token in the URL and
// are the entry points for users who are, by definition, not logged in yet
// (email-invite activation, password set/reset). Without this, the protected
// -route rules below bounced logged-out invitees/admins to a login they can't
// complete, dropping the token in the process.
const PUBLIC_PATHS = [
  '/student/accept-invite',
  '/student/set-password',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/set-password',
]

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// sdk.nextaibuilder.com — physical course landing page + admission form.
// Served from the same Next.js app: requests whose Host starts with "sdk."
// are rewritten to /sdk/* internally so the URL bar keeps showing the
// subdomain. Matches "sdk.localhost:3000" too, for local testing.
const SDK_SUBDOMAIN_HOST_PREFIX = 'sdk.'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // /api and /socket.io must skip the rewrite: in dev they're handled by the
  // next.config.ts rewrite to the local Fastify server, which only runs
  // *after* middleware — rewriting them to /sdk/api/* here would 404 them.
  // In prod they never reach Next.js at all (nginx proxies straight to
  // Fastify), so this only matters for local subdomain testing.
  const isApiPath = pathname.startsWith('/api') || pathname.startsWith('/socket.io')

  // Crawler convention files must be served from the exact domain root —
  // rewriting /robots.txt to /sdk/robots.txt 404s it, since no such route
  // exists. The matcher's image-extension exclusion below doesn't cover
  // these (.txt/.xml), so they need their own check.
  const isCrawlerFile = pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/llms.txt'

  // The admin dashboard (including /admin/admissions, where sdk applications
  // are reviewed) is only deployed on this app — there's no separate admin
  // subdomain. Rewriting it into /sdk/admin/* 404s it, since that route
  // doesn't exist under the landing page. Let it resolve to the real /admin/*
  // route tree instead.
  const isAdminPath = pathname.startsWith('/admin')

  if (host.startsWith(SDK_SUBDOMAIN_HOST_PREFIX) && !isApiPath && !isCrawlerFile && !isAdminPath && !pathname.startsWith('/sdk')) {
    const url = request.nextUrl.clone()
    url.pathname = `/sdk${pathname}`
    return NextResponse.rewrite(url)
  }

  const hasSession = Boolean(request.cookies.get('nab_s')?.value)

  // ── Public token-bearing pages (invite / password set/reset) ───────────────
  // Checked first so they're never redirected regardless of session state.
  if (matchesAny(pathname, PUBLIC_PATHS)) {
    return NextResponse.next()
  }

  // ── Admin guest pages (/admin/login) ───────────────────────────────────────
  if (matchesAny(pathname, ADMIN_GUEST_PATHS)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  // ── Student guest pages (/login, /register, etc.) ─────────────────────────
  if (matchesAny(pathname, STUDENT_GUEST_PATHS)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ── Admin protected routes ─────────────────────────────────────────────────
  if (matchesAny(pathname, ADMIN_PREFIXES)) {
    if (!hasSession) {
      const url = new URL('/admin/login', request.url)
      if (pathname !== '/admin/login') url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── Student protected routes ───────────────────────────────────────────────
  if (matchesAny(pathname, STUDENT_PREFIXES)) {
    if (!hasSession) {
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
