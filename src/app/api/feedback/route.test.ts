import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockProfileSelect, mockFeedbackInsert, mockFeedbackSelect, mockStorageUpload, mockStorageSignedUrl } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockFeedbackInsert: vi.fn(),
  mockFeedbackSelect: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      if (table === 'feedbacks') {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockFeedbackInsert }) }),
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue(mockFeedbackSelect()) }),
        }
      }
      return {}
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageSignedUrl,
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageSignedUrl,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'feedbacks') {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockFeedbackInsert }) }),
          select: vi.fn().mockReturnValue({ order: vi.fn().mockImplementation(() => ({ then: (r: (v: unknown) => unknown) => r(mockFeedbackSelect()) })) }),
        }
      }
      return {}
    }),
  }),
}))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: true }, error: null })
  mockFeedbackSelect.mockReturnValue({ data: [], error: null })
  mockFeedbackInsert.mockResolvedValue({ data: { id: 'fb-1', beschreibung: 'Test' }, error: null })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.url/img.png' }, error: null })
})

describe('POST /api/feedback', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: 'Test', kategorie: 'Bug', annotations: [], seite_url: '/dashboard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: '', kategorie: 'Invalid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates feedback without screenshot', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: 'Bug found', kategorie: 'Bug', annotations: [], seite_url: '/dashboard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('GET /api/feedback', () => {
  it('returns 403 for non-admin', async () => {
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns feedbacks for admin', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.feedbacks)).toBe(true)
  })
})
