import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockLogsSelect,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockLogsSelect: vi.fn(),
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
      if (table === 'slack_post_log') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockLogsSelect,
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

import { GET } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/slack/logs')
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/slack/logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('gibt 403 zurück für deaktivierten Account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: false }, error: null })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('gibt Logs zurück für Staffhub Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true },
      error: null,
    })
    mockLogsSelect.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          vakanz_id: 'v-1',
          post_type: 'detail',
          workspace: 'freelance',
          channel: 'testing',
          status: 'success',
          error_msg: null,
          posted_by: 'user-2',
          posted_at: '2026-04-15T10:00:00Z',
          vakanzen: { titel: 'Senior Dev' },
          profiles: { name: 'Test Manager' },
        },
      ],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.logs).toHaveLength(1)
    expect(json.logs[0].vakanz_titel).toBe('Senior Dev')
    expect(json.logs[0].posted_by_name).toBe('Test Manager')
    expect(json.logs[0].post_type).toBe('detail')
  })

  it('gibt Logs zurück für Admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-3' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: true }, error: null })
    mockLogsSelect.mockResolvedValue({ data: [], error: null })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.logs).toHaveLength(0)
  })

  it('normalisiert null-Felder korrekt (Updatepost ohne Vakanz)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Admin', aktiv: true },
      error: null,
    })
    mockLogsSelect.mockResolvedValue({
      data: [
        {
          id: 'log-2',
          vakanz_id: null,
          post_type: 'update',
          workspace: 'partner',
          channel: 'global',
          status: 'success',
          error_msg: null,
          posted_by: 'user-2',
          posted_at: '2026-04-15T11:00:00Z',
          vakanzen: null,
          profiles: null,
        },
      ],
      error: null,
    })

    const res = await GET()
    const json = await res.json()
    expect(json.logs[0].vakanz_titel).toBeNull()
    expect(json.logs[0].posted_by_name).toBeNull()
  })
})
