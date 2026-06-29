import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks (vi.hoisted) ────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockVakanzDataSelect,
  mockVakanzUpdate,
  mockVakanzBesetztSelect,
  mockLinksSelect,
  mockRessourcenUpdate,
  mockBeauftragungUpdate,
  mockServiceLinksSelect,
  mockServiceRessourcenUpdate,
  mockServiceBeauftragungUpdate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockVakanzDataSelect: vi.fn(),
  mockVakanzUpdate: vi.fn(),
  mockVakanzBesetztSelect: vi.fn(),
  mockLinksSelect: vi.fn(),
  mockRessourcenUpdate: vi.fn(),
  mockBeauftragungUpdate: vi.fn(),
  mockServiceLinksSelect: vi.fn(),
  mockServiceRessourcenUpdate: vi.fn(),
  mockServiceBeauftragungUpdate: vi.fn(),
}))

// Log-Vakanz-Historie mock (avoids createAdminClient / env-key requirement)
vi.mock('@/lib/log-vakanz-historie', () => ({
  logVakanzHistorie: vi.fn().mockResolvedValue(undefined),
}))

// Regular client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: mockProfileSelect }) }),
        }
      }
      if (table === 'vakanzen') {
        return {
          select: () => ({
            eq: () => ({ single: mockVakanzBesetztSelect }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          select: () => ({
            eq: () => ({ single: mockVakanzDataSelect }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({ single: mockVakanzUpdate }),
            }),
          }),
        }
      }
      if (table === 'ressource_vakanz_links') {
        return {
          select: () => ({
            eq: () => ({
              in: () => mockLinksSelect(),
            }),
          }),
        }
      }
      if (table === 'ressourcen') {
        return {
          update: () => ({ in: mockRessourcenUpdate }),
        }
      }
      if (table === 'beauftragungen') {
        return {
          update: () => ({ in: mockBeauftragungUpdate }),
        }
      }
      return {}
    }),
  }),
}))

// Service-Role client
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: () => ({
            eq: () => ({
              in: () => mockServiceLinksSelect(),
            }),
          }),
        }
      }
      if (table === 'ressourcen') {
        return {
          update: () => ({ in: mockServiceRessourcenUpdate }),
        }
      }
      if (table === 'beauftragungen') {
        return {
          update: () => ({ in: mockServiceBeauftragungUpdate }),
        }
      }
      return {}
    }),
  }),
}))

import { PUT } from './route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePutRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/vakanzen/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  branche: 'IT',
  kunde: null,
  rolle: 'Frontend Engineer',
  beschreibung: 'React-Experte für Projekt X',
  skills: ['React', 'TypeScript'],
  skills_nice_have: [],
  erfahrungslevel: 'Senior' as const,
  startdatum: '2026-05-01',
  enddatum: '2026-12-31',
  teamgroesse: null,
  fte_anzahl: 1,
  auslastung: 100,
  arbeitsmodell: 'Remote' as const,
  onsite_anteil: null,
  ansprechpartner: null,
  status: 'Offen' as const,
  standort: null,
  budget_intern: 750,
  weitere_kommentare: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PUT /api/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await PUT(makePutRequest('vak-1', validBody), {
      params: Promise.resolve({ id: 'vak-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-Rolle', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })

    const res = await PUT(makePutRequest('vak-1', validBody), {
      params: Promise.resolve({ id: 'vak-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei ungültigen Daten', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true }, error: null })

    const res = await PUT(makePutRequest('vak-1', { rolle: '' }), {
      params: Promise.resolve({ id: 'vak-1' }),
    })
    expect(res.status).toBe(400)
  })

  describe('Enddatum-Sync', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'u-mgr' } }, error: null })
      mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true }, error: null })
      mockVakanzBesetztSelect.mockResolvedValue({ data: { besetzt_seit: null, status: 'Offen' }, error: null })
      mockVakanzUpdate.mockResolvedValue({
        data: { id: 'vak-1', titel: 'Frontend Engineer', status: 'Offen', besetzt_seit: null, updated_at: '2026-06-25T00:00:00Z' },
        error: null,
      })
    })

    it('synchronisiert Beauftragung und Ressource wenn Enddatum geändert wird', async () => {
      // Altes Enddatum ist anders → enddatumChanged = true
      mockVakanzDataSelect.mockResolvedValue({ data: { enddatum: '2026-11-30' }, error: null })

      mockServiceLinksSelect.mockResolvedValue({
        data: [
          { id: 'link-1', ressource_id: 'res-1' },
          { id: 'link-2', ressource_id: 'res-2' },
        ],
        error: null,
      })
      mockServiceRessourcenUpdate.mockResolvedValue({ error: null })
      mockServiceBeauftragungUpdate.mockResolvedValue({ error: null })

      const res = await PUT(makePutRequest('vak-1', validBody), {
        params: Promise.resolve({ id: 'vak-1' }),
      })
      expect(res.status).toBe(200)

      // Service-Role-Client muss für die Sync-Updates verwendet worden sein
      expect(mockServiceLinksSelect).toHaveBeenCalledTimes(1)
      expect(mockServiceRessourcenUpdate).toHaveBeenCalledTimes(1)
      expect(mockServiceBeauftragungUpdate).toHaveBeenCalledTimes(1)

      // Regulärer Client darf NICHT für Ressourcen/Beauftragungen verwendet worden sein
      expect(mockLinksSelect).not.toHaveBeenCalled()
      expect(mockRessourcenUpdate).not.toHaveBeenCalled()
      expect(mockBeauftragungUpdate).not.toHaveBeenCalled()
    })

    it('überspringt Sync wenn Enddatum unverändert ist', async () => {
      // Gleiches Enddatum → enddatumChanged = false
      mockVakanzDataSelect.mockResolvedValue({ data: { enddatum: '2026-12-31' }, error: null })

      const res = await PUT(makePutRequest('vak-1', validBody), {
        params: Promise.resolve({ id: 'vak-1' }),
      })
      expect(res.status).toBe(200)
      expect(mockServiceLinksSelect).not.toHaveBeenCalled()
    })

    it('überspringt Ressourcen-Update wenn alle ressource_ids null sind', async () => {
      mockVakanzDataSelect.mockResolvedValue({ data: { enddatum: '2026-11-30' }, error: null })

      mockServiceLinksSelect.mockResolvedValue({
        data: [{ id: 'link-1', ressource_id: null }],
        error: null,
      })
      mockServiceBeauftragungUpdate.mockResolvedValue({ error: null })

      const res = await PUT(makePutRequest('vak-1', validBody), {
        params: Promise.resolve({ id: 'vak-1' }),
      })
      expect(res.status).toBe(200)

      // Beauftragungen werden trotzdem aktualisiert
      expect(mockServiceBeauftragungUpdate).toHaveBeenCalledTimes(1)
      // Ressourcen nicht (alle IDs waren null)
      expect(mockServiceRessourcenUpdate).not.toHaveBeenCalled()
    })
  })
})
