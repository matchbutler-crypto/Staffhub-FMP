import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockVakanzenSelect,
  mockLogInsert,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockVakanzenSelect: vi.fn(),
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
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockVakanzenSelect,
              }),
            }),
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/slack/updatepost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true }
const sampleVakanzen = [
  { id: 'v1', titel: 'React Dev', status: 'Offen', budget_intern: 700 },
  { id: 'v2', titel: 'Java Dev', status: 'In Auswahl', budget_intern: 600 },
  { id: 'v3', titel: 'Old Role', status: 'Geschlossen', budget_intern: null },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/slack/updatepost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogInsert.mockResolvedValue({ error: null })
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }))
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei fehlenden Feldern', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })

    const res = await POST(makeRequest({ workspace: 'freelance' }))
    expect(res.status).toBe(400)
  })

  it('gibt 422 zurück wenn keine Vakanzen vorhanden', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzenSelect.mockResolvedValue({ data: [], error: null })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }))
    expect(res.status).toBe(422)
  })

  it('sendet Updatepost erfolgreich', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzenSelect.mockResolvedValue({ data: sampleVakanzen, error: null })
    mockFetch.mockResolvedValue({ ok: true, text: async () => 'ok', status: 200 })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'germany' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.vakanzen_count).toBe(3)
    expect(json.messages_sent).toBe(1)
  })

  it('loggt Erfolg in slack_post_log mit vakanz_id=null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzenSelect.mockResolvedValue({ data: sampleVakanzen, error: null })
    mockFetch.mockResolvedValue({ ok: true, text: async () => 'ok', status: 200 })

    await POST(makeRequest({ workspace: 'partner', channel: 'global' }))

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vakanz_id: null,
        post_type: 'update',
        workspace: 'partner',
        channel: 'global',
        status: 'success',
      })
    )
  })

  it('gibt 502 zurück bei Slack-Fehler', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockVakanzenSelect.mockResolvedValue({ data: sampleVakanzen, error: null })
    mockFetch.mockResolvedValue({ ok: false, text: async () => 'channel_not_found', status: 404 })

    const res = await POST(makeRequest({ workspace: 'freelance', channel: 'testing' }))
    expect(res.status).toBe(502)

    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    )
  })
})
