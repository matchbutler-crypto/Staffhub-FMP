# MagentaOS Bidirektionale Integration — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständige bidirektionale Integration zwischen StaffHub und MagentaOS gemäß Partner-Spec v2 — Profile werden beim Spielen per Webhook an MagentaOS übertragen, MagentaOS kann reservieren/buchen/ablehnen, Statusänderungen werden beidseitig synchronisiert und in der Historie dokumentiert.

**Architecture:** Notify+Pull-Modell laut Spec: StaffHub feuert `profile.proposed` Webhook beim Spielen (Voll-Push, kein Follow-up-Pull nötig) und `profile.updated` bei Beauftragt. MagentaOS ruft über neue Supply-API-Routen (`/supply/v1.0/profiles`) Status-Aktionen auf. Alle ausgehenden Webhooks sind fire-and-forget mit HMAC-SHA256-Signatur.

**Tech Stack:** Next.js 14 App Router, Vitest, Supabase (service-role-client für externe Routen), zod, Node.js `crypto` für HMAC.

## Global Constraints

- Neue externe Routen immer `createServiceRoleClient` — kein Supabase auth context
- Authentifizierung via `validateExternalApiKey` aus `@/lib/external-api-auth`
- Testbefehl: `npx vitest run <pfad>` — erwartet PASS ohne Anpassungen
- Env-Variablen: `MAGENTA_WEBHOOK_URL`, `MAGENTA_WEBHOOK_SECRET`
- Webhook-URL laut Spec: `https://magenta-os.vercel.app/api/integrations/staffhub/webhook`
- Name-Splitting: `name.trim().split(' ')` → `firstName = parts[0]`, `lastName = parts.slice(1).join(' ')`
- `erstellt_von: null` in `ressource_historie` für alle extern ausgelösten Einträge
- Supply-Status-Enum: `AVAILABLE | RESERVED | BOOKED | UNAVAILABLE`
- Spec-Referenz: `docs/superpowers/specs/2026-06-23-magenta-os-bidirektionale-integration-design.md`

---

### Task 1: Webhook-Infrastruktur

**Files:**
- Create: `src/lib/magenta-webhook.ts`
- Create: `src/lib/magenta-webhook.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type RessourceSnapshot = { id: string; name: string; email: string | null; phone: string | null }
  function sendProfileProposed(vakanzId: string, ressource: RessourceSnapshot): Promise<void>
  function sendProfileUpdated(vakanzId: string, ressource: RessourceSnapshot, status: 'BOOKED' | 'UNAVAILABLE'): Promise<void>
  ```

- [ ] **Schritt 1: Test schreiben**

Datei: `src/lib/magenta-webhook.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendProfileProposed, sendProfileUpdated } from './magenta-webhook'

const snapshot = { id: 'r-1', name: 'Anna Beispiel', email: 'anna@test.de', phone: '+49123' }

describe('magenta-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MAGENTA_WEBHOOK_URL = 'https://magenta-os.vercel.app/api/integrations/staffhub/webhook'
    process.env.MAGENTA_WEBHOOK_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.MAGENTA_WEBHOOK_URL
    delete process.env.MAGENTA_WEBHOOK_SECRET
  })

  it('tut nichts wenn MAGENTA_WEBHOOK_URL fehlt', async () => {
    delete process.env.MAGENTA_WEBHOOK_URL
    await sendProfileProposed('vak-1', snapshot)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sendet profile.proposed mit korrektem Payload', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    await sendProfileProposed('vak-1', snapshot)
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://magenta-os.vercel.app/api/integrations/staffhub/webhook')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      event: 'profile.proposed',
      vakanzId: 'vak-1',
      profile: { id: 'r-1', firstName: 'Anna', lastName: 'Beispiel', email: 'anna@test.de', phone: '+49123' },
    })
    const headers = options.headers as Record<string, string>
    expect(headers['x-staffhub-signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sendet profile.updated mit BOOKED-Status', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    await sendProfileUpdated('vak-1', snapshot, 'BOOKED')
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      event: 'profile.updated',
      vakanzId: 'vak-1',
      profile: { id: 'r-1', status: 'BOOKED', firstName: 'Anna', lastName: 'Beispiel' },
    })
  })

  it('loggt Fehler bei HTTP-Fehler ohne zu werfen', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue({ ok: false, status: 503 })
    await expect(sendProfileProposed('vak-1', snapshot)).resolves.toBeUndefined()
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Schritt 2: Test ausführen (erwartet FAIL)**

```bash
npx vitest run src/lib/magenta-webhook.test.ts
```

Erwartet: FAIL — `Cannot find module './magenta-webhook'`

- [ ] **Schritt 3: Implementierung schreiben**

Datei: `src/lib/magenta-webhook.ts`

```ts
import { createHmac } from 'crypto'

export type RessourceSnapshot = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ')
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

async function sendWebhook(payload: unknown): Promise<void> {
  const url = process.env.MAGENTA_WEBHOOK_URL
  const secret = process.env.MAGENTA_WEBHOOK_SECRET
  if (!url || !secret) return

  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-staffhub-signature': sig },
    body,
  })

  if (!res.ok) {
    console.error(`MagentaOS webhook HTTP ${res.status} für event "${(payload as { event?: string }).event}"`)
  }
}

export async function sendProfileProposed(vakanzId: string, ressource: RessourceSnapshot): Promise<void> {
  const { firstName, lastName } = splitName(ressource.name)
  await sendWebhook({
    event: 'profile.proposed',
    vakanzId,
    profile: { id: ressource.id, firstName, lastName, email: ressource.email, phone: ressource.phone },
  })
}

export async function sendProfileUpdated(
  vakanzId: string,
  ressource: RessourceSnapshot,
  status: 'BOOKED' | 'UNAVAILABLE'
): Promise<void> {
  const { firstName, lastName } = splitName(ressource.name)
  await sendWebhook({
    event: 'profile.updated',
    vakanzId,
    profile: { id: ressource.id, status, firstName, lastName },
  })
}
```

- [ ] **Schritt 4: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/lib/magenta-webhook.test.ts
```

Erwartet: 4 tests passed

- [ ] **Schritt 5: Commit**

```bash
git add src/lib/magenta-webhook.ts src/lib/magenta-webhook.test.ts
git commit -m "feat: Webhook-Infrastruktur für MagentaOS (profile.proposed / profile.updated)"
```

---

### Task 2: Spielen → Webhook

**Files:**
- Modify: `src/app/api/ressourcen/[id]/spielen/route.ts`
- Modify: `src/app/api/ressourcen/[id]/spielen/route.test.ts`

**Interfaces:**
- Consumes: `sendProfileProposed` aus `@/lib/magenta-webhook`

- [ ] **Schritt 1: Test erweitern**

Am Ende der Testdatei `src/app/api/ressourcen/[id]/spielen/route.test.ts` folgendes ergänzen:

```ts
// ── Webhook-Mock ───────────────────────────────────────────────────────────────
vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileProposed: vi.fn().mockResolvedValue(undefined),
}))

import { sendProfileProposed } from '@/lib/magenta-webhook'
```

Den Mock-Block ganz oben bei den anderen `vi.mock`-Aufrufen einfügen (vor den `import`-Statements am Ende des Hoisted-Blocks).

Dann folgenden Test-Block am Ende hinzufügen:

```ts
describe('POST /api/ressourcen/[id]/spielen — Webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feuert sendProfileProposed nach erfolgreichem Spielen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({
      data: { id: 'res-1', name: 'Max M.', verfuegbarkeit: 'Jetzt verfügbar', agentur_id: 'ag-1', email_geschaeftlich: 'max@test.de', telefon_geschaeftlich: null },
      error: null,
    })
    mockBeauftragungSelect.mockReturnValue({ data: [], error: null })
    mockVakanzSelect.mockResolvedValue({ data: offeneVakanz, error: null })
    mockLinkInsert.mockResolvedValue({
      data: { id: 'lnk-1', ressource_id: 'res-1', vakanz_id: VAKANZ_UUID, status: 'Gespielt', created_at: '2026-06-23T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })

    expect(sendProfileProposed).toHaveBeenCalledWith(
      VAKANZ_UUID,
      expect.objectContaining({ id: 'res-1', name: 'Max M.', email: 'max@test.de', phone: null })
    )
  })

  it('feuert keinen Webhook wenn Spielen fehlschlägt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await POST(makeRequest({ vakanz_id: VAKANZ_UUID }), { params: Promise.resolve({ id: 'res-1' }) })

    expect(sendProfileProposed).not.toHaveBeenCalled()
  })
})
```

- [ ] **Schritt 2: Test ausführen (erwartet FAIL)**

```bash
npx vitest run src/app/api/ressourcen/[id]/spielen/route.test.ts
```

Erwartet: FAIL — `sendProfileProposed` wird nicht aufgerufen

- [ ] **Schritt 3: Route erweitern**

In `src/app/api/ressourcen/[id]/spielen/route.ts`:

Import ergänzen (nach den bestehenden Imports):
```ts
import { sendProfileProposed } from '@/lib/magenta-webhook'
```

Den Select auf `ressourcen` um Kontaktfelder erweitern (Zeile ~100, aktuell `'id, name, verfuegbarkeit, agentur_id'`):
```ts
.select('id, name, verfuegbarkeit, agentur_id, email_geschaeftlich, telefon_geschaeftlich')
```

Nach dem erfolgreichen `insert` (nach dem `await supabase.from('ressource_historie').insert(...)`) anfügen:
```ts
  // fire-and-forget — kein await, kein Fehler für den User
  sendProfileProposed(vakanz_id, {
    id: ressource.id,
    name: ressource.name,
    email: ressource.email_geschaeftlich ?? null,
    phone: ressource.telefon_geschaeftlich ?? null,
  }).catch((e) => console.error('MagentaOS webhook error:', e))
```

- [ ] **Schritt 4: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/app/api/ressourcen/[id]/spielen/route.test.ts
```

Erwartet: alle Tests grün

- [ ] **Schritt 5: Commit**

```bash
git add src/app/api/ressourcen/[id]/spielen/route.ts src/app/api/ressourcen/[id]/spielen/route.test.ts
git commit -m "feat: profile.proposed Webhook beim Spielen (MagentaOS)"
```

---

### Task 3: Neue Permissions + Supply GET

**Files:**
- Modify: `src/lib/external-api-auth.ts`
- Modify: `src/app/api/admin/api-keys/route.ts`
- Modify: `src/app/api/admin/api-keys/[id]/route.ts`
- Create: `src/app/supply/v1.0/profiles/route.ts`
- Create: `src/app/supply/v1.0/profiles/route.test.ts`

**Interfaces:**
- Produces: `GET /supply/v1.0/profiles?vakanz={vakanzId}` → `{ data: SupplyProfile[] }`
  ```ts
  type SupplyProfile = {
    id: string; firstName: string; lastName: string
    email: string | null; phone: string | null
    status: 'AVAILABLE' | 'RESERVED' | 'BOOKED' | 'UNAVAILABLE'
    seniority: string | null; skills: string[]
  }
  ```

- [ ] **Schritt 1: Permissions in external-api-auth.ts ergänzen**

In `src/lib/external-api-auth.ts` die `ApiPermission`-Union erweitern:

```ts
export type ApiPermission =
  | 'vakanzen:read'
  | 'vakanzen:create'
  | 'vakanzen:update'
  | 'vorschlaege:read'
  | 'vorschlaege:update'
  | 'profile:read'
  | 'demand:write'
  | 'supply:read'
  | 'supply:write'
```

- [ ] **Schritt 2: Admin-Keys-Routen aktualisieren**

In `src/app/api/admin/api-keys/route.ts` die `VALID_PERMISSIONS`-Liste und das `createKeySchema` um die drei neuen Scopes ergänzen:

```ts
const VALID_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
  'vorschlaege:read', 'vorschlaege:update', 'profile:read',
  'demand:write', 'supply:read', 'supply:write',
]

const createKeySchema = z.object({
  name: z.string().min(1).max(200),
  permissions: z.array(z.enum([
    'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
    'vorschlaege:read', 'vorschlaege:update', 'profile:read',
    'demand:write', 'supply:read', 'supply:write',
  ])).min(1),
})
```

In `src/app/api/admin/api-keys/[id]/route.ts` das `updateKeySchema` analog erweitern:

```ts
permissions: z.array(z.enum([
  'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
  'vorschlaege:read', 'vorschlaege:update', 'profile:read',
  'demand:write', 'supply:read', 'supply:write',
])).optional(),
```

- [ ] **Schritt 3: Test für Supply GET schreiben**

Datei: `src/app/supply/v1.0/profiles/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ then: (r: (v: unknown) => unknown) => mockSelect().then(r) }),
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

function makeRequest(vakanzId: string) {
  return new NextRequest(`http://localhost/supply/v1.0/profiles?vakanz=${vakanzId}`, {
    headers: { Authorization: 'Bearer test-key' },
  })
}

const mockLink = {
  id: 'lnk-1',
  status: 'Gespielt',
  ressourcen: {
    id: 'r-1',
    name: 'Anna Beispiel',
    erfahrungslevel: 'Senior',
    skills: ['Python'],
    email_geschaeftlich: 'anna@test.de',
    telefon_geschaeftlich: null,
  },
}

describe('GET /supply/v1.0/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 zurück wenn vakanz-Parameter fehlt', async () => {
    const res = await GET(new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { Authorization: 'Bearer test-key' },
    }))
    expect(res.status).toBe(400)
  })

  it('gibt Profile mit AVAILABLE-Status zurück', async () => {
    mockSelect.mockResolvedValue({ data: [mockLink], error: null })
    const res = await GET(makeRequest('vak-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({
      id: 'r-1', firstName: 'Anna', lastName: 'Beispiel',
      status: 'AVAILABLE', email: null, phone: null,
    })
  })

  it('liefert Kontaktdaten nur bei BOOKED', async () => {
    mockSelect.mockResolvedValue({ data: [{ ...mockLink, status: 'Beauftragt' }], error: null })
    const res = await GET(makeRequest('vak-1'))
    const json = await res.json()
    expect(json.data[0].status).toBe('BOOKED')
    expect(json.data[0].email).toBe('anna@test.de')
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } })
    const res = await GET(makeRequest('vak-1'))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Schritt 4: Test ausführen (erwartet FAIL)**

```bash
npx vitest run src/app/supply/v1.0/profiles/route.test.ts
```

Erwartet: FAIL — `Cannot find module './route'`

- [ ] **Schritt 5: Supply GET implementieren**

Datei: `src/app/supply/v1.0/profiles/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const INTERNAL_TO_SUPPLY: Record<string, string> = {
  Gespielt:          'AVAILABLE',
  'Interview geplant': 'RESERVED',
  Zugesagt:          'RESERVED',
  Beauftragt:        'BOOKED',
  Abgelehnt:         'UNAVAILABLE',
  Abgesagt:          'UNAVAILABLE',
  Zurückgezogen:     'UNAVAILABLE',
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ')
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'supply:read')
  if (authError) return authError

  const vakanzId = request.nextUrl.searchParams.get('vakanz')
  if (!vakanzId) {
    return NextResponse.json({ error: { code: 'MISSING_PARAM', message: 'Parameter vakanz ist Pflicht' } }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id, status,
      ressourcen!inner(id, name, erfahrungslevel, skills, email_geschaeftlich, telefon_geschaeftlich)
    `)
    .eq('vakanz_id', vakanzId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden der Profile' } }, { status: 500 })
  }

  const profiles = (data ?? []).map((link) => {
    const r = link.ressourcen as unknown as {
      id: string; name: string; erfahrungslevel: string | null
      skills: string[] | null; email_geschaeftlich: string | null; telefon_geschaeftlich: string | null
    }
    const supplyStatus = INTERNAL_TO_SUPPLY[link.status] ?? 'AVAILABLE'
    const isBooked = supplyStatus === 'BOOKED'
    const { firstName, lastName } = splitName(r.name)

    return {
      id: r.id,
      firstName,
      lastName,
      email: isBooked ? (r.email_geschaeftlich ?? null) : null,
      phone: isBooked ? (r.telefon_geschaeftlich ?? null) : null,
      status: supplyStatus,
      seniority: r.erfahrungslevel ?? null,
      skills: r.skills ?? [],
    }
  })

  return NextResponse.json({ data: profiles })
}
```

- [ ] **Schritt 6: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/app/supply/v1.0/profiles/route.test.ts
```

Erwartet: 4 tests passed

- [ ] **Schritt 7: Commit**

```bash
git add src/lib/external-api-auth.ts \
        src/app/api/admin/api-keys/route.ts \
        src/app/api/admin/api-keys/[id]/route.ts \
        src/app/supply/v1.0/profiles/route.ts \
        src/app/supply/v1.0/profiles/route.test.ts
git commit -m "feat: Supply GET /supply/v1.0/profiles + neue Permissions (supply:read/write, demand:write)"
```

---

### Task 4: Supply reserve / book / cancel

**Files:**
- Create: `src/app/supply/v1.0/profiles/[id]/reserve/route.ts`
- Create: `src/app/supply/v1.0/profiles/[id]/book/route.ts`
- Create: `src/app/supply/v1.0/profiles/[id]/cancel/route.ts`
- Create: `src/app/supply/v1.0/profiles/[id]/actions.test.ts`

**Interfaces:**
- Consumes: `sendProfileUpdated` aus `@/lib/magenta-webhook` (nur in book)
- Consumes: `validateExternalApiKey` mit `supply:write`
- Request body: `{ vakanzId: string }`
- Response: `{ id: string; status: 'RESERVED' | 'BOOKED' | 'UNAVAILABLE' }`

- [ ] **Schritt 1: Tests schreiben**

Datei: `src/app/supply/v1.0/profiles/[id]/actions.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockLinkSelect, mockLinkUpdate, mockVakanzSelect,
  mockRessourceSelect, mockHistorieInsert, mockRessourceUpdate,
  mockVakanzUpdate, mockLinkCount,
} = vi.hoisted(() => ({
  mockLinkSelect:     vi.fn(),
  mockLinkUpdate:     vi.fn(),
  mockVakanzSelect:   vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockHistorieInsert: vi.fn(),
  mockRessourceUpdate: vi.fn(),
  mockVakanzUpdate:   vi.fn(),
  mockLinkCount:      vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockLinkSelect,
        then: (r: (v: unknown) => unknown) => mockLinkCount().then(r),
      }
      if (table === 'vakanzen') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockVakanzSelect,
      }
      if (table === 'ressourcen') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockRessourceSelect,
      }
      if (table === 'ressource_historie') return { insert: mockHistorieInsert }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileUpdated: vi.fn().mockResolvedValue(undefined),
}))

import { POST as reserve } from './reserve/route'
import { POST as book }    from './book/route'
import { POST as cancel }  from './cancel/route'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

function makeRequest(profileId: string, vakanzId: string, routeSuffix: string) {
  return new NextRequest(`http://localhost/supply/v1.0/profiles/${profileId}/${routeSuffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
    body: JSON.stringify({ vakanzId }),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const gespielterLink = { id: 'lnk-1', status: 'Gespielt' }
const beauftragtLink = { id: 'lnk-1', status: 'Beauftragt' }
const interviewLink  = { id: 'lnk-1', status: 'Interview geplant' }
const vakanz = { id: 'vak-1', rolle: 'Senior Dev', enddatum: '2027-01-31', fte_anzahl: 1, status: 'Offen' }
const ressource = { id: 'r-1', name: 'Anna Beispiel', email_geschaeftlich: 'anna@test.de', telefon_geschaeftlich: null }

describe('POST reserve', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Link nicht gefunden', async () => {
    mockLinkSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(404)
  })

  it('gibt 409 zurück wenn bereits Beauftragt', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Status auf Interview geplant und gibt RESERVED zurück', async () => {
    mockLinkSelect.mockResolvedValue({ data: gespielterLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'RESERVED' })
  })
})

describe('POST book', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 409 zurück wenn bereits Beauftragt', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await book(makeRequest('r-1', 'vak-1', 'book'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Beauftragt, schreibt Historie, feuert Webhook', async () => {
    mockLinkSelect.mockResolvedValue({ data: interviewLink, error: null })
    mockVakanzSelect.mockResolvedValue({ data: vakanz, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockLinkUpdate.mockResolvedValue({ data: {}, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    mockVakanzUpdate.mockResolvedValue({ error: null })
    mockLinkCount.mockResolvedValue({ count: 1, error: null })

    const res = await book(makeRequest('r-1', 'vak-1', 'book'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'BOOKED' })
    expect(sendProfileUpdated).toHaveBeenCalledWith(
      'vak-1',
      expect.objectContaining({ id: 'r-1' }),
      'BOOKED'
    )
  })
})

describe('POST cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 409 zurück wenn bereits Beauftragt (gesperrt)', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await cancel(makeRequest('r-1', 'vak-1', 'cancel'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Status auf Abgelehnt und gibt UNAVAILABLE zurück', async () => {
    mockLinkSelect.mockResolvedValue({ data: gespielterLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: {}, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await cancel(makeRequest('r-1', 'vak-1', 'cancel'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'UNAVAILABLE' })
  })
})
```

- [ ] **Schritt 2: Tests ausführen (erwartet FAIL)**

```bash
npx vitest run src/app/supply/v1.0/profiles/[id]/actions.test.ts
```

Erwartet: FAIL — Module nicht gefunden

- [ ] **Schritt 3: `reserve/route.ts` implementieren**

Datei: `src/app/supply/v1.0/profiles/[id]/reserve/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const schema = z.object({ vakanzId: z.string().min(1) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'supply:write')
  if (authError) return authError

  const { id: profileId } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'vakanzId ist Pflicht' } }, { status: 400 })
  }

  const { vakanzId } = parsed.data
  const supabase = createServiceRoleClient()

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', profileId)
    .eq('vakanz_id', vakanzId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil-Vakanz-Verknüpfung nicht gefunden' } }, { status: 404 })
  }
  if (link.status === 'Beauftragt') {
    return NextResponse.json({ error: { code: 'LOCKED', message: 'Gebuchtes Profil kann nicht verändert werden' } }, { status: 409 })
  }

  await supabase
    .from('ressource_vakanz_links')
    .update({ status: 'Interview geplant', interview_datum: null })
    .eq('id', link.id)

  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: 'Interview geplant (via MagentaOS)',
    erstellt_von: null,
  })

  return NextResponse.json({ id: profileId, status: 'RESERVED' })
}
```

- [ ] **Schritt 4: `book/route.ts` implementieren**

Datei: `src/app/supply/v1.0/profiles/[id]/book/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

const schema = z.object({ vakanzId: z.string().min(1) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'supply:write')
  if (authError) return authError

  const { id: profileId } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'vakanzId ist Pflicht' } }, { status: 400 })
  }

  const { vakanzId } = parsed.data
  const supabase = createServiceRoleClient()

  const [linkResult, vakanzResult, ressourceResult] = await Promise.all([
    supabase.from('ressource_vakanz_links').select('id, status').eq('ressource_id', profileId).eq('vakanz_id', vakanzId).single(),
    supabase.from('vakanzen').select('rolle, enddatum, fte_anzahl, status').eq('id', vakanzId).single(),
    supabase.from('ressourcen').select('id, name, email_geschaeftlich, telefon_geschaeftlich').eq('id', profileId).single(),
  ])

  const link = linkResult.data
  if (linkResult.error || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil-Vakanz-Verknüpfung nicht gefunden' } }, { status: 404 })
  }
  if (link.status === 'Beauftragt') {
    return NextResponse.json({ error: { code: 'LOCKED', message: 'Profil ist bereits gebucht' } }, { status: 409 })
  }

  const vakanz = vakanzResult.data
  const ressource = ressourceResult.data

  await supabase.from('ressource_vakanz_links').update({ status: 'Beauftragt' }).eq('id', link.id)

  if (vakanz?.enddatum) {
    await supabase
      .from('ressourcen')
      .update({ verfuegbarkeit: 'Verfügbar ab', verfuegbar_ab: vakanz.enddatum })
      .eq('id', profileId)
  }

  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: `Beauftragt (via MagentaOS)${vakanz?.rolle ? ` — Vakanz: "${vakanz.rolle}"` : ''}`,
    erstellt_von: null,
  })

  // FTE-Check → Vakanz automatisch auf Besetzt setzen
  if (vakanz) {
    const { count } = await supabase
      .from('ressource_vakanz_links')
      .select('*', { count: 'exact', head: true })
      .eq('vakanz_id', vakanzId)
      .eq('status', 'Beauftragt')

    const fte = vakanz.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
    if (fte !== null && (count ?? 0) >= fte && vakanz.status !== 'Besetzt') {
      await supabase
        .from('vakanzen')
        .update({ status: 'Besetzt', published: false, besetzt_seit: new Date().toISOString() })
        .eq('id', vakanzId)
    }
  }

  if (ressource) {
    sendProfileUpdated(vakanzId, {
      id: ressource.id,
      name: ressource.name,
      email: ressource.email_geschaeftlich ?? null,
      phone: ressource.telefon_geschaeftlich ?? null,
    }, 'BOOKED').catch((e) => console.error('MagentaOS webhook error:', e))
  }

  return NextResponse.json({ id: profileId, status: 'BOOKED' })
}
```

- [ ] **Schritt 5: `cancel/route.ts` implementieren**

Datei: `src/app/supply/v1.0/profiles/[id]/cancel/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const schema = z.object({ vakanzId: z.string().min(1) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'supply:write')
  if (authError) return authError

  const { id: profileId } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'vakanzId ist Pflicht' } }, { status: 400 })
  }

  const { vakanzId } = parsed.data
  const supabase = createServiceRoleClient()

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', profileId)
    .eq('vakanz_id', vakanzId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil-Vakanz-Verknüpfung nicht gefunden' } }, { status: 404 })
  }
  if (link.status === 'Beauftragt') {
    return NextResponse.json({ error: { code: 'LOCKED', message: 'Gebuchtes Profil kann nicht abgelehnt werden' } }, { status: 409 })
  }

  await supabase.from('ressource_vakanz_links').update({ status: 'Abgelehnt' }).eq('id', link.id)

  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: 'Abgelehnt (via MagentaOS)',
    erstellt_von: null,
  })

  return NextResponse.json({ id: profileId, status: 'UNAVAILABLE' })
}
```

- [ ] **Schritt 6: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/app/supply/v1.0/profiles/[id]/actions.test.ts
```

Erwartet: 7 tests passed

- [ ] **Schritt 7: Commit**

```bash
git add src/app/supply/v1.0/profiles/[id]/reserve/route.ts \
        src/app/supply/v1.0/profiles/[id]/book/route.ts \
        src/app/supply/v1.0/profiles/[id]/cancel/route.ts \
        src/app/supply/v1.0/profiles/[id]/actions.test.ts
git commit -m "feat: Supply reserve/book/cancel Endpunkte für MagentaOS"
```

---

### Task 5: Beauftragt → Webhook

**Files:**
- Modify: `src/app/api/ressource-links/[id]/status/route.ts`
- Modify: `src/app/api/ressource-links/[id]/status/route.test.ts` (falls vorhanden) oder neue Tests

**Interfaces:**
- Consumes: `sendProfileUpdated` aus `@/lib/magenta-webhook`

- [ ] **Schritt 1: Test schreiben**

Datei: `src/app/api/ressource-links/[id]/status/route.test.ts`

Falls die Datei noch nicht existiert, neue Datei anlegen. Falls sie bereits existiert, die folgenden Blocks ergänzen:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser, mockProfileSelect, mockLinkSelect,
  mockLinkUpdate, mockHistorieInsert, mockRessourceUpdate,
  mockVakanzCount, mockVakanzSelect, mockVakanzUpdate, mockRessourceSelect,
} = vi.hoisted(() => ({
  mockGetUser:        vi.fn(),
  mockProfileSelect:  vi.fn(),
  mockLinkSelect:     vi.fn(),
  mockLinkUpdate:     vi.fn(),
  mockHistorieInsert: vi.fn().mockResolvedValue({ error: null }),
  mockRessourceUpdate: vi.fn(),
  mockVakanzCount:    vi.fn(),
  mockVakanzSelect:   vi.fn(),
  mockVakanzUpdate:   vi.fn(),
  mockRessourceSelect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      if (table === 'ressource_vakanz_links') return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockLinkSelect }) }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockLinkUpdate }) }) }),
      }
      if (table === 'ressource_historie') return { insert: mockHistorieInsert }
      if (table === 'ressourcen') return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockRessourceSelect }) }),
      }
      if (table === 'vakanzen') return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockVakanzSelect }), count: 'exact', head: true }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileUpdated: vi.fn().mockResolvedValue(undefined),
}))

import { PATCH } from './route'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ressource-links/lnk-1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true }
const interviewLink = {
  id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Interview geplant',
  vakanzen: { rolle: 'Senior Dev', enddatum: '2027-01-31' },
}

describe('PATCH /api/ressource-links/[id]/status — Beauftragt Webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('feuert sendProfileUpdated mit BOOKED wenn auf Beauftragt gesetzt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: interviewLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Beauftragt', interview_datum: null, feedback: null, updated_at: '2026-06-23T00:00:00Z' }, error: null })
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r-1', name: 'Anna Beispiel', email_geschaeftlich: 'anna@test.de', telefon_geschaeftlich: null }, error: null })
    mockVakanzCount.mockResolvedValue({ count: 1, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { status: 'Offen', fte_anzahl: 1 }, error: null })

    await PATCH(makeRequest({ status: 'Beauftragt' }), { params: Promise.resolve({ id: 'lnk-1' }) })

    expect(sendProfileUpdated).toHaveBeenCalledWith(
      'vak-1',
      expect.objectContaining({ id: 'r-1', name: 'Anna Beispiel' }),
      'BOOKED'
    )
  })

  it('feuert keinen Webhook bei anderem Status', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({ data: { ...interviewLink, status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1', ressource_id: 'r-1', vakanz_id: 'vak-1', status: 'Interview geplant', interview_datum: '2026-07-01', feedback: null, updated_at: '2026-06-23T00:00:00Z' }, error: null })

    await PATCH(makeRequest({ status: 'Interview geplant', interview_datum: '2026-07-01' }), { params: Promise.resolve({ id: 'lnk-1' }) })

    expect(sendProfileUpdated).not.toHaveBeenCalled()
  })
})
```

- [ ] **Schritt 2: Test ausführen (erwartet FAIL)**

```bash
npx vitest run src/app/api/ressource-links/[id]/status/route.test.ts
```

Erwartet: FAIL — `sendProfileUpdated` nicht aufgerufen

- [ ] **Schritt 3: status/route.ts erweitern**

In `src/app/api/ressource-links/[id]/status/route.ts`:

Import ergänzen (nach den bestehenden Imports):
```ts
import { sendProfileUpdated } from '@/lib/magenta-webhook'
```

Nach dem Block `// Bei Beauftragt: Verfügbarkeit automatisch auf Enddatum der Vakanz setzen` (nach Zeile ~150, dem zweiten `ressource_historie.insert` für Verfügbarkeit) — also nach dem gesamten Beauftragt-Seiteneffekte-Block und VOR dem FTE-Check-Block — folgenden Code einfügen:

```ts
  // Webhook an MagentaOS bei Beauftragt
  if (newStatus === 'Beauftragt') {
    const { data: ressource } = await supabase
      .from('ressourcen')
      .select('id, name, email_geschaeftlich, telefon_geschaeftlich')
      .eq('id', link.ressource_id)
      .single()

    if (ressource) {
      sendProfileUpdated(link.vakanz_id, {
        id: ressource.id,
        name: ressource.name,
        email: ressource.email_geschaeftlich ?? null,
        phone: ressource.telefon_geschaeftlich ?? null,
      }, 'BOOKED').catch((e) => console.error('MagentaOS webhook error:', e))
    }
  }
```

- [ ] **Schritt 4: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/app/api/ressource-links/[id]/status/route.test.ts
```

Erwartet: alle Tests grün

- [ ] **Schritt 5: Commit**

```bash
git add src/app/api/ressource-links/[id]/status/route.ts \
        src/app/api/ressource-links/[id]/status/route.test.ts
git commit -m "feat: profile.updated BOOKED Webhook bei Beauftragt (MagentaOS)"
```

---

### Task 6: Demand PATCH — Vakanz schließen

**Files:**
- Create: `src/app/demand/v1.0/vakanzen/[id]/route.ts`
- Create: `src/app/demand/v1.0/vakanzen/[id]/route.test.ts`

**Interfaces:**
- Consumes: `validateExternalApiKey` mit `demand:write`
- Request body: Teilmenge von Vakanz-Feldern, Schließen via `{ "status": "closed" }`
- Response: `200` mit Vakanz-Objekt

- [ ] **Schritt 1: Test schreiben**

Datei: `src/app/demand/v1.0/vakanzen/[id]/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockUpdate }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSelect }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { PATCH } from './route'

function makeRequest(vakanzId: string, body: unknown) {
  return new NextRequest(`http://localhost/demand/v1.0/vakanzen/${vakanzId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
    body: JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('PATCH /demand/v1.0/vakanzen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Vakanz nicht gefunden', async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(makeRequest('vak-1', { status: 'closed' }), params('vak-1'))
    expect(res.status).toBe(404)
  })

  it('schließt Vakanz via status:closed', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vak-1', rolle: 'Senior Dev', status: 'Geschlossen', updated_at: '2026-06-23T00:00:00Z' }, error: null })
    const res = await PATCH(makeRequest('vak-1', { status: 'closed' }), params('vak-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanz.status).toBe('Geschlossen')
  })

  it('aktualisiert Teilmenge von Feldern', async () => {
    mockUpdate.mockResolvedValue({ data: { id: 'vak-1', rolle: 'Updated Dev', status: 'Offen', updated_at: '2026-06-23T00:00:00Z' }, error: null })
    const res = await PATCH(makeRequest('vak-1', { rolle: 'Updated Dev' }), params('vak-1'))
    expect(res.status).toBe(200)
  })

  it('gibt 400 bei leerem Body zurück', async () => {
    const res = await PATCH(makeRequest('vak-1', {}), params('vak-1'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Schritt 2: Test ausführen (erwartet FAIL)**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/[id]/route.test.ts
```

Erwartet: FAIL — `Cannot find module './route'`

- [ ] **Schritt 3: PATCH-Route implementieren**

Datei: `src/app/demand/v1.0/vakanzen/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const STATUS_MAP: Record<string, string> = { closed: 'Geschlossen', open: 'Offen' }

const patchSchema = z.object({
  status:       z.string().optional(),
  rolle:        z.string().min(1).optional(),
  role:         z.string().min(1).optional(),
  beschreibung: z.string().min(1).optional(),
  description:  z.string().min(1).optional(),
  startdatum:   z.string().optional(),
  startDate:    z.string().optional(),
  enddatum:     z.string().optional(),
  endDate:      z.string().optional(),
  skills:       z.array(z.string()).optional(),
}).refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  { message: 'Mindestens ein Feld muss angegeben werden' }
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'demand:write')
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().formErrors[0] ?? 'Validierungsfehler' } },
      { status: 400 }
    )
  }

  const d = parsed.data
  const updatePayload: Record<string, unknown> = {}

  if (d.status !== undefined) updatePayload.status = STATUS_MAP[d.status] ?? d.status
  if (d.rolle ?? d.role)      updatePayload.rolle = d.rolle ?? d.role
  if (d.beschreibung ?? d.description) updatePayload.beschreibung = d.beschreibung ?? d.description
  if (d.startdatum ?? d.startDate) updatePayload.startdatum = d.startdatum ?? d.startDate
  if (d.enddatum ?? d.endDate)     updatePayload.enddatum = d.enddatum ?? d.endDate
  if (d.skills !== undefined)  updatePayload.skills = d.skills

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .update(updatePayload)
    .eq('id', id)
    .select('id, rolle, status, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Vakanz nicht gefunden' } }, { status: 404 })
    }
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}
```

- [ ] **Schritt 4: Tests ausführen (erwartet PASS)**

```bash
npx vitest run src/app/demand/v1.0/vakanzen/[id]/route.test.ts
```

Erwartet: 4 tests passed

- [ ] **Schritt 5: Gesamte Testsuite prüfen**

```bash
npx vitest run src/lib/magenta-webhook.test.ts \
              src/app/api/ressourcen/[id]/spielen/route.test.ts \
              src/app/supply/v1.0/profiles/route.test.ts \
              src/app/supply/v1.0/profiles/[id]/actions.test.ts \
              src/app/demand/v1.0/vakanzen/[id]/route.test.ts
```

Erwartet: alle Tests grün

- [ ] **Schritt 6: Commit**

```bash
git add src/app/demand/v1.0/vakanzen/[id]/route.ts \
        src/app/demand/v1.0/vakanzen/[id]/route.test.ts
git commit -m "feat: PATCH /demand/v1.0/vakanzen/[id] — Vakanz schließen/aktualisieren (MagentaOS)"
```

---

## Offene Punkte (vor Go-Live mit MagentaOS)

1. **Env-Variablen in Vercel setzen:** `MAGENTA_WEBHOOK_URL=https://magenta-os.vercel.app/api/integrations/staffhub/webhook` und `MAGENTA_WEBHOOK_SECRET=<shared-secret>`
2. **API-Key für MagentaOS anlegen** (Admin-UI) mit Scopes: `demand:write`, `supply:read`, `supply:write`
3. **Name-Splitting bestätigen:** StaffHub speichert `name` als Vollname — Splitting via erstes Leerzeichen. Zu bestätigen ob MagentaOS das akzeptiert.
4. **Status-Route-Tests:** Wenn `src/app/api/ressource-links/[id]/status/route.test.ts` bereits existiert, müssen bestehende Tests beim Ausführen weiter grün bleiben.
