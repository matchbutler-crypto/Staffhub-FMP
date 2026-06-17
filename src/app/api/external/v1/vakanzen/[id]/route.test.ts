import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSingle = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
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

import { GET, PATCH } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeGetReq() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1', {
    headers: { 'x-api-key': 'test' },
  })
}

function makePatchReq(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/external/v1/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await GET(makeGetReq(), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('gibt Vakanz-Details zurück', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'v1', rolle: 'Dev', status: 'Offen' },
      error: null,
    })
    const res = await GET(makeGetReq(), makeParams('v1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.id).toBe('v1')
  })
})

describe('PATCH /api/external/v1/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei leerem Body zurück', async () => {
    const res = await PATCH(makePatchReq({}), makeParams('v1'))
    expect(res.status).toBe(400)
  })

  it('aktualisiert Status und gibt Vakanz zurück', async () => {
    mockUpdate.mockResolvedValue({
      data: { id: 'v1', status: 'Besetzt' },
      error: null,
    })
    const res = await PATCH(makePatchReq({ status: 'Besetzt' }), makeParams('v1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Besetzt')
  })
})
