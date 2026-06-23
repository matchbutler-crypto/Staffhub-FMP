import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourceSelect,
  mockBeauftragungSelect,
  mockVakanzSelect,
  mockLinkInsert,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockBeauftragungSelect: vi.fn(),
  mockVakanzSelect: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockHistorieInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      if (table === 'ressourcen') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockRessourceSelect }) }) }
      }
      if (table === 'beauftragungen') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(mockBeauftragungSelect()) }) }
      }
      if (table === 'vakanzen_data') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockVakanzSelect }) }) }
      }
      if (table === 'ressource_vakanz_links') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockLinkInsert }),
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

import { POST } from './route'

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1/spielen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  })
}

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const VAKANZ_UUID = '00000000-0000-0000-0000-000000000001'
const aktiveRessource = { id: 'res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', agentur_id: 'ag-1' }
const deaktivierteRessource = { id: 'res-1', name: 'Max M.', verfuegbarkeit: 'Deaktiviert', agentur_id: 'ag-1' }
const offeneVakanz = { id: VAKANZ_UUID, rolle: 'Senior Java Dev', status: 'Offen' }
const geschlosseneVakanz = { id: VAKANZ_UUID, rolle: 'Senior Java Dev', status: 'Geschlossen' }

describe('POST /api/ressourcen/[id]/spielen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User mit fremder Ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { ...agenturProfile, agentur_id: 'ag-2' }, error: null })
    mockRessourceSelect.mockResolvedValue({ data: aktiveRessource, error: null }) // agentur_id: 'ag-1'
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Berechtigung')
  })

  it('legt Verknüpfung für Agentur mit eigener Ressource an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null }) // agentur_id: 'ag-1'
    mockRessourceSelect.mockResolvedValue({ data: { ...aktiveRessource, status: 'verfügbar' }, error: null }) // agentur_id: 'ag-1'
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null }) // No active beauftragungen
    mockVakanzSelect.mockResolvedValue({ data: offeneVakanz, error: null })
    mockLinkInsert.mockResolvedValue({
      data: { id: 'link-2', ressource_id: 'res-1', vakanz_id: VAKANZ_UUID, status: 'Gespielt', created_at: '2026-04-19T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.link.status).toBe('Gespielt')
  })

  it('gibt 400 zurück bei fehlender vakanz_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validierungsfehler')
  })

  it('gibt 400 zurück wenn Ressource deaktiviert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: deaktivierteRessource, error: null })
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Deaktivierte')
  })

  it('gibt 403 zurück wenn Ressource nicht verfügbar ist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { ...aktiveRessource, status: 'nicht_verfügbar' }, error: null })
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('nicht verfügbar')
  })

  it('gibt 400 zurück wenn Vakanz geschlossen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { ...aktiveRessource, status: 'verfügbar' }, error: null })
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null }) // No active beauftragungen
    mockVakanzSelect.mockResolvedValue({ data: geschlosseneVakanz, error: null })
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('offene Vakanzen')
  })

  it('gibt 409 zurück bei Duplikat-Verknüpfung', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { ...aktiveRessource, status: 'verfügbar' }, error: null })
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null }) // No active beauftragungen
    mockVakanzSelect.mockResolvedValue({ data: offeneVakanz, error: null })
    mockLinkInsert.mockResolvedValue({ data: null, error: { code: '23505' } })
    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('bereits auf diese Vakanz gespielt')
  })

  it('legt Verknüpfung erfolgreich an und schreibt Historien-Eintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { ...aktiveRessource, status: 'verfügbar' }, error: null })
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null }) // No active beauftragungen
    mockVakanzSelect.mockResolvedValue({ data: offeneVakanz, error: null })
    mockLinkInsert.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: VAKANZ_UUID, status: 'Gespielt', created_at: '2026-04-18T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.link.status).toBe('Gespielt')
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
  })
})

// ── Webhook-Mock ───────────────────────────────────────────────────────────────
vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileProposed: vi.fn().mockResolvedValue(undefined),
}))

import { sendProfileProposed } from '@/lib/magenta-webhook'

describe('POST /api/ressourcen/[id]/spielen — Webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feuert sendProfileProposed nach erfolgreichem Spielen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({
      data: { id: 'res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', agentur_id: 'ag-1', email_geschaeftlich: 'max@test.de', telefon_geschaeftlich: null },
      error: null,
    })
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null })
    mockVakanzSelect.mockResolvedValue({ data: offeneVakanz, error: null })
    mockLinkInsert.mockResolvedValue({
      data: { id: 'lnk-1', ressource_id: 'res-1', vakanz_id: VAKANZ_UUID, status: 'Gespielt', created_at: '2026-06-23T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })

    expect(sendProfileProposed).toHaveBeenCalledWith(
      VAKANZ_UUID,
      expect.objectContaining({ id: 'res-1', name: 'Max M.', email: 'max@test.de', phone: null })
    )
  })

  it('feuert keinen Webhook wenn Spielen fehlschlägt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })

    expect(sendProfileProposed).not.toHaveBeenCalled()
  })
})
