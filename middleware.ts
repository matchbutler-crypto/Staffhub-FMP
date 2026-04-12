import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

// Routes each role is allowed to access (prefix match)
const ROLE_ROUTES: Record<string, string[]> = {
  'Admin': ['/dashboard', '/vakanzen', '/profile', '/agenturen', '/abrechnung', '/admin', '/meine-profile'],
  'Staffhub Manager': ['/dashboard', '/vakanzen', '/profile', '/agenturen', '/abrechnung'],
  'Agentur': ['/dashboard', '/vakanzen', '/meine-profile'],
}

function isAllowedRoute(pathname: string, rolle: string): boolean {
  const allowed = ROLE_ROUTES[rolle] ?? []
  return allowed.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — important: do NOT remove this
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Public routes ───────────────────────���────────────────────────────────
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (user) {
      // Already logged in → send to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Protected routes ───────────────────────────────��─────────────────────

  // No session → redirect to login with return URL
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    const redirectTo = pathname + request.nextUrl.search
    if (isSafeRedirect(redirectTo)) {
      loginUrl.searchParams.set('redirectTo', redirectTo)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Fetch profile for role + active check
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  // No profile record → sign out + error
  if (!profile) {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'no_profile')
    return NextResponse.redirect(loginUrl)
  }

  // Deactivated account → sign out + error
  if (!profile.aktiv) {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'deactivated')
    return NextResponse.redirect(loginUrl)
  }

  // RBAC: role not allowed for this route → dashboard with unauthorized flag
  if (!isAllowedRoute(pathname, profile.rolle)) {
    const dashboardUrl = new URL('/dashboard', request.url)
    dashboardUrl.searchParams.set('unauthorized', '1')
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
