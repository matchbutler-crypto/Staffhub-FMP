# API-Verwaltung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Datenbankbasierte API-Key-Verwaltung mit granularen Berechtigungen im Admin Panel, plus Erweiterung der externen API um fehlende Endpunkte.

**Architecture:** Die `EXTERNAL_API_KEY`-Umgebungsvariable wird durch eine Supabase-Tabelle `external_api_keys` ersetzt. Jeder Key wird als SHA-256-Hash gespeichert und bei Auth-Checks per DB-Lookup validiert — zusammen mit dem erforderlichen Permission-Flag pro Route. Das Admin Panel erhält einen dritten Tab für CRUD-Operationen auf Keys.

**Tech Stack:** Next.js App Router, Supabase (Service Role Client), Vitest, Zod, Tailwind/shadcn-ui, crypto (Node built-in)

## Global Constraints

- Alle neuen Routen unter `/api/external/v1/` (Major-Versionierung, Breaking Changes → `/v2/`)
- Auth-Header: `x-api-key` (unverändert)
- Permissions: `vakanzen:read`, `vakanzen:create`, `vakanzen:update`, `vorschlaege:read`, `vorschlaege:update`, `profile:read`
- Admin-Routen: nur für eingeloggte Admins (`rolle === 'Admin'` + `aktiv === true`)
- Service Role Client für alle DB-Operationen in externen Routen und Admin-Key-Routen
- Session-Client (`createClient()`) nur für Admin-Auth-Check
- Tests: Vitest, gleicher Ordner wie Route-Datei (`route.test.ts`)
- Nach erfolgreichem Task: committen

---

## File Structure

**Neu erstellen:**
- `src/lib/external-api-auth.ts` — komplett neu schreiben (Key-Generierung + async Validierung)
- `src/app/api/admin/api-keys/route.ts` — GET (Liste), POST (anlegen)
- `src/app/api/admin/api-keys/[id]/route.ts` — PATCH (deaktivieren/Berechtigungen), DELETE
- `src/app/api/external/v1/vakanzen/[id]/route.ts` — GET (Einzelvakanz), PATCH (Update)
- `src/app/api/external/v1/vakanzen/[id]/vorschlaege/route.ts` — GET (Vorschläge lesen)
- `src/app/api/external/v1/vakanzen/[id]/vorschlaege/[matchId]/route.ts` — PATCH (Status setzen)
- `src/app/api/external/v1/profiles/route.ts` — GET (alle Profile)
- `src/app/api/external/v1/profiles/[id]/route.ts` — GET (Einzel-Profil)

**Modifizieren:**
- `src/middleware.ts` — Auth-Check für externe Routen entfernen
- `src/app/api/external/v1/vakanzen/route.ts` — auf async Auth + Permission umstellen
- `src/app/api/external/v1/vakanzen/route.test.ts` — Mock auf async anpassen
- `src/app/api/external/v1/vakanzen/[id]/publish/route.ts` — auf async Auth umstellen
- `src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts` — auf async Auth umstellen
- `src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts` — auf async Auth umstellen
- `src/app/admin/page.tsx` — dritten Tab „API Schlüssel" hinzufügen

---

### Task 1: Supabase-Tabelle anlegen

**Files:**
- Kein Datei-Commit nötig — SQL wird im Supabase Studio ausgeführt

**Interfaces:**
- Produces: Tabelle `external_api_keys` mit Spalten `id, name, key_hash, key_preview, permissions, aktiv, last_used_at, created_at`

- [ ] **Step 1: SQL in Supabase Studio ausführen**

Supabase Studio öffnen → SQL Editor → folgendes ausführen:

```sql
create table external_api_keys (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  key_hash     text        not null unique,
  key_preview  text        not null,
  permissions  text[]      not null default '{}',
  aktiv        boolean     not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on column external_api_keys.key_hash is 'SHA-256 des Klartext-Keys';
comment on column external_api_keys.key_preview is 'Letzte 8 Zeichen des Klartext-Keys zur Anzeige';
```

- [ ] **Step 2: Tabelle prüfen**

Im Supabase Table Editor prüfen, dass `external_api_keys` mit allen Spalten erscheint.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: create external_api_keys table in Supabase (manual)"
```

---

### Task 2: Auth-Lib neu schreiben

**Files:**
- Modify: `src/lib/external-api-auth.ts`
- Create: `src/lib/external-api-auth.test.ts`

**Interfaces:**
- Produces:
  - `generateApiKey(): { plaintext: string; hash: string; preview: string }`
  - `validateExternalApiKey(request: NextRequest, permission: ApiPermission): Promise<NextResponse | null>`
  - `type ApiPermission = 'vakanzen:read' | 'vakanzen:create' | 'vakanzen:update' | 'vorschlaege:read' | 'vorschlaege:update' | 'profile:read'`

- [ ] **Step 1: Test schreiben**

Datei `src/lib/external-api-auth.test.ts` anlegen:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSelect }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ then: vi.fn() }),
      }),
    })),
  })),
}))

import { generateApiKey, validateExternalApiKey } from './external-api-auth'

function makeRequest(key?: string) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
    headers: key ? { 'x-api-key': key } : {},
  })
}

describe('generateApiKey', () => {
  it('erzeugt Key mit sfhub_-Prefix und 32 Hex-Zeichen', () => {
    const { plaintext, hash, preview } = generateApiKey()
    expect(plaintext).toMatch(/^sfhub_[a-f0-9]{32}$/)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(preview).toHaveLength(8)
    expect(plaintext.endsWith(preview)).toBe(true)
  })

  it('erzeugt bei jedem Aufruf einen anderen Key', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.plaintext).not.toBe(b.plaintext)
  })
})

describe('validateExternalApiKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn kein x-api-key Header vorhanden', async () => {
    const res = await validateExternalApiKey(makeRequest(), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 401 zurück wenn Key nicht in DB vorhanden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const res = await validateExternalApiKey(makeRequest('sfhub_invalid'), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 401 zurück wenn Key inaktiv', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read'], aktiv: false },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 403 zurück wenn Permission fehlt', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read'], aktiv: true },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:create')
    expect(res?.status).toBe(403)
  })

  it('gibt null zurück bei gültigem Key mit korrekter Permission', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read', 'vakanzen:create'], aktiv: true },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:read')
    expect(res).toBeNull()
  })
})
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
npx vitest run src/lib/external-api-auth.test.ts
```

Erwartetes Ergebnis: FAIL — Modul nicht gefunden oder falsche Signaturen.

- [ ] **Step 3: Auth-Lib implementieren**

`src/lib/external-api-auth.ts` komplett ersetzen:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type ApiPermission =
  | 'vakanzen:read'
  | 'vakanzen:create'
  | 'vakanzen:update'
  | 'vorschlaege:read'
  | 'vorschlaege:update'
  | 'profile:read'

export function generateApiKey(): { plaintext: string; hash: string; preview: string } {
  const plaintext = 'sfhub_' + randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(plaintext).digest('hex')
  const preview = plaintext.slice(-8)
  return { plaintext, hash, preview }
}

export async function validateExternalApiKey(
  request: NextRequest,
  permission: ApiPermission
): Promise<NextResponse | null> {
  const key = request.headers.get('x-api-key')
  if (!key) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const hash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, permissions, aktiv')
    .eq('key_hash', hash)
    .single()

  if (error || !data || !data.aktiv) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  if (!(data.permissions as string[]).includes(permission)) {
    return NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 })
  }

  // Fire-and-forget: Letzten Zugriff aktualisieren
  supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return null
}
```

- [ ] **Step 4: Tests ausführen — müssen grün sein**

```bash
npx vitest run src/lib/external-api-auth.test.ts
```

Erwartetes Ergebnis: 7 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/external-api-auth.ts src/lib/external-api-auth.test.ts
git commit -m "feat: async API-Key-Validierung mit DB-Lookup und Permission-Check"
```

---

### Task 3: Middleware und bestehende externe Routen anpassen

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/app/api/external/v1/vakanzen/route.ts`
- Modify: `src/app/api/external/v1/vakanzen/route.test.ts`
- Modify: `src/app/api/external/v1/vakanzen/[id]/publish/route.ts`
- Modify: `src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts`
- Modify: `src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey(request, permission)` (async, aus Task 2)

- [ ] **Step 1: Middleware anpassen**

In `src/middleware.ts` den External-API-Block ersetzen — Auth findet jetzt in den Routen statt:

```ts
// ALT:
if (pathname.startsWith('/api/external/')) {
  const keyError = validateExternalApiKey(request)
  if (keyError) return keyError
  return NextResponse.next({ request })
}

// NEU:
if (pathname.startsWith('/api/external/')) {
  return NextResponse.next({ request })
}
```

Den Import `import { validateExternalApiKey } from '@/lib/external-api-auth'` aus der Middleware entfernen, falls er danach ungenutzt ist.

- [ ] **Step 2: vakanzen/route.ts auf async Auth umstellen**

```ts
// src/app/api/external/v1/vakanzen/route.ts

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError
  // … Rest unverändert
}

export async function POST(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:create')
  if (authError) return authError
  // … Rest unverändert
}
```

- [ ] **Step 3: vakanzen/route.test.ts Mock auf async anpassen**

Den Mock von `validateExternalApiKey` auf Promise umstellen:

```ts
// ALT:
vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

// NEU:
vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))
```

Den 401-Test anpassen:

```ts
it('gibt 401 zurück bei fehlendem API-Key', async () => {
  const { NextResponse } = await import('next/server')
  vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
    NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  )
  const res = await GET(makeGetRequest())
  expect(res.status).toBe(401)
})
```

- [ ] **Step 4: publish/route.ts auf async Auth umstellen**

```ts
// src/app/api/external/v1/vakanzen/[id]/publish/route.ts

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError
  // … Rest unverändert
}
```

- [ ] **Step 5: kandidaten/route.ts auf async Auth umstellen**

```ts
// src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:read')
  if (authError) return authError
  // … Rest unverändert
}
```

- [ ] **Step 6: kandidaten/[linkId]/route.ts auf async Auth umstellen**

```ts
// src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:update')
  if (authError) return authError
  // … Rest unverändert
}
```

- [ ] **Step 7: Alle Tests ausführen**

```bash
npx vitest run src/app/api/external/
```

Erwartetes Ergebnis: Alle bestehenden Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/middleware.ts \
  src/app/api/external/v1/vakanzen/route.ts \
  src/app/api/external/v1/vakanzen/route.test.ts \
  src/app/api/external/v1/vakanzen/[id]/publish/route.ts \
  src/app/api/external/v1/vakanzen/[id]/kandidaten/route.ts \
  "src/app/api/external/v1/vakanzen/[id]/kandidaten/[linkId]/route.ts"
git commit -m "refactor: externe Routen auf async Permission-basierten Auth umgestellt"
```

---

### Task 4: Admin API-Routen für Key-Verwaltung

**Files:**
- Create: `src/app/api/admin/api-keys/route.ts`
- Create: `src/app/api/admin/api-keys/[id]/route.ts`

**Interfaces:**
- Consumes:
  - `generateApiKey()` aus `@/lib/external-api-auth`
  - `createClient()` aus `@/lib/supabase/server`
  - `createServiceRoleClient()` aus `@/lib/supabase/service-role`
- Produces:
  - `GET /api/admin/api-keys` → `{ keys: ApiKeyRow[] }`
  - `POST /api/admin/api-keys` → `{ key: ApiKeyRow, plaintext_key: string }`
  - `PATCH /api/admin/api-keys/[id]` → `{ key: ApiKeyRow }`
  - `DELETE /api/admin/api-keys/[id]` → `204`

```ts
type ApiKeyRow = {
  id: string
  name: string
  key_preview: string
  permissions: string[]
  aktiv: boolean
  last_used_at: string | null
  created_at: string
}
```

- [ ] **Step 1: `src/app/api/admin/api-keys/route.ts` anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateApiKey, type ApiPermission } from '@/lib/external-api-auth'

const VALID_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read',
  'vakanzen:create',
  'vakanzen:update',
  'vorschlaege:read',
  'vorschlaege:update',
  'profile:read',
]

const createKeySchema = z.object({
  name: z.string().min(1).max(200),
  permissions: z.array(z.enum([
    'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
    'vorschlaege:read', 'vorschlaege:update', 'profile:read',
  ])).min(1),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { plaintext, hash, preview } = generateApiKey()
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .insert({
      name: parsed.data.name,
      key_hash: hash,
      key_preview: preview,
      permissions: parsed.data.permissions,
    })
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 })

  return NextResponse.json({ key: data, plaintext_key: plaintext }, { status: 201 })
}
```

- [ ] **Step 2: `src/app/api/admin/api-keys/[id]/route.ts` anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const updateKeySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  aktiv: z.boolean().optional(),
  permissions: z.array(z.enum([
    'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
    'vorschlaege:read', 'vorschlaege:update', 'profile:read',
  ])).optional(),
}).refine(d => d.name !== undefined || d.aktiv !== undefined || d.permissions !== undefined, {
  message: 'Mindestens ein Feld muss angegeben werden',
})

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('external_api_keys')
    .update(parsed.data)
    .eq('id', id)
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Key nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ key: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('external_api_keys')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Manuell testen (curl)**

Stelle sicher, dass die App läuft (`npm run dev`), dann:

```bash
# Als Admin eingeloggt sein und Cookie aus Browser kopieren, dann:
curl -X GET http://localhost:3000/api/admin/api-keys \
  -H "Cookie: <session-cookie-aus-browser>"
# Erwartetes Ergebnis: 403 (kein Cookie) oder { keys: [] }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/api-keys/route.ts "src/app/api/admin/api-keys/[id]/route.ts"
git commit -m "feat: Admin-API-Routen für API-Key-Verwaltung (CRUD)"
```

---

### Task 5: Neue externe Vakanzen-Routen (GET /id, PATCH /id)

**Files:**
- Create: `src/app/api/external/v1/vakanzen/[id]/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey(request, permission)` (async)
- Produces:
  - `GET /api/external/v1/vakanzen/{id}` → `{ vakanz: VakanzDetail }`
  - `PATCH /api/external/v1/vakanzen/{id}` → `{ vakanz: VakanzDetail }`

- [ ] **Step 1: Test schreiben**

```ts
// src/app/api/external/v1/vakanzen/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSingle = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
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

import { GET, PATCH } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeGetReq() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1', {
    headers: { 'x-api-key': 'test' },
  })
}

function makePatchReq(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/external/v1/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await GET(makeGetReq(), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('gibt Vakanz-Details zurück', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'v1', rolle: 'Dev', status: 'Offen' },
      error: null,
    })
    const res = await GET(makeGetReq(), makeParams('v1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.id).toBe('v1')
  })
})

describe('PATCH /api/external/v1/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei leerem Body zurück', async () => {
    const res = await PATCH(makePatchReq({}), makeParams('v1'))
    expect(res.status).toBe(400)
  })

  it('aktualisiert Status und gibt Vakanz zurück', async () => {
    mockUpdate.mockResolvedValue({
      data: { id: 'v1', status: 'Besetzt' },
      error: null,
    })
    const res = await PATCH(makePatchReq({ status: 'Besetzt' }), makeParams('v1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Besetzt')
  })
})
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
npx vitest run "src/app/api/external/v1/vakanzen/\[id\]/route.test.ts"
```

Erwartetes Ergebnis: FAIL — Route-Datei nicht gefunden.

- [ ] **Step 3: Route implementieren**

```ts
// src/app/api/external/v1/vakanzen/[id]/route.ts
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

- [ ] **Step 4: Tests ausführen — müssen grün sein**

```bash
npx vitest run "src/app/api/external/v1/vakanzen/\[id\]/route.test.ts"
```

Erwartetes Ergebnis: 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/external/v1/vakanzen/[id]/route.ts" \
  "src/app/api/external/v1/vakanzen/[id]/route.test.ts"
git commit -m "feat: externe Routen GET+PATCH /vakanzen/{id}"
```

---

### Task 6: Vorschläge-Routen

> **Hinweis zur DB-Schema:** Vorschläge nutzen `ressource_vakanz_links` (gleiche Tabelle wie `/kandidaten`). Verfügbare Status-Werte für den PATCH-Endpunkt müssen gegen die DB-Constraint geprüft werden — aktuell bekannt: `'Zugesagt'`, `'Abgelehnt'`. Falls das externe System andere Werte benötigt (`'Interessiert'`, `'In Gespräch'`), muss ein DB-Migration die Enum-Constraint erweitern.

**Files:**
- Create: `src/app/api/external/v1/vakanzen/[id]/vorschlaege/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/vorschlaege/route.test.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/vorschlaege/[matchId]/route.ts`
- Create: `src/app/api/external/v1/vakanzen/[id]/vorschlaege/[matchId]/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /vakanzen/{id}/vorschlaege` → `{ vorschlaege: Vorschlag[] }`
  - `PATCH /vakanzen/{id}/vorschlaege/{matchId}` → `{ vorschlag: { id, status, updated_at } }`

- [ ] **Step 1: Test für GET /vorschlaege schreiben**

```ts
// src/app/api/external/v1/vakanzen/[id]/vorschlaege/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockLinks = vi.fn()
const mockScores = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockLinks().then(resolve, reject),
              }),
            }),
          }),
        }
      }
      if (table === 'ressource_ki_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockScores().then(resolve, reject),
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

import { GET } from './route'

function makeReq() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1/vorschlaege', {
    headers: { 'x-api-key': 'test' },
  })
}

describe('GET /api/external/v1/vakanzen/[id]/vorschlaege', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt leere Liste zurück wenn keine Vorschläge', async () => {
    mockLinks.mockResolvedValue({ data: [], error: null })
    mockScores.mockResolvedValue({ data: [], error: null })
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege).toHaveLength(0)
  })

  it('gibt Vorschläge mit Matching-Score zurück', async () => {
    mockLinks.mockResolvedValue({
      data: [{
        id: 'link1',
        status: 'Offen',
        ressourcen: { id: 'r1', name: 'Max Muster', ek_tagesrate: 800, agenturen: { name: 'TechGmbH' } },
      }],
      error: null,
    })
    mockScores.mockResolvedValue({ data: [{ ressource_id: 'r1', vakanz_id: 'v1', score: 0.92 }], error: null })
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'v1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlaege[0].matching_score).toBe(0.92)
  })
})
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
npx vitest run "src/app/api/external/v1/vakanzen/\[id\]/vorschlaege/route.test.ts"
```

- [ ] **Step 3: GET /vorschlaege implementieren**

```ts
// src/app/api/external/v1/vakanzen/[id]/vorschlaege/route.ts
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

- [ ] **Step 4: Test für PATCH /vorschlaege/[matchId] schreiben**

```ts
// src/app/api/external/v1/vakanzen/[id]/vorschlaege/[matchId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockFetch }),
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

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen/v1/vorschlaege/m1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: JSON.stringify(body),
  })
}
const makeParams = () => ({ params: Promise.resolve({ id: 'v1', matchId: 'm1' }) })

describe('PATCH /vakanzen/[id]/vorschlaege/[matchId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(makeReq({ status: 'Ungültig' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Match nicht gefunden', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeReq({ status: 'Zugesagt' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('aktualisiert Status und gibt Vorschlag zurück', async () => {
    mockFetch.mockResolvedValue({ data: { id: 'm1', status: 'Offen' }, error: null })
    mockUpdate.mockResolvedValue({
      data: { id: 'm1', status: 'Zugesagt', updated_at: '2026-06-17T10:00:00Z' },
      error: null,
    })
    const res = await PATCH(makeReq({ status: 'Zugesagt' }), makeParams())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vorschlag.status).toBe('Zugesagt')
  })
})
```

- [ ] **Step 5: PATCH /vorschlaege/[matchId] implementieren**

> **Hinweis:** Die Status-Werte `'Zugesagt'` und `'Abgelehnt'` sind aus der bestehenden DB-Implementierung bekannt. Falls weitere Status benötigt werden, DB-Constraint prüfen/erweitern.

```ts
// src/app/api/external/v1/vakanzen/[id]/vorschlaege/[matchId]/route.ts
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

  const { matchId } = await params
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

- [ ] **Step 6: Tests ausführen**

```bash
npx vitest run "src/app/api/external/v1/vakanzen/\[id\]/vorschlaege/"
```

Erwartetes Ergebnis: 5 Tests PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/external/v1/vakanzen/[id]/vorschlaege/"
git commit -m "feat: externe Routen GET /vorschlaege und PATCH /vorschlaege/{matchId}"
```

---

### Task 7: Profil-Routen

> **Hinweis:** Profile sind in der `ressourcen`-Tabelle gespeichert. Die genauen Spaltennamen müssen einmalig im Supabase Table Editor geprüft werden. Die unten verwendeten Namen (`name`, `skills`, `erfahrungslevel`, `verfuegbar_ab`, `arbeitsmodell`, `aktiv`) sind basierend auf dem Domänen-Kontext gewählt — bei Abweichungen anpassen.

**Files:**
- Create: `src/app/api/external/v1/profiles/route.ts`
- Create: `src/app/api/external/v1/profiles/route.test.ts`
- Create: `src/app/api/external/v1/profiles/[id]/route.ts`
- Create: `src/app/api/external/v1/profiles/[id]/route.test.ts`

- [ ] **Step 1: Test für GET /profiles schreiben**

```ts
// src/app/api/external/v1/profiles/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfiles = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                mockProfiles().then(resolve, reject),
            }),
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

describe('GET /api/external/v1/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt Profile zurück', async () => {
    mockProfiles.mockResolvedValue({
      data: [{ id: 'r1', name: 'Max Muster', skills: ['React'], erfahrungslevel: 'Senior' }],
      error: null,
    })
    const req = new NextRequest('http://localhost/api/external/v1/profiles', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profiles).toHaveLength(1)
  })
})
```

- [ ] **Step 2: GET /profiles implementieren**

```ts
// src/app/api/external/v1/profiles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()

  // Spalten gegen Supabase Table Editor prüfen falls Fehler auftreten
  const { data, error } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, arbeitsmodell, aktiv')
    .eq('aktiv', true)
    .order('name', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Profile' }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}
```

- [ ] **Step 3: Test für GET /profiles/[id] schreiben**

```ts
// src/app/api/external/v1/profiles/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSingle = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

describe('GET /api/external/v1/profiles/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Profil nicht gefunden', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const req = new NextRequest('http://localhost/api/external/v1/profiles/r1', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(404)
  })

  it('gibt Profil-Details zurück', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'r1', name: 'Max Muster', skills: ['React', 'TypeScript'] },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/external/v1/profiles/r1', {
      headers: { 'x-api-key': 'test' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.profile.id).toBe('r1')
  })
})
```

- [ ] **Step 4: GET /profiles/[id] implementieren**

```ts
// src/app/api/external/v1/profiles/[id]/route.ts
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
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, arbeitsmodell, aktiv, created_at')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
```

- [ ] **Step 5: Tests ausführen**

```bash
npx vitest run src/app/api/external/v1/profiles/
```

Erwartetes Ergebnis: 3 Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/external/v1/profiles/
git commit -m "feat: externe Routen GET /profiles und GET /profiles/{id}"
```

---

### Task 8: Admin UI — API Schlüssel Tab

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/api-keys`, `POST /api/admin/api-keys`, `PATCH /api/admin/api-keys/[id]`, `DELETE /api/admin/api-keys/[id]`

- [ ] **Step 1: Imports ergänzen**

Am Anfang von `src/app/admin/page.tsx` folgende Imports hinzufügen (zu den bestehenden):

```ts
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconEye,
} from "@tabler/icons-react"
import { Checkbox } from "@/components/ui/checkbox"
```

- [ ] **Step 2: Typen und Konstanten hinzufügen**

Nach den bestehenden Typen (`interface Agentur`, `interface User`) einfügen:

```ts
type ApiPermission =
  | 'vakanzen:read'
  | 'vakanzen:create'
  | 'vakanzen:update'
  | 'vorschlaege:read'
  | 'vorschlaege:update'
  | 'profile:read'

interface ApiKey {
  id: string
  name: string
  key_preview: string
  permissions: ApiPermission[]
  aktiv: boolean
  last_used_at: string | null
  created_at: string
}

const PERMISSION_LABELS: Record<ApiPermission, string> = {
  'vakanzen:read': 'Vakanzen lesen',
  'vakanzen:create': 'Vakanz erstellen',
  'vakanzen:update': 'Vakanz aktualisieren',
  'vorschlaege:read': 'Vorschläge lesen',
  'vorschlaege:update': 'Vorschlag-Status setzen',
  'profile:read': 'Profile lesen',
}

const ALL_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
  'vorschlaege:read', 'vorschlaege:update', 'profile:read',
]
```

- [ ] **Step 3: NeuerApiKeySheet-Komponente hinzufügen**

Vor `function AdminPage()` einfügen:

```ts
// ── NeuerApiKeySheet ───────────────────────────────────────────────────────────

interface NeuerApiKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function NeuerApiKeySheet({ open, onOpenChange, onSuccess }: NeuerApiKeySheetProps) {
  const [name, setName] = React.useState("")
  const [permissions, setPermissions] = React.useState<ApiPermission[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (open) { setName(""); setPermissions([]); setError(null); setGeneratedKey(null); setCopied(false) }
  }, [open])

  function togglePermission(p: ApiPermission) {
    setPermissions(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleSubmit() {
    if (!name) { setError("Bitte einen Namen eingeben."); return }
    if (permissions.length === 0) { setError("Bitte mindestens eine Berechtigung auswählen."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Anlegen") }
      const data = await res.json()
      setGeneratedKey(data.plaintext_key)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  async function copyKey() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!generatedKey) onOpenChange(o) }}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Neuen API-Key anlegen</SheetTitle>
          <SheetDescription>Legen Sie einen Key an und weisen Sie Berechtigungen zu.</SheetDescription>
        </SheetHeader>

        {generatedKey ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-sm font-medium text-green-800">Key wurde erstellt — bitte jetzt kopieren!</p>
              <p className="mb-3 text-xs text-green-700">Dieser Key wird nicht erneut angezeigt.</p>
              <div className="flex items-center gap-2 rounded border bg-white px-3 py-2 font-mono text-xs break-all">
                <span className="flex-1">{generatedKey}</span>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copyKey}>
                  {copied ? <IconCheck className="size-4 text-green-600" /> : <IconCopy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name">Name *</Label>
              <Input id="key-name" placeholder="z.B. Backoffice Sören" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Berechtigungen *</Label>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                {ALL_PERMISSIONS.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm-${p}`}
                      checked={permissions.includes(p)}
                      onCheckedChange={() => togglePermission(p)}
                    />
                    <label htmlFor={`perm-${p}`} className="text-sm cursor-pointer select-none">
                      {PERMISSION_LABELS[p]}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{p}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <SheetFooter className="border-t px-6 py-4">
          {generatedKey ? (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <IconKey className="size-4" />{saving ? "Erstellen…" : "Key generieren"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: ApiKeyBearbeitenSheet-Komponente hinzufügen**

Direkt nach `NeuerApiKeySheet` einfügen:

```ts
// ── ApiKeyBearbeitenSheet ──────────────────────────────────────────────────────

interface ApiKeyBearbeitenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKey | null
  onSuccess: () => void
}

function ApiKeyBearbeitenSheet({ open, onOpenChange, apiKey, onSuccess }: ApiKeyBearbeitenSheetProps) {
  const [name, setName] = React.useState("")
  const [permissions, setPermissions] = React.useState<ApiPermission[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && apiKey) {
      setName(apiKey.name)
      setPermissions(apiKey.permissions)
      setError(null)
    }
  }, [open, apiKey])

  function togglePermission(p: ApiPermission) {
    setPermissions(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleSubmit() {
    if (!name) { setError("Name darf nicht leer sein."); return }
    if (permissions.length === 0) { setError("Mindestens eine Berechtigung erforderlich."); return }
    if (!apiKey) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
      toast.success(`Key „${name}" aktualisiert`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>API-Key bearbeiten</SheetTitle>
          <SheetDescription>Name und Berechtigungen von <span className="font-medium text-foreground">{apiKey?.name}</span> ändern.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-key-name">Name *</Label>
            <Input id="edit-key-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Berechtigungen *</Label>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {ALL_PERMISSIONS.map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-perm-${p}`}
                    checked={permissions.includes(p)}
                    onCheckedChange={() => togglePermission(p)}
                  />
                  <label htmlFor={`edit-perm-${p}`} className="text-sm cursor-pointer select-none">
                    {PERMISSION_LABELS[p]}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{p}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Speichern…" : "Änderungen speichern"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: State und Logik in AdminPage ergänzen**

In `AdminPage()` nach dem bestehenden State-Block einfügen:

```ts
const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([])
const [loadingKeys, setLoadingKeys] = React.useState(true)
const [apiKeySheetOpen, setApiKeySheetOpen] = React.useState(false)
const [apiKeyEditOpen, setApiKeyEditOpen] = React.useState(false)
const [apiKeyEditTarget, setApiKeyEditTarget] = React.useState<ApiKey | null>(null)
const [keyLoeschenOpen, setKeyLoeschenOpen] = React.useState(false)
const [keyLoeschen, setKeyLoeschen] = React.useState<ApiKey | null>(null)
const [keyLoeschenLoading, setKeyLoeschenLoading] = React.useState(false)

async function fetchApiKeys() {
  setLoadingKeys(true)
  try {
    const res = await fetch("/api/admin/api-keys")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setApiKeys(data.keys ?? [])
  } catch (err) {
    toast.error(`API-Keys konnten nicht geladen werden: ${err instanceof Error ? err.message : ""}`)
  } finally { setLoadingKeys(false) }
}

async function toggleKeyAktiv(key: ApiKey) {
  try {
    const res = await fetch(`/api/admin/api-keys/${key.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: !key.aktiv }),
    })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
    toast.success(key.aktiv ? `„${key.name}" deaktiviert` : `„${key.name}" aktiviert`)
    fetchApiKeys()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Fehler")
  }
}

async function handleKeyLoeschen() {
  if (!keyLoeschen) return
  setKeyLoeschenLoading(true)
  try {
    const res = await fetch(`/api/admin/api-keys/${keyLoeschen.id}`, { method: "DELETE" })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
    toast.success(`Key „${keyLoeschen.name}" gelöscht`)
    setKeyLoeschenOpen(false); setKeyLoeschen(null); fetchApiKeys()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Fehler")
  } finally { setKeyLoeschenLoading(false) }
}
```

Den bestehenden `useEffect` erweitern:

```ts
// ALT:
React.useEffect(() => { Promise.all([fetchUsers(), fetchAgenturen()]) }, [])

// NEU:
React.useEffect(() => { Promise.all([fetchUsers(), fetchAgenturen(), fetchApiKeys()]) }, [])
```

- [ ] **Step 6: TabsList um dritten Tab erweitern**

```tsx
// ALT:
<TabsList>
  <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
  <TabsTrigger value="agenturen">Agenturen</TabsTrigger>
</TabsList>

// NEU:
<TabsList>
  <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
  <TabsTrigger value="agenturen">Agenturen</TabsTrigger>
  <TabsTrigger value="api-keys">API Schlüssel</TabsTrigger>
</TabsList>
```

- [ ] **Step 7: TabsContent für API Schlüssel hinzufügen**

Nach dem `</TabsContent>` des Agenturen-Tabs einfügen:

```tsx
{/* ── API Schlüssel Tab ── */}
<TabsContent value="api-keys" className="mt-4">
  <div className="mb-4 flex items-center justify-between">
    <p className="text-sm text-muted-foreground">{loadingKeys ? "Lädt…" : `${apiKeys.length} API-Keys`}</p>
    <Button size="sm" onClick={() => setApiKeySheetOpen(true)}>
      <IconPlus className="size-4" />Neuer API-Key
    </Button>
  </div>
  <div className="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader className="bg-muted">
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Berechtigungen</TableHead>
          <TableHead>Zuletzt genutzt</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {loadingKeys ? (
          <TableSkeletonRows cols={6} />
        ) : apiKeys.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Keine API-Keys vorhanden.</TableCell>
          </TableRow>
        ) : (
          apiKeys.map((k) => (
            <TableRow key={k.id}>
              <TableCell className="font-medium">{k.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                sfhub_••••{k.key_preview}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {k.permissions.map((p) => (
                    <Badge key={p} variant="outline" className="font-mono text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {k.last_used_at
                  ? new Date(k.last_used_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Noch nie"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={k.aktiv ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                  {k.aktiv ? "Aktiv" : "Inaktiv"}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                      <IconDotsVertical className="size-4" /><span className="sr-only">Aktionen</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => { setApiKeyEditTarget(k); setApiKeyEditOpen(true) }}>
                      <IconEdit className="mr-2 size-4" />Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => toggleKeyAktiv(k)} className={k.aktiv ? "text-destructive focus:text-destructive" : ""}>
                      {k.aktiv
                        ? <><IconUserOff className="mr-2 size-4" />Deaktivieren</>
                        : <><IconUserCheck className="mr-2 size-4" />Aktivieren</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setKeyLoeschen(k); setKeyLoeschenOpen(true) }}>
                      <IconTrash className="mr-2 size-4" />Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
```

- [ ] **Step 8: Sheets und Dialogs ins JSX einbinden**

Am Ende der `return`-Anweisung in `AdminPage`, vor dem letzten `</SidebarProvider>`, einfügen:

```tsx
<NeuerApiKeySheet open={apiKeySheetOpen} onOpenChange={setApiKeySheetOpen} onSuccess={fetchApiKeys} />
<ApiKeyBearbeitenSheet open={apiKeyEditOpen} onOpenChange={setApiKeyEditOpen} apiKey={apiKeyEditTarget} onSuccess={fetchApiKeys} />

<AlertDialog open={keyLoeschenOpen} onOpenChange={(o) => { if (!keyLoeschenLoading) setKeyLoeschenOpen(o) }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>API-Key löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        <strong>{keyLoeschen?.name ?? "Dieser Key"}</strong> wird dauerhaft gelöscht. Alle Systeme, die diesen Key verwenden, verlieren sofort den Zugriff.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={keyLoeschenLoading}>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={handleKeyLoeschen} disabled={keyLoeschenLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        {keyLoeschenLoading ? "Wird gelöscht…" : "Löschen"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 9: TypeScript-Check**

```bash
npx tsc --noEmit
```

Alle Fehler beheben, dann:

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: Admin-Panel API-Schlüssel-Tab mit CRUD und Berechtigungs-Checkboxen"
```

---

## Abschluss

Nach allen Tasks:

```bash
npx vitest run
```

Alle Tests sollten grün sein. Dann App starten, als Admin einloggen, API-Schlüssel-Tab öffnen, einen Key anlegen, Key kopieren und manuell gegen die externen Endpunkte testen:

```bash
curl http://localhost:3000/api/external/v1/vakanzen \
  -H "x-api-key: sfhub_<dein-key>"
```
