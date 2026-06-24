# Agency API v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REST API für externe Agentur-Plattformen unter `agency/v1.0/` — Positionen abrufen, Profile einreichen, Status-Webhooks empfangen.

**Architecture:** Neuer Next.js Route-Namespace `src/app/agency/v1.0/` mit API-Key-Auth (bestehende `validateExternalApiKey`-Infrastruktur erweitert). Push-Webhooks via neue `src/lib/agency-webhook.ts`. DB-Erweiterung per Migration 015.

**Tech Stack:** Next.js App Router, Supabase (service-role client), Zod, TypeScript, HMAC-SHA256 Webhooks.

**Spec:** `docs/superpowers/specs/2026-06-24-agency-api-design.md`

## Global Constraints

- Alle `agency/v1.0/`-Routen nutzen `createServiceRoleClient()` (kein Session-Auth)
- Auth via `Bearer <api-key>` oder `x-api-key` Header
- `vakanzen_data` = Schreib-Tabelle, `vakanzen` = Read-View (für SELECT)
- Bucket für CV-Uploads: `ressourcen-cvs`
- Max. CV-Größe: 5 MB (base64-decoded)
- Status-Mapping intern → API: `Gespielt`→`SUBMITTED`, `Interview geplant`→`INTERVIEW`, `Zugesagt`→`RESERVED`, `Beauftragt`→`BOOKED`, `Abgelehnt`→`REJECTED`, `Abgesagt`→`WITHDRAWN`, `Zurückgezogen`→`WITHDRAWN`
- Alle Webhooks: fire-and-forget (`.catch(console.error)`)
- `created_by`-Spalte in `ressource_vakanz_links` muss nullable sein (agency API hat keinen session User)

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `migrations/015_agency_api.sql` | Create | DB-Erweiterung |
| `src/lib/external-api-auth.ts` | Modify | `validateAgencyKey` + neue Permissions |
| `src/lib/agency-webhook.ts` | Create | Webhook-Funktionen |
| `src/app/agency/v1.0/positions/route.ts` | Create | GET positions list |
| `src/app/agency/v1.0/positions/[id]/route.ts` | Create | GET position detail |
| `src/app/agency/v1.0/positions/[id]/submissions/route.ts` | Create | GET submissions (polling) |
| `src/app/agency/v1.0/profiles/route.ts` | Create | POST + GET profiles |
| `src/app/agency/v1.0/profiles/[id]/route.ts` | Create | PUT profile |
| `src/app/agency/v1.0/profiles/[id]/submit/route.ts` | Create | POST submit (spielen) |
| `src/app/api/ressource-links/[id]/status/route.ts` | Modify | Hook: `submission.status_changed` + `position.closed` |
| `src/app/demand/v1.0/vakanzen/[id]/publish/route.ts` | Modify | Hook: `position.published` |

---

### Task 1: DB Migration + Auth Extension

**Files:**
- Create: `migrations/015_agency_api.sql`
- Modify: `src/lib/external-api-auth.ts`

**Interfaces:**
- Produces: `validateAgencyKey(request, permission): Promise<{ agencyId: string; error: null } | { agencyId: null; error: NextResponse }>`

- [ ] **Step 1: Migration schreiben**

Erstelle `migrations/015_agency_api.sql`:

```sql
-- migrations/015_agency_api.sql
-- Extends external_api_keys with agentur_id scope
-- Extends agenturen with agency webhook config

ALTER TABLE external_api_keys
  ADD COLUMN IF NOT EXISTS agentur_id UUID REFERENCES agenturen(id);

ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS agency_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS agency_webhook_secret TEXT;

-- created_by in ressource_vakanz_links muss nullable sein für API-Einsatz
ALTER TABLE ressource_vakanz_links
  ALTER COLUMN created_by DROP NOT NULL;
```

- [ ] **Step 2: Migration in Supabase anwenden**

```bash
# Lokale Supabase-Instanz:
npx supabase db push
# oder direkt im Dashboard ausführen
```

Erwartung: Keine Fehler, drei Spalten hinzugefügt, eine Constraint entfernt.

- [ ] **Step 3: `external-api-auth.ts` erweitern**

Lies `src/lib/external-api-auth.ts` und ergänze:

```ts
// Neue Permissions anhängen an den bestehenden Union-Type:
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
  | 'agency:positions:read'    // NEU
  | 'agency:profiles:write'    // NEU
  | 'agency:profiles:read'     // NEU
```

Neue Funktion am Ende der Datei anhängen:

```ts
// Gibt agencyId zurück wenn Key gültig und permission gesetzt.
// Gibt NextResponse-Fehler zurück wenn nicht.
export async function validateAgencyKey(
  request: NextRequest,
  permission: ApiPermission
): Promise<{ agencyId: string; error: null } | { agencyId: null; error: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  const key = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
           ?? request.headers.get('x-api-key')
  if (!key) {
    return { agencyId: null, error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }
  }

  const hash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, permissions, aktiv, agentur_id')
    .eq('key_hash', hash)
    .single()

  if (error || !data || !data.aktiv) {
    return { agencyId: null, error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }
  }

  if (!(data.permissions as string[]).includes(permission)) {
    return { agencyId: null, error: NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 }) }
  }

  if (!data.agentur_id) {
    return { agencyId: null, error: NextResponse.json({ error: 'API-Key nicht einer Agentur zugeordnet' }, { status: 403 }) }
  }

  // Fire-and-forget: last_used_at
  supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return { agencyId: data.agentur_id as string, error: null }
}
```

- [ ] **Step 4: TypeScript kompilieren**

```bash
npx tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add migrations/015_agency_api.sql src/lib/external-api-auth.ts
git commit -m "feat: add agency API permissions and validateAgencyKey"
```

---

### Task 2: Agency Webhook Library

**Files:**
- Create: `src/lib/agency-webhook.ts`

**Interfaces:**
- Consumes: `agenturen.agency_webhook_url`, `agenturen.agency_webhook_secret` (aus Task 1 Migration)
- Produces:
  - `sendPositionPublished(vakanzId: string): Promise<void>`
  - `sendPositionClosed(vakanzId: string, reason: 'FILLED' | 'CANCELLED'): Promise<void>`
  - `sendSubmissionStatusChanged(opts: { vakanzId: string; profileId: string; externalRef: string | null; status: string; agenturId: string }): Promise<void>`

- [ ] **Step 1: `agency-webhook.ts` erstellen**

```ts
// src/lib/agency-webhook.ts
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const INTERNAL_TO_API: Record<string, string> = {
  'Gespielt':           'SUBMITTED',
  'Interview geplant':  'INTERVIEW',
  'Zugesagt':           'RESERVED',
  'Beauftragt':         'BOOKED',
  'Abgelehnt':          'REJECTED',
  'Abgesagt':           'WITHDRAWN',
  'Zurückgezogen':      'WITHDRAWN',
}

export function mapSubmissionStatus(internal: string): string {
  return INTERNAL_TO_API[internal] ?? 'SUBMITTED'
}

async function sendToAgency(url: string, secret: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-staffhub-signature': sig },
    body,
  })
  if (!res.ok) {
    console.error(`Agency webhook HTTP ${res.status} for event "${(payload as { event?: string }).event}"`)
  }
}

async function loadAllAgencyWebhooks(): Promise<{ url: string; secret: string }[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('agenturen')
    .select('agency_webhook_url, agency_webhook_secret')
    .not('agency_webhook_url', 'is', null)
    .not('agency_webhook_secret', 'is', null)
  return (data ?? []).map((a) => ({
    url: a.agency_webhook_url as string,
    secret: a.agency_webhook_secret as string,
  }))
}

async function loadAgencyWebhook(agenturId: string): Promise<{ url: string; secret: string } | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('agenturen')
    .select('agency_webhook_url, agency_webhook_secret')
    .eq('id', agenturId)
    .not('agency_webhook_url', 'is', null)
    .not('agency_webhook_secret', 'is', null)
    .single()
  if (!data) return null
  return { url: data.agency_webhook_url as string, secret: data.agency_webhook_secret as string }
}

// Broadcast an alle Agenturen mit Webhook
export async function sendPositionPublished(vakanzId: string, position: Record<string, unknown>): Promise<void> {
  const hooks = await loadAllAgencyWebhooks()
  await Promise.all(hooks.map((h) => sendToAgency(h.url, h.secret, { event: 'position.published', position })))
}

export async function sendPositionClosed(vakanzId: string, reason: 'FILLED' | 'CANCELLED'): Promise<void> {
  const hooks = await loadAllAgencyWebhooks()
  await Promise.all(hooks.map((h) => sendToAgency(h.url, h.secret, { event: 'position.closed', positionId: vakanzId, reason })))
}

// Nur an die Agentur der Ressource
export async function sendSubmissionStatusChanged(opts: {
  vakanzId: string
  profileId: string
  externalRef: string | null
  internalStatus: string
  agenturId: string
}): Promise<void> {
  const hook = await loadAgencyWebhook(opts.agenturId)
  if (!hook) return
  await sendToAgency(hook.url, hook.secret, {
    event: 'submission.status_changed',
    positionId: opts.vakanzId,
    profileId: opts.profileId,
    externalRef: opts.externalRef,
    status: mapSubmissionStatus(opts.internalStatus),
    updatedAt: new Date().toISOString(),
  })
}
```

- [ ] **Step 2: TypeScript kompilieren**

```bash
npx tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agency-webhook.ts
git commit -m "feat: add agency webhook library"
```

---

### Task 3: GET /agency/v1.0/positions (List)

**Files:**
- Create: `src/app/agency/v1.0/positions/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey(request, 'agency:positions:read')` aus Task 1
- Produces: `GET /agency/v1.0/positions` → `{ data: Position[], nextCursor: string | null }`

- [ ] **Step 1: Route erstellen**

```bash
mkdir -p src/app/agency/v1.0/positions
```

Erstelle `src/app/agency/v1.0/positions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const VAKANZ_STATUS_MAP: Record<string, string> = {
  Offen: 'OPEN',
  Besetzt: 'FILLED',
  Geschlossen: 'CLOSED',
  'Ausreichend Profile': 'OPEN',
}

const SENIORITY_MAP: Record<string, string> = {
  Junior: 'JUNIOR',
  Mid: 'MID',
  Senior: 'SENIOR',
  Expert: 'EXPERT',
}

const WORKMODEL_MAP: Record<string, string> = {
  Remote: 'REMOTE',
  Hybrid: 'HYBRID',
  Onsite: 'ONSITE',
  Onshore: 'ONSHORE',
  Nearshore: 'NEARSHORE',
  Offshore: 'OFFSHORE',
}

export async function GET(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:positions:read')
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor')

  const supabase = createServiceRoleClient()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('vakanzen')
    .select(`
      id, rolle, branche, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, auslastung,
      arbeitsmodell, standort, status, published_at, created_at
    `)
    .eq('published', true)
    .or(`status.neq.Besetzt,besetzt_seit.gt.${threeDaysAgo},besetzt_seit.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const rows = hasMore ? data!.slice(0, limit) : (data ?? [])

  const positions = rows.map((v) => ({
    id: v.id,
    role: v.rolle,
    industry: v.branche,
    description: v.beschreibung,
    skills: v.skills ?? [],
    skillsNiceToHave: v.skills_nice_have ?? [],
    seniority: SENIORITY_MAP[v.erfahrungslevel ?? ''] ?? v.erfahrungslevel,
    startDate: v.startdatum,
    endDate: v.enddatum,
    utilizationPct: v.auslastung,
    workModel: WORKMODEL_MAP[v.arbeitsmodell ?? ''] ?? v.arbeitsmodell,
    location: v.standort ?? null,
    status: VAKANZ_STATUS_MAP[v.status ?? ''] ?? 'OPEN',
    publishedAt: v.published_at ?? null,
  }))

  const nextCursor = hasMore ? rows[rows.length - 1]?.created_at ?? null : null

  return NextResponse.json({ data: positions, nextCursor })
}
```

- [ ] **Step 2: TypeScript kompilieren**

```bash
npx tsc --noEmit
```

Erwartung: Keine Fehler.

- [ ] **Step 3: Manuell testen**

```bash
# Entwicklungsserver starten
npm run dev

# API-Key in DB anlegen (Supabase Dashboard oder SQL):
# INSERT INTO external_api_keys (key_hash, permissions, aktiv, agentur_id)
# VALUES (sha256('sfhub_testkey123'), ARRAY['agency:positions:read'], true, '<agentur-uuid>');

curl -H "x-api-key: sfhub_testkey123" http://localhost:3000/agency/v1.0/positions
```

Erwartung: JSON mit `{ data: [...], nextCursor: null }` — nur published Vakanzen.

- [ ] **Step 4: Commit**

```bash
git add src/app/agency/v1.0/positions/route.ts
git commit -m "feat: GET /agency/v1.0/positions"
```

---

### Task 4: GET /agency/v1.0/positions/{id} (Detail)

**Files:**
- Create: `src/app/agency/v1.0/positions/[id]/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey` aus Task 1, gleiche Status-Maps wie Task 3
- Produces: `GET /agency/v1.0/positions/{id}` → `{ position: Position }`

- [ ] **Step 1: Route erstellen**

```bash
mkdir -p src/app/agency/v1.0/positions/[id]
```

Erstelle `src/app/agency/v1.0/positions/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const VAKANZ_STATUS_MAP: Record<string, string> = {
  Offen: 'OPEN',
  Besetzt: 'FILLED',
  Geschlossen: 'CLOSED',
  'Ausreichend Profile': 'OPEN',
}

const SENIORITY_MAP: Record<string, string> = {
  Junior: 'JUNIOR', Mid: 'MID', Senior: 'SENIOR', Expert: 'EXPERT',
}

const WORKMODEL_MAP: Record<string, string> = {
  Remote: 'REMOTE', Hybrid: 'HYBRID', Onsite: 'ONSITE',
  Onshore: 'ONSHORE', Nearshore: 'NEARSHORE', Offshore: 'OFFSHORE',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:positions:read')
  if (auth.error) return auth.error

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('vakanzen')
    .select(`
      id, rolle, branche, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, auslastung,
      arbeitsmodell, standort, status, published_at, published
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  if (!data.published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }

  return NextResponse.json({
    position: {
      id: data.id,
      role: data.rolle,
      industry: data.branche,
      description: data.beschreibung,
      skills: data.skills ?? [],
      skillsNiceToHave: data.skills_nice_have ?? [],
      seniority: SENIORITY_MAP[data.erfahrungslevel ?? ''] ?? data.erfahrungslevel,
      startDate: data.startdatum,
      endDate: data.enddatum,
      utilizationPct: data.auslastung,
      workModel: WORKMODEL_MAP[data.arbeitsmodell ?? ''] ?? data.arbeitsmodell,
      location: data.standort ?? null,
      status: VAKANZ_STATUS_MAP[data.status ?? ''] ?? 'OPEN',
      publishedAt: data.published_at ?? null,
    },
  })
}
```

- [ ] **Step 2: TypeScript kompilieren + Commit**

```bash
npx tsc --noEmit
git add src/app/agency/v1.0/positions/[id]/route.ts
git commit -m "feat: GET /agency/v1.0/positions/{id}"
```

---

### Task 5: POST + GET /agency/v1.0/profiles

**Files:**
- Create: `src/app/agency/v1.0/profiles/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey` aus Task 1, `createServiceRoleClient`
- Produces:
  - `POST /agency/v1.0/profiles` → `{ profileId: string; externalRef: string; created: boolean }`
  - `GET /agency/v1.0/profiles` → `{ data: Profile[]; nextCursor: string | null }`

- [ ] **Step 1: Verzeichnis und Route erstellen**

```bash
mkdir -p src/app/agency/v1.0/profiles
```

Erstelle `src/app/agency/v1.0/profiles/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const MAX_CV_BYTES = 5 * 1024 * 1024 // 5 MB decoded

const AVAILABILITY_MAP: Record<string, string> = {
  AVAILABLE_NOW: 'Jetzt verfügbar',
  AVAILABLE_FROM: 'Verfügbar ab',
  UNAVAILABLE: 'Nicht verfügbar',
}

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior', EXPERT: 'Expert',
}

const WORKMODEL_MAP: Record<string, string> = {
  REMOTE: 'Onshore', ONSITE: 'Onsite', HYBRID: 'Onshore',
  ONSHORE: 'Onshore', NEARSHORE: 'Nearshore', OFFSHORE: 'Offshore',
}

const profileSchema = z.object({
  externalRef:   z.string().min(1).max(255),
  firstName:     z.string().min(1).max(200),
  lastName:      z.string().min(1).max(200),
  skills:        z.array(z.string()).min(1).max(30),
  seniority:     z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']),
  availability:  z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']),
  availableFrom: z.string().nullable().optional(),
  workModel:     z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location:      z.string().max(200).nullable().optional(),
  cvBase64:      z.string().nullable().optional(),
}).refine(
  (d) => d.availability !== 'AVAILABLE_FROM' || !!d.availableFrom,
  { message: 'availableFrom erforderlich wenn availability=AVAILABLE_FROM', path: ['availableFrom'] }
)

export async function POST(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const d = parsed.data
  const supabase = createServiceRoleClient()
  const name = `${d.firstName} ${d.lastName}`.trim()

  // Upsert via externalRef + agentur_id
  const { data: existing } = await supabase
    .from('ressourcen')
    .select('id, cv_pfad')
    .eq('external_ref', d.externalRef)
    .eq('agentur_id', auth.agencyId)
    .maybeSingle()

  const ressourcePayload = {
    name,
    vorname: d.firstName,
    nachname: d.lastName,
    skills: d.skills,
    erfahrungslevel: SENIORITY_MAP[d.seniority],
    verfuegbarkeit: AVAILABILITY_MAP[d.availability],
    verfuegbar_ab: d.availableFrom ?? null,
    arbeitsmodell: WORKMODEL_MAP[d.workModel ?? 'ONSHORE'] ?? 'Onshore',
    wohnort: d.location ?? null,
    agentur_id: auth.agencyId,
    external_ref: d.externalRef,
  }

  let ressourceId: string
  let created: boolean

  if (existing) {
    const { error } = await supabase
      .from('ressourcen')
      .update(ressourcePayload)
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
    }
    ressourceId = existing.id
    created = false
  } else {
    const { data: newRessource, error } = await supabase
      .from('ressourcen')
      .insert({ ...ressourcePayload, verfuegbarkeit: AVAILABILITY_MAP[d.availability] })
      .select('id')
      .single()
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Anlegen' } }, { status: 500 })
    }
    ressourceId = newRessource.id
    created = true
  }

  // CV hochladen wenn vorhanden
  if (d.cvBase64) {
    const buffer = Buffer.from(d.cvBase64, 'base64')
    if (buffer.byteLength > MAX_CV_BYTES) {
      return NextResponse.json({ error: { code: 'CV_TOO_LARGE', message: 'CV darf max. 5 MB groß sein' } }, { status: 413 })
    }

    // Altes CV entfernen wenn vorhanden
    if (existing?.cv_pfad) {
      await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
    }

    const cvPfad = `${auth.agencyId}/${ressourceId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('ressourcen-cvs')
      .upload(cvPfad, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('CV upload error:', uploadError)
    } else {
      await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', ressourceId)
    }
  }

  return NextResponse.json({ profileId: ressourceId, externalRef: d.externalRef, created }, { status: created ? 201 : 200 })
}

export async function GET(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:profiles:read')
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor')

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('ressourcen')
    .select('id, external_ref, name, skills, erfahrungslevel, verfuegbarkeit, verfuegbar_ab, arbeitsmodell, wohnort, created_at')
    .eq('agentur_id', auth.agencyId)
    .neq('verfuegbarkeit', 'Deaktiviert')
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const rows = hasMore ? data!.slice(0, limit) : (data ?? [])

  const SENIORITY_OUT: Record<string, string> = {
    Junior: 'JUNIOR', Mid: 'MID', Senior: 'SENIOR', Expert: 'EXPERT',
  }

  const profiles = rows.map((r) => ({
    profileId: r.id,
    externalRef: r.external_ref ?? null,
    name: r.name,
    skills: r.skills ?? [],
    seniority: SENIORITY_OUT[r.erfahrungslevel ?? ''] ?? r.erfahrungslevel,
    availability: r.verfuegbarkeit,
    availableFrom: r.verfuegbar_ab ?? null,
    location: r.wohnort ?? null,
  }))

  return NextResponse.json({ data: profiles, nextCursor: hasMore ? rows[rows.length - 1]?.created_at ?? null : null })
}
```

- [ ] **Step 2: TypeScript kompilieren**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manuell testen (POST)**

```bash
curl -X POST http://localhost:3000/agency/v1.0/profiles \
  -H "x-api-key: sfhub_testkey123" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "ext-001",
    "firstName": "Anna",
    "lastName": "Muster",
    "skills": ["React", "TypeScript"],
    "seniority": "SENIOR",
    "availability": "AVAILABLE_NOW"
  }'
```

Erwartung: `{ "profileId": "<uuid>", "externalRef": "ext-001", "created": true }` mit Status 201.

Zweiter Aufruf mit gleichem `externalRef` → `"created": false`, Status 200.

- [ ] **Step 4: Commit**

```bash
git add src/app/agency/v1.0/profiles/route.ts
git commit -m "feat: POST + GET /agency/v1.0/profiles"
```

---

### Task 6: PUT /agency/v1.0/profiles/{id}

**Files:**
- Create: `src/app/agency/v1.0/profiles/[id]/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey(request, 'agency:profiles:write')`, gleiche Maps wie Task 5
- Produces: `PUT /agency/v1.0/profiles/{id}` → `{ profileId: string }`

- [ ] **Step 1: Route erstellen**

```bash
mkdir -p "src/app/agency/v1.0/profiles/[id]"
```

Erstelle `src/app/agency/v1.0/profiles/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const MAX_CV_BYTES = 5 * 1024 * 1024

const AVAILABILITY_MAP: Record<string, string> = {
  AVAILABLE_NOW: 'Jetzt verfügbar',
  AVAILABLE_FROM: 'Verfügbar ab',
  UNAVAILABLE: 'Nicht verfügbar',
}

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior', EXPERT: 'Expert',
}

const WORKMODEL_MAP: Record<string, string> = {
  REMOTE: 'Onshore', ONSITE: 'Onsite', HYBRID: 'Onshore',
  ONSHORE: 'Onshore', NEARSHORE: 'Nearshore', OFFSHORE: 'Offshore',
}

const updateSchema = z.object({
  firstName:     z.string().min(1).max(200).optional(),
  lastName:      z.string().min(1).max(200).optional(),
  skills:        z.array(z.string()).min(1).max(30).optional(),
  seniority:     z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']).optional(),
  availability:  z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']).optional(),
  availableFrom: z.string().nullable().optional(),
  workModel:     z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location:      z.string().max(200).nullable().optional(),
  cvBase64:      z.string().nullable().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id } = await params
  const supabase = createServiceRoleClient()

  // Ownership prüfen
  const { data: existing } = await supabase
    .from('ressourcen')
    .select('id, cv_pfad, agentur_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
  }
  if (existing.agentur_id !== auth.agencyId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Keine Berechtigung' } }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const d = parsed.data
  const updates: Record<string, unknown> = {}

  if (d.firstName !== undefined || d.lastName !== undefined) {
    const { data: cur } = await supabase.from('ressourcen').select('vorname, nachname').eq('id', id).single()
    const fn = d.firstName ?? cur?.vorname ?? ''
    const ln = d.lastName ?? cur?.nachname ?? ''
    updates.vorname = fn
    updates.nachname = ln
    updates.name = `${fn} ${ln}`.trim()
  }
  if (d.skills !== undefined)       updates.skills = d.skills
  if (d.seniority !== undefined)    updates.erfahrungslevel = SENIORITY_MAP[d.seniority]
  if (d.availability !== undefined) updates.verfuegbarkeit = AVAILABILITY_MAP[d.availability]
  if (d.availableFrom !== undefined) updates.verfuegbar_ab = d.availableFrom
  if (d.workModel !== undefined)    updates.arbeitsmodell = WORKMODEL_MAP[d.workModel]
  if (d.location !== undefined)     updates.wohnort = d.location

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('ressourcen').update(updates).eq('id', id)
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
    }
  }

  if (d.cvBase64) {
    const buffer = Buffer.from(d.cvBase64, 'base64')
    if (buffer.byteLength > MAX_CV_BYTES) {
      return NextResponse.json({ error: { code: 'CV_TOO_LARGE', message: 'CV darf max. 5 MB groß sein' } }, { status: 413 })
    }
    if (existing.cv_pfad) {
      await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
    }
    const cvPfad = `${auth.agencyId}/${id}.pdf`
    await supabase.storage.from('ressourcen-cvs').upload(cvPfad, buffer, { contentType: 'application/pdf', upsert: true })
    await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', id)
  }

  return NextResponse.json({ profileId: id })
}
```

- [ ] **Step 2: TypeScript kompilieren + Commit**

```bash
npx tsc --noEmit
git add "src/app/agency/v1.0/profiles/[id]/route.ts"
git commit -m "feat: PUT /agency/v1.0/profiles/{id}"
```

---

### Task 7: POST /agency/v1.0/profiles/{id}/submit

**Files:**
- Create: `src/app/agency/v1.0/profiles/[id]/submit/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey(request, 'agency:profiles:write')`
- Produces: `POST /agency/v1.0/profiles/{id}/submit` → `{ submissionId: string }`

- [ ] **Step 1: Route erstellen**

```bash
mkdir -p "src/app/agency/v1.0/profiles/[id]/submit"
```

Erstelle `src/app/agency/v1.0/profiles/[id]/submit/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const submitSchema = z.object({
  positionId: z.string().uuid('Ungültige Position-ID'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id: profileId } = await params
  const supabase = createServiceRoleClient()

  // Ressource prüfen + Ownership
  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('id, name, external_ref, agentur_id, verfuegbarkeit')
    .eq('id', profileId)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
  }
  if (ressource.agentur_id !== auth.agencyId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Keine Berechtigung für dieses Profil' } }, { status: 403 })
  }
  if (ressource.verfuegbarkeit === 'Deaktiviert') {
    return NextResponse.json({ error: { code: 'UNAVAILABLE', message: 'Deaktivierte Ressource kann nicht eingereicht werden' } }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const { positionId } = parsed.data

  // Vakanz prüfen: published + Offen
  const { data: vakanz } = await supabase
    .from('vakanzen')
    .select('id, rolle, status, published')
    .eq('id', positionId)
    .single()

  if (!vakanz) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }
  if (!vakanz.published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }
  if (vakanz.status === 'Besetzt' || vakanz.status === 'Geschlossen') {
    return NextResponse.json({ error: { code: 'POSITION_CLOSED', message: 'Position nimmt keine weiteren Profile an' } }, { status: 400 })
  }

  // Link anlegen (unique constraint verhindert Duplikate)
  const { data: link, error: insertError } = await supabase
    .from('ressource_vakanz_links')
    .insert({
      ressource_id: profileId,
      vakanz_id: positionId,
      status: 'Gespielt',
      created_by: null,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: { code: 'ALREADY_SUBMITTED', message: 'Profil bereits auf diese Position eingereicht' } },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Einreichen' } }, { status: 500 })
  }

  // Historien-Eintrag
  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: `Via Agency-API auf Position "${vakanz.rolle}" eingereicht`,
    erstellt_von: null,
  })

  return NextResponse.json({ submissionId: link.id }, { status: 201 })
}
```

- [ ] **Step 2: TypeScript kompilieren + Commit**

```bash
npx tsc --noEmit
git add "src/app/agency/v1.0/profiles/[id]/submit/route.ts"
git commit -m "feat: POST /agency/v1.0/profiles/{id}/submit"
```

---

### Task 8: GET /agency/v1.0/positions/{id}/submissions (Polling)

**Files:**
- Create: `src/app/agency/v1.0/positions/[id]/submissions/route.ts`

**Interfaces:**
- Consumes: `validateAgencyKey(request, 'agency:profiles:read')`, `mapSubmissionStatus` aus Task 2
- Produces: `GET /agency/v1.0/positions/{id}/submissions` → `{ data: Submission[] }`

- [ ] **Step 1: Route erstellen**

```bash
mkdir -p "src/app/agency/v1.0/positions/[id]/submissions"
```

Erstelle `src/app/agency/v1.0/positions/[id]/submissions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'
import { mapSubmissionStatus } from '@/lib/agency-webhook'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:read')
  if (auth.error) return auth.error

  const { id: positionId } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id, status, updated_at,
      ressourcen!inner(id, external_ref, vorname, nachname, agentur_id)
    `)
    .eq('vakanz_id', positionId)
    .eq('ressourcen.agentur_id', auth.agencyId)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const submissions = (data ?? []).map((link) => {
    const r = link.ressourcen as unknown as {
      id: string; external_ref: string | null; vorname: string | null; nachname: string | null
    }
    return {
      submissionId: link.id,
      profileId: r.id,
      externalRef: r.external_ref ?? null,
      firstName: r.vorname ?? null,
      lastName: r.nachname ?? null,
      status: mapSubmissionStatus(link.status),
      updatedAt: link.updated_at,
    }
  })

  return NextResponse.json({ data: submissions })
}
```

- [ ] **Step 2: TypeScript kompilieren + Commit**

```bash
npx tsc --noEmit
git add "src/app/agency/v1.0/positions/[id]/submissions/route.ts"
git commit -m "feat: GET /agency/v1.0/positions/{id}/submissions"
```

---

### Task 9: Webhook Hook — submission.status_changed + position.closed

**Files:**
- Modify: `src/app/api/ressource-links/[id]/status/route.ts`

**Interfaces:**
- Consumes: `sendSubmissionStatusChanged`, `sendPositionClosed` aus Task 2 (`src/lib/agency-webhook.ts`)

- [ ] **Step 1: Import hinzufügen**

In `src/app/api/ressource-links/[id]/status/route.ts`, oben nach dem `sendProfileUpdated`-Import:

```ts
import { sendSubmissionStatusChanged, sendPositionClosed } from '@/lib/agency-webhook'
```

- [ ] **Step 2: `submission.status_changed` Webhook einhängen**

Nach dem bestehenden Block (ca. Zeile 163-178, Magenta-Webhook bei `Beauftragt`), nach dem `sendProfileUpdated`-Block, folgenden Block einfügen:

```ts
  // Agency Webhook: submission.status_changed bei ALLEN Status-Wechseln
  // Agentur der Ressource ermitteln
  const { data: ressourceForWebhook } = await supabase
    .from('ressourcen')
    .select('id, external_ref, agentur_id')
    .eq('id', updated.ressource_id)
    .single()

  if (ressourceForWebhook?.agentur_id) {
    sendSubmissionStatusChanged({
      vakanzId: updated.vakanz_id,
      profileId: updated.ressource_id,
      externalRef: ressourceForWebhook.external_ref ?? null,
      internalStatus: newStatus,
      agenturId: ressourceForWebhook.agentur_id,
    }).catch((e) => console.error('Agency webhook error:', e))
  }
```

- [ ] **Step 3: `position.closed` Webhook einhängen**

Im gleichen File, nach dem Block der Vakanz auf `Besetzt` setzt (ca. Zeile 202-219, nach `await supabase.from('vakanzen').update({ status: 'Besetzt', ... })`):

```ts
        // Agency Webhook: position.closed
        sendPositionClosed(link.vakanz_id, 'FILLED')
          .catch((e) => console.error('Agency webhook error (position.closed):', e))
```

- [ ] **Step 4: TypeScript kompilieren**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ressource-links/[id]/status/route.ts
git commit -m "feat: fire agency webhooks on status change and position filled"
```

---

### Task 10: Webhook Hook — position.published

**Files:**
- Modify: `src/app/demand/v1.0/vakanzen/[id]/publish/route.ts`

**Interfaces:**
- Consumes: `sendPositionPublished` aus Task 2

- [ ] **Step 1: Import + Webhook einhängen**

In `src/app/demand/v1.0/vakanzen/[id]/publish/route.ts`:

Import hinzufügen oben:
```ts
import { sendPositionPublished } from '@/lib/agency-webhook'
```

Nach dem erfolgreichen Update (nach `return NextResponse.json({ published: parsed.data.published })`), **vor** dem return, wenn `published === true`:

Ersetze den return-Block am Ende der Funktion:

```ts
  // Webhook wenn published wird (nicht wenn unpublished)
  if (parsed.data.published === true) {
    // Vakanz-Daten für Webhook laden
    const { data: vakanzData } = await supabase
      .from('vakanzen')
      .select('id, rolle, branche, beschreibung, skills, skills_nice_have, erfahrungslevel, startdatum, enddatum, auslastung, arbeitsmodell, standort')
      .eq('id', id)
      .single()

    if (vakanzData) {
      sendPositionPublished(id, {
        id: vakanzData.id,
        role: vakanzData.rolle,
        industry: vakanzData.branche,
        description: vakanzData.beschreibung,
        skills: vakanzData.skills ?? [],
        skillsNiceToHave: vakanzData.skills_nice_have ?? [],
        seniority: vakanzData.erfahrungslevel,
        startDate: vakanzData.startdatum,
        endDate: vakanzData.enddatum,
        utilizationPct: vakanzData.auslastung,
        workModel: vakanzData.arbeitsmodell,
        location: vakanzData.standort ?? null,
      }).catch((e) => console.error('Agency webhook error:', e))
    }
  }

  return NextResponse.json({ published: parsed.data.published })
```

**Achtung:** Den bisherigen `return NextResponse.json({ published: ... })` am Ende des try/if-Blocks entfernen und durch obigen Block ersetzen.

- [ ] **Step 2: TypeScript kompilieren + Commit**

```bash
npx tsc --noEmit
git add src/app/demand/v1.0/vakanzen/[id]/publish/route.ts
git commit -m "feat: fire position.published agency webhook on vakanz publish"
```

---

### Task 11: End-to-End Smoke Test

- [ ] **Step 1: API-Key in DB anlegen**

Im Supabase Dashboard → SQL Editor:

```sql
-- Agentur-Webhook setzen (Test)
UPDATE agenturen
SET agency_webhook_url = 'https://webhook.site/<dein-test-token>',
    agency_webhook_secret = 'test-secret-123'
WHERE name = '<Agentur-Name>';

-- API-Key anlegen
INSERT INTO external_api_keys (key_hash, permissions, aktiv, agentur_id)
VALUES (
  encode(sha256('sfhub_agencytest123'::bytea), 'hex'),
  ARRAY['agency:positions:read', 'agency:profiles:write', 'agency:profiles:read'],
  true,
  (SELECT id FROM agenturen WHERE name = '<Agentur-Name>')
);
```

- [ ] **Step 2: Smoke Tests**

```bash
KEY="sfhub_agencytest123"
BASE="http://localhost:3000/agency/v1.0"

# 1. Positions list
curl -s -H "x-api-key: $KEY" "$BASE/positions" | jq '.data | length'
# Erwartung: Zahl > 0

# 2. Position detail
POS_ID=$(curl -s -H "x-api-key: $KEY" "$BASE/positions" | jq -r '.data[0].id')
curl -s -H "x-api-key: $KEY" "$BASE/positions/$POS_ID" | jq '.position.role'
# Erwartung: String mit Rolle

# 3. Profile anlegen
curl -s -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"externalRef":"smoke-001","firstName":"Test","lastName":"User","skills":["Java"],"seniority":"MID","availability":"AVAILABLE_NOW"}' \
  "$BASE/profiles" | jq .
# Erwartung: { profileId: "...", externalRef: "smoke-001", created: true }

# 4. Submit
PROFILE_ID=$(curl -s -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"externalRef":"smoke-002","firstName":"Sub","lastName":"Test","skills":["Python"],"seniority":"SENIOR","availability":"AVAILABLE_NOW"}' \
  "$BASE/profiles" | jq -r '.profileId')

curl -s -X POST -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d "{\"positionId\":\"$POS_ID\"}" \
  "$BASE/profiles/$PROFILE_ID/submit" | jq .
# Erwartung: { submissionId: "..." }

# 5. Submissions polling
curl -s -H "x-api-key: $KEY" "$BASE/positions/$POS_ID/submissions" | jq '.data'
# Erwartung: Array mit mind. einem Eintrag, status: "SUBMITTED"
```

- [ ] **Step 3: Webhook-Empfang prüfen**

Einen bestehenden Status ändern (via internes UI oder direkt via `PATCH /api/ressource-links/{linkId}/status`).  
Auf webhook.site prüfen: Payload enthält `event: "submission.status_changed"`, korrekte `status`-Mapping.

- [ ] **Step 4: Final Commit**

```bash
git add .
git commit -m "feat: agency API v1.0 complete — positions, profiles, webhooks"
```
