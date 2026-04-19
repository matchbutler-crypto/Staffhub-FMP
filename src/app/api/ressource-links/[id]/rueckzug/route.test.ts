import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockLinkSelect,
  mockLinkUpdate,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
  mockHistorieInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockLinkSelect }) }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockLinkUpdate }),
            }),
          }),
        }
      }
      if (table === 'ressource_historie') {
        return { insert: mockHistorieInsert }
      }
      return {}
    }),
  }),
}))

import { PATCH } from './route'

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ressource-links/link-1/rueckzug', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
  })
}

const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }

const gespieltLink = {
  id: 'link-1',
  ressource_id: 'res-1',
  status: 'Gespielt',
  ressourcen: { agentur_id: 'ag-1' },
  vakanzen_data: { rolle: 'Senior Java Dev' },
}

const updatedLink = {
  id: 'link-1',
  ressource_id: 'res-1',
  vakanz_id: 'vak-1',
  status: 'Zurückgezogen',
  grund_rueckzug: null,
  updated_at: '2026-04-19T00:00:00Z',
}

describe('PATCH /api/ressource-links/[id]/rueckzug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Staffhub Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Agenturen')
  })

  it('gibt 403 zurück für Agentur mit fremder Ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { ...agenturProfile, agentur_id: 'ag-2' }, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null }) // ressource belongs to ag-1
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Berechtigung')
  })

  it('gibt 404 zurück wenn Link nicht existiert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(404)
  })

  it('gibt 409 zurück wenn Status nicht "Gespielt"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { ...gespieltLink, status: 'Interview geplant' },
      error: null,
    })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('nicht möglich')
  })

  it('gibt 409 zurück für bereits zurückgezogenen Link', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { ...gespieltLink, status: 'Zurückgezogen' },
      error: null,
    })
    const res = await PATCH(makeRequest(), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(409)
  })

  it('zieht Einreichung erfolgreich zurück ohne Grund', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: updatedLink, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(makeRequest({}), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Zurückgezogen')
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
  })

  it('speichert optionalen Grund und schreibt ihn in die Historie', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { ...updatedLink, grund_rueckzug: 'Ressource nicht mehr verfügbar' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ grund: 'Ressource nicht mehr verfügbar' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.grund_rueckzug).toBe('Ressource nicht mehr verfügbar')

    const historieCall = mockHistorieInsert.mock.calls[0][0]
    expect(historieCall.text).toContain('Ressource nicht mehr verfügbar')
  })

  it('gibt 400 zurück wenn Grund zu lang ist (> 500 Zeichen)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const res = await PATCH(
      makeRequest({ grund: 'x'.repeat(501) }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(400)
  })
})
