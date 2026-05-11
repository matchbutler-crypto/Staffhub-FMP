import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase Mock ──────────────────────────────────────────────────────────────

const { mockGetUser, mockProfileSelect, mockProfileListSelect, mockInsertProfil, mockStorageUpload, mockStorageRemove } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockProfileSelect: vi.fn(),
    mockProfileListSelect: vi.fn(),
    mockInsertProfil: vi.fn(),
    mockStorageUpload: vi.fn(),
    mockStorageRemove: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockProfileSelect,
            }),
          }),
        }
      }
      if (table === 'kandidaten_profile') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockProfileListSelect,
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockInsertProfil,
            }),
          }),
        }
      }
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'vakanz-1', status: 'Offen' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
  }),
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }))

import { GET, POST } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/profile', { method: 'GET' })
}

function makePostRequest(fields: Record<string, string>, cv?: File): NextRequest {
  const req = new NextRequest('http://localhost/api/profile', { method: 'POST' })
  // Mock formData() since jsdom doesn't handle multipart FormData parsing well
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  if (cv) formData.append('cv', cv)
  vi.spyOn(req, 'formData').mockResolvedValue(formData)
  return req
}

function makePdfFile(sizeBytes = 1024): File {
  const buf = new Uint8Array(sizeBytes)
  // Set %PDF magic bytes so magic-byte check passes
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46
  return new File([buf], 'lebenslauf.pdf', { type: 'application/pdf' })
}

const validFields = {
  vakanz_id: '00000000-0000-0000-0000-000000000001',
  kandidatenname: 'Max Mustermann',
  verfuegbarkeit_stunden: '40',
  verfuegbar_ab: '2026-05-01',
  verkaufspreis: '800',
  skills: JSON.stringify(['React', 'TypeScript']),
  erfahrungslevel: 'Senior',
  profiltext: 'Erfahrener Entwickler mit 8 Jahren Berufserfahrung.',
}

// ── GET Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Nicht authentifiziert')
  })

  it('gibt 403 zurück wenn Account deaktiviert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: false, agentur_id: 'ag-1' },
      error: null,
    })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('gibt Profilliste zurück für Agentur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockProfileListSelect.mockResolvedValue({
      data: [
        {
          id: 'profil-1',
          vakanz_id: 'vakanz-1',
          agentur_id: 'ag-1',
          kandidatenname: 'Max Muster',
          status: 'Eingereicht',
          ki_score: null,
          created_at: '2026-04-13T00:00:00Z',
          vakanzen: { titel: 'React Developer' },
          agenturen: { name: 'TestAgentur GmbH' },
        },
      ],
      error: null,
    })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].vakanz_titel).toBe('React Developer')
    // Agentur bekommt kein agentur_name
    expect(json[0].agentur_name).toBeUndefined()
  })

  it('gibt agentur_name zurück für Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null },
      error: null,
    })
    mockProfileListSelect.mockResolvedValue({
      data: [
        {
          id: 'profil-1',
          vakanz_id: 'vakanz-1',
          agentur_id: 'ag-1',
          kandidatenname: 'Max Muster',
          status: 'Eingereicht',
          ki_score: null,
          created_at: '2026-04-13T00:00:00Z',
          vakanzen: { titel: 'React Developer' },
          agenturen: { name: 'TestAgentur GmbH' },
        },
      ],
      error: null,
    })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].agentur_name).toBe('TestAgentur GmbH')
  })
})

// ── POST Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await POST(makePostRequest(validFields, makePdfFile()))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Staffhub Manager (nur Agentur darf einreichen)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Manager', aktiv: true, agentur_id: null },
      error: null,
    })

    const res = await POST(makePostRequest(validFields, makePdfFile()))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Agenturen')
  })

  it('gibt 403 zurück wenn Agentur keine agentur_id hat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: null },
      error: null,
    })

    const res = await POST(makePostRequest(validFields, makePdfFile()))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('keiner Agentur zugeordnet')
  })

  it('gibt 400 zurück wenn kein CV hochgeladen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })

    const res = await POST(makePostRequest(validFields)) // no CV
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Lebenslauf')
  })

  it('gibt 400 zurück bei nicht-PDF Datei', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })

    const txtFile = new File(['text content'], 'cv.txt', { type: 'text/plain' })
    const res = await POST(makePostRequest(validFields, txtFile))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('PDF')
  })

  it('erstellt Profil erfolgreich und gibt 201 zurück', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertProfil.mockResolvedValue({
      data: {
        id: 'profil-new',
        kandidatenname: 'Max Mustermann',
        status: 'Eingereicht',
        created_at: '2026-04-13T00:00:00Z',
      },
      error: null,
    })

    const res = await POST(makePostRequest(validFields, makePdfFile()))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.profil.status).toBe('Eingereicht')
    expect(mockStorageUpload).toHaveBeenCalledOnce()
  })

  it('löscht CV wenn DB-Insert fehlschlägt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertProfil.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'unique constraint' },
    })

    const res = await POST(makePostRequest(validFields, makePdfFile()))
    expect(res.status).toBe(500)
    // CV should be cleaned up
    expect(mockStorageRemove).toHaveBeenCalledOnce()
  })
})
