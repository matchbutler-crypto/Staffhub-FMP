/** Routes each role is permitted to access (prefix match) */
export const ROLE_ROUTES: Record<string, string[]> = {
  Admin: [
    '/dashboard',
    '/vakanzen',
    '/profile',
    '/agenturen',
    '/beauftragungen',
    '/abrechnung',
    '/admin',
    '/meine-profile',
    '/slack-log',
    '/ressourcen',
    '/api',
  ],
  'Staffhub Manager': [
    '/dashboard',
    '/vakanzen',
    '/profile',
    '/agenturen',
    '/beauftragungen',
    '/abrechnung',
    '/slack-log',
    '/ressourcen',
    '/api',
  ],
  Agentur: ['/dashboard', '/vakanzen', '/meine-profile', '/pool', '/api'],
}

/** Returns true if the given pathname is accessible for the given role */
export function isAllowedRoute(pathname: string, rolle: string): boolean {
  const allowed = ROLE_ROUTES[rolle] ?? []
  return allowed.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

/** Returns true if the url is a safe relative redirect (prevents Open Redirect) */
export function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}
