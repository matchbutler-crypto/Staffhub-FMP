# External API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine REST-API unter `/api/external/v1/` bereitstellen, die einem internen Backoffice-Tool ermöglicht, Vakanzen zu verwalten und Kandidatenvorschläge einzusehen und zu bearbeiten — gesichert per globalem API-Key.

**Architecture:** Dedizierter Route-Prefix `/api/external/v1/` getrennt vom session-basierten internen API-Bereich. Middleware nimmt diesen Prefix vom Supabase-Session-Check aus; jeder Route-Handler validiert den `X-API-Key`-Header eigenständig (Defense-in-Depth). Alle Routen nutzen den Supabase Service-Role-Client, der RLS-Policies umgeht.

**Tech Stack:** Next.js App Router Route Handlers, Supabase JS (`@supabase/supabase-js` Service Role), Zod, Vitest

## Global Constraints

- Alle Routen unter `src/app/api/external/v1/`
- Auth-Header: `X-API-Key: <value>` — Wert aus `process.env.EXTERNAL_API_KEY`
- Fehlerantworten immer als `{ "error": "..." }` mit passendem HTTP-Status
- Supabase-Tabellen: `vakanzen` (Leseview), `vakanzen_data` (Schreib-View), `ressource_vakanz_links`, `ressourcen`, `agenturen`, `ressource_ki_scores`
- Test-Framework: Vitest mit `vi.mock`, `vi.hoisted`, kein jsdom-Feature nötig
- Kandidaten-Status für externe API: `"Zugesagt"` (annehmen) oder `"Abgelehnt"` (ablehnen)

---

## Dateistruktur

```
Neu:
  src/lib/supabase/service-role.ts                               — Service-Role-Client
  src/lib/external-api-auth.ts                                   — validateExternalApiKey()
  src/app/api/external/v1/vakanzen/route.ts                      — GET list + POST create
  src/app/api/external/v1/vakanzen/route.test.ts
  src/app/api/external/v1/vakanzen/[id]/route.ts                 — PATCH update
  src/app/api/external/v1/vakanzen/[id]/route.test.ts
  src/app/api/external/v1/vakanzen/[id]/publish/route.ts         — PATCH publish
  src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
  src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts      — GET list
  src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts
  src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts  — PATCH status
  src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts

Geändert:
  src/middleware.ts                                               — /api/external/* ausschließen
```

---

## Task 1: Auth-Foundation

Service-Role-Client, API-Key-Helper und Middleware-Anpassung.

**Files:**
- Create: `src/lib/supabase/service-role.ts`
- Create: `src/lib/external-api-auth.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Produces:
  - `createServiceRoleClient(): SupabaseClient` aus `src/lib/supabase/service-role.ts`
  - `validateExternalApiKey(request: NextRequest): NextResponse | null` aus `src/lib/external-api-auth.ts` — gibt `null` bei gültigem Key zurück, sonst 401-Response

- [ ] **Schritt 1: Service-Role-Client erstellen**

```typescript
// src/lib/supabase/service-role.ts
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

- [ ] **Schritt 2: API-Key-Validator erstellen**

```typescript
// src/lib/external-api-auth.ts
import { NextRequest, NextResponse } from 'next/server'

export function validateExternalApiKey(request: NextRequest): NextResponse | null {
  const key = request.headers.get('x-api-key')
  if (!key || key !== process.env.EXTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }
  return null
}
```

- [ ] **Schritt 3: Middleware anpassen**

In `src/middleware.ts` direkt nach `const { pathname } = request.nextUrl` folgende Früh-Return-Bedingung einfügen (VOR dem `createServerClient`-Aufruf, damit kein DB-Call stattfindet):

```typescript
// ── External API routes — skip session check entirely ──────────────────────
if (pathname.startsWith('/api/external/')) {
  return NextResponse.next({ request })
}
```

Der vollständige Anfang der `middleware`-Funktion sieht dann so aus:

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── External API routes — skip session check entirely ──────────────────────
  if (pathname.startsWith('/api/external/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(/* ... bestehender Code ... */)
  // ... Rest der Middleware unverändert
```

- [ ] **Schritt 4: EXTERNAL_API_KEY zur .env.local hinzufügen**

```bash
echo 'EXTERNAL_API_KEY=staffhub-backoffice-dev-key-2026' >> .env.local
```

- [ ] **Schritt 5: Smoke-Test manuell**

```bash
# Server starten
npm run dev

# Ohne Key → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/external/v1/vakanzen
# Erwartung: 401 (kommt erst nach Task 2, hier reicht es dass kein 500 kommt)
```

- [ ] **Schritt 6: Commit**

```bash
git add src/lib/supabase/service-role.ts src/lib/external-api-auth.ts src/middleware.ts .env.local
git commit -m "feat: add external API auth layer (service role client + API key validator)"
```

---

## Task 2: Vakanzen — GET Liste + POST Erstellen

**Files:**
- Create: `src/app/api/external/v1/vakanzen/route.ts`
- Create: `src/app/api/external/v1/vakanzen/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey` aus `@/lib/external-api-auth`, `createServiceRoleClient` aus `@/lib/supabase/service-role`
- Produces:
  - `GET /api/external/v1/vakanzen` → `{ vakanzen: Vakanz[] }`
  - `POST /api/external/v1/vakanzen` → `{ vakanz: { id, vakanz_nr, rolle, status } }`

- [ ] **Schritt 1: Test-Datei schreiben**

```typescript
// src/app/api/external/v1/vakanzen/route.test.ts
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
  validateExternalApiKey: vi.fn(() => null),
}))

import { GET, POST } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
    headers: { 'x-api-key': 'test-key' },
  })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
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

describe('GET /api/external/v1/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück bei fehlendem API-Key', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockReturnValueOnce(
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
    expect(json.vakanzen[0].id).toBe('v1')
  })
})

describe('POST /api/external/v1/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei fehlendem Pflichtfeld zurück', async () => {
    const res = await POST(makePostRequest({ rolle: 'Dev' }))
    expect(res.status).toBe(400)
  })

  it('erstellt Vakanz und gibt sie zurück', async () => {
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

- [ ] **Schritt 2: Tests ausführen — müssen FAILEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/route.test.ts
# Erwartung: FAIL — Modul nicht gefunden
```

- [ ] **Schritt 3: Route implementieren**

```typescript
// src/app/api/external/v1/vakanzen/route.ts
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
  const authError = validateExternalApiKey(request)
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
  const authError = validateExternalApiKey(request)
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

- [ ] **Schritt 4: Tests ausführen — müssen PASSEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/route.test.ts
# Erwartung: 4 Tests PASS
```

- [ ] **Schritt 5: Commit**

```bash
git add src/app/api/external/v1/vakanzen/route.ts src/app/api/external/v1/vakanzen/route.test.ts
git commit -m "feat: add external API GET/POST /vakanzen"
```

---

## Task 3: Vakanzen — PATCH Bearbeiten + Publish

**Files:**
- Create: `src/app/api/external/v1/vakanzen/[id]/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/route.test.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/publish/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces:
  - `PATCH /api/external/v1/vakanzen/[id]` → `{ vakanz: { id, rolle, status, updated_at } }`
  - `PATCH /api/external/v1/vakanzen/[id]/publish` → `{ published: boolean }`

- [ ] **Schritt 1: Test-Datei für PATCH /vakanzen/[id] schreiben**

```typescript
// src/app/api/external/v1/vakanzen/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { PATCH } from './route'

function makeRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/external/v1/vakanzen/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

const validUpdate = {
  branche: 'IT', rolle: 'Backend Engineer',
  beschreibung: 'Node.js Projekt', skills: ['Node.js'],
  erfahrungslevel: 'Senior', startdatum: '2026-07-01',
  enddatum: '2026-12-31', fte_anzahl: 1, arbeitsmodell: 'Remote',
  budget_intern: 900,
}

describe('PATCH /api/external/v1/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei fehlendem Pflichtfeld zurück', async () => {
    const res = await PATCH(makeRequest('v1', { rolle: 'Dev' }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest('v1', validUpdate), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(404)
  })

  it('aktualisiert Vakanz und gibt sie zurück', async () => {
    mockUpdate.mockResolvedValue({
      data: { id: 'v1', rolle: 'Backend Engineer', status: 'Offen', updated_at: '2026-06-16' },
      error: null,
    })
    const res = await PATCH(makeRequest('v1', validUpdate), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.rolle).toBe('Backend Engineer')
  })
})
```

- [ ] **Schritt 2: Test-Datei für PATCH /vakanzen/[id]/publish schreiben**

```typescript
// src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen_data') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSelect }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn(() => ({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockUpdate().then(resolve, reject),
            })),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { PATCH } from './route'

function makeRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/external/v1/vakanzen/${id}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/external/v1/vakanzen/[id]/publish', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Body zurück', async () => {
    const res = await PATCH(makeRequest('v1', { published: 'ja' }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(400)
  })

  it('gibt 422 wenn besetzte Vakanz veröffentlicht werden soll', async () => {
    mockSelect.mockResolvedValue({ data: { status: 'Besetzt' }, error: null })
    const res = await PATCH(makeRequest('v1', { published: true }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(422)
  })

  it('veröffentlicht Vakanz', async () => {
    mockSelect.mockResolvedValue({ data: { status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({ error: null })
    const res = await PATCH(makeRequest('v1', { published: true }), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.published).toBe(true)
  })
})
```

- [ ] **Schritt 3: Tests ausführen — müssen FAILEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/[id]/route.test.ts src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
# Erwartung: FAIL — Module nicht gefunden
```

- [ ] **Schritt 4: PATCH /vakanzen/[id] implementieren**

```typescript
// src/app/api/external/v1/vakanzen/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const updateVakanzSchema = z.object({
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
  status: z.enum(['Offen', 'Besetzt', 'Pausiert', 'Abgebrochen']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateExternalApiKey(request)
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .update({
      ...parsed.data,
      skills_nice_have: parsed.data.skills_nice_have ?? [],
    })
    .eq('id', id)
    .select('id, vakanz_nr, rolle, status, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}
```

- [ ] **Schritt 5: PATCH /vakanzen/[id]/publish implementieren**

```typescript
// src/app/api/external/v1/vakanzen/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const publishSchema = z.object({ published: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateExternalApiKey(request)
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

  const { error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })

  return NextResponse.json({ published: parsed.data.published })
}
```

- [ ] **Schritt 6: Tests ausführen — müssen PASSEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/[id]/route.test.ts src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
# Erwartung: 6 Tests PASS
```

- [ ] **Schritt 7: Commit**

```bash
git add src/app/api/external/v1/vakanzen/[id]/route.ts src/app/api/external/v1/vakanzen/[id]/route.test.ts src/app/api/external/v1/vakanzen/[id]/publish/route.ts src/app/api/external/v1/vakanzen/[id]/publish/route.test.ts
git commit -m "feat: add external API PATCH /vakanzen/[id] and /publish"
```

---

## Task 4: Kandidaten — GET Liste + PATCH Status

**Files:**
- Create: `src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey`, `createServiceRoleClient`
- Produces:
  - `GET /api/external/v1/vakanzen/[id]/kandidaten` →
    ```json
    { "kandidaten": [{ "link_id": "uuid", "status": "Gespielt", "name": "...", "agentur": "...", "ek_tagesrate": 850, "matching_score": 87 }] }
    ```
  - `PATCH /api/external/v1/vakanzen/[id]/kandidaten/[linkId]` → `{ "link": { "id": "uuid", "status": "Zugesagt" } }`
  - Erlaubte Status-Werte: `"Zugesagt"` (annehmen) oder `"Abgelehnt"` (ablehnen)

- [ ] **Schritt 1: Test-Datei für GET /kandidaten schreiben**

```typescript
// src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinksSelect, mockKiScoresSelect } = vi.hoisted(() => ({
  mockLinksSelect: vi.fn(),
  mockKiScoresSelect: vi.fn(),
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
                  mockLinksSelect().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockKiScoresSelect().then(resolve, reject),
            }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { GET } from './route'

function makeRequest(vakanzId: string) {
  return new NextRequest(`http://localhost/api/external/v1/vakanzen/${vakanzId}/kandidaten`, {
    headers: { 'x-api-key': 'test-key' },
  })
}

describe('GET /api/external/v1/vakanzen/[id]/kandidaten', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Kandidaten', async () => {
    mockLinksSelect.mockResolvedValue({ data: [], error: null })
    mockKiScoresSelect.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeRequest('v1'), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.kandidaten).toHaveLength(0)
  })

  it('gibt Kandidaten mit Score und Tagesrate zurück', async () => {
    mockLinksSelect.mockResolvedValue({
      data: [{
        id: 'link-1', status: 'Gespielt',
        ressourcen: { id: 'r1', name: 'Max Muster', ek_tagesrate: 850, agenturen: { name: 'Agentur GmbH' } },
      }],
      error: null,
    })
    mockKiScoresSelect.mockResolvedValue({
      data: [{ ressource_id: 'r1', vakanz_id: 'v1', score: 87 }],
      error: null,
    })
    const res = await GET(makeRequest('v1'), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.kandidaten[0]).toMatchObject({
      link_id: 'link-1', status: 'Gespielt',
      name: 'Max Muster', agentur: 'Agentur GmbH',
      ek_tagesrate: 850, matching_score: 87,
    })
  })
})
```

- [ ] **Schritt 2: Test-Datei für PATCH /kandidaten/[linkId] schreiben**

```typescript
// src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinkSelect, mockLinkUpdate } = vi.hoisted(() => ({
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockLinkSelect }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockLinkUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { PATCH } from './route'

function makeRequest(vakanzId: string, linkId: string, body: unknown) {
  return new NextRequest(
    `http://localhost/api/external/v1/vakanzen/${vakanzId}/kandidaten/${linkId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify(body),
    }
  )
}

describe('PATCH /api/external/v1/vakanzen/[id]/kandidaten/[linkId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Beauftragt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Link nicht gefunden', async () => {
    mockLinkSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('setzt Status auf Zugesagt', async () => {
    mockLinkSelect.mockResolvedValue({ data: { id: 'link-1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', status: 'Zugesagt' }, error: null,
    })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Zugesagt')
  })

  it('setzt Status auf Abgelehnt', async () => {
    mockLinkSelect.mockResolvedValue({ data: { id: 'link-1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', status: 'Abgelehnt' }, error: null,
    })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Abgelehnt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Abgelehnt')
  })
})
```

- [ ] **Schritt 3: Tests ausführen — müssen FAILEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts
# Erwartung: FAIL — Module nicht gefunden
```

- [ ] **Schritt 4: GET /kandidaten implementieren**

```typescript
// src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateExternalApiKey(request)
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
    return NextResponse.json({ error: 'Fehler beim Laden der Kandidaten' }, { status: 500 })
  }

  const scoreMap = new Map<string, number>(
    (scoresResult.data ?? []).map((s) => [s.ressource_id, s.score])
  )

  const kandidaten = (linksResult.data ?? []).map((link) => {
    const ressource = link.ressourcen as unknown as {
      id: string; name: string; ek_tagesrate: number | null
      agenturen: { name: string } | { name: string }[] | null
    }
    const agenturRaw = ressource?.agenturen
    const agentur = Array.isArray(agenturRaw) ? agenturRaw[0]?.name : agenturRaw?.name

    return {
      link_id: link.id,
      status: link.status,
      name: ressource.name,
      agentur: agentur ?? null,
      ek_tagesrate: ressource.ek_tagesrate,
      matching_score: scoreMap.get(ressource.id) ?? null,
    }
  })

  return NextResponse.json({ kandidaten })
}
```

- [ ] **Schritt 5: PATCH /kandidaten/[linkId] implementieren**

```typescript
// src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const statusSchema = z.object({
  status: z.enum(['Zugesagt', 'Abgelehnt']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authError = validateExternalApiKey(request)
  if (authError) return authError

  const { linkId } = await params
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
    .eq('id', linkId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: 'Kandidaten-Link nicht gefunden' }, { status: 404 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({ status: parsed.data.status })
    .eq('id', linkId)
    .select('id, status, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  return NextResponse.json({ link: updated })
}
```

- [ ] **Schritt 6: Tests ausführen — müssen PASSEN**

```bash
npx vitest run src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts
# Erwartung: 6 Tests PASS
```

- [ ] **Schritt 7: Alle Tests der neuen Routen gesamt ausführen**

```bash
npx vitest run src/app/api/external/
# Erwartung: alle Tests PASS, 0 FAIL
```

- [ ] **Schritt 8: Commit**

```bash
git add src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts src/app/api/external/v1/vakanzen/[id]/kandidaten/route.test.ts src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.test.ts
git commit -m "feat: add external API GET /kandidaten and PATCH /kandidaten/[linkId]"
```

---

## Task 5: Smoke-Test End-to-End

- [ ] **Schritt 1: Dev-Server starten**

```bash
npm run dev
```

- [ ] **Schritt 2: Alle Endpunkte manuell testen**

```bash
KEY="staffhub-backoffice-dev-key-2026"
BASE="http://localhost:3000/api/external/v1"

# 401 ohne Key
curl -s -o /dev/null -w "%{http_code}" $BASE/vakanzen
# → 401

# GET Vakanzen
curl -s -H "X-API-Key: $KEY" $BASE/vakanzen | jq '.vakanzen | length'
# → Zahl > 0 (oder 0 wenn keine Vakanzen)

# POST neue Vakanz
VAKANZ_ID=$(curl -s -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"branche":"IT","rolle":"Test Engineer","beschreibung":"Test","skills":["TypeScript"],"erfahrungslevel":"Senior","startdatum":"2026-08-01","enddatum":"2026-12-31","fte_anzahl":1,"arbeitsmodell":"Remote","budget_intern":700}' \
  $BASE/vakanzen | jq -r '.vakanz.id')
echo "Neue Vakanz ID: $VAKANZ_ID"
# → UUID

# PATCH Vakanz
curl -s -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"branche":"IT","rolle":"Test Engineer Updated","beschreibung":"Test","skills":["TypeScript"],"erfahrungslevel":"Senior","startdatum":"2026-08-01","enddatum":"2026-12-31","fte_anzahl":1,"arbeitsmodell":"Remote","budget_intern":700}' \
  $BASE/vakanzen/$VAKANZ_ID | jq '.vakanz.rolle'
# → "Test Engineer Updated"

# Publish
curl -s -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"published":true}' \
  $BASE/vakanzen/$VAKANZ_ID/publish | jq '.published'
# → true

# Kandidaten
curl -s -H "X-API-Key: $KEY" $BASE/vakanzen/$VAKANZ_ID/kandidaten | jq '.kandidaten'
# → [] (neue Vakanz hat keine Kandidaten)
```

- [ ] **Schritt 3: Commit nach erfolgreichem Smoke-Test**

```bash
git commit --allow-empty -m "chore: external API smoke-tested and working"
```
