import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockLinks = vi.fn()
const mockScores = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockLinks().then(resolve, reject),
              }),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockScores().then(resolve, reject),
            }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

function makeReq() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1/vorschlaege', {
    headers: { 'x-api-key': 'test' },
  })
}

describe('GET /api/external/v1/vakanzen/[id]/vorschlaege', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Vorschläge', async () => {
    mockLinks.mockResolvedValue({ data: [], error: null })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege).toHaveLength(0)
  })

  it('gibt Vorschläge mit Matching-Score zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{
        id: 'link1',
        status: 'Offen',
        ressourcen: { id: 'r1', name: 'Max Muster', ek_tagesrate: 800, agenturen: { name: 'TechGmbH' } },
      }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [{ ressource_id: 'r1', vakanz_id: 'v1', score: 0.92 }], error: null })
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege[0].matching_score).toBe(0.92)
  })
})
