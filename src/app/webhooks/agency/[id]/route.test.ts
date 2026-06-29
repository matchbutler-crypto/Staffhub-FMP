import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const AGENCY_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const OTHER_AGENCY_ID = 'aaaaaaaa-0000-0000-0000-000000000002'

const {
  mockValidateAgencyKey,
  mockRessourceSelect, mockRessourceInsert, mockRessourceUpdate,
  mockVakanzSelect,
  mockLinkInsert, mockLinkSelect, mockLinkUpdate,
  mockHistorieInsert,
  mockStorageRemove, mockStorageUpload,
} = vi.hoisted(() => ({
  mockValidateAgencyKey: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockRessourceInsert: vi.fn(),
  mockRessourceUpdate: vi.fn(),
  mockVakanzSelect: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
  mockHistorieInsert: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockStorageUpload: vi.fn(),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateAgencyKey: mockValidateAgencyKey,
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressourcen') return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn(() => ({ eq: vi.fn(() => mockRessourceUpdate()) })),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockRessourceSelect,
        single: mockRessourceInsert,
      }
      if (table === 'vakanzen') return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockVakanzSelect,
      }
      if (table === 'ressource_vakanz_links') return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockLinkSelect,
        single: mockLinkInsert,
      }
      if (table === 'ressource_historie') return { insert: mockHistorieInsert }
      return {}
    }),
    storage: {
      from: vi.fn(() => ({
        remove: mockStorageRemove,
        upload: mockStorageUpload,
      })),
    },
  })),
}))

import { POST } from './route'

function makeRequest(agenturId: string, body: unknown) {
  return new NextRequest(`http://localhost/webhooks/agency/${agenturId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sfhub_test' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateAgencyKey.mockResolvedValue({ agencyId: AGENCY_ID, error: null })
  mockRessourceUpdate.mockResolvedValue({ error: null })
  mockHistorieInsert.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({})
  mockStorageUpload.mockResolvedValue({ error: null })
})

describe('Auth & ownership', () => {
  it('gibt 401 zurück wenn Key ungültig', async () => {
    mockValidateAgencyKey.mockResolvedValue({
      agencyId: null,
      error: new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 401 }),
    })
    const res = await POST(makeRequest(AGENCY_ID, { event: 'profile.upserted' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück wenn Key einer anderen Agentur gehört', async () => {
    mockValidateAgencyKey.mockResolvedValue({ agencyId: OTHER_AGENCY_ID, error: null })
    const res = await POST(makeRequest(AGENCY_ID, { event: 'profile.upserted' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(403)
  })
})

describe('Unbekanntes Event', () => {
  it('gibt 200 skipped zurück', async () => {
    const res = await POST(makeRequest(AGENCY_ID, { event: 'something.unknown' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ received: true, skipped: true })
  })
})

describe('profile.upserted — neues Profil', () => {
  it('legt Profil an und gibt 200 zurück', async () => {
    mockRessourceSelect.mockResolvedValue({ data: null, error: null })
    mockRessourceInsert.mockResolvedValue({ data: { id: 'r1' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
      firstName: 'Max',
      lastName: 'Muster',
      skills: ['Python'],
      seniority: 'SENIOR',
      availability: 'AVAILABLE_NOW',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    expect(body.processed.created).toBe(true)
    expect(body.processed.externalRef).toBe('AG-1')
  })

  it('gibt 400 zurück wenn Pflichtfelder fehlen', async () => {
    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
    }), makeParams(AGENCY_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })
})

describe('profile.upserted — bestehendes Profil', () => {
  it('aktualisiert Profil', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', cv_pfad: null }, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
      firstName: 'Max',
      lastName: 'Muster',
      skills: ['Go'],
      seniority: 'EXPERT',
      availability: 'UNAVAILABLE',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.created).toBe(false)
  })
})

describe('profile.deactivated', () => {
  it('setzt verfuegbarkeit auf Deaktiviert', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.deactivated',
      externalRef: 'AG-1',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('gibt 404 zurück wenn Profil nicht gefunden', async () => {
    mockRessourceSelect.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.deactivated',
      externalRef: 'NICHT-DA',
    }), makeParams(AGENCY_ID))
    expect(res.status).toBe(404)
  })
})

describe('submission.created', () => {
  it('erstellt Einreichung', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Offen', published: true }, error: null })
    mockLinkInsert.mockResolvedValue({ data: { id: 'l1' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.submissionId).toBe('l1')
  })

  it('gibt 409 zurück bei Duplikat', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Offen', published: true }, error: null })
    mockLinkInsert.mockResolvedValue({ data: null, error: { code: '23505' } })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(409)
  })

  it('gibt 400 zurück wenn Position besetzt', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Besetzt', published: true }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('POSITION_CLOSED')
  })
})

describe('submission.withdrawn', () => {
  it('setzt Status auf Zurückgezogen', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockLinkSelect.mockResolvedValue({ data: { id: 'l1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.withdrawn',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.submissionId).toBe('l1')
  })

  it('gibt 400 zurück wenn Einreichung bereits beauftragt', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockLinkSelect.mockResolvedValue({ data: { id: 'l1', status: 'Beauftragt' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.withdrawn',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('INVALID_STATUS')
  })
})
