import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinksSelect, mockKiScoresSelect } = vi.hoisted(() => ({
  mockLinksSelect: vi.fn(),
  mockKiScoresSelect: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn(() => ({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockLinksSelect().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockKiScoresSelect().then(resolve, reject),
            }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { GET } from './route'

function makeRequest(vakanzId: string) {
  return new NextRequest(`http://localhost/api/external/v1/vakanzen/${vakanzId}/kandidaten`, {
    headers: { 'x-api-key': 'test-key' },
  })
}

describe('GET /api/external/v1/vakanzen/[id]/kandidaten', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Kandidaten', async () => {
    mockLinksSelect.mockResolvedValue({ data: [], error: null })
    mockKiScoresSelect.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest('v1'), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.kandidaten).toHaveLength(0)
  })

  it('gibt Kandidaten mit Score und Tagesrate zurück', async () => {
    mockLinksSelect.mockResolvedValue({
      data: [{
        id: 'link-1', status: 'Gespielt',
        ressourcen: { id: 'r1', name: 'Max Muster', ek_tagesrate: 850, agenturen: { name: 'Agentur GmbH' } },
      }],
      error: null,
    })
    mockKiScoresSelect.mockResolvedValue({
      data: [{ ressource_id: 'r1', vakanz_id: 'v1', score: 87 }],
      error: null,
    })
    const res = await GET(makeRequest('v1'), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.kandidaten[0]).toMatchObject({
      link_id: 'link-1', status: 'Gespielt',
      name: 'Max Muster', agentur: 'Agentur GmbH',
      ek_tagesrate: 850, matching_score: 87,
    })
  })
})
