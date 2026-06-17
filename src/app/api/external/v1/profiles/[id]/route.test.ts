import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSingle = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

describe('GET /api/external/v1/profiles/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Profil nicht gefunden', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest('http://localhost/api/external/v1/profiles/r1', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(404)
  })

  it('gibt Profil-Details zurück', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'r1', name: 'Max Muster', skills: ['React', 'TypeScript'] },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/external/v1/profiles/r1', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profile.id).toBe('r1')
  })
})
