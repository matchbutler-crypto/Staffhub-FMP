import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock (vi.hoisted wegen Hoist-Reihenfolge) ────────────────────────

const { mockGetUser, mockProfileSelect, mockVakanzenSelect, mockInsert } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockVakanzenSelect: vi.fn(),
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
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockVakanzenSelect,
            }),
          }),
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

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/vakanzen', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const validVakanz = {
  titel: 'Senior React Developer',
  rolle: 'Frontend Engineer',
  beschreibung: 'React-Experte für unser Team',
  skills: ['React', 'TypeScript'],
  erfahrungslevel: 'Senior',
  startdatum: '2026-05-01',
  laufzeit: '6 Monate',
  auslastung: 100,
  arbeitsmodell: 'Remote',
}

// ── GET Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Nicht authentifiziert')
  })

  it('gibt Vakanzen zurück ohne budget_intern für Agentur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true },
      error: null,
    })
    mockVakanzenSelect.mockResolvedValue({
      data: [
        {
          id: 'vakanz-1',
          titel: 'React Developer',
          rolle: 'Frontend',
          beschreibung: 'Test',
          skills: ['React'],
          erfahrungslevel: 'Senior',
          startdatum: '2026-05-01',
          laufzeit: '3 Monate',
          auslastung: 100,
          arbeitsmodell: 'Remote',
          status: 'Offen',
          standort: null,
          budget_intern: 800,
          created_at: '2026-04-12T00:00:00Z',
          kandidaten_profile: [{ count: 3 }],
        },
      ],
      error: null,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanzen[0].budget_intern).toBeUndefined()
    expect(json.vakanzen[0].profile_anzahl).toBe(3)
  })

  it('gibt budget_intern zurück für Staffhub Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true },
      error: null,
    })
    mockVakanzenSelect.mockResolvedValue({
      data: [
        {
          id: 'vakanz-1',
          titel: 'React Developer',
          rolle: 'Frontend',
          beschreibung: 'Test',
          skills: ['React'],
          erfahrungslevel: 'Senior',
          startdatum: '2026-05-01',
          laufzeit: '3 Monate',
          auslastung: 100,
          arbeitsmodell: 'Remote',
          status: 'Offen',
          standort: null,
          budget_intern: 800,
          created_at: '2026-04-12T00:00:00Z',
          kandidaten_profile: [{ count: 0 }],
        },
      ],
      error: null,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanzen[0].budget_intern).toBe(800)
  })
})

// ── POST Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await POST(makeRequest(validVakanz))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true },
      error: null,
    })

    const res = await POST(makeRequest(validVakanz))
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei ungültigen Daten', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true },
      error: null,
    })

    const res = await POST(makeRequest({ titel: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validierungsfehler')
  })

  it('erstellt Vakanz erfolgreich für Staffhub Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true },
      error: null,
    })
    mockInsert.mockResolvedValue({
      data: { id: 'new-id', titel: validVakanz.titel, status: 'Offen', created_at: '2026-04-12T00:00:00Z' },
      error: null,
    })

    const res = await POST(makeRequest(validVakanz))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.vakanz.id).toBe('new-id')
    expect(json.vakanz.status).toBe('Offen')
  })
})
