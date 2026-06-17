import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockFetch }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { PATCH } from './route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1/vorschlaege/m1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: JSON.stringify(body),
  })
}
const makeParams = () => ({ params: Promise.resolve({ id: 'v1', matchId: 'm1' }) })

describe('PATCH /vakanzen/[id]/vorschlaege/[matchId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(makeReq({ status: 'Ungültig' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Match nicht gefunden', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeReq({ status: 'Zugesagt' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('aktualisiert Status und gibt Vorschlag zurück', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'm1', status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({
      data: { id: 'm1', status: 'Zugesagt', updated_at: '2026-06-17T10:00:00Z' },
      error: null,
    })
    const res = await PATCH(makeReq({ status: 'Zugesagt' }), makeParams())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlag.status).toBe('Zugesagt')
  })
})
