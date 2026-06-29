# Inbound Agency Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /webhooks/agency/{agentur-id}` so agencies can push profile and submission events into Staffhub using their existing API key.

**Architecture:** A single Next.js route handler validates the API key via `validateAgencyKey`, checks ownership (key's `agentur_id` === URL param), then dispatches to per-event logic that reuses the same DB operations as the existing Agency REST API. The Admin UI Übergabe-Info box gets one new section showing the inbound webhook URL when the Agency layer is active.

**Tech Stack:** Next.js App Router route handlers, Zod v3, Supabase service-role client, Vitest

## Global Constraints

- Auth always via `validateAgencyKey(request, 'agency:profiles:write')` from `@/lib/external-api-auth`
- Unknown events → `200 { received: true, skipped: true }` — never 4xx
- All DB writes use `createServiceRoleClient()` from `@/lib/supabase/service-role`
- CV max 5 MB decoded
- Tests use Vitest with `vi.hoisted` + `vi.mock` pattern (see `src/app/supply/v1.0/profiles/[id]/actions.test.ts`)

---

### Task 1: Inbound Webhook Route Handler

**Files:**
- Create: `src/app/webhooks/agency/[id]/route.ts`
- Create: `src/app/webhooks/agency/[id]/route.test.ts`

**Interfaces:**
- Consumes: `validateAgencyKey` from `@/lib/external-api-auth` → `{ agencyId: string, error: null } | { agencyId: null, error: NextResponse }`
- Consumes: `createServiceRoleClient` from `@/lib/supabase/service-role`
- Produces: `POST` export used by Next.js routing

- [ ] **Step 1: Write failing tests**

Create `src/app/webhooks/agency/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const AGENCY_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const OTHER_AGENCY_ID = 'aaaaaaaa-0000-0000-0000-000000000002'

const {
  mockValidateAgencyKey,
  mockRessourceSelect, mockRessourceInsert, mockRessourceUpdate,
  mockVakanzSelect,
  mockLinkInsert, mockLinkSelect, mockLinkUpdate,
  mockHistorieInsert,
  mockStorageRemove, mockStorageUpload,
} = vi.hoisted(() => ({
  mockValidateAgencyKey: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockRessourceInsert: vi.fn(),
  mockRessourceUpdate: vi.fn(),
  mockVakanzSelect: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
  mockHistorieInsert: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockStorageUpload: vi.fn(),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateAgencyKey: mockValidateAgencyKey,
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressourcen') return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockRessourceSelect,
        single: mockRessourceInsert,
      }
      if (table === 'vakanzen') return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockVakanzSelect,
      }
      if (table === 'ressource_vakanz_links') return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: mockLinkSelect,
        single: mockLinkInsert,
      }
      if (table === 'ressource_historie') return { insert: mockHistorieInsert }
      return {}
    }),
    storage: {
      from: vi.fn(() => ({
        remove: mockStorageRemove,
        upload: mockStorageUpload,
      })),
    },
  })),
}))

import { POST } from './route'

function makeRequest(agenturId: string, body: unknown) {
  return new NextRequest(`http://localhost/webhooks/agency/${agenturId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sfhub_test' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateAgencyKey.mockResolvedValue({ agencyId: AGENCY_ID, error: null })
  mockHistorieInsert.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({})
  mockStorageUpload.mockResolvedValue({ error: null })
})

describe('Auth & ownership', () => {
  it('gibt 401 zurück wenn Key ungültig', async () => {
    mockValidateAgencyKey.mockResolvedValue({
      agencyId: null,
      error: new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 401 }),
    })
    const res = await POST(makeRequest(AGENCY_ID, { event: 'profile.upserted' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück wenn Key einer anderen Agentur gehört', async () => {
    mockValidateAgencyKey.mockResolvedValue({ agencyId: OTHER_AGENCY_ID, error: null })
    const res = await POST(makeRequest(AGENCY_ID, { event: 'profile.upserted' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(403)
  })
})

describe('Unbekanntes Event', () => {
  it('gibt 200 skipped zurück', async () => {
    const res = await POST(makeRequest(AGENCY_ID, { event: 'something.unknown' }), makeParams(AGENCY_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ received: true, skipped: true })
  })
})

describe('profile.upserted — neues Profil', () => {
  it('legt Profil an und gibt 200 zurück', async () => {
    mockRessourceSelect.mockResolvedValue({ data: null, error: null })
    mockRessourceInsert.mockResolvedValue({ data: { id: 'r1' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
      firstName: 'Max',
      lastName: 'Muster',
      skills: ['Python'],
      seniority: 'SENIOR',
      availability: 'AVAILABLE_NOW',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    expect(body.processed.created).toBe(true)
    expect(body.processed.externalRef).toBe('AG-1')
  })

  it('gibt 400 zurück wenn Pflichtfelder fehlen', async () => {
    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
    }), makeParams(AGENCY_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })
})

describe('profile.upserted — bestehendes Profil', () => {
  it('aktualisiert Profil', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', cv_pfad: null }, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.upserted',
      externalRef: 'AG-1',
      firstName: 'Max',
      lastName: 'Muster',
      skills: ['Go'],
      seniority: 'EXPERT',
      availability: 'UNAVAILABLE',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.created).toBe(false)
  })
})

describe('profile.deactivated', () => {
  it('setzt verfuegbarkeit auf Deaktiviert', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.deactivated',
      externalRef: 'AG-1',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('gibt 404 zurück wenn Profil nicht gefunden', async () => {
    mockRessourceSelect.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'profile.deactivated',
      externalRef: 'NICHT-DA',
    }), makeParams(AGENCY_ID))
    expect(res.status).toBe(404)
  })
})

describe('submission.created', () => {
  it('erstellt Einreichung', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Offen', published: true }, error: null })
    mockLinkInsert.mockResolvedValue({ data: { id: 'l1' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.submissionId).toBe('l1')
  })

  it('gibt 409 zurück bei Duplikat', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Offen', published: true }, error: null })
    mockLinkInsert.mockResolvedValue({ data: null, error: { code: '23505' } })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(409)
  })

  it('gibt 400 zurück wenn Position besetzt', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1', verfuegbarkeit: 'Jetzt verfügbar' }, error: null })
    mockVakanzSelect.mockResolvedValue({ data: { id: 'v1', rolle: 'Dev', status: 'Besetzt', published: true }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.created',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('POSITION_CLOSED')
  })
})

describe('submission.withdrawn', () => {
  it('setzt Status auf Zurückgezogen', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockLinkSelect.mockResolvedValue({ data: { id: 'l1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({ error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.withdrawn',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed.submissionId).toBe('l1')
  })

  it('gibt 400 zurück wenn Einreichung bereits beauftragt', async () => {
    mockRessourceSelect.mockResolvedValue({ data: { id: 'r1' }, error: null })
    mockLinkSelect.mockResolvedValue({ data: { id: 'l1', status: 'Beauftragt' }, error: null })

    const res = await POST(makeRequest(AGENCY_ID, {
      event: 'submission.withdrawn',
      externalRef: 'AG-1',
      positionId: '00000000-0000-0000-0000-000000000001',
    }), makeParams(AGENCY_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('INVALID_STATUS')
  })
})
```

- [ ] **Step 2: Tests laufen lassen — sicherstellen dass sie FEHLSCHLAGEN**

```bash
npx vitest run src/app/webhooks/agency/\\[id\\]/route.test.ts
```

Erwartet: Alle Tests FAIL mit "Cannot find module" oder ähnlichem.

- [ ] **Step 3: Route Handler implementieren**

Erstelle `src/app/webhooks/agency/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateAgencyKey } from '@/lib/external-api-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const MAX_CV_BYTES = 5 * 1024 * 1024

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior', EXPERT: 'Expert',
}
const AVAILABILITY_MAP: Record<string, string> = {
  AVAILABLE_NOW: 'Jetzt verfügbar',
  AVAILABLE_FROM: 'Verfügbar ab',
  UNAVAILABLE: 'Nicht verfügbar',
}
const WORKMODEL_MAP: Record<string, string> = {
  REMOTE: 'Onshore', ONSITE: 'Onsite', HYBRID: 'Onshore',
  ONSHORE: 'Onshore', NEARSHORE: 'Nearshore', OFFSHORE: 'Offshore',
}

const profileUpsertedSchema = z.object({
  event: z.literal('profile.upserted'),
  externalRef: z.string().min(1).max(255),
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  skills: z.array(z.string()).min(1).max(30),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']),
  availability: z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']),
  availableFrom: z.string().nullable().optional(),
  workModel: z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location: z.string().max(200).nullable().optional(),
  cvBase64: z.string().nullable().optional(),
}).refine(
  (d) => d.availability !== 'AVAILABLE_FROM' || !!d.availableFrom,
  { message: 'availableFrom required when availability=AVAILABLE_FROM', path: ['availableFrom'] }
)

const profileDeactivatedSchema = z.object({
  event: z.literal('profile.deactivated'),
  externalRef: z.string().min(1).max(255),
})

const submissionCreatedSchema = z.object({
  event: z.literal('submission.created'),
  externalRef: z.string().min(1).max(255),
  positionId: z.string().uuid(),
})

const submissionWithdrawnSchema = z.object({
  event: z.literal('submission.withdrawn'),
  externalRef: z.string().min(1).max(255),
  positionId: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id: agenturId } = await params

  if (auth.agencyId !== agenturId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.event !== 'string') {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: { event: ['Required'] } },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  switch (body.event) {
    case 'profile.upserted': {
      const parsed = profileUpsertedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const d = parsed.data

      if (d.cvBase64) {
        const buf = Buffer.from(d.cvBase64, 'base64')
        if (buf.byteLength > MAX_CV_BYTES) {
          return NextResponse.json({ error: 'CV_TOO_LARGE', message: 'CV max 5 MB' }, { status: 413 })
        }
      }

      const payload = {
        name: `${d.firstName} ${d.lastName}`.trim(),
        vorname: d.firstName,
        nachname: d.lastName,
        skills: d.skills,
        erfahrungslevel: SENIORITY_MAP[d.seniority],
        verfuegbarkeit: AVAILABILITY_MAP[d.availability],
        verfuegbar_ab: d.availableFrom ?? null,
        arbeitsmodell: WORKMODEL_MAP[d.workModel ?? 'ONSHORE'] ?? 'Onshore',
        wohnort: d.location ?? null,
        agentur_id: agenturId,
        external_ref: d.externalRef,
      }

      const { data: existing } = await supabase
        .from('ressourcen')
        .select('id, cv_pfad')
        .eq('external_ref', d.externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      let ressourceId: string
      let created: boolean

      if (existing) {
        await supabase.from('ressourcen').update(payload).eq('id', existing.id)
        ressourceId = existing.id
        created = false
      } else {
        const { data: newR, error } = await supabase
          .from('ressourcen').insert(payload).select('id').single()
        if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
        ressourceId = newR.id
        created = true
      }

      if (d.cvBase64) {
        const buffer = Buffer.from(d.cvBase64, 'base64')
        if (existing?.cv_pfad) {
          await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
        }
        const cvPfad = `${agenturId}/${ressourceId}.pdf`
        await supabase.storage
          .from('ressourcen-cvs')
          .upload(cvPfad, buffer, { contentType: 'application/pdf', upsert: true })
        await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', ressourceId)
      }

      return NextResponse.json({
        received: true,
        event: d.event,
        processed: { profileId: ressourceId, externalRef: d.externalRef, created },
      })
    }

    case 'profile.deactivated': {
      const parsed = profileDeactivatedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id')
        .eq('external_ref', parsed.data.externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }

      await supabase.from('ressourcen').update({ verfuegbarkeit: 'Deaktiviert' }).eq('id', ressource.id)

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { profileId: ressource.id } })
    }

    case 'submission.created': {
      const parsed = submissionCreatedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const { externalRef, positionId } = parsed.data

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id, verfuegbarkeit')
        .eq('external_ref', externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }
      if (ressource.verfuegbarkeit === 'Deaktiviert') {
        return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 400 })
      }

      const { data: vakanz } = await supabase
        .from('vakanzen')
        .select('id, rolle, status, published')
        .eq('id', positionId)
        .maybeSingle()

      if (!vakanz || !vakanz.published) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Position nicht gefunden' }, { status: 404 })
      }
      if (vakanz.status === 'Besetzt' || vakanz.status === 'Geschlossen') {
        return NextResponse.json({ error: 'POSITION_CLOSED' }, { status: 400 })
      }

      const { data: link, error: insertError } = await supabase
        .from('ressource_vakanz_links')
        .insert({ ressource_id: ressource.id, vakanz_id: positionId, status: 'Gespielt', created_by: null })
        .select('id')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({ error: 'ALREADY_SUBMITTED' }, { status: 409 })
        }
        return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
      }

      await supabase.from('ressource_historie').insert({
        ressource_id: ressource.id,
        link_id: link.id,
        typ: 'system',
        text: `Via Inbound-Webhook auf Position "${vakanz.rolle}" eingereicht`,
        erstellt_von: null,
      })

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { submissionId: link.id } })
    }

    case 'submission.withdrawn': {
      const parsed = submissionWithdrawnSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const { externalRef, positionId } = parsed.data

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id')
        .eq('external_ref', externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }

      const { data: link } = await supabase
        .from('ressource_vakanz_links')
        .select('id, status')
        .eq('ressource_id', ressource.id)
        .eq('vakanz_id', positionId)
        .maybeSingle()

      if (!link) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Einreichung nicht gefunden' }, { status: 404 })
      }
      if (['Beauftragt', 'Abgesagt', 'Zurückgezogen'].includes(link.status)) {
        return NextResponse.json({ error: 'INVALID_STATUS', message: 'Einreichung kann nicht zurückgezogen werden' }, { status: 400 })
      }

      await supabase.from('ressource_vakanz_links').update({ status: 'Zurückgezogen' }).eq('id', link.id)

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { submissionId: link.id } })
    }

    default:
      return NextResponse.json({ received: true, skipped: true })
  }
}
```

- [ ] **Step 4: Tests laufen lassen — alle müssen GRÜN sein**

```bash
npx vitest run src/app/webhooks/agency/\\[id\\]/route.test.ts
```

Erwartet: Alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/webhooks/agency/[id]/route.ts src/app/webhooks/agency/[id]/route.test.ts
git commit -m "feat: add inbound agency webhook endpoint (POST /webhooks/agency/[id])"
```

---

### Task 2: Admin UI — Inbound Webhook URL in Übergabe-Info

**Files:**
- Modify: `src/app/admin/page.tsx` (Funktion `buildUebergabeText` + JSX in `NeuerApiKeySheet`)

**Interfaces:**
- Consumes: `agenturId` state (bereits vorhanden in `NeuerApiKeySheet` — gesetzt wenn Agency layer aktiv)
- Consumes: `generatedLayers` state (bereits vorhanden)
- Consumes: `BASE_URL` Konstante (`'https://api.staffhub.digital'`)

- [ ] **Step 1: `buildUebergabeText` um Inbound-Webhook-Sektion erweitern**

Suche in `src/app/admin/page.tsx` die Funktion `buildUebergabeText`. Ersetze sie durch:

```typescript
function buildUebergabeText(keyName: string, key: string, activeLayers: Set<'demand' | 'supply' | 'agency'>, agenturId?: string): string {
  const lines: string[] = [
    `=== Staffhub API – Zugangsdaten für „${keyName}" ===`,
    '',
    `Base-URL : ${BASE_URL}`,
    `API-Key  : ${key}`,
    `Header   : Authorization: Bearer <API-Key>`,
    '',
  ]
  for (const layer of ['demand', 'supply', 'agency'] as const) {
    if (!activeLayers.has(layer)) continue
    lines.push(`--- ${LAYER_LABELS[layer]} ---`)
    for (const ep of LAYER_ENDPOINTS[layer]) {
      lines.push(`${ep.method.padEnd(6)} ${BASE_URL}${ep.path}`)
    }
    lines.push('')
  }
  if (activeLayers.has('agency') && agenturId) {
    lines.push('--- Inbound Webhook (Agentur → Staffhub) ---')
    lines.push(`POST   ${BASE_URL}/webhooks/agency/${agenturId}`)
    lines.push(`Header : Authorization: Bearer <API-Key>`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
```

- [ ] **Step 2: `copyAll`-Aufruf in `NeuerApiKeySheet` anpassen**

Suche in `NeuerApiKeySheet` den Aufruf von `buildUebergabeText` (im `copyAll`-Handler):

```typescript
// ALT:
await navigator.clipboard.writeText(buildUebergabeText(name, generatedKey, generatedLayers))

// NEU:
await navigator.clipboard.writeText(buildUebergabeText(name, generatedKey, generatedLayers, agenturId || undefined))
```

- [ ] **Step 3: Inbound-Webhook-Sektion in der Übergabe-Box ergänzen**

Suche im JSX von `NeuerApiKeySheet` die Endpunkte-Sektion (das `.filter(l => generatedLayers.has(l)).map(layer => ...)` Block). Füge **nach** diesem Block hinzu:

```tsx
{/* Inbound Webhook — nur wenn Agency-Layer aktiv und agenturId bekannt */}
{generatedLayers.has('agency') && agenturId && (
  <div className="space-y-1.5">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Inbound Webhook (Agentur → Staffhub)
    </p>
    <div className="rounded-md border bg-background divide-y">
      <div className="flex items-center gap-3 px-3 py-2">
        <Badge variant="outline" className="shrink-0 font-mono text-[10px] w-12 justify-center bg-blue-100 text-blue-700 border-blue-200">
          POST
        </Badge>
        <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
          /webhooks/agency/{agenturId}
        </span>
        <span className="text-xs text-muted-foreground/70 shrink-0">Profile & Einreichungen pushen</span>
      </div>
    </div>
    <p className="text-[10px] text-muted-foreground">
      Header: <span className="font-mono">Authorization: Bearer &lt;API-Key&gt;</span>
    </p>
  </div>
)}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: show inbound webhook URL in agency API key handoff info"
```
