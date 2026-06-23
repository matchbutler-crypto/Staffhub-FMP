import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

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

  it('mapped status:closed auf Geschlossen', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid', status: 'Geschlossen' }, error: null })
    const res = await PATCH(makeRequest('PATCH', { status: 'closed' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Geschlossen')
  })

  it('aktualisiert Vakanz mit role (MagentaOS-Alias)', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid', rolle: 'Senior Dev' }, error: null })
    const res = await PATCH(makeRequest('PATCH', { role: 'Senior Dev' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.rolle).toBe('Senior Dev')
  })

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest('PATCH', { status: 'Offen' }), { params })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /demand/v1.0/vakanzen/{id} — Dual-Permission', () => {
  // Für diese Tests brauchen wir permission-spezifische Mocks
  // Der bestehende validateExternalApiKey-Mock returnt immer null.
  // Wir überschreiben ihn per mockImplementation in einzelnen Tests.

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid', rolle: 'Dev', status: 'Offen', updated_at: '2026-06-23T00:00:00Z' }, error: null })
  })

  it('akzeptiert demand:write wenn vakanzen:update fehlt', async () => {
    const { validateExternalApiKey } = await import('@/lib/external-api-auth')
    vi.mocked(validateExternalApiKey).mockImplementation(async (_req, permission) => {
      if (permission === 'demand:write') return null
      return NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 })
    })
    const res = await PATCH(makeRequest('PATCH', { role: 'Dev' }), { params })
    expect(res.status).toBe(200)
  })

  it('akzeptiert vakanzen:update wenn demand:write fehlt', async () => {
    const { validateExternalApiKey } = await import('@/lib/external-api-auth')
    vi.mocked(validateExternalApiKey).mockImplementation(async (_req, permission) => {
      if (permission === 'vakanzen:update') return null
      return NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 })
    })
    const res = await PATCH(makeRequest('PATCH', { skills: ['TypeScript'] }), { params })
    expect(res.status).toBe(200)
  })

  it('gibt 403 zurück wenn beide Permissions fehlen', async () => {
    const { validateExternalApiKey } = await import('@/lib/external-api-auth')
    vi.mocked(validateExternalApiKey).mockResolvedValue(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    )
    const res = await PATCH(makeRequest('PATCH', { status: 'Offen' }), { params })
    expect(res.status).toBe(403)
  })
})
