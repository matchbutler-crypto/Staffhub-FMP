import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockProfileSelect, mockFeedbackUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockFeedbackUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockFeedbackUpdate }) }) }),
    }),
  }),
}))

import { PATCH } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: true }, error: null })
  mockFeedbackUpdate.mockResolvedValue({ data: { id: 'fb-1', status: 'in_progress' }, error: null })
})

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/feedback/fb-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const params = Promise.resolve({ id: 'fb-1' })

describe('PATCH /api/feedback/[id]', () => {
  it('returns 403 for non-admin', async () => {
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })
    const res = await PATCH(makeReq({ status: 'in_progress' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status', async () => {
    const res = await PATCH(makeReq({ status: 'invalid' }), { params })
    expect(res.status).toBe(400)
  })

  it('updates status successfully', async () => {
    const res = await PATCH(makeReq({ status: 'in_progress' }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.feedback.status).toBe('in_progress')
  })
})
