import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourcenSelect,
  mockRessourcenInsert,
  mockInsert,
  mockAdminRessourcenInsert,
  mockAdminInsert,
  mockLinkCountSelect,
  mockLinkSelect,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourcenSelect: vi.fn(),
  mockRessourcenInsert: vi.fn(),
  mockInsert: vi.fn(),
  mockAdminRessourcenInsert: vi.fn(),
  mockAdminInsert: vi.fn(),
  mockLinkCountSelect: vi.fn(),
  mockLinkSelect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSelect }),
          }),
        }
      }
      if (table === 'ressourcen') {
        // Supports two terminal patterns:
        //   .select.order.limit.neq(...)         → awaitable (no vakanz_id)
        //   .select.order.limit.neq(...).eq(...) → awaitable (with vakanz_id + Agentur)
        const mkAwaitable = () => ({
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            mockRessourcenSelect().then(resolve, reject),
          eq: vi.fn(() => ({
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              mockRessourcenSelect().then(resolve, reject),
          })),
        })
        const builder: Record<string, () => unknown> = {
          select: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          neq: vi.fn(mkAwaitable),
          eq: vi.fn(mkAwaitable),
        }
        return {
          select: vi.fn(() => builder),
          insert: mockRessourcenInsert.mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockInsert }),
          }),
        }
      }
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn(() => ({
            // Direct await (no .eq) — used for the link-count parallel query
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              mockLinkCountSelect().then(resolve, reject),
            // .eq().then() — used for beauftragt query and vakanz-specific links query
            eq: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockLinkSelect().then(resolve, reject),
            })),
          })),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(resolve, reject),
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressourcen') {
        return {
          insert: mockAdminRessourcenInsert.mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockAdminInsert }),
          }),
        }
      }
      return {}
    }),
  })),
}))

import { GET, POST } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown, searchParams = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/ressourcen${searchParams ? '?' + searchParams : ''}`,
    {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }
  )
}

const validRessource = {
  name: 'Max M.',
  skills: ['React', 'TypeScript'],
  erfahrungslevel: 'Senior',
  verfuegbarkeit: 'Jetzt verfügbar',
  ek_tagesrate: 750,
}

const mockRessourceRow = {
  id: 'res-1',
  agentur_id: 'ag-1',
  name: 'Max M.',
  skills: ['React', 'TypeScript'],
  erfahrungslevel: 'Senior',
  verfuegbarkeit: 'Jetzt verfügbar',
  verfuegbar_ab: null,
  cv_pfad: null,
  ek_tagesrate: 750,
  notizen: 'Intern',
  created_at: '2026-04-18T00:00:00Z',
  updated_at: '2026-04-18T00:00:00Z',
  agenturen: { name: 'Agentur GmbH' },
}

// Ressource from a different agency (ag-2 vs profile ag-1)
const foreignRessourceRow = { ...mockRessourceRow, id: 'res-2', agentur_id: 'ag-2' }

// ── GET /api/ressourcen ────────────────────────────────────────────────────────

describe('GET /api/ressourcen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinkCountSelect.mockResolvedValue({ data: [], error: null })
    mockLinkSelect.mockResolvedValue({ data: [], error: null })
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Nicht authentifiziert')
  })

  it('gibt 403 zurück für deaktivierten Account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: false, agentur_id: 'ag-1' },
      error: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('versteckt ek_tagesrate/notizen für Agentur bei fremden Ressourcen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [foreignRessourceRow], // agentur_id: 'ag-2' ≠ 'ag-1'
      error: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].ek_tagesrate).toBeUndefined()
    expect(json.ressourcen[0].notizen).toBeUndefined()
    expect(json.ressourcen[0].name).toBe('Max M.')
  })

  it('zeigt ek_tagesrate/notizen für Agentur bei eigenen Ressourcen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [mockRessourceRow], // agentur_id: 'ag-1' === 'ag-1'
      error: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].ek_tagesrate).toBe(750)
    expect(json.ressourcen[0].notizen).toBe('Intern')
  })

  it('gibt ek_tagesrate und notizen zurück für Staffhub Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [mockRessourceRow],
      error: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].ek_tagesrate).toBe(750)
    expect(json.ressourcen[0].notizen).toBe('Intern')
  })

  it('gibt bereits_gespielt-Flag zurück bei vakanz_id Query-Parameter', async () => {
    const VAKANZ_UUID = '00000000-0000-0000-0000-000000000001'
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [mockRessourceRow], // res-1 is already submitted
      error: null,
    })
    mockLinkSelect.mockResolvedValue({
      data: [{ ressource_id: 'res-1' }], // res-1 already linked to this vacancy
      error: null,
    })
    const res = await GET(makeRequest(undefined, `vakanz_id=${VAKANZ_UUID}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].bereits_gespielt).toBe(true)
  })

  it('gibt bereits_gespielt=false für nicht eingereichte Ressource', async () => {
    const VAKANZ_UUID = '00000000-0000-0000-0000-000000000001'
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [mockRessourceRow], // res-1
      error: null,
    })
    mockLinkSelect.mockResolvedValue({
      data: [], // no links for this vacancy
      error: null,
    })
    const res = await GET(makeRequest(undefined, `vakanz_id=${VAKANZ_UUID}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].bereits_gespielt).toBe(false)
  })
})

// ── POST /api/ressourcen ───────────────────────────────────────────────────────

describe('POST /api/ressourcen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest(validRessource))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück für Staffhub Manager ohne agentur_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null },
      error: null,
    })
    const res = await POST(makeRequest(validRessource))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei fehlendem Pflichtfeld', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    const res = await POST(makeRequest({ name: '', skills: [], erfahrungslevel: 'Senior', verfuegbarkeit: 'Jetzt verfügbar' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Validierungsfehler')
  })

  it('gibt 400 zurück wenn verfuegbar_ab fehlt bei Status "Verfügbar ab"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    const res = await POST(makeRequest({ ...validRessource, verfuegbarkeit: 'Verfügbar ab', verfuegbar_ab: null }))
    expect(res.status).toBe(400)
  })

  it('legt Ressource erfolgreich für Agentur an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockInsert.mockResolvedValue({
      data: { id: 'new-res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', created_at: '2026-04-18T00:00:00Z' },
      error: null,
    })
    const res = await POST(makeRequest(validRessource))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ressource.id).toBe('new-res-1')
    expect(json.ressource.name).toBe('Max M.')
  })

  it('speichert Skills ohne case-insensitive Duplikate', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockInsert.mockResolvedValue({
      data: { id: 'new-res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', created_at: '2026-04-18T00:00:00Z' },
      error: null,
    })

    const res = await POST(makeRequest({
      ...validRessource,
      skills: ['Project Management', 'project management', 'React'],
    }))

    expect(res.status).toBe(201)
    expect(mockRessourcenInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: ['Project Management', 'React'],
      })
    )
  })

  it('legt Ressource für Staffhub Manager per Admin-Client an, damit RLS Agentur-Policies nicht blockieren', async () => {
    const AGENTUR_ID = '00000000-0000-0000-0000-000000000001'
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null },
      error: null,
    })
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    })
    mockAdminInsert.mockResolvedValue({
      data: { id: 'new-res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', created_at: '2026-04-18T00:00:00Z' },
      error: null,
    })

    const res = await POST(makeRequest({ ...validRessource, agentur_id: AGENTUR_ID }))

    expect(res.status).toBe(201)
    expect(mockRessourcenInsert).not.toHaveBeenCalled()
    expect(mockAdminRessourcenInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Max M.',
        agentur_id: AGENTUR_ID,
      })
    )
  })
})
