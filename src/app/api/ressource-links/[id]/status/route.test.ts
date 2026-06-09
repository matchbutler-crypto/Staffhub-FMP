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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ressource-links/link-1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true }
const agenturProfile = { rolle: 'Agentur', aktiv: true }
const gespieltLink = {
  id: 'link-1',
  ressource_id: 'res-1',
  status: 'Gespielt',
  vakanzen_data: { rolle: 'Senior Java Dev' },
}

describe('PATCH /api/ressource-links/[id]/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(makeRequest({ status: 'Interview geplant', interview_datum: '2026-05-01' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const res = await PATCH(makeRequest({ status: 'Interview geplant', interview_datum: '2026-05-01' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück wenn interview_datum fehlt bei "Interview geplant"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const res = await PATCH(makeRequest({ status: 'Interview geplant' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validierungsfehler')
  })

  it('gibt 400 zurück bei ungültigem Rückschritt (Gespielt → Gespielt)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null })
    const res = await PATCH(makeRequest({ status: 'Gespielt' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Ungültiger Status-Übergang')
  })

  it('gibt 400 zurück bei terminalem Status (Zugesagt → Interview geplant)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { ...gespieltLink, status: 'Zugesagt' },
      error: null,
    })
    const res = await PATCH(makeRequest({ status: 'Interview geplant', interview_datum: '2026-05-01' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(400)
  })

  it('schaltet Status erfolgreich weiter und schreibt Historien-Eintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Interview geplant', interview_datum: '2026-05-01', updated_at: '2026-04-18T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ status: 'Interview geplant', interview_datum: '2026-05-01' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Interview geplant')
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
  })

  it('schaltet auf Abgelehnt aus Gespielt-Status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: gespieltLink, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { ...gespieltLink, status: 'Abgelehnt', interview_datum: null, updated_at: '2026-04-18T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(makeRequest({ status: 'Abgelehnt' }), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Abgelehnt')
  })

  it('schaltet Zugesagt → Stammdaten anfordern erfolgreich', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Zugesagt', vakanzen: null },
      error: null,
    })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Stammdaten anfordern', interview_datum: null, feedback: null, updated_at: '2026-05-28T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ status: 'Stammdaten anfordern' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Stammdaten anfordern')
  })

  it('gibt 400 zurück bei Rückschritt Stammdaten anfordern → Zugesagt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Stammdaten anfordern', vakanzen: null },
      error: null,
    })

    const res = await PATCH(
      makeRequest({ status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Ungültiger Status-Übergang')
  })

  it('schaltet Setup externe Mail & Hardware → Running erfolgreich', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Setup externe Mail & Hardware', vakanzen: null },
      error: null,
    })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Running', interview_datum: null, feedback: null, updated_at: '2026-05-28T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ status: 'Running' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Running')
  })
})
