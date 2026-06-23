import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockLinkSelect,
  mockLinkUpdate,
  mockHistorieInsert,
  mockRessourceSelect,
  mockVakanzSelect,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
  mockHistorieInsert: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockVakanzSelect: vi.fn(),
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
          select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === 'exact') {
              // FTE count query: .select('*', { count, head }).eq().eq() — return count result
              const secondEq = vi.fn().mockResolvedValue({ count: 0, error: null })
              return { eq: vi.fn().mockReturnValue({ eq: secondEq }) }
            }
            return { eq: vi.fn().mockReturnValue({ single: mockLinkSelect }) }
          }),
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
      if (table === 'ressourcen') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockRessourceSelect }) }),
        }
      }
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockVakanzSelect }),
            count: 'exact',
            head: true,
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileUpdated: vi.fn().mockResolvedValue(undefined),
}))

import { PATCH } from './route'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

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
})

// ── Task 5: Beauftragt Webhook ─────────────────────────────────────────────────

const managerProfileWebhook = { rolle: 'Staffhub Manager', aktiv: true }
const interviewLink = {
  id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Interview geplant',
  vakanzen: { rolle: 'Senior Dev', enddatum: '2027-01-31' },
}

describe('PATCH /api/ressource-links/[id]/status — Beauftragt Webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feuert sendProfileUpdated mit BOOKED wenn auf Beauftragt gesetzt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfileWebhook, error: null })
    mockLinkSelect.mockResolvedValue({ data: interviewLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Beauftragt', interview_datum: null, feedback: null, updated_at: '2026-06-23T00:00:00Z' }, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r-1', name: 'Anna Beispiel', email_geschaeftlich: 'anna@test.de', telefon_geschaeftlich: null }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    mockVakanzSelect.mockResolvedValue({ data: { status: 'Offen', fte_anzahl: 1 }, error: null })

    await PATCH(makeRequest({ status: 'Beauftragt' }), { params: Promise.resolve({ id: 'lnk-1' }) })

    expect(sendProfileUpdated).toHaveBeenCalledWith(
      'vak-1',
      expect.objectContaining({ id: 'r-1', name: 'Anna Beispiel' }),
      'BOOKED'
    )
  })

  it('feuert keinen Webhook bei anderem Status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfileWebhook, error: null })
    mockLinkSelect.mockResolvedValue({ data: { ...interviewLink, status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Interview geplant', interview_datum: '2026-07-01', feedback: null, updated_at: '2026-06-23T00:00:00Z' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    await PATCH(makeRequest({ status: 'Interview geplant', interview_datum: '2026-07-01' }), { params: Promise.resolve({ id: 'lnk-1' }) })

    expect(sendProfileUpdated).not.toHaveBeenCalled()
  })
})
