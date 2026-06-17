import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSelect }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

const params = Promise.resolve({ id: 'r1' })

const sampleData = {
  id: 'r1',
  name: 'Anna M.',
  skills: ['Kubernetes'],
  erfahrungslevel: 'Senior',
  verfuegbar_ab: '2026-08-01',
  verfuegbarkeit: 'Vollzeit',
  arbeitsmodell: 'Remote',
  wohnort: 'Berlin',
  ek_tagesrate: 800,
}

describe('GET /supply/v1.0/profiles/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 wenn Profil nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'Authorization': 'Bearer test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('gibt Profil im einheitlichen Schema zurück', async () => {
    mockSelect.mockResolvedValue({ data: sampleData, error: null })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'Authorization': 'Bearer test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    const p = json.profile
    expect(p.profileId).toBe('r1')
    expect(p.displayName).toBe('Anna M.')
    expect(p.seniority).toBe('Senior')
    expect(p.skills).toEqual(['Kubernetes'])
    expect(p.availableFrom).toBe('2026-08-01')
    expect(p.location).toEqual({ mode: 'Remote', city: 'Berlin' })
    expect(p.rate).toEqual({ amount: 800, currency: 'EUR', per: 'DAY' })
  })
})
