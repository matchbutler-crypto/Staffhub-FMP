import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFetch, mockUpdate } = vi.hoisted(() => ({
  mockFetch:  vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ single: mockFetch })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ single: mockUpdate })),
          })),
        })),
      })),
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
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /demand/v1.0/vakanzen/{id}/vorschlaege/{matchId}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(makeRequest({ status: 'Zugesagt' }), { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('gibt 400 bei altem deutschem Status zurück', async () => {
    const res = await PATCH(makeRequest({ status: 'Abgelehnt' }), { params })
    expect(res.status).toBe(400)
  })

  it('gibt 404 wenn Vorschlag nicht gefunden', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest({ status: 'ACCEPTED' }), { params })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('setzt Status auf ACCEPTED', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Vorgeschlagen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Zugesagt', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'ACCEPTED' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ACCEPTED')
    expect(json.matchId).toBe('match-uuid')
    expect(json.updatedAt).toBe('2026-06-17T10:00:00Z')
  })

  it('setzt Status auf REJECTED', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Vorgeschlagen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Abgelehnt', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'REJECTED' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('REJECTED')
  })

  it('setzt Status auf SHORTLISTED', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Vorgeschlagen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Shortlist', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'SHORTLISTED' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('SHORTLISTED')
  })

  it('akzeptiert optionales note-Feld', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Vorgeschlagen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Abgelehnt', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'REJECTED', note: 'Passt leider nicht' }), { params })
    expect(res.status).toBe(200)
  })
})
