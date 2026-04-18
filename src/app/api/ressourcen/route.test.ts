import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourcenSelect,
  mockInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourcenSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockProfileSelect,
            }),
          }),
        }
      }
      if (table === 'ressourcen') {
        // Build a fluent builder whose terminal call resolves via mockRessourcenSelect
        const builder: Record<string, unknown> = {}
        const fluent = () => builder
        builder.select = vi.fn(fluent)
        builder.order = vi.fn(fluent)
        builder.limit = vi.fn(fluent)
        builder.neq = mockRessourcenSelect
        return {
          select: vi.fn(() => builder),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockInsert,
            }),
          }),
        }
      }
      return {}
    }),
  }),
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

// ── GET /api/ressourcen ────────────────────────────────────────────────────────

describe('GET /api/ressourcen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Nicht authentifiziert')
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

  it('gibt Ressourcen zurück ohne ek_tagesrate und notizen für Agentur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourcenSelect.mockResolvedValue({
      data: [mockRessourceRow],
      error: null,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ressourcen[0].ek_tagesrate).toBeUndefined()
    expect(json.ressourcen[0].notizen).toBeUndefined()
    expect(json.ressourcen[0].name).toBe('Max M.')
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
})

// ── POST /api/ressourcen ───────────────────────────────────────────────────────

describe('POST /api/ressourcen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await POST(makeRequest(validRessource))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Staffhub Manager (kein Anlegen)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null },
      error: null,
    })

    const res = await POST(makeRequest(validRessource))
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei fehlendem Pflichtfeld', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })

    const res = await POST(makeRequest({ name: '', skills: [], erfahrungslevel: 'Senior', verfuegbarkeit: 'Jetzt verfügbar' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validierungsfehler')
  })

  it('gibt 400 zurück wenn verfuegbar_ab fehlt bei Status "Verfügbar ab"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })

    const res = await POST(makeRequest({
      ...validRessource,
      verfuegbarkeit: 'Verfügbar ab',
      verfuegbar_ab: null,
    }))
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
})
