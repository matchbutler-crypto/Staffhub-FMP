import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFetch, mockUpdate } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockFetch }),
        }),
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

const params = Promise.resolve({ id: 'vakanz-uuid', matchId: 'match-uuid' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege/match-uuid', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /demand/v1.0/vakanzen/{id}/vorschlaege/{matchId}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(makeRequest({ status: 'Interessiert' }), { params })
    expect(res.status).toBe(400)
  })

  it('gibt 404 wenn Vorschlag nicht gefunden', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest({ status: 'Zugesagt' }), { params })
    expect(res.status).toBe(404)
  })

  it('setzt Status auf Zugesagt', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Gespielt' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Zugesagt', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'Zugesagt' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlag.status).toBe('Zugesagt')
  })
})
