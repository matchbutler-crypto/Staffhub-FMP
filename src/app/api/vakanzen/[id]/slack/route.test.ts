import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockVakanzSelect,
  mockUpdate,
  mockLogInsert,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockVakanzSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockLogInsert: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('@/lib/slack-webhooks', () => ({
  getWebhookUrl: vi.fn().mockReturnValue('https://hooks.slack.com/test-webhook'),
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
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockVakanzSelect }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          update: vi.fn().mockReturnValue({
            eq: mockUpdate,
          }),
        }
      }
      if (table === 'slack_post_log') {
        return { insert: mockLogInsert }
      }
      return {}
    }),
  }),
}))

vi.stubGlobal('fetch', mockFetch)

import { POST } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, id = 'vakanz-1'): NextRequest {
  return new NextRequest(`http://localhost/api/vakanzen/${id}/slack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, name: 'Test Manager' }
const validVakanz = {
  id: 'vakanz-1',
  titel: 'Senior Developer',
  rolle: 'Frontend Engineer',
  beschreibung: 'React expert',
  skills: ['React', 'TypeScript'],
  erfahrungslevel: 'Senior',
  startdatum: '2026-05-01',
  laufzeit: '6 Monate',
  auslastung: 100,
  arbeitsmodell: 'Remote',
  standort: 'Berlin',
  branche: 'IT',
  teamgroesse: 5,
  budget_intern: 800,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/vakanzen/[id]/slack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogInsert.mockResolvedValue({ error: null })
    mockUpdate.mockResolvedValue({ error: null })
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei fehlenden Feldern', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei ungültigem workspace', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })

    const res = await POST(makeRequest({ workspace: 'invalid', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Vakanz nicht existiert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzSelect.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(404)
  })

  it('postet erfolgreich und gibt 200 zurück', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzSelect.mockResolvedValue({ data: validVakanz, error: null })
    mockFetch.mockResolvedValue({ ok: true, text: async () => 'ok', status: 200 })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.slack_detail_posted_at).toBeDefined()
  })

  it('loggt Erfolg in slack_post_log', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzSelect.mockResolvedValue({ data: validVakanz, error: null })
    mockFetch.mockResolvedValue({ ok: true, text: async () => 'ok', status: 200 })

    await POST(makeRequest({ workspace: 'partner', channel: 'germany' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vakanz_id: 'vakanz-1',
        post_type: 'detail',
        workspace: 'partner',
        channel: 'germany',
        status: 'success',
      })
    )
  })

  it('gibt 502 zurück bei Slack-Fehler und loggt error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzSelect.mockResolvedValue({ data: validVakanz, error: null })
    mockFetch.mockResolvedValue({ ok: false, text: async () => 'invalid_token', status: 403 })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }), {
      params: Promise.resolve({ id: 'vakanz-1' }),
    })
    expect(res.status).toBe(502)

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    )
  })
})
