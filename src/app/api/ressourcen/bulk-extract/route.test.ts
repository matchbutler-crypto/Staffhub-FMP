import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted Mocks ──────────────────────────────────────────────────────────────

const {
  mockGetUser,
  mockProfileSelect,
  mockStorageUpload,
  mockStorageRemove,
  mockExtractSkills,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockExtractSkills: vi.fn(),
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
      return {}
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      })),
    },
  })),
}))

vi.mock('@/lib/openai', () => ({
  extractSkillsFromCVBuffer: mockExtractSkills,
}))

vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('test-uuid-1234') }))

import { POST, DELETE } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePdfRequest(opts: {
  file?: File | null
  index?: number
  headers?: Record<string, string>
}): NextRequest {
  const { file, index = 0, headers = {} } = opts
  const formData = new FormData()
  if (file !== null) {
    const f = file ?? new File([new Uint8Array(10)], 'test.pdf', { type: 'application/pdf' })
    formData.append('file', f)
  }
  formData.append('index', String(index))

  const req = new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
    method: 'POST',
    headers,
  })
  // Mock formData() since jsdom doesn't handle multipart FormData parsing well
  vi.spyOn(req, 'formData').mockResolvedValue(formData)
  return req
}

function makeDeleteRequest(paths: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ paths }),
  })
}

const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const viewerProfile = { rolle: 'Viewer', aktiv: true, agentur_id: null }

// ── POST /api/ressourcen/bulk-extract ──────────────────────────────────────────

describe('POST /api/ressourcen/bulk-extract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageUpload.mockResolvedValue({ error: null })
    mockExtractSkills.mockResolvedValue(['React', 'TypeScript'])
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makePdfRequest({}))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Nicht authentifiziert')
  })

  it('gibt 403 zurück für deaktivierten Account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { ...agenturProfile, aktiv: false },
      error: null,
    })
    const res = await POST(makePdfRequest({}))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Account deaktiviert')
  })

  it('gibt 403 zurück für nicht erlaubte Rolle (Viewer)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: viewerProfile, error: null })
    const res = await POST(makePdfRequest({}))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Keine Berechtigung')
  })

  it('gibt 400 zurück für Nicht-PDF Datei (falscher MIME-Typ)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const notPdf = new File([new Uint8Array(10)], 'test.txt', { type: 'text/plain' })
    const res = await POST(makePdfRequest({ file: notPdf }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Nur PDF-Dateien erlaubt')
  })

  it('gibt 400 zurück wenn keine Datei übermittelt wurde', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const fd = new FormData()
    fd.append('index', '0')
    const req = new NextRequest('http://localhost/api/ressourcen/bulk-extract', { method: 'POST' })
    vi.spyOn(req, 'formData').mockResolvedValue(fd)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Datei/)
  })

  it('extrahiert Skills und gibt tempCvPfad für Agentur-User zurück', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const res = await POST(makePdfRequest({ file: pdfFile, index: 0 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tempCvPfad).toBe('bulk-temp/ag-1/test-uuid-1234.pdf')
    expect(json.skills).toEqual(['React', 'TypeScript'])
    expect(json.index).toBe(0)
  })

  it('gibt leeres Skills-Array zurück wenn OpenAI einen Fehler wirft', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockExtractSkills.mockRejectedValue(new Error('OpenAI timeout'))
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const res = await POST(makePdfRequest({ file: pdfFile }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.skills).toEqual([])
    expect(json.tempCvPfad).toBe('bulk-temp/ag-1/test-uuid-1234.pdf')
  })

  it('gibt 500 zurück wenn Storage-Upload fehlschlägt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockStorageUpload.mockResolvedValue({ error: { message: 'Storage error' } })
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const res = await POST(makePdfRequest({ file: pdfFile }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Fehler beim Hochladen der Datei')
  })

  it('Manager ohne x-agentur-id Header verwendet user.id als agenturId-Segment', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'manager-user-id' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const res = await POST(makePdfRequest({ file: pdfFile }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tempCvPfad).toBe('bulk-temp/manager-user-id/test-uuid-1234.pdf')
  })

  it('Manager mit ungültigem x-agentur-id Header verwendet user.id als Fallback', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'manager-user-id' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const res = await POST(makePdfRequest({ file: pdfFile, headers: { 'x-agentur-id': 'not-a-uuid' } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tempCvPfad).toBe('bulk-temp/manager-user-id/test-uuid-1234.pdf')
  })

  it('Manager mit gültigem x-agentur-id Header verwendet Header-Wert als agenturId-Segment', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'manager-user-id' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const pdfFile = new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' })
    const AGENTUR_UUID = '00000000-0000-0000-0000-000000000042'
    const res = await POST(makePdfRequest({ file: pdfFile, headers: { 'x-agentur-id': AGENTUR_UUID } }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.tempCvPfad).toBe(`bulk-temp/${AGENTUR_UUID}/test-uuid-1234.pdf`)
  })
})

// ── DELETE /api/ressourcen/bulk-extract ───────────────────────────────────────

describe('DELETE /api/ressourcen/bulk-extract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageRemove.mockResolvedValue({ error: null })
  })

  it('löscht eigene bulk-temp Pfade für Agentur-User', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const paths = ['bulk-temp/ag-1/file1.pdf', 'bulk-temp/ag-1/file2.pdf']
    const res = await DELETE(makeDeleteRequest(paths))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(2)
    expect(mockStorageRemove).toHaveBeenCalledWith(paths)
  })

  it('ignoriert Pfade die nicht mit bulk-temp/ beginnen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const paths = ['bulk-temp/ag-1/valid.pdf', 'other-bucket/ag-1/invalid.pdf', 'ressourcen-cvs/file.pdf']
    const res = await DELETE(makeDeleteRequest(paths))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(1)
    expect(mockStorageRemove).toHaveBeenCalledWith(['bulk-temp/ag-1/valid.pdf'])
  })

  it('Agentur-User kann keine Pfade einer fremden Agentur löschen (Cross-Tenant-Schutz)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null }) // agentur_id: 'ag-1'
    const paths = [
      'bulk-temp/ag-1/own.pdf',      // eigener Pfad
      'bulk-temp/ag-2/foreign.pdf',  // fremde Agentur
    ]
    const res = await DELETE(makeDeleteRequest(paths))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(1)
    expect(mockStorageRemove).toHaveBeenCalledWith(['bulk-temp/ag-1/own.pdf'])
  })

  it('Manager kann beliebige bulk-temp Pfade löschen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'manager-id' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const paths = [
      'bulk-temp/ag-1/file.pdf',
      'bulk-temp/ag-2/file.pdf',
      'bulk-temp/some-other-agency/file.pdf',
    ]
    const res = await DELETE(makeDeleteRequest(paths))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(3)
    expect(mockStorageRemove).toHaveBeenCalledWith(paths)
  })

  it('gibt deleted: 0 zurück wenn alle Pfade gefiltert werden', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const paths = ['bulk-temp/ag-2/foreign.pdf']
    const res = await DELETE(makeDeleteRequest(paths))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(0)
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  it('gibt 400 zurück wenn paths fehlt oder leer ist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const res = await DELETE(makeDeleteRequest([]))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('paths ist erforderlich')
  })

  it('filtert nicht-string Werte in paths still heraus', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const req = new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
      method: 'DELETE',
      body: JSON.stringify({ paths: [null, 123, 'bulk-temp/ag-1/ok.pdf'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(1)
    expect(mockStorageRemove).toHaveBeenCalledWith(['bulk-temp/ag-1/ok.pdf'])
  })
})
