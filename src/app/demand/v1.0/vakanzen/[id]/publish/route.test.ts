import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockStatusSelect, mockUpdate } = vi.hoisted(() => ({
  mockStatusSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockStatusSelect }),
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

const params = Promise.resolve({ id: 'vakanz-uuid' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/publish', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /demand/v1.0/vakanzen/{id}/publish', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Body zurück', async () => {
    const res = await PATCH(makeRequest({ published: 'ja' }), { params })
    expect(res.status).toBe(400)
  })

  it('gibt 422 wenn Vakanz besetzt ist und published=true', async () => {
    mockStatusSelect.mockResolvedValue({ data: { status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest({ published: true }), { params })
    expect(res.status).toBe(422)
  })

  it('gibt 404 zurück wenn Vakanz beim Status-Abruf nicht gefunden', async () => {
    mockStatusSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest({ published: true }), { params })
    expect(res.status).toBe(404)
  })

  it('veröffentlicht Vakanz', async () => {
    mockStatusSelect.mockResolvedValue({ data: { status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid' }, error: null })
    const res = await PATCH(makeRequest({ published: true }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.published).toBe(true)
  })
})
