# Bulk Import Ressourcen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agenturen und Manager können mehrere anonyme CVs auf einmal hochladen; Skills werden sequenziell per OpenAI extrahiert; anschließend befüllt ein Wizard-Modal pro Ressource die Pflichtfelder und speichert einzeln.

**Architecture:** Multi-Step Sheet (upload → extracting → wizard), neue API Route `POST /api/ressourcen/bulk-extract` für sequenzielle Einzelextraktion, minimale Erweiterung von `POST /api/ressourcen` um optionales `tempCvPfad`-Feld für Storage-Move nach Anlage. Keine DB-Entwürfe — nur bestätigte Ressourcen landen in der DB.

**Tech Stack:** Next.js App Router, React Hook Form + Zod, Supabase Storage, OpenAI `gpt-4o-mini` (via `lib/openai.ts`), `react-dropzone`, Tabler Icons, shadcn/ui Sheet + Dialog

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `src/app/api/ressourcen/bulk-extract/route.ts` | Neu | POST: PDF annehmen, in bulk-temp hochladen, Skills extrahieren. DELETE: temp CVs löschen |
| `src/app/api/ressourcen/bulk-extract/route.test.ts` | Neu | Tests für bulk-extract Route |
| `src/app/api/ressourcen/route.ts` | Ändern | POST: optionales `tempCvPfad` + Storage-Move + cv_pfad-Update nach Insert |
| `src/app/api/ressourcen/route.test.ts` | Ändern | Test für tempCvPfad-Pfad |
| `src/components/bulk-import-sheet.tsx` | Neu | BulkImportSheet: Upload, Extraktion, Wizard |
| `src/app/pool/page.tsx` | Ändern | "Bulk Import"-Button + State + BulkImportSheet einbinden |

---

## Task 1: `POST /api/ressourcen/bulk-extract` — API Route

**Files:**
- Create: `src/app/api/ressourcen/bulk-extract/route.ts`

- [ ] **Step 1: Datei anlegen**

```ts
// src/app/api/ressourcen/bulk-extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSkillsFromCVBuffer } from '@/lib/openai'

export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024
const LIMITS: Record<string, number> = {
  Admin: 30,
  'Staffhub Manager': 30,
  Agentur: 10,
}

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── POST /api/ressourcen/bulk-extract ─────────────────────────────────────────
// Nimmt ein einzelnes PDF, lädt es in bulk-temp hoch, extrahiert Skills.

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const allowedRollen = ['Admin', 'Staffhub Manager', 'Agentur']
  if (!allowedRollen.includes(profile.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const isManagerOrAdmin = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
  if (!isManagerOrAdmin && !profile.agentur_id) {
    return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })
  }

  const agenturId = isManagerOrAdmin
    ? (request.headers.get('x-agentur-id') ?? 'manager')
    : profile.agentur_id!

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const indexRaw = formData.get('index')
  const index = indexRaw !== null ? Number(indexRaw) : 0

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
  }

  const uuid = uuidv4()
  const tempCvPfad = `bulk-temp/${agenturId}/${uuid}.pdf`

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server-Konfigurationsfehler' }, { status: 500 })
  }

  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from('ressourcen-cvs')
    .upload(tempCvPfad, fileBuffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei' }, { status: 500 })
  }

  let skills: string[] = []
  try {
    skills = await extractSkillsFromCVBuffer(fileBuffer)
  } catch {
    // Skills-Extraktion fehlgeschlagen — leeres Array zurückgeben, Upload bleibt erhalten
    skills = []
  }

  return NextResponse.json({ tempCvPfad, skills, index })
}

// ── DELETE /api/ressourcen/bulk-extract ───────────────────────────────────────
// Löscht temp CVs (Überspringen / Sheet schließen).

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const paths: unknown = body?.paths

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: 'paths ist erforderlich' }, { status: 400 })
  }

  const validPaths = (paths as unknown[]).filter(
    (p): p is string => typeof p === 'string' && p.startsWith('bulk-temp/')
  )

  if (validPaths.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server-Konfigurationsfehler' }, { status: 500 })
  }

  await supabaseAdmin.storage.from('ressourcen-cvs').remove(validPaths)

  return NextResponse.json({ deleted: validPaths.length })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ressourcen/bulk-extract/route.ts
git commit -m "feat: add POST+DELETE /api/ressourcen/bulk-extract route"
```

---

## Task 2: Tests für bulk-extract Route

**Files:**
- Create: `src/app/api/ressourcen/bulk-extract/route.test.ts`

- [ ] **Step 1: Tests schreiben**

```ts
// src/app/api/ressourcen/bulk-extract/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
  }),
}))

vi.mock('@/lib/openai', () => ({
  extractSkillsFromCVBuffer: mockExtractSkills,
}))

vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('test-uuid-1234') }))

import { POST, DELETE } from './route'

function makePdfFormData(sizeMb = 1) {
  const buf = new Uint8Array(sizeMb * 1024 * 1024)
  const file = new File([buf], 'cv.pdf', { type: 'application/pdf' })
  const fd = new FormData()
  fd.append('file', file)
  fd.append('index', '0')
  return fd
}

function makeRequest(fd: FormData, method = 'POST') {
  return new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
    method,
    body: fd,
  })
}

const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
  mockStorageUpload.mockResolvedValue({ data: {}, error: null })
  mockExtractSkills.mockResolvedValue(['React', 'TypeScript'])
})

describe('POST /api/ressourcen/bulk-extract', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('no session') })
    const res = await POST(makeRequest(makePdfFormData()))
    expect(res.status).toBe(401)
  })

  it('returns 403 when account is deactivated', async () => {
    mockProfileSelect.mockResolvedValueOnce({ data: { ...agenturProfile, aktiv: false }, error: null })
    const res = await POST(makeRequest(makePdfFormData()))
    expect(res.status).toBe(403)
  })

  it('returns 400 for non-PDF file', async () => {
    const fd = new FormData()
    fd.append('file', new File(['data'], 'cv.docx', { type: 'application/msword' }))
    fd.append('index', '0')
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/PDF/)
  })

  it('extracts skills and returns tempCvPfad', async () => {
    const res = await POST(makeRequest(makePdfFormData()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tempCvPfad).toBe('bulk-temp/ag-1/test-uuid-1234.pdf')
    expect(body.skills).toEqual(['React', 'TypeScript'])
    expect(body.index).toBe(0)
  })

  it('returns empty skills array if OpenAI throws', async () => {
    mockExtractSkills.mockRejectedValueOnce(new Error('OpenAI error'))
    const res = await POST(makeRequest(makePdfFormData()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skills).toEqual([])
  })

  it('returns 500 if storage upload fails', async () => {
    mockStorageUpload.mockResolvedValueOnce({ data: null, error: { message: 'bucket full' } })
    const res = await POST(makeRequest(makePdfFormData()))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/ressourcen/bulk-extract', () => {
  it('deletes given bulk-temp paths', async () => {
    const req = new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
      method: 'DELETE',
      body: JSON.stringify({ paths: ['bulk-temp/ag-1/uuid.pdf'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(1)
    expect(mockStorageRemove).toHaveBeenCalledWith(['bulk-temp/ag-1/uuid.pdf'])
  })

  it('ignores paths that do not start with bulk-temp/', async () => {
    const req = new NextRequest('http://localhost/api/ressourcen/bulk-extract', {
      method: 'DELETE',
      body: JSON.stringify({ paths: ['ag-1/malicious.pdf', 'bulk-temp/ag-1/ok.pdf'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await DELETE(req)
    const body = await res.json()
    expect(body.deleted).toBe(1)
    expect(mockStorageRemove).toHaveBeenCalledWith(['bulk-temp/ag-1/ok.pdf'])
  })
})
```

- [ ] **Step 2: Tests ausführen und grün bekommen**

```bash
npx vitest run src/app/api/ressourcen/bulk-extract/route.test.ts
```

Erwartetes Ergebnis: alle Tests grün.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ressourcen/bulk-extract/route.test.ts
git commit -m "test: add bulk-extract route tests"
```

---

## Task 3: `POST /api/ressourcen` — tempCvPfad-Erweiterung

**Files:**
- Modify: `src/app/api/ressourcen/route.ts`

- [ ] **Step 1: Schema um `tempCvPfad` erweitern**

In `src/app/api/ressourcen/route.ts`, im `createRessourceSchema`:

Alt:
```ts
const createRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().max(200).nullable().optional(),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']).optional(),
  location: z.string().max(200).nullable().optional(),
}).refine(
```

Neu:
```ts
const createRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().max(200).nullable().optional(),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']).optional(),
  location: z.string().max(200).nullable().optional(),
  tempCvPfad: z.string().max(500).optional(),
}).refine(
```

- [ ] **Step 2: Nach dem `ressource`-Insert den CV-Move einbauen**

Direkt nach dem `if (error)` Block des Inserts (vor `return NextResponse.json({ ressource }, { status: 201 })`):

```ts
  // Temp CV von bulk-temp/ in finalen Pfad verschieben
  if (parsed.data.tempCvPfad) {
    const finalCvPfad = `${agenturId}/${ressource.id}.pdf`
    const { error: moveError } = await supabaseAdmin.storage
      .from('ressourcen-cvs')
      .move(parsed.data.tempCvPfad, finalCvPfad)

    if (!moveError) {
      await supabaseAdmin
        .from('ressourcen')
        .update({ cv_pfad: finalCvPfad })
        .eq('id', ressource.id)
    }
  }
```

- [ ] **Step 3: Bestehende Tests sicherstellen**

```bash
npx vitest run src/app/api/ressourcen/route.test.ts
```

Erwartetes Ergebnis: alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Test für tempCvPfad-Pfad hinzufügen**

In `src/app/api/ressourcen/route.test.ts` einen neuen Mock `mockStorageMove` ergänzen und folgenden Test hinzufügen (im `POST`-`describe`-Block):

Oben in den `vi.hoisted`-Block `mockStorageMove: vi.fn()` hinzufügen.

Im Admin-Mock das `storage`-Objekt ergänzen:
```ts
// Im createAdminClient Mock:
storage: {
  from: vi.fn().mockReturnValue({
    upload: mockAdminStorageUpload, // falls vorhanden, sonst weglassen
    move: mockStorageMove,
  }),
},
```

Test:
```ts
it('moves temp CV to final path after insert when tempCvPfad provided', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
  mockProfileSelect.mockResolvedValueOnce({ data: managerProfile, error: null })
  mockAdminRessourcenSelect.mockResolvedValueOnce({
    data: [{ ressource_code: 'D3XP0001' }], error: null,
  })
  mockAdminInsert.mockResolvedValueOnce({
    data: { id: 'res-1', name: 'Test', verfuegbarkeit: 'Verfügbar ab', created_at: '2026-06-09' },
    error: null,
  })
  mockStorageMove.mockResolvedValueOnce({ error: null })

  const body = {
    agentur_id: 'ag-1',
    name: 'Test Ressource',
    rolle: 'Entwickler',
    skills: ['React'],
    erfahrungslevel: 'Mid',
    verfuegbarkeit: 'Verfügbar ab',
    verfuegbar_ab: '2026-07-01',
    tempCvPfad: 'bulk-temp/ag-1/uuid.pdf',
  }

  const req = new NextRequest('http://localhost/api/ressourcen', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await POST(req)
  expect(res.status).toBe(201)
  expect(mockStorageMove).toHaveBeenCalledWith(
    'bulk-temp/ag-1/uuid.pdf',
    'ag-1/res-1.pdf'
  )
})
```

- [ ] **Step 5: Tests ausführen**

```bash
npx vitest run src/app/api/ressourcen/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ressourcen/route.ts src/app/api/ressourcen/route.test.ts
git commit -m "feat: extend POST /api/ressourcen with optional tempCvPfad storage move"
```

---

## Task 4: `BulkImportSheet` — Upload- und Extraktionsphase

**Files:**
- Create: `src/components/bulk-import-sheet.tsx`

- [ ] **Step 1: Hilfsfunktion + Types + Upload-Phase anlegen**

```tsx
// src/components/bulk-import-sheet.tsx
'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import {
  IconFile,
  IconUpload,
  IconX,
  IconLoader2,
  IconFileImport,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'extracting' | 'wizard'

interface ExtractedItem {
  tempCvPfad: string
  skills: string[]
  originalFileName: string
}

interface BulkImportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  isManagerOrAdmin: boolean
  agenturId: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getFirstOfNextMonth(): string {
  const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  return next.toISOString().split('T')[0]
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

// ── UploadPhase ────────────────────────────────────────────────────────────────

interface UploadPhaseProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  onStart: () => void
  maxFiles: number
}

function UploadPhase({ files, onFilesChange, onStart, maxFiles }: UploadPhaseProps) {
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setValidationError(null)
      const combined = [...files, ...accepted]

      const oversized = combined.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setValidationError(`${oversized.length} Datei(en) überschreiten 10 MB.`)
        return
      }
      if (combined.length > maxFiles) {
        setValidationError(`Maximal ${maxFiles} PDFs erlaubt.`)
        return
      }
      onFilesChange(combined)
    },
    [files, maxFiles, onFilesChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  })

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : validationError
            ? 'border-destructive bg-destructive/5'
            : 'border-input hover:border-primary/50 hover:bg-muted/40'
        }`}
      >
        <input {...getInputProps()} />
        <IconUpload className="size-6 text-muted-foreground" />
        <div>
          <span className="font-medium">PDFs hier ablegen</span>
          <span className="text-muted-foreground"> oder klicken zum Auswählen</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Nur PDF, max. 10 MB pro Datei · max. {maxFiles} Dateien
        </p>
      </div>

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
            >
              <IconFile className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">
                {(f.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        disabled={files.length === 0}
        onClick={onStart}
      >
        <IconFileImport className="size-4" />
        {files.length > 0 ? `${files.length} PDF${files.length > 1 ? 's' : ''} importieren` : 'Importieren'}
      </Button>
    </div>
  )
}

// ── ExtractionPhase ────────────────────────────────────────────────────────────

interface ExtractionPhaseProps {
  current: number
  total: number
}

function ExtractionPhase({ current, total }: ExtractionPhaseProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <IconLoader2 className="size-8 text-primary animate-spin" />
      </div>
      <div className="w-full space-y-2 text-center">
        <p className="font-medium">PDF {current} von {total} wird analysiert…</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pct}%</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit Teilstand**

```bash
git add src/components/bulk-import-sheet.tsx
git commit -m "feat: add BulkImportSheet upload + extraction phase UI"
```

---

## Task 5: `BulkImportSheet` — Wizard-Phase + Hauptkomponente

**Files:**
- Modify: `src/components/bulk-import-sheet.tsx`

- [ ] **Step 1: Wizard-Formular-Komponente anhängen**

Am Ende der Datei `src/components/bulk-import-sheet.tsx` nach der `ExtractionPhase`-Komponente einfügen:

```tsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ERFAHRUNGSLEVEL, ARBEITSMODELL } from '@/lib/constants'

const wizardSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().min(1, 'Rolle ist erforderlich').max(200),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich'),
  verfuegbar_ab: z.string().min(1, 'Datum ist erforderlich'),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']),
  ek_tagesrate: z.string().optional(),
})

type WizardFormData = z.infer<typeof wizardSchema>

interface WizardFormProps {
  item: ExtractedItem
  index: number
  total: number
  agenturId: string | null
  isManagerOrAdmin: boolean
  onConfirm: (tempCvPfad: string) => void
  onSkip: (tempCvPfad: string) => void
}

function WizardForm({ item, index, total, agenturId, isManagerOrAdmin, onConfirm, onSkip }: WizardFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [skillInput, setSkillInput] = React.useState('')
  const [skills, setSkills] = React.useState<string[]>(item.skills)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: '',
      rolle: '',
      erfahrungslevel: undefined,
      skills: item.skills,
      verfuegbar_ab: getFirstOfNextMonth(),
      arbeitsmodell: 'Onshore',
      ek_tagesrate: '',
    },
  })

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed])
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  async function onSubmit(data: WizardFormData) {
    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: data.name,
        rolle: data.rolle,
        erfahrungslevel: data.erfahrungslevel,
        skills,
        verfuegbarkeit: 'Verfügbar ab',
        verfuegbar_ab: data.verfuegbar_ab,
        arbeitsmodell: data.arbeitsmodell,
        tempCvPfad: item.tempCvPfad,
      }
      if (data.ek_tagesrate) {
        body.ek_tagesrate = parseFloat(data.ek_tagesrate)
      }
      if (isManagerOrAdmin && agenturId) {
        body.agentur_id = agenturId
      }

      const res = await fetch('/api/ressourcen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Fehler beim Anlegen der Ressource')
        return
      }

      onConfirm(item.tempCvPfad)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Ressource {index + 1} von {total}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{item.originalFileName}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round(((index) / total) * 100)}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="wiz-name">Name <span className="text-destructive">*</span></Label>
          <Input id="wiz-name" placeholder="z.B. Kandidat A" {...register('name')}
            className={errors.name ? 'border-destructive' : ''} disabled={isSubmitting} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Rolle */}
        <div className="space-y-1.5">
          <Label htmlFor="wiz-rolle">Rolle <span className="text-destructive">*</span></Label>
          <Input id="wiz-rolle" placeholder="z.B. Frontend Developer" {...register('rolle')}
            className={errors.rolle ? 'border-destructive' : ''} disabled={isSubmitting} />
          {errors.rolle && <p className="text-xs text-destructive">{errors.rolle.message}</p>}
        </div>

        {/* Erfahrungslevel */}
        <div className="space-y-1.5">
          <Label>Erfahrungslevel <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="erfahrungslevel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger className={errors.erfahrungslevel ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Bitte wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {ERFAHRUNGSLEVEL.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.erfahrungslevel && <p className="text-xs text-destructive">{errors.erfahrungslevel.message}</p>}
        </div>

        {/* Skills */}
        <div className="space-y-1.5">
          <Label>Skills <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input
              placeholder="Skill hinzufügen…"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
              disabled={isSubmitting}
            />
            <Button type="button" variant="outline" size="sm" onClick={addSkill} disabled={isSubmitting}>
              +
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button type="button" onClick={() => removeSkill(s)} className="hover:text-destructive">
                  <IconX className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          {skills.length === 0 && (
            <p className="text-xs text-destructive">Mindestens ein Skill erforderlich</p>
          )}
        </div>

        {/* Verfügbar ab */}
        <div className="space-y-1.5">
          <Label htmlFor="wiz-datum">Verfügbar ab <span className="text-destructive">*</span></Label>
          <Input id="wiz-datum" type="date" {...register('verfuegbar_ab')}
            className={errors.verfuegbar_ab ? 'border-destructive' : ''} disabled={isSubmitting} />
          {errors.verfuegbar_ab && <p className="text-xs text-destructive">{errors.verfuegbar_ab.message}</p>}
        </div>

        {/* Arbeitsmodell */}
        <div className="space-y-1.5">
          <Label>Arbeitsmodell</Label>
          <Controller
            control={control}
            name="arbeitsmodell"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARBEITSMODELL.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* EK-Tagesrate */}
        <div className="space-y-1.5">
          <Label htmlFor="wiz-rate">EK-Tagesrate (€)</Label>
          <Input id="wiz-rate" type="number" min="0" step="0.01"
            placeholder="Optional" {...register('ek_tagesrate')} disabled={isSubmitting} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" disabled={isSubmitting}
            onClick={() => onSkip(item.tempCvPfad)}>
            Überspringen
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting || skills.length === 0}>
            {isSubmitting ? (
              <><IconLoader2 className="size-4 animate-spin" /> Wird angelegt…</>
            ) : (
              'Ressource anlegen & weiter'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Hauptkomponente `BulkImportSheet` anhängen**

Am Ende der Datei einfügen:

```tsx
// ── BulkImportSheet ────────────────────────────────────────────────────────────

export function BulkImportSheet({
  open,
  onOpenChange,
  onSuccess,
  isManagerOrAdmin,
  agenturId,
}: BulkImportSheetProps) {
  const [phase, setPhase] = React.useState<Phase>('upload')
  const [files, setFiles] = React.useState<File[]>([])
  const [extractedItems, setExtractedItems] = React.useState<ExtractedItem[]>([])
  const [extractionProgress, setExtractionProgress] = React.useState(0)
  const [wizardIndex, setWizardIndex] = React.useState(0)
  const [confirmedCount, setConfirmedCount] = React.useState(0)
  const [skippedPaths, setSkippedPaths] = React.useState<string[]>([])
  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false)

  const maxFiles = isManagerOrAdmin ? 30 : 10

  const resetState = () => {
    setPhase('upload')
    setFiles([])
    setExtractedItems([])
    setExtractionProgress(0)
    setWizardIndex(0)
    setConfirmedCount(0)
    setSkippedPaths([])
  }

  const cleanupPaths = async (paths: string[]) => {
    if (paths.length === 0) return
    await fetch('/api/ressourcen/bulk-extract', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
  }

  const handleStartExtraction = async () => {
    setPhase('extracting')
    setExtractionProgress(0)

    const results: ExtractedItem[] = []

    for (let i = 0; i < files.length; i++) {
      setExtractionProgress(i + 1)
      const fd = new FormData()
      fd.append('file', files[i])
      fd.append('index', String(i))

      try {
        const res = await fetch('/api/ressourcen/bulk-extract', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          results.push({
            tempCvPfad: data.tempCvPfad,
            skills: data.skills ?? [],
            originalFileName: files[i].name,
          })
        } else {
          toast.error(`Fehler bei ${files[i].name} — wird übersprungen`)
        }
      } catch {
        toast.error(`Fehler bei ${files[i].name} — wird übersprungen`)
      }
    }

    if (results.length === 0) {
      toast.error('Keine CVs konnten verarbeitet werden.')
      resetState()
      return
    }

    setExtractedItems(results)
    setWizardIndex(0)
    setPhase('wizard')
  }

  const handleConfirm = (_tempCvPfad: string) => {
    setConfirmedCount((c) => c + 1)
    advanceWizard()
  }

  const handleSkip = (tempCvPfad: string) => {
    setSkippedPaths((prev) => [...prev, tempCvPfad])
    advanceWizard()
  }

  const advanceWizard = () => {
    const nextIndex = wizardIndex + 1
    if (nextIndex >= extractedItems.length) {
      finishWizard(confirmedCount + (skippedPaths.length < extractedItems.length ? 0 : 0))
    } else {
      setWizardIndex(nextIndex)
    }
  }

  const finishWizard = async (finalConfirmedCount: number) => {
    await cleanupPaths(skippedPaths)
    const skipped = extractedItems.length - finalConfirmedCount
    toast.success(
      `${finalConfirmedCount} Ressource${finalConfirmedCount !== 1 ? 'n' : ''} importiert${skipped > 0 ? `, ${skipped} übersprungen` : ''}.`
    )
    onSuccess()
    resetState()
    onOpenChange(false)
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (!open && phase === 'wizard' && confirmedCount === 0 && wizardIndex < extractedItems.length) {
      setCloseConfirmOpen(true)
      return
    }
    if (!open && phase === 'wizard') {
      setCloseConfirmOpen(true)
      return
    }
    if (!open) {
      resetState()
    }
    onOpenChange(open)
  }

  const handleForceClose = async () => {
    const remainingPaths = extractedItems
      .slice(wizardIndex)
      .map((i) => i.tempCvPfad)
      .concat(skippedPaths)
    await cleanupPaths(remainingPaths)

    if (confirmedCount > 0) {
      toast.success(`${confirmedCount} Ressource${confirmedCount !== 1 ? 'n' : ''} wurden bereits angelegt.`)
      onSuccess()
    }
    setCloseConfirmOpen(false)
    resetState()
    onOpenChange(false)
  }

  const currentItem = extractedItems[wizardIndex]

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bulk Import</SheetTitle>
            <SheetDescription>
              {phase === 'upload' && 'Mehrere CVs auf einmal hochladen und importieren.'}
              {phase === 'extracting' && 'Lebensläufe werden analysiert…'}
              {phase === 'wizard' && 'Pflichtfelder pro Ressource ergänzen.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {phase === 'upload' && (
              <UploadPhase
                files={files}
                onFilesChange={setFiles}
                onStart={handleStartExtraction}
                maxFiles={maxFiles}
              />
            )}

            {phase === 'extracting' && (
              <ExtractionPhase current={extractionProgress} total={files.length} />
            )}

            {phase === 'wizard' && currentItem && (
              <WizardForm
                item={currentItem}
                index={wizardIndex}
                total={extractedItems.length}
                agenturId={agenturId}
                isManagerOrAdmin={isManagerOrAdmin}
                onConfirm={handleConfirm}
                onSkip={handleSkip}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import abbrechen?</DialogTitle>
            <DialogDescription>
              {confirmedCount > 0
                ? `${confirmedCount} Ressource${confirmedCount !== 1 ? 'n' : ''} wurden bereits angelegt. Verbleibende werden verworfen.`
                : 'Keine Ressource wurde bisher angelegt. Alle temp Dateien werden gelöscht.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>
              Weitermachen
            </Button>
            <Button variant="destructive" onClick={handleForceClose}>
              Schließen & verwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Imports oben in der Datei konsolidieren**

Die `import`-Statements von `react-hook-form`, `zod`, `Badge`, `Select`, `Input`, `Label`, `ERFAHRUNGSLEVEL`, `ARBEITSMODELL` müssen oben in der Datei stehen (nicht in der Mitte). Die finale Import-Sektion oben soll lauten:

```tsx
'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  IconFile,
  IconUpload,
  IconX,
  IconLoader2,
  IconFileImport,
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ERFAHRUNGSLEVEL, ARBEITSMODELL } from '@/lib/constants'
```

- [ ] **Step 4: TypeScript-Check**

```bash
npx tsc --noEmit 2>&1 | grep bulk-import
```

Erwartetes Ergebnis: keine Fehler in `bulk-import-sheet.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/bulk-import-sheet.tsx
git commit -m "feat: add BulkImportSheet wizard phase and main component"
```

---

## Task 6: Bulk Import in Pool-Seite einbinden

**Files:**
- Modify: `src/app/pool/page.tsx`

- [ ] **Step 1: Import hinzufügen**

In `src/app/pool/page.tsx` ganz oben bei den anderen Komponenten-Imports:

```tsx
import { BulkImportSheet } from '@/components/bulk-import-sheet'
```

- [ ] **Step 2: State hinzufügen**

Im `PoolPage`-Komponent direkt nach `const [poolFormSheetOpen, setPoolFormSheetOpen] = React.useState(false)`:

```tsx
const [bulkImportOpen, setBulkImportOpen] = React.useState(false)
```

- [ ] **Step 3: Button hinzufügen**

Den bestehenden "Neue Ressource"-Button-Block suchen:

```tsx
<Button
  size="sm"
  onClick={() => {
    setPoolFormSheetOpen(true)
  }}
>
  <IconPlus className="size-4" />
  Neue Ressource
</Button>
```

Ersetzen durch:

```tsx
<div className="flex gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={() => setBulkImportOpen(true)}
  >
    <IconFileImport className="size-4" />
    Bulk Import
  </Button>
  <Button
    size="sm"
    onClick={() => {
      setPoolFormSheetOpen(true)
    }}
  >
    <IconPlus className="size-4" />
    Neue Ressource
  </Button>
</div>
```

`IconFileImport` muss oben beim Tabler-Icons-Import ergänzt werden:

```tsx
import {
  // ... bestehende Icons ...
  IconFileImport,
} from '@tabler/icons-react'
```

- [ ] **Step 4: BulkImportSheet einbinden**

Direkt neben dem `<ResourcePoolFormSheet ...` Block (am Ende der JSX, kurz vor dem letzten `</SidebarProvider>`):

```tsx
<BulkImportSheet
  open={bulkImportOpen}
  onOpenChange={setBulkImportOpen}
  onSuccess={fetchRessourcen}
  isManagerOrAdmin={isManager}
  agenturId={user?.agentur_id ?? null}
/>
```

> `fetchRessourcen` ist die bestehende Funktion die `setRessourcen` befüllt — falls sie anders heißt, den korrekten Namen aus dem bestehenden Code verwenden.

- [ ] **Step 5: TypeScript-Check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Erwartetes Ergebnis: keine neuen Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: add Bulk Import button and sheet to pool page"
```

---

## Task 7: advanceWizard-Bug fixen + Ende-Logik prüfen

Die `advanceWizard`-Funktion in `BulkImportSheet` hat einen Logikfehler: sie prüft `confirmedCount` vor dem State-Update. Die korrekte Version:

**Files:**
- Modify: `src/components/bulk-import-sheet.tsx`

- [ ] **Step 1: advanceWizard korrigieren**

Die `advanceWizard`-Funktion so anpassen, dass sie die updated Counts direkt übergeben bekommt:

```tsx
const handleConfirm = (_tempCvPfad: string) => {
  const newConfirmedCount = confirmedCount + 1
  setConfirmedCount(newConfirmedCount)
  const nextIndex = wizardIndex + 1
  if (nextIndex >= extractedItems.length) {
    finishWizard(newConfirmedCount, [...skippedPaths])
  } else {
    setWizardIndex(nextIndex)
  }
}

const handleSkip = (tempCvPfad: string) => {
  const newSkipped = [...skippedPaths, tempCvPfad]
  setSkippedPaths(newSkipped)
  const nextIndex = wizardIndex + 1
  if (nextIndex >= extractedItems.length) {
    finishWizard(confirmedCount, newSkipped)
  } else {
    setWizardIndex(nextIndex)
  }
}

const finishWizard = async (finalConfirmedCount: number, finalSkippedPaths: string[]) => {
  await cleanupPaths(finalSkippedPaths)
  const skipped = extractedItems.length - finalConfirmedCount
  toast.success(
    `${finalConfirmedCount} Ressource${finalConfirmedCount !== 1 ? 'n' : ''} importiert${skipped > 0 ? `, ${skipped} übersprungen` : ''}.`
  )
  onSuccess()
  resetState()
  onOpenChange(false)
}
```

Die alte `advanceWizard`-Funktion und den alten `finishWizard`-Block entfernen.

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit 2>&1 | grep bulk-import
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bulk-import-sheet.tsx
git commit -m "fix: correct wizard advance and finish logic in BulkImportSheet"
```

---

## Self-Review

**Spec-Coverage:**
- [x] Upload-Phase mit Dropzone, Dateiliste, Limits → Task 4
- [x] Sequenzielle Extraktion mit Fortschritt → Task 4 + 5
- [x] Wizard-Formular mit allen Feldern (Name, Rolle Pflicht) → Task 5
- [x] Default Verfügbarkeit = 1. nächster Monat → `getFirstOfNextMonth()` Task 5
- [x] "Anlegen & weiter" → POST /api/ressourcen + tempCvPfad move → Task 3 + 5
- [x] "Überspringen" → cleanup → Task 5
- [x] Sheet schließen → Bestätigungs-Dialog → Task 5
- [x] Toast am Ende → Task 5
- [x] Ressourcen-Liste refresh → Task 6
- [x] Limits 10/30 → Task 1 + 4
- [x] Pro PDF max 10 MB → Task 1 + 4
- [x] Bulk-Import-Button in Pool-Seite → Task 6
- [x] DELETE cleanup-Endpoint → Task 1

**Keine Placeholders gefunden.**

**Typkonsistenz:** `ExtractedItem`, `WizardFormData`, `BulkImportSheetProps` konsistent durch alle Tasks. `finishWizard(count, paths)` Signatur in Task 5 + Task 7 angepasst.
