import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockFeedbackSelect,
  mockFeedbackInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockFeedbackSelect: vi.fn(),
  mockFeedbackInsert: vi.fn(),
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
      if (table === 'ressource_feedback') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockFeedbackSelect,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockFeedbackInsert }),
          }),
        }
      }
      return {}
    }),
  }),
}))

import { GET, POST } from './route'

const RESSOURCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/ressourcen/${RESSOURCE_ID}/feedback`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeParams(): Promise<{ id: string }> {
  return Promise.resolve({ id: RESSOURCE_ID })
}

describe('GET /api/ressourcen/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no user') })
    const res = await GET(makeRequest('GET'), { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns 401 when profile is inactive', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: false }, error: null })
    const res = await GET(makeRequest('GET'), { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns feedback list for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true }, error: null })
    const mockFeedbacks = [
      { id: 'f1', text: 'Gute Ressource', bewertung: 4, created_at: new Date().toISOString(), vakanz_id: null, vakanzen_data: null, profiles: { id: USER_ID, name: 'Manager', rolle: 'Staffhub Manager' } },
    ]
    mockFeedbackSelect.mockResolvedValue({ data: mockFeedbacks, error: null })
    const res = await GET(makeRequest('GET'), { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.feedback).toHaveLength(1)
    expect(body.feedback[0].text).toBe('Gute Ressource')
  })
})

describe('POST /api/ressourcen/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no user') })
    const res = await POST(makeRequest('POST', { text: 'Test' }), { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns 400 on empty text', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }, error: null })
    const res = await POST(makeRequest('POST', { text: '' }), { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid bewertung (out of range)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }, error: null })
    const res = await POST(makeRequest('POST', { text: 'Test', bewertung: 6 }), { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('creates feedback with text only (no bewertung)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }, error: null })
    const created = { id: 'f2', text: 'Ohne Bewertung', bewertung: null, created_at: new Date().toISOString(), vakanz_id: null, vakanzen_data: null, profiles: null }
    mockFeedbackInsert.mockResolvedValue({ data: created, error: null })
    const res = await POST(makeRequest('POST', { text: 'Ohne Bewertung' }), { params: makeParams() })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.feedback.text).toBe('Ohne Bewertung')
    expect(body.feedback.bewertung).toBeNull()
  })

  it('creates feedback with 5-star rating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag1' }, error: null })
    const created = { id: 'f3', text: 'Hervorragend', bewertung: 5, created_at: new Date().toISOString(), vakanz_id: null, vakanzen_data: null, profiles: null }
    mockFeedbackInsert.mockResolvedValue({ data: created, error: null })
    const res = await POST(makeRequest('POST', { text: 'Hervorragend', bewertung: 5 }), { params: makeParams() })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.feedback.bewertung).toBe(5)
  })
})
