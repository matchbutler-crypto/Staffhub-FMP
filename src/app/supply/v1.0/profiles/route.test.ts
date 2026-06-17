import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfilesSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockProfilesSelect().then(resolve, reject),
            })),
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
import { validateExternalApiKey } from '@/lib/external-api-auth'

describe('GET /supply/v1.0/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 bei fehlendem Key zurück', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const req = new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { 'x-api-key': 'bad-key' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('gibt Profile-Liste zurück', async () => {
    mockProfilesSelect.mockResolvedValue({
      data: [{ id: 'r1', name: 'Anna', skills: ['React'], verfuegbarkeit: 'Jetzt verfügbar' }],
      error: null,
    })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profiles).toHaveLength(1)
    expect(json.profiles[0].id).toBe('r1')
  })
})
