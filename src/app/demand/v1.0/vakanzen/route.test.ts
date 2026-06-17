import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect, mockInsert, mockMaybeSingle, mockUpdate } = vi.hoisted(() => ({
  mockSelect:      vi.fn(),
  mockInsert:      vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockUpdate:      vi.fn(),
}))

// Flexibles chainbares Mock-Objekt — jede Methode gibt sich selbst zurück,
// am Ende wird mockSelect() als Promise aufgelöst.
function makeChainable(resolveFn: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'order', 'limit', 'gte', 'lte', 'eq', 'neq', 'overlaps']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    resolveFn().then(resolve, reject)
  return chain
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen') return makeChainable(mockSelect)
      if (table === 'vakanzen_data') {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockInsert })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: mockUpdate })) })) })),
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET, POST } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

function makeGetRequest(params = '') {
  return new NextRequest(`http://localhost/demand/v1.0/vakanzen${params}`, {
    headers: { 'Authorization': 'Bearer test-key' },
  })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

const validVakanzIntern = {
  branche: 'IT', rolle: 'Frontend Engineer',
  beschreibung: 'React-Projekt', skills: ['React'],
  erfahrungslevel: 'Senior', startdatum: '2026-07-01',
  enddatum: '2026-12-31', fte_anzahl: 1, arbeitsmodell: 'Remote',
  budget_intern: 800,
}

const validVakanzEnglish = {
  role: 'Senior Cloud Engineer',
  description: 'Cloud-Projekt',
  skills: [{ name: 'Kubernetes', level: 'EXPERT', mandatory: true }],
  seniority: 'SENIOR',
  startDate: '2026-08-01',
  endDate: '2027-01-31',
  utilizationPct: 80,
  location: { mode: 'REMOTE', city: 'Berlin' },
  maxRate: { amount: 95, currency: 'EUR', per: 'HOUR' },
}

describe('GET /demand/v1.0/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück bei fehlendem API-Key', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('gibt Vakanzen-Liste als data-Array zurück', async () => {
    mockSelect.mockResolvedValue({
      data: [{ id: 'v1', rolle: 'Dev', status: 'Offen', updated_at: '2026-06-17T00:00:00Z' }],
      error: null,
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('v1')
  })

  it('gibt leere Liste bei Fehler zurück', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})

describe('POST /demand/v1.0/vakanzen — interne Felder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei fehlendem Pflichtfeld zurück', async () => {
    const res = await POST(makePostRequest({ rolle: 'Dev' }))
    expect(res.status).toBe(400)
  })

  it('erstellt Vakanz mit internen Feldern und gibt 201 zurück', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsert.mockResolvedValue({
      data: { id: 'new-v', external_ref: null, vakanz_nr: 42, rolle: 'Frontend Engineer', status: 'Offen', created_at: '2026-06-17T00:00:00Z', updated_at: '2026-06-17T00:00:00Z' },
      error: null,
    })
    const res = await POST(makePostRequest(validVakanzIntern))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.vakanz.id).toBe('new-v')
  })
})

describe('POST /demand/v1.0/vakanzen — englische Felder (Magenta OS)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('akzeptiert englisches Schema und erstellt Vakanz', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsert.mockResolvedValue({
      data: { id: 'eng-v', external_ref: null, vakanz_nr: 43, rolle: 'Senior Cloud Engineer', status: 'Offen', created_at: '2026-06-17T00:00:00Z', updated_at: '2026-06-17T00:00:00Z' },
      error: null,
    })
    const res = await POST(makePostRequest(validVakanzEnglish))
    expect(res.status).toBe(201)
  })

  it('gibt 400 zurück wenn weder role noch rolle angegeben', async () => {
    const res = await POST(makePostRequest({ startDate: '2026-08-01', endDate: '2027-01-31', maxRate: { amount: 90 } }))
    expect(res.status).toBe(400)
  })
})

describe('POST /demand/v1.0/vakanzen — externalRef Idempotenz', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aktualisiert bestehende Vakanz wenn externalRef bereits existiert', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-v' }, error: null })
    mockUpdate.mockResolvedValue({
      data: { id: 'existing-v', external_ref: 'magentaos-pos-1234', vakanz_nr: 1, rolle: 'Senior Cloud Engineer', status: 'Offen', updated_at: '2026-06-17T00:00:00Z' },
      error: null,
    })
    const res = await POST(makePostRequest({ ...validVakanzEnglish, externalRef: 'magentaos-pos-1234' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.id).toBe('existing-v')
  })

  it('legt neue Vakanz an wenn externalRef noch nicht existiert', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsert.mockResolvedValue({
      data: { id: 'new-v', external_ref: 'magentaos-pos-9999', vakanz_nr: 44, rolle: 'Senior Cloud Engineer', status: 'Offen', created_at: '2026-06-17T00:00:00Z', updated_at: '2026-06-17T00:00:00Z' },
      error: null,
    })
    const res = await POST(makePostRequest({ ...validVakanzEnglish, externalRef: 'magentaos-pos-9999' }))
    expect(res.status).toBe(201)
  })
})
