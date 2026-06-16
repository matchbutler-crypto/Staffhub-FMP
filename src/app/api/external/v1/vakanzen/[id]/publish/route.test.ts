// src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen_data') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSelect }),
          }),
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
  validateExternalApiKey: vi.fn(() => null),
}))

import { PATCH } from './route'

function makeRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/external/v1/vakanzen/${id}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/external/v1/vakanzen/[id]/publish', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Body zurück', async () => {
    const res = await PATCH(makeRequest('v1', { published: 'ja' }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(400)
  })

  it('gibt 422 wenn besetzte Vakanz veröffentlicht werden soll', async () => {
    mockSelect.mockResolvedValue({ data: { status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest('v1', { published: true }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(422)
  })

  it('veröffentlicht Vakanz', async () => {
    mockSelect.mockResolvedValue({ data: { status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'v1' }, error: null })
    const res = await PATCH(makeRequest('v1', { published: true }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.published).toBe(true)
  })

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: { status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest('v1', { published: false }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(404)
  })
})
