import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfilesSelect = vi.hoisted(() => vi.fn())

function makeChainable(resolveFn: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'neq', 'order', 'limit', 'eq', 'overlaps', 'lte', 'gte']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    resolveFn().then(resolve, reject)
  return chain
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => makeChainable(mockProfilesSelect)),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

function makeRequest(search = '') {
  return new NextRequest(`http://localhost/supply/v1.0/profiles${search}`, {
    headers: { 'Authorization': 'Bearer test-key' },
  })
}

const sampleProfile = {
  id: 'r1',
  name: 'Anna M.',
  skills: ['Kubernetes', 'Docker'],
  erfahrungslevel: 'Senior',
  verfuegbar_ab: '2026-08-01',
  verfuegbarkeit: 'Vollzeit',
  arbeitsmodell: 'Remote',
  wohnort: 'Berlin',
  ek_tagesrate: 800,
}

describe('GET /supply/v1.0/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 bei fehlendem Key zurück', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('gibt Profile als data-Array mit nextCursor zurück', async () => {
    mockProfilesSelect.mockResolvedValue({
      data: [sampleProfile],
      error: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.nextCursor).toBeNull()
  })

  it('mappt DB-Felder auf Profil-Objekt-Schema', async () => {
    mockProfilesSelect.mockResolvedValue({ data: [sampleProfile], error: null })
    const res = await GET(makeRequest())
    const json = await res.json()
    const p = json.data[0]
    expect(p.profileId).toBe('r1')
    expect(p.displayName).toBe('Anna M.')
    expect(p.seniority).toBe('Senior')
    expect(p.skills).toEqual(['Kubernetes', 'Docker'])
    expect(p.availableFrom).toBe('2026-08-01')
    expect(p.location).toEqual({ mode: 'Remote', city: 'Berlin' })
    expect(p.rate).toEqual({ amount: 800, currency: 'EUR', per: 'DAY' })
  })

  it('setzt nextCursor wenn mehr Ergebnisse vorhanden', async () => {
    // limit default = 50, wir simulieren 51 Einträge
    const profiles = Array.from({ length: 51 }, (_, i) => ({
      ...sampleProfile,
      id: `r${i}`,
      name: `User ${String(i).padStart(3, '0')}`,
    }))
    mockProfilesSelect.mockResolvedValue({ data: profiles, error: null })
    const res = await GET(makeRequest('?limit=50'))
    const json = await res.json()
    expect(json.data).toHaveLength(50)
    expect(json.nextCursor).not.toBeNull()
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    mockProfilesSelect.mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
