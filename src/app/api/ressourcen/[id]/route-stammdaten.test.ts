import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourceSelect,
  mockRessourceUpdate,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockRessourceUpdate: vi.fn(),
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
      if (table === 'ressourcen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockRessourceSelect }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockRessourceUpdate }),
            }),
          }),
        }
      }
      if (table === 'ressource_historie') {
        return { insert: mockHistorieInsert }
      }
      return {}
    }),
  }),
}))

import { PATCH, PUT } from './route'

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const ressource = { id: 'res-1', agentur_id: 'ag-1' }

function makePatch(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function makePut(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/ressourcen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur mit fremder Ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { ...agenturProfile, agentur_id: 'ag-2' }, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
  })

  it('aktualisiert Stammdaten und schreibt Historieneintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockRessourceUpdate.mockResolvedValue({ data: { id: 'res-1', vorname: 'Max' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
    expect(mockHistorieInsert).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Stammdaten aktualisiert', typ: 'system' })
    )
  })
})

describe('PUT /api/ressourcen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aktualisiert Stammdaten und schreibt Historieneintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockRessourceUpdate.mockResolvedValue({ data: { id: 'res-1', vorname: 'Max' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PUT(makePut({ vorname: 'Max', nachname: 'M.' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
    expect(mockHistorieInsert).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Stammdaten aktualisiert', typ: 'system' })
    )
  })
})
