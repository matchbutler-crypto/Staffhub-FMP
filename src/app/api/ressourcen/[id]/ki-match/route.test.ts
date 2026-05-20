import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourceSelect,
  mockVakanzSelect,
  mockScoreSelect,
  mockScoreUpsert,
  mockOllama,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockVakanzSelect: vi.fn(),
  mockScoreSelect: vi.fn(),
  mockScoreUpsert: vi.fn(),
  mockOllama: vi.fn(),
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
      if (table === 'vakanzen_data') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockVakanzSelect }) }) }
      }
      if (table === 'ressource_ki_scores') {
        const chain: Record<string, unknown> = {}
        const eqFn = vi.fn().mockReturnValue(chain)
        const orderFn = vi.fn().mockReturnValue({ limit: mockScoreSelect })
        chain.eq = eqFn
        chain.order = orderFn
        return {
          select: vi.fn().mockReturnValue(chain),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockScoreUpsert }),
          }),
        }
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/openai', () => ({
  bewerteProfilMitOpenAI: mockOllama,
}))

import { GET, POST } from './route'

const RESSOURCE_ID = '11111111-1111-1111-1111-111111111111'
const VAKANZ_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '33333333-3333-3333-3333-333333333333'
const AGENTUR_ID = '44444444-4444-4444-4444-444444444444'

function makeGetRequest(vakanzId?: string): NextRequest {
  const url = `http://localhost/api/ressourcen/${RESSOURCE_ID}/ki-match${vakanzId ? `?vakanz_id=${vakanzId}` : ''}`
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/ressourcen/${RESSOURCE_ID}/ki-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: RESSOURCE_ID })

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: AGENTUR_ID }
const mockRessource = {
  id: RESSOURCE_ID, name: 'Max M.', skills: ['React'], erfahrungslevel: 'Senior',
  notizen: 'Guter Entwickler', agentur_id: AGENTUR_ID,
}
const mockVakanz = {
  id: VAKANZ_ID, titel: 'Senior React Dev', rolle: 'Senior React Dev',
  beschreibung: 'React Entwickler gesucht', skills: ['React', 'TypeScript'], erfahrungslevel: 'Senior',
}
const mockKiResult = {
  score: 85, empfehlung: 'Empfohlen', begruendung: 'Passt gut.',
  skill_vorhanden: ['React'], skill_fehlend: ['TypeScript'], model: 'llama3.2',
}
const mockScore = { id: 'score-1', ...mockKiResult, berechnet_am: '2026-04-19T10:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OPENAI_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.OPENAI_API_KEY
})

// ── GET Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/ressourcen/[id]/ki-match', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeGetRequest(VAKANZ_ID), { params })
    expect(res.status).toBe(401)
  })

  it('returns score for manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockScoreSelect.mockResolvedValue({ data: [mockScore] })
    const res = await GET(makeGetRequest(VAKANZ_ID), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score.score).toBe(85)
  })

  it('returns null score when none exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockScoreSelect.mockResolvedValue({ data: [] })
    const res = await GET(makeGetRequest(VAKANZ_ID), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score).toBeNull()
  })
})

// ── POST Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/ressourcen/[id]/ki-match', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    const res = await POST(makePostRequest({ vakanz_id: 'not-a-uuid' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 403 when agentur tries to match foreign ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile })
    mockRessourceSelect.mockResolvedValue({ data: { ...mockRessource, agentur_id: 'other-agentur' } })
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when ressource not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockRessourceSelect.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 503 when ollama is not reachable', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockRessourceSelect.mockResolvedValue({ data: mockRessource })
    mockVakanzSelect.mockResolvedValue({ data: mockVakanz })
    mockOllama.mockRejectedValue(new Error('fetch failed ECONNREFUSED'))
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(503)
  })

  it('calculates and saves score successfully for manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockRessourceSelect.mockResolvedValue({ data: mockRessource })
    mockVakanzSelect.mockResolvedValue({ data: mockVakanz })
    mockOllama.mockResolvedValue(mockKiResult)
    mockScoreUpsert.mockResolvedValue({ data: mockScore, error: null })
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.score.score).toBe(85)
    expect(body.score.empfehlung).toBe('Empfohlen')
  })

  it('calculates score for agentur with own ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile })
    mockRessourceSelect.mockResolvedValue({ data: mockRessource })
    mockVakanzSelect.mockResolvedValue({ data: mockVakanz })
    mockOllama.mockResolvedValue(mockKiResult)
    mockScoreUpsert.mockResolvedValue({ data: mockScore, error: null })
    const res = await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(res.status).toBe(200)
  })
})
