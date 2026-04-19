import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const { mockGetUser, mockDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockDelete }),
        }),
      }),
    })),
  }),
}))

import { DELETE } from './route'

const FEEDBACK_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeParams(): Promise<{ id: string }> {
  return Promise.resolve({ id: FEEDBACK_ID })
}

describe('DELETE /api/ressource-feedback/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no user') })
    const req = new NextRequest(`http://localhost/api/ressource-feedback/${FEEDBACK_ID}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns 404 when feedback not found or not author (RLS blocks)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockDelete.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest(`http://localhost/api/ressource-feedback/${FEEDBACK_ID}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('deletes own feedback successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockDelete.mockResolvedValue({ data: { id: FEEDBACK_ID }, error: null })
    const req = new NextRequest(`http://localhost/api/ressource-feedback/${FEEDBACK_ID}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
