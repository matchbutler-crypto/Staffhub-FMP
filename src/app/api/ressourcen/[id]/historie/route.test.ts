import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockProfileSelect,
  mockHistorieSelect,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockHistorieSelect: vi.fn(),
  mockHistorieInsert: vi.fn(),
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
      if (table === 'ressource_historie') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockHistorieSelect()),
              }),
            }),
          }),
          insert: mockHistorieInsert,
        }
      }
      return {}
    }),
  }),
}))

import { GET, POST } from './route'

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const adminProfile = { rolle: 'Admin', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }

function makeGet(): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1/historie', { method: 'GET' })
}
function makePost(text: string): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1/historie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

describe('GET /api/ressourcen/[id]/historie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt Historieneinträge zurück für Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockHistorieSelect.mockReturnValue({
      data: [{ id: 'h1', typ: 'system', text: 'Stammdaten aktualisiert', created_at: '2026-05-28T10:00:00Z', profiles: { name: 'Max M.', rolle: 'Staffhub Manager' } }],
      error: null,
    })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.historie).toHaveLength(1)
    expect(json.historie[0].typ).toBe('system')
  })

  it('gibt Historieneinträge zurück für Agentur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockHistorieSelect.mockReturnValue({ data: [], error: null })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/ressourcen/[id]/historie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makePost('Test'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-Nutzer', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const res = await POST(makePost('Test'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
  })

  it('legt manuellen Eintrag für Manager an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await POST(makePost('Kandidat hat zugesagt'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
  })

  it('legt manuellen Eintrag für Admin an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: adminProfile, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await POST(makePost('Vertrag unterzeichnet'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
  })

  it('gibt 400 zurück bei leerem Text', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const res = await POST(makePost(''), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(400)
  })
})
