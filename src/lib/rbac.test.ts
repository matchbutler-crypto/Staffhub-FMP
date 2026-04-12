import { describe, it, expect } from 'vitest'
import { isAllowedRoute, isSafeRedirect, ROLE_ROUTES } from './rbac'

describe('isAllowedRoute', () => {
  // ── Admin ────────────────────────────────────────────────────────────────
  describe('Admin', () => {
    it('allows /dashboard', () => {
      expect(isAllowedRoute('/dashboard', 'Admin')).toBe(true)
    })
    it('allows /admin', () => {
      expect(isAllowedRoute('/admin', 'Admin')).toBe(true)
    })
    it('allows /meine-profile', () => {
      expect(isAllowedRoute('/meine-profile', 'Admin')).toBe(true)
    })
    it('allows all defined routes', () => {
      ROLE_ROUTES['Admin'].forEach((route) => {
        expect(isAllowedRoute(route, 'Admin')).toBe(true)
      })
    })
    it('allows sub-paths (e.g. /dashboard/detail)', () => {
      expect(isAllowedRoute('/dashboard/detail', 'Admin')).toBe(true)
    })
  })

  // ── Staffhub Manager ─────────────────────────────────────────────────────
  describe('Staffhub Manager', () => {
    it('allows /dashboard', () => {
      expect(isAllowedRoute('/dashboard', 'Staffhub Manager')).toBe(true)
    })
    it('allows /profile', () => {
      expect(isAllowedRoute('/profile', 'Staffhub Manager')).toBe(true)
    })
    it('allows /agenturen', () => {
      expect(isAllowedRoute('/agenturen', 'Staffhub Manager')).toBe(true)
    })
    it('allows /abrechnung', () => {
      expect(isAllowedRoute('/abrechnung', 'Staffhub Manager')).toBe(true)
    })
    it('blocks /admin', () => {
      expect(isAllowedRoute('/admin', 'Staffhub Manager')).toBe(false)
    })
    it('blocks /meine-profile', () => {
      expect(isAllowedRoute('/meine-profile', 'Staffhub Manager')).toBe(false)
    })
  })

  // ── Agentur ───────────────────────────────────────────────────────────────
  describe('Agentur', () => {
    it('allows /dashboard', () => {
      expect(isAllowedRoute('/dashboard', 'Agentur')).toBe(true)
    })
    it('allows /vakanzen', () => {
      expect(isAllowedRoute('/vakanzen', 'Agentur')).toBe(true)
    })
    it('allows /meine-profile', () => {
      expect(isAllowedRoute('/meine-profile', 'Agentur')).toBe(true)
    })
    it('blocks /profile', () => {
      expect(isAllowedRoute('/profile', 'Agentur')).toBe(false)
    })
    it('blocks /agenturen', () => {
      expect(isAllowedRoute('/agenturen', 'Agentur')).toBe(false)
    })
    it('blocks /abrechnung', () => {
      expect(isAllowedRoute('/abrechnung', 'Agentur')).toBe(false)
    })
    it('blocks /admin', () => {
      expect(isAllowedRoute('/admin', 'Agentur')).toBe(false)
    })
  })

  // ── Edge Cases ────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('returns false for unknown role', () => {
      expect(isAllowedRoute('/dashboard', 'UnknownRole')).toBe(false)
    })
    it('returns false for empty role string', () => {
      expect(isAllowedRoute('/dashboard', '')).toBe(false)
    })
    it('does not allow partial prefix match (e.g. /dashboardExtra)', () => {
      // /dashboardExtra does NOT start with /dashboard/
      expect(isAllowedRoute('/dashboardExtra', 'Agentur')).toBe(false)
    })
    it('allows exact route match', () => {
      expect(isAllowedRoute('/vakanzen', 'Agentur')).toBe(true)
    })
    it('allows nested sub-path', () => {
      expect(isAllowedRoute('/vakanzen/123/details', 'Agentur')).toBe(true)
    })
  })
})

describe('isSafeRedirect', () => {
  it('allows a simple relative path', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true)
  })
  it('allows a path with query params', () => {
    expect(isSafeRedirect('/vakanzen?status=Offen')).toBe(true)
  })
  it('blocks protocol-relative URLs (Open Redirect)', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false)
  })
  it('blocks absolute URLs with http', () => {
    expect(isSafeRedirect('http://evil.com')).toBe(false)
  })
  it('blocks absolute URLs with https', () => {
    expect(isSafeRedirect('https://evil.com/steal')).toBe(false)
  })
  it('blocks empty string', () => {
    expect(isSafeRedirect('')).toBe(false)
  })
  it('blocks javascript: protocol', () => {
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false)
  })
})
