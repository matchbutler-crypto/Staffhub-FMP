# External API Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bestehende `/api/external/v1/`-Routen durch eine saubere Zwei-Layer-Struktur unter `demand/v1.0/` und `supply/v1.0/` ersetzen.

**Architecture:** Neue Next.js-Routen unter `src/app/demand/v1.0/` (Vakanzen + Matching) und `src/app/supply/v1.0/` (Profile). Das Subdomain `api.staffhub.digital` zeigt in Vercel auf dasselbe Deployment — kein Middleware-Rewriting nötig. Auth-Logik, Permissions und DB-Queries bleiben unverändert.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Service Role), Zod, Vitest

## Global Constraints

- Kein Bcrypt, keine neuen Dependencies — ausschließlich bestehende Imports
- Auth immer via `validateExternalApiKey(request, permission)` aus `@/lib/external-api-auth`
- Supabase-Zugriff ausschließlich über `createServiceRoleClient()` aus `@/lib/supabase/service-role`
- Zod für alle Request-Body-Validierungen
- `params` ist in Next.js 15 ein `Promise<{...}>` — immer `await params` verwenden
- Tests mit Vitest, `vi.hoisted` für Mock-Factories, `vi.mock` für Module
- Alle neuen Routendateien ohne Kommentar-Header (keine `// src/app/...`-Zeilen)

---

### Task 1: Demand — GET /vakanzen + POST /vakanzen

**Files:**
- Create: `src/app/demand/v1.0/vakanzen/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey` aus `@/lib/external-api-auth`, `createServiceRoleClient` aus `@/lib/supabase/service-role`
- Produces: `GET` und `POST` Handler — werden von Task 2–4 nicht direkt importiert, aber das Dateistruktur-Muster gilt für alle

- [ ] **Step 1: Verzeichnis anlegen und Test schreiben**

Erstelle `src/app/demand/v1.0/vakanzen/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVakanzenSelect, mockInsert } = vi.hoisted(() => ({
  mockVakanzenSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn(() => ({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockVakanzenSelect().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockInsert }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET, POST } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

function makeGetRequest() {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen', {
    headers: { 'x-api-key': 'test-key' },
  })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

const validVakanz = {
  branche: 'IT', rolle: 'Frontend Engineer',
  beschreibung: 'React-Projekt', skills: ['React'],
  erfahrungslevel: 'Senior', startdatum: '2026-07-01',
  enddatum: '2026-12-31', fte_anzahl: 1, arbeitsmodell: 'Remote',
  budget_intern: 800,
}

describe('GET /demand/v1.0/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück bei fehlendem API-Key', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('gibt Vakanzen-Liste zurück', async () => {
    mockVakanzenSelect.mockResolvedValue({
      data: [{ id: 'v1', rolle: 'Dev', status: 'Offen', published: true }],
      error: null,
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanzen).toHaveLength(1)
  })
})

describe('POST /demand/v1.0/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei fehlendem Pflichtfeld zurück', async () => {
    const res = await POST(makePostRequest({ rolle: 'Dev' }))
    expect(res.status).toBe(400)
  })

  it('erstellt Vakanz und gibt 201 zurück', async () => {
    mockInsert.mockResolvedValue({
      data: { id: 'new-v', vakanz_nr: 42, rolle: 'Frontend Engineer', status: 'Offen' },
      error: null,
    })
    const res = await POST(makePostRequest(validVakanz))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.vakanz.id).toBe('new-v')
  })
})
```

- [ ] **Step 2: Test ausführen — muss FAIL sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/route.test.ts
```

Erwartung: FAIL mit „Cannot find module './route'"

- [ ] **Step 3: Route implementieren**

Erstelle `src/app/demand/v1.0/vakanzen/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const createVakanzSchema = z.object({
  branche: z.string().min(1),
  kunde: z.string().nullable().optional(),
  rolle: z.string().min(1),
  beschreibung: z.string().min(1),
  skills: z.array(z.string()).min(1).max(20),
  skills_nice_have: z.array(z.string()).max(20).optional().default([]),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  startdatum: z.string().min(1),
  enddatum: z.string().min(1),
  teamgroesse: z.number().int().min(1).nullable().optional(),
  fte_anzahl: z.number().min(0.1),
  auslastung: z.number().int().min(1).max(100).optional().default(100),
  arbeitsmodell: z.enum(['Remote', 'Hybrid', 'Onsite']),
  onsite_anteil: z.number().int().min(0).max(100).nullable().optional(),
  ansprechpartner: z.string().nullable().optional(),
  standort: z.string().nullable().optional(),
  budget_intern: z.number().positive(),
  weitere_kommentare: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen')
    .select('id, vakanz_nr, branche, kunde, rolle, status, published, published_at, startdatum, enddatum, fte_anzahl, arbeitsmodell, erfahrungslevel, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Vakanzen' }, { status: 500 })
  return NextResponse.json({ vakanzen: data ?? [] })
}

export async function POST(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:create')
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = createVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .insert({
      ...parsed.data,
      skills_nice_have: parsed.data.skills_nice_have ?? [],
      status: 'Offen',
    })
    .select('id, vakanz_nr, rolle, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Erstellen der Vakanz' }, { status: 500 })
  return NextResponse.json({ vakanz: data }, { status: 201 })
}
```

- [ ] **Step 4: Test ausführen — muss PASS sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/route.test.ts
```

Erwartung: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/demand/v1.0/vakanzen/route.ts src/app/demand/v1.0/vakanzen/route.test.ts
git commit -m "feat: demand GET/POST /vakanzen"
```

---

### Task 2: Demand — GET /vakanzen/{id} + PATCH /vakanzen/{id}

**Files:**
- Create: `src/app/demand/v1.0/vakanzen/[id]/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces: `GET` und `PATCH` Handler mit `{ params: Promise<{ id: string }> }`

- [ ] **Step 1: Test schreiben**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSelect }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockUpdate }),
            }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET, PATCH } from './route'

const params = Promise.resolve({ id: 'vakanz-uuid' })

function makeRequest(method = 'GET', body?: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid', {
    method,
    headers: { 'x-api-key': 'test-key', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('GET /demand/v1.0/vakanzen/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('gibt Vakanz zurück', async () => {
    mockSelect.mockResolvedValue({ data: { id: 'vakanz-uuid', rolle: 'Dev' }, error: null })
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.id).toBe('vakanz-uuid')
  })
})

describe('PATCH /demand/v1.0/vakanzen/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei leerem Body zurück', async () => {
    const res = await PATCH(makeRequest('PATCH', {}), { params })
    expect(res.status).toBe(400)
  })

  it('aktualisiert Vakanz', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid', status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest('PATCH', { status: 'Besetzt' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Besetzt')
  })
})
```

- [ ] **Step 2: Test ausführen — muss FAIL sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/route.test.ts
```

Erwartung: FAIL mit „Cannot find module './route'"

- [ ] **Step 3: Route implementieren**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const updateVakanzSchema = z.object({
  status: z.enum(['Offen', 'Besetzt', 'Storniert']).optional(),
  beschreibung: z.string().min(1).optional(),
  budget_intern: z.number().positive().optional(),
  skills: z.array(z.string()).min(1).max(20).optional(),
  sourcing_erlaubt: z.boolean().optional(),
}).refine(
  d => Object.values(d).some(v => v !== undefined),
  { message: 'Mindestens ein Feld muss angegeben werden' }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('vakanzen')
    .select('id, vakanz_nr, branche, kunde, rolle, beschreibung, status, published, published_at, skills, skills_nice_have, erfahrungslevel, startdatum, enddatum, fte_anzahl, auslastung, arbeitsmodell, onsite_anteil, standort, ansprechpartner, budget_intern, weitere_kommentare, sourcing_erlaubt, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateVakanzSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .update(parsed.data)
    .eq('id', id)
    .select('id, vakanz_nr, rolle, status, published, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}
```

- [ ] **Step 4: Test ausführen — muss PASS sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/route.test.ts
```

Erwartung: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/demand/v1.0/vakanzen/\[id\]/route.ts src/app/demand/v1.0/vakanzen/\[id\]/route.test.ts
git commit -m "feat: demand GET/PATCH /vakanzen/{id}"
```

---

### Task 3: Demand — PATCH /vakanzen/{id}/publish

**Files:**
- Create: `src/app/demand/v1.0/vakanzen/[id]/publish/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/publish/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces: `PATCH` Handler mit `{ params: Promise<{ id: string }> }`

- [ ] **Step 1: Test schreiben**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/publish/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockStatusSelect, mockUpdate } = vi.hoisted(() => ({
  mockStatusSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockStatusSelect }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { PATCH } from './route'

const params = Promise.resolve({ id: 'vakanz-uuid' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/publish', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /demand/v1.0/vakanzen/{id}/publish', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Body zurück', async () => {
    const res = await PATCH(makeRequest({ published: 'ja' }), { params })
    expect(res.status).toBe(400)
  })

  it('gibt 422 wenn Vakanz besetzt ist und published=true', async () => {
    mockStatusSelect.mockResolvedValue({ data: { status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest({ published: true }), { params })
    expect(res.status).toBe(422)
  })

  it('veröffentlicht Vakanz', async () => {
    mockStatusSelect.mockResolvedValue({ data: { status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'vakanz-uuid' }, error: null })
    const res = await PATCH(makeRequest({ published: true }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.published).toBe(true)
  })
})
```

- [ ] **Step 2: Test ausführen — muss FAIL sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/publish/route.test.ts
```

Erwartung: FAIL mit „Cannot find module './route'"

- [ ] **Step 3: Route implementieren**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/publish/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const publishSchema = z.object({ published: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (parsed.data.published === true) {
    const { data: vakanz } = await supabase
      .from('vakanzen_data')
      .select('status')
      .eq('id', id)
      .single()

    if (vakanz?.status === 'Besetzt') {
      return NextResponse.json({ error: 'Besetzte Vakanzen können nicht veröffentlicht werden' }, { status: 422 })
    }
  }

  const { data: updated, error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ published: parsed.data.published })
}
```

- [ ] **Step 4: Test ausführen — muss PASS sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/publish/route.test.ts
```

Erwartung: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/demand/v1.0/vakanzen/\[id\]/publish/
git commit -m "feat: demand PATCH /vakanzen/{id}/publish"
```

---

### Task 4: Demand — GET /vakanzen/{id}/vorschlaege + PATCH /{matchId}

**Files:**
- Create: `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/route.test.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/[matchId]/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/[matchId]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces:
  - `GET` Handler mit `{ params: Promise<{ id: string }> }` → `{ vorschlaege: [...] }`
  - `PATCH` Handler mit `{ params: Promise<{ id: string; matchId: string }> }` → `{ vorschlag: {...} }`

- [ ] **Step 1: Test für GET /vorschlaege schreiben**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinks, mockScores } = vi.hoisted(() => ({
  mockLinks: vi.fn(),
  mockScores: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn(() => ({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockLinks().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockScores().then(resolve, reject),
            })),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

const params = Promise.resolve({ id: 'vakanz-uuid' })

describe('GET /demand/v1.0/vakanzen/{id}/vorschlaege', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Vorschläge', async () => {
    mockLinks.mockResolvedValue({ data: [], error: null })
    mockScores.mockResolvedValue({ data: [], error: null })
    const req = new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege).toHaveLength(0)
  })

  it('gibt Vorschläge mit Score zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{
        id: 'link-1', status: 'Gespielt',
        ressourcen: { id: 'r1', name: 'Anna', ek_tagesrate: 800, agenturen: { name: 'Agentur X' } },
      }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [{ ressource_id: 'r1', vakanz_id: 'vakanz-uuid', score: 87 }], error: null })
    const req = new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege[0].match_id).toBe('link-1')
    expect(json.vorschlaege[0].matching_score).toBe(87)
  })
})
```

- [ ] **Step 2: Test für PATCH /{matchId} schreiben**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/[matchId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFetch, mockUpdate } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockFetch }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { PATCH } from './route'

const params = Promise.resolve({ id: 'vakanz-uuid', matchId: 'match-uuid' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/demand/v1.0/vakanzen/vakanz-uuid/vorschlaege/match-uuid', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /demand/v1.0/vakanzen/{id}/vorschlaege/{matchId}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(makeRequest({ status: 'Interessiert' }), { params })
    expect(res.status).toBe(400)
  })

  it('gibt 404 wenn Vorschlag nicht gefunden', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest({ status: 'Zugesagt' }), { params })
    expect(res.status).toBe(404)
  })

  it('setzt Status auf Zugesagt', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'match-uuid', status: 'Gespielt' }, error: null })
    mockUpdate.mockResolvedValue({ data: { id: 'match-uuid', status: 'Zugesagt', updated_at: '2026-06-17T10:00:00Z' }, error: null })
    const res = await PATCH(makeRequest({ status: 'Zugesagt' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlag.status).toBe('Zugesagt')
  })
})
```

- [ ] **Step 3: Tests ausführen — müssen FAIL sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/vorschlaege/
```

Erwartung: FAIL mit „Cannot find module './route'" für beide

- [ ] **Step 4: GET /vorschlaege implementieren**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:read')
  if (authError) return authError

  const { id: vakanzId } = await params
  const supabase = createServiceRoleClient()

  const [linksResult, scoresResult] = await Promise.all([
    supabase
      .from('ressource_vakanz_links')
      .select('id, status, ressourcen!inner(id, name, ek_tagesrate, agenturen(name))')
      .eq('vakanz_id', vakanzId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ressource_ki_scores')
      .select('ressource_id, vakanz_id, score')
      .eq('vakanz_id', vakanzId),
  ])

  if (linksResult.error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Vorschläge' }, { status: 500 })
  }

  const scoreMap = new Map<string, number>(
    (scoresResult.data ?? []).map((s) => [s.ressource_id, s.score])
  )

  const vorschlaege = (linksResult.data ?? []).map((link) => {
    const ressource = link.ressourcen as unknown as {
      id: string; name: string; ek_tagesrate: number | null
      agenturen: { name: string } | { name: string }[] | null
    }
    const agenturRaw = ressource?.agenturen
    const agentur = Array.isArray(agenturRaw) ? agenturRaw[0]?.name : agenturRaw?.name

    return {
      match_id: link.id,
      status: link.status,
      name: ressource.name,
      agentur: agentur ?? null,
      ek_tagesrate: ressource.ek_tagesrate,
      matching_score: scoreMap.get(ressource.id) ?? null,
    }
  })

  return NextResponse.json({ vorschlaege })
}
```

- [ ] **Step 5: PATCH /{matchId} implementieren**

Erstelle `src/app/demand/v1.0/vakanzen/[id]/vorschlaege/[matchId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const statusSchema = z.object({
  status: z.enum(['Zugesagt', 'Abgelehnt']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:update')
  if (authError) return authError

  const { id: vakanzId, matchId } = await params
  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültiger Status. Erlaubt: "Zugesagt" oder "Abgelehnt"' },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('id', matchId)
    .eq('vakanz_id', vakanzId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({ status: parsed.data.status })
    .eq('id', matchId)
    .select('id, status, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vorschlag: updated })
}
```

- [ ] **Step 6: Tests ausführen — müssen PASS sein**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/\\[id\\]/vorschlaege/
```

Erwartung: 5 passed

- [ ] **Step 7: Commit**

```bash
git add src/app/demand/v1.0/vakanzen/\[id\]/vorschlaege/
git commit -m "feat: demand GET /vorschlaege und PATCH /vorschlaege/{matchId}"
```

---

### Task 5: Supply — GET /profiles + GET /profiles/{id}

**Files:**
- Create: `src/app/supply/v1.0/profiles/route.ts`
- Create: `src/app/supply/v1.0/profiles/route.test.ts`
- Create: `src/app/supply/v1.0/profiles/[id]/route.ts`
- Create: `src/app/supply/v1.0/profiles/[id]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces:
  - `GET` Handler (list) → `{ profiles: [...] }`
  - `GET` Handler (single) mit `{ params: Promise<{ id: string }> }` → `{ profile: {...} }`

- [ ] **Step 1: Test für GET /profiles (Liste) schreiben**

Erstelle `src/app/supply/v1.0/profiles/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfilesSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockProfilesSelect().then(resolve, reject),
            })),
          }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

describe('GET /supply/v1.0/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 bei fehlendem Key zurück', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const req = new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { 'x-api-key': 'bad-key' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('gibt Profile-Liste zurück', async () => {
    mockProfilesSelect.mockResolvedValue({
      data: [{ id: 'r1', name: 'Anna', skills: ['React'], verfuegbarkeit: 'Jetzt verfügbar' }],
      error: null,
    })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profiles).toHaveLength(1)
    expect(json.profiles[0].id).toBe('r1')
  })
})
```

- [ ] **Step 2: Test für GET /profiles/{id} schreiben**

Erstelle `src/app/supply/v1.0/profiles/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSelect }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

const params = Promise.resolve({ id: 'r1' })

describe('GET /supply/v1.0/profiles/{id}', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 wenn Profil nicht gefunden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('gibt Profil zurück', async () => {
    mockSelect.mockResolvedValue({ data: { id: 'r1', name: 'Anna' }, error: null })
    const req = new NextRequest('http://localhost/supply/v1.0/profiles/r1', {
      headers: { 'x-api-key': 'test-key' },
    })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profile.id).toBe('r1')
  })
})
```

- [ ] **Step 3: Tests ausführen — müssen FAIL sein**

```bash
npx vitest run src/app/supply/v1.0/profiles/
```

Erwartung: FAIL mit „Cannot find module './route'"

- [ ] **Step 4: GET /profiles (Liste) implementieren**

Erstelle `src/app/supply/v1.0/profiles/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, verfuegbarkeit, arbeitsmodell')
    .neq('verfuegbarkeit', 'Deaktiviert')
    .order('name', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Profile' }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}
```

- [ ] **Step 5: GET /profiles/{id} implementieren**

Erstelle `src/app/supply/v1.0/profiles/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, verfuegbarkeit, arbeitsmodell, created_at')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
```

- [ ] **Step 6: Tests ausführen — müssen PASS sein**

```bash
npx vitest run src/app/supply/v1.0/profiles/
```

Erwartung: 4 passed

- [ ] **Step 7: Commit**

```bash
git add src/app/supply/v1.0/
git commit -m "feat: supply GET /profiles und GET /profiles/{id}"
```

---

### Task 6: Cleanup — Middleware, alte Routen löschen, Doku aktualisieren

**Files:**
- Modify: `src/middleware.ts`
- Delete: `src/app/api/external/` (gesamtes Verzeichnis)
- Modify: `docs/external-api-reference.md`

**Interfaces:**
- Consumes: nichts aus früheren Tasks — rein destruktiver/migrierender Schritt

- [ ] **Step 1: Middleware aktualisieren**

In `src/middleware.ts` Zeile 10–12 ersetzen:

Vorher:
```ts
  // ── External API routes — Auth findet in den Routen statt ─────────────────
  if (pathname.startsWith('/api/external/')) {
    return NextResponse.next({ request })
  }
```

Nachher:
```ts
  // ── External API routes — Auth findet in den Routen statt ─────────────────
  if (pathname.startsWith('/demand/') || pathname.startsWith('/supply/')) {
    return NextResponse.next({ request })
  }
```

- [ ] **Step 2: Alte Routen löschen**

```bash
rm -rf src/app/api/external/
```

- [ ] **Step 3: Alle neuen Tests ausführen (kein Regressions-Check auf gelöschte Tests)**

```bash
npx vitest run src/app/demand/ src/app/supply/ src/middleware.ts
```

Erwartung: Alle neuen Tests grün, keine Fehler

- [ ] **Step 4: Gesamte Test-Suite prüfen**

```bash
npx vitest run
```

Erwartung: Keine neuen Fehler im Vergleich zum Stand vor diesem Plan. (6 pre-existing failures in `rbac.test.ts`, `ressource-feedback/`, `ressourcen/[id]/feedback/`, `vakanzen/route.test.ts` waren bereits vor diesem Feature vorhanden — diese ignorieren.)

- [ ] **Step 5: Dokumentation aktualisieren**

Ersetze in `docs/external-api-reference.md` den kompletten Inhalt:

```markdown
# Staffhub External API — Referenz

**Base URL Demand:** `https://api.staffhub.digital/demand/v1.0`  
**Base URL Supply:** `https://api.staffhub.digital/supply/v1.0`  
**Auth:** Header `X-API-Key: <key>`

---

## Authentifizierung

API-Keys werden im Admin Panel unter „API Schlüssel" verwaltet. Jeder Key hat granulare Berechtigungen pro Endpunkt-Gruppe.

Jeder Request muss den Header enthalten:

```
X-API-Key: sfhub_<dein-key>
```

| Status | Bedeutung |
|--------|-----------|
| `401` | Key fehlt, ungültig oder deaktiviert |
| `403` | Key gültig, aber fehlende Berechtigung für diesen Endpunkt |

---

## Berechtigungen

| Permission | Endpunkte |
|---|---|
| `vakanzen:read` | GET /vakanzen, GET /vakanzen/{id} |
| `vakanzen:create` | POST /vakanzen |
| `vakanzen:update` | PATCH /vakanzen/{id}, PATCH /vakanzen/{id}/publish |
| `vorschlaege:read` | GET /vakanzen/{id}/vorschlaege |
| `vorschlaege:update` | PATCH /vakanzen/{id}/vorschlaege/{matchId} |
| `profile:read` | GET /profiles, GET /profiles/{id} |

---

## Demand API — `api.staffhub.digital/demand/v1.0`

### `GET /vakanzen`
Liste aller Vakanzen. Permission: `vakanzen:read`

```bash
curl https://api.staffhub.digital/demand/v1.0/vakanzen \
  -H "X-API-Key: sfhub_..."
```

Response `200`: `{ "vakanzen": [{ "id", "vakanz_nr", "branche", "kunde", "rolle", "status", "published", ... }] }`

---

### `POST /vakanzen`
Neue Vakanz anlegen. Permission: `vakanzen:create`

Pflichtfelder: `branche`, `rolle`, `beschreibung`, `skills` (min. 1), `erfahrungslevel` (Junior/Mid/Senior/Expert), `startdatum` (YYYY-MM-DD), `enddatum` (YYYY-MM-DD), `fte_anzahl` (min. 0.1), `arbeitsmodell` (Remote/Hybrid/Onsite), `budget_intern`

Response `201`: `{ "vakanz": { "id", "vakanz_nr", "rolle", "status", "created_at" } }`

---

### `GET /vakanzen/{id}`
Einzelne Vakanz. Permission: `vakanzen:read`

Response `200`: `{ "vakanz": { alle Felder } }`  
Response `404`: Vakanz nicht gefunden

---

### `PATCH /vakanzen/{id}`
Vakanz aktualisieren. Permission: `vakanzen:update`

Optionale Felder: `status` (Offen/Besetzt/Storniert), `beschreibung`, `budget_intern`, `skills`, `sourcing_erlaubt`

Response `200`: `{ "vakanz": { "id", "status", "updated_at", ... } }`

---

### `PATCH /vakanzen/{id}/publish`
Vakanz veröffentlichen/zurückziehen. Permission: `vakanzen:update`

Body: `{ "published": true | false }`  
Response `200`: `{ "published": true }`  
Response `422`: Besetzte Vakanz kann nicht veröffentlicht werden

---

### `GET /vakanzen/{id}/vorschlaege`
Vorgeschlagene Profile für eine Vakanz. Permission: `vorschlaege:read`

Response `200`: `{ "vorschlaege": [{ "match_id", "status", "name", "agentur", "ek_tagesrate", "matching_score" }] }`

Status-Werte: `Gespielt` · `Interview geplant` · `Zugesagt` · `Beauftragt` · `Abgesagt` · `Abgelehnt` · `Zurückgezogen`

---

### `PATCH /vakanzen/{id}/vorschlaege/{matchId}`
Entscheidung zum Vorschlag setzen. Permission: `vorschlaege:update`

Body: `{ "status": "Zugesagt" | "Abgelehnt" }`  
Response `200`: `{ "vorschlag": { "id", "status", "updated_at" } }`

---

## Supply API — `api.staffhub.digital/supply/v1.0`

### `GET /profiles`
Alle verfügbaren Entwickler. Permission: `profile:read`

```bash
curl https://api.staffhub.digital/supply/v1.0/profiles \
  -H "X-API-Key: sfhub_..."
```

Response `200`: `{ "profiles": [{ "id", "name", "skills", "erfahrungslevel", "verfuegbar_ab", "verfuegbarkeit", "arbeitsmodell" }] }`

`verfuegbarkeit`-Werte: `"Jetzt verfügbar"` · `"Verfügbar ab"` · `"Nicht verfügbar"`

---

### `GET /profiles/{id}`
Profil-Details. Permission: `profile:read`

Response `200`: `{ "profile": { alle Felder } }`  
Response `404`: Profil nicht gefunden

---

## Fehlercodes

| Status | Bedeutung |
|--------|-----------|
| `400` | Ungültiger Body oder fehlende Pflichtfelder |
| `401` | Key fehlt, ungültig oder deaktiviert |
| `403` | Key gültig, aber fehlende Berechtigung |
| `404` | Ressource nicht gefunden |
| `422` | Logikfehler (z.B. besetzte Vakanz veröffentlichen) |
| `500` | Datenbankfehler |

Alle Fehler: `{ "error": "Beschreibung" }`

---

## Lokale Entwicklung

```bash
npm run dev

KEY="sfhub_<dein-lokaler-key>"   # Im Admin Panel anlegen

curl -H "X-API-Key: $KEY" http://localhost:3000/demand/v1.0/vakanzen | jq '.vakanzen | length'
curl -H "X-API-Key: $KEY" http://localhost:3000/supply/v1.0/profiles | jq '.profiles | length'
```

---

## Vercel Custom Domain (einmaliger Setup-Schritt)

`api.staffhub.digital` im Vercel-Projekt als Custom Domain eintragen und DNS-CNAME auf `cname.vercel-dns.com` setzen. Kein separates Deployment nötig.
```

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts docs/external-api-reference.md
git commit -m "feat: middleware auf demand/supply umgestellt, alte external/v1-Routen entfernt, Doku aktualisiert"
```
