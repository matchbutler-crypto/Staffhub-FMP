import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinks, mockScores } = vi.hoisted(() => ({
  mockLinks: vi.fn(),
  mockScores: vi.fn(),
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
                  mockLinks().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockScores().then(resolve, reject),
            })),
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

const params = Promise.resolve({ id: 'vakanz-uuid' })

describe('GET /demand/v1.0/vakanzen/{id}/vorschlaege', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Vorschläge', async () => {
    mockLinks.mockResolvedValue({ data: [], error: null })
    mockScores.mockResolvedValue({ data: [], error: null })
    const req = new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege).toHaveLength(0)
  })

  it('gibt Vorschläge mit Score zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{
        id: 'link-1', status: 'Gespielt',
        ressourcen: { id: 'r1', name: 'Anna', ek_tagesrate: 800, agenturen: { name: 'Agentur X' } },
      }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [{ ressource_id: 'r1', vakanz_id: 'vakanz-uuid', score: 87 }], error: null })
    const req = new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege[0].match_id).toBe('link-1')
    expect(json.vorschlaege[0].matching_score).toBe(87)
  })
})
