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

describe('GET /supply/v1.0/profiles/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 wenn Profil nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('gibt Profil zurück', async () => {
    mockSelect.mockResolvedValue({ data: { id: 'r1', name: 'Anna' }, error: null })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profile.id).toBe('r1')
  })
})
