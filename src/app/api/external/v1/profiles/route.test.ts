import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfiles = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockProfiles().then(resolve, reject),
            }),
          }),
        }),
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockProfiles().then(resolve, reject),
            }),
          }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

describe('GET /api/external/v1/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt Profile zurück', async () => {
    mockProfiles.mockResolvedValue({
      data: [{ id: 'r1', name: 'Max Muster', skills: ['React'], erfahrungslevel: 'Senior' }],
      error: null,
    })
    const req = new NextRequest('http://localhost/api/external/v1/profiles', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profiles).toHaveLength(1)
  })
})
