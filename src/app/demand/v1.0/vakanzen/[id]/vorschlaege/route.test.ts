import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinks, mockScores } = vi.hoisted(() => ({
  mockLinks:  vi.fn(),
  mockScores: vi.fn(),
}))

function makeLinksChain(resolveFn: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'gte']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    resolveFn().then(resolve, reject)
  return chain
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') return makeLinksChain(mockLinks)
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockScores().then(resolve, reject),
            })),
          })),
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

function makeRequest(search = '') {
  return new NextRequest(`http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege${search}`, {
    headers: { 'Authorization': 'Bearer test-key' },
  })
}

const baseRessource = {
  id: 'r1',
  name: 'Anna M.',
  erfahrungslevel: 'Senior',
  verfuegbar_ab: '2026-08-01',
  verfuegbarkeit: 'Vollzeit',
  arbeitsmodell: 'Remote',
  wohnort: 'Berlin',
  ek_tagesrate: 800,
  email_geschaeftlich: 'anna@example.com',
  telefon_geschaeftlich: '+49123456',
  agenturen: { id: 'ag-1', name: 'Agentur X' },
}

describe('GET /demand/v1.0/vakanzen/{id}/vorschlaege', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere data-Liste zurück wenn keine Vorschläge', async () => {
    mockLinks.mockResolvedValue({ data: [], error: null })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(0)
  })

  it('gibt Vorschläge mit camelCase-Feldern zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{ id: 'link-1', status: 'Vorgeschlagen', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-10T00:00:00Z', ressourcen: baseRessource }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [{ ressource_id: 'r1', score: 0.87 }], error: null })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    const v = json.data[0]
    expect(v.matchId).toBe('link-1')
    expect(v.matchScore).toBe(0.87)
    expect(v.submittedAt).toBe('2026-06-01T00:00:00Z')
    expect(v.updatedAt).toBe('2026-06-10T00:00:00Z')
  })

  it('mappt internen Status auf englisches Enum', async () => {
    mockScores.mockResolvedValue({ data: [], error: null })

    const statusCases: [string, string][] = [
      ['Vorgeschlagen', 'NEW'],
      ['Shortlist',     'SHORTLISTED'],
      ['Zugesagt',      'ACCEPTED'],
      ['Abgelehnt',     'REJECTED'],
      ['Zurückgezogen', 'WITHDRAWN'],
    ]

    for (const [intern, extern] of statusCases) {
      mockLinks.mockResolvedValue({
        data: [{ id: 'l', status: intern, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ressourcen: baseRessource }],
        error: null,
      })
      const res = await GET(makeRequest(), { params })
      const json = await res.json()
      expect(json.data[0].status).toBe(extern)
    }
  })

  it('gibt partner-Objekt mit id und name zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{ id: 'l', status: 'Vorgeschlagen', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ressourcen: baseRessource }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest(), { params })
    const json = await res.json()
    expect(json.data[0].partner).toEqual({ id: 'ag-1', name: 'Agentur X' })
  })

  it('maskiert contact solange Status nicht ACCEPTED', async () => {
    mockLinks.mockResolvedValue({
      data: [{ id: 'l', status: 'Vorgeschlagen', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ressourcen: baseRessource }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest(), { params })
    const json = await res.json()
    expect(json.data[0].profile.contact).toBeNull()
  })

  it('gibt contact frei wenn Status Zugesagt (ACCEPTED)', async () => {
    mockLinks.mockResolvedValue({
      data: [{ id: 'l', status: 'Zugesagt', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ressourcen: baseRessource }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest(), { params })
    const json = await res.json()
    expect(json.data[0].profile.contact).toEqual({
      email: 'anna@example.com',
      phone: '+49123456',
    })
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    mockLinks.mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(500)
  })
})
