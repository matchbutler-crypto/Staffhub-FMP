import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSelect }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockUpdate }),
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

import { GET, PATCH } from './route'

const params = Promise.resolve({ id: 'vakanz-uuid' })

function makeRequest(method = 'GET', body?: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid', {
    method,
    headers: { 'x-api-key': 'test-key', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /demand/v1.0/vakanzen/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('gibt Vakanz zurück', async () => {
    mockSelect.mockResolvedValue({ data: { id: 'vakanz-uuid', rolle: 'Dev' }, error: null })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.id).toBe('vakanz-uuid')
  })
})

describe('PATCH /demand/v1.0/vakanzen/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei leerem Body zurück', async () => {
    const res = await PATCH(makeRequest('PATCH', {}), { params })
    expect(res.status).toBe(400)
  })

  it('aktualisiert Vakanz', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid', status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest('PATCH', { status: 'Besetzt' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Besetzt')
  })
})
