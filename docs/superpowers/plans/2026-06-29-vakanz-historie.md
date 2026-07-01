# Vakanz-Audit-Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Vakanz-Ereignisse in einer neuen `vakanz_historie`-Tabelle erfassen und im Admin-Aktivitäts-Log gemeinsam mit Ressource-Logs anzeigen.

**Architecture:** Neue Tabelle `vakanz_historie` (analog `ressource_historie`). Helper `log-vakanz-historie.ts` schreibt via Admin-Client (Service Role, umgeht RLS). Vier Routen erhalten Logging-Aufrufe. `GET /api/admin/logs` merged beide Tabellen serverseitig. Admin-UI zeigt neue "Referenz"-Spalte mit Links zu Ressource oder Vakanz.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Vitest

## Global Constraints

- Kein neuer Filter in der Admin-UI (YAGNI)
- Bestehende Tests dürfen nicht brechen
- `createAdminClient` aus `@/lib/supabase/admin` für alle vakanz_historie-Inserts (RLS hat keine INSERT-Policy für User)
- Migrations-Datei in `migrations/` (nicht `supabase/migrations/`)
- Schreiboperationen gehen auf `vakanzen_data`, Lesungen auf `vakanzen`

---

## File Map

| Datei | Aktion |
|---|---|
| `migrations/019_vakanz_historie.sql` | Neu: Tabellendefinition + RLS |
| `src/lib/log-vakanz-historie.ts` | Neu: Helper-Funktion |
| `src/app/api/vakanzen/route.ts` | Modify: POST-Handler + Log |
| `src/app/api/vakanzen/route.test.ts` | Modify: Admin-Client-Mock hinzufügen |
| `src/app/api/vakanzen/[id]/status/route.ts` | Modify: Alten Status laden + Log |
| `src/app/api/vakanzen/[id]/publish/route.ts` | Modify: Alten Published-Wert laden + Log |
| `src/app/api/vakanzen/[id]/route.ts` | Modify: PUT-Handler Diff-Logging |
| `src/app/api/admin/logs/route.ts` | Modify: vakanz_historie query + merge |
| `src/app/admin/logs/page.tsx` | Modify: Types + "Referenz"-Spalte |

---

## Task 1: Migration `vakanz_historie`

**Files:**
- Create: `migrations/019_vakanz_historie.sql`

**Interfaces:**
- Produces: Tabelle `vakanz_historie(id, vakanz_id, text, typ, erstellt_von, created_at)` in der DB

- [ ] **Schritt 1: Migration-Datei erstellen**

```sql
-- migrations/019_vakanz_historie.sql

CREATE TABLE IF NOT EXISTS vakanz_historie (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vakanz_id    UUID        NOT NULL REFERENCES vakanzen_data(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL,
  typ          TEXT        NOT NULL DEFAULT 'system'
                           CHECK (typ IN ('system', 'manuell')),
  erstellt_von UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vakanz_historie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin liest vakanz_historie"
  ON vakanz_historie FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND rolle = 'Admin'
        AND aktiv = true
    )
  );

CREATE INDEX IF NOT EXISTS vakanz_historie_vakanz_id_idx
  ON vakanz_historie(vakanz_id);

CREATE INDEX IF NOT EXISTS vakanz_historie_created_at_idx
  ON vakanz_historie(created_at DESC);
```

- [ ] **Schritt 2: Migration in Supabase anwenden**

Im Supabase Dashboard → SQL Editor: Inhalt der Datei einfügen und ausführen. Alternativ via CLI:

```bash
supabase db push
```

Verifikation im SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vakanz_historie';
```
Erwartetes Ergebnis: 6 Spalten (id, vakanz_id, text, typ, erstellt_von, created_at).

- [ ] **Schritt 3: Commit**

```bash
git add migrations/019_vakanz_historie.sql
git commit -m "feat: add vakanz_historie table with RLS"
```

---

## Task 2: Helper `log-vakanz-historie.ts`

**Files:**
- Create: `src/lib/log-vakanz-historie.ts`

**Interfaces:**
- Consumes: `createAdminClient` aus `@/lib/supabase/admin`
- Produces: `logVakanzHistorie({ vakanzId, text, typ?, erstelltVon? }): Promise<void>`

- [ ] **Schritt 1: Helper erstellen**

```typescript
// src/lib/log-vakanz-historie.ts
import { createAdminClient } from '@/lib/supabase/admin'

interface LogVakanzHistorieOptions {
  vakanzId: string
  text: string
  typ?: 'system' | 'manuell'
  erstelltVon?: string | null
}

export async function logVakanzHistorie({
  vakanzId,
  text,
  typ = 'system',
  erstelltVon = null,
}: LogVakanzHistorieOptions): Promise<void> {
  const admin = createAdminClient()
  await admin.from('vakanz_historie').insert({
    vakanz_id: vakanzId,
    text,
    typ,
    erstellt_von: erstelltVon,
  })
}
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add src/lib/log-vakanz-historie.ts
git commit -m "feat: add logVakanzHistorie helper"
```

---

## Task 3: POST /api/vakanzen — Erstellungs-Log

**Files:**
- Modify: `src/app/api/vakanzen/route.ts`
- Modify: `src/app/api/vakanzen/route.test.ts`

**Interfaces:**
- Consumes: `logVakanzHistorie` aus `src/lib/log-vakanz-historie.ts`
- Produces: Nach erfolgreichem POST liegt ein Eintrag `"Vakanz erstellt: [rolle]"` in `vakanz_historie`

- [ ] **Schritt 1: Failing-Test schreiben**

In `src/app/api/vakanzen/route.test.ts` den `vi.hoisted`-Block und Mock erweitern:

```typescript
// Bestehenden vi.hoisted-Block ersetzen:
const { mockGetUser, mockProfileSelect, mockVakanzenSelect, mockInsert, mockVakanzHistorieInsert } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockVakanzenSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockVakanzHistorieInsert: vi.fn().mockResolvedValue({ error: null }),
}))

// Neuen Mock für Admin-Client hinzufügen (nach dem bestehenden vi.mock):
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'vakanz_historie') {
        return { insert: mockVakanzHistorieInsert }
      }
      return {}
    }),
  }),
}))
```

Neuen Test am Ende von `describe('POST /api/vakanzen', ...)` hinzufügen:

```typescript
it('loggt Vakanz-Erstellung in vakanz_historie', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
  mockProfileSelect.mockResolvedValue({
    data: { rolle: 'Staffhub Manager', aktiv: true },
    error: null,
  })
  mockInsert.mockResolvedValue({
    data: { id: 'new-id', rolle: validVakanz.rolle, status: 'Offen', created_at: '2026-04-12T00:00:00Z' },
    error: null,
  })

  const res = await POST(makeRequest(validVakanz))
  expect(res.status).toBe(201)
  expect(mockVakanzHistorieInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      vakanz_id: 'new-id',
      text: `Vakanz erstellt: ${validVakanz.rolle}`,
      typ: 'system',
      erstellt_von: 'user-2',
    })
  )
})
```

- [ ] **Schritt 2: Test ausführen — muss FAIL sein**

```bash
npx vitest run src/app/api/vakanzen/route.test.ts
```
Erwartetes Ergebnis: Neuer Test schlägt fehl mit `mockVakanzHistorieInsert` not called.

- [ ] **Schritt 3: Implementation — POST-Handler erweitern**

In `src/app/api/vakanzen/route.ts`:

Import hinzufügen (nach dem bestehenden `import`-Block):
```typescript
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'
```

Im POST-Handler nach dem erfolgreichen Insert (nach `if (error) { ... }`), vor `return NextResponse.json`:
```typescript
  await logVakanzHistorie({
    vakanzId: vakanz.id,
    text: `Vakanz erstellt: ${vakanz.titel}`,
    erstelltVon: user.id,
  })

  return NextResponse.json({ vakanz }, { status: 201 })
```

- [ ] **Schritt 4: Test ausführen — muss PASS sein**

```bash
npx vitest run src/app/api/vakanzen/route.test.ts
```
Erwartetes Ergebnis: Alle Tests grün.

- [ ] **Schritt 5: Commit**

```bash
git add src/app/api/vakanzen/route.ts src/app/api/vakanzen/route.test.ts
git commit -m "feat: log vakanz creation in vakanz_historie"
```

---

## Task 4: PATCH /api/vakanzen/[id]/status — Status-Log

**Files:**
- Modify: `src/app/api/vakanzen/[id]/status/route.ts`

**Interfaces:**
- Consumes: `logVakanzHistorie` aus `src/lib/log-vakanz-historie.ts`
- Produces: Eintrag `"Status geändert: [alt] → [neu]"` in `vakanz_historie`

- [ ] **Schritt 1: Route anpassen**

Vollständiger neuer Inhalt von `src/app/api/vakanzen/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { VAKANZ_STATUS } from '@/lib/constants'
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'

const statusSchema = z.object({
  status: z.enum(VAKANZ_STATUS),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Alten Status laden für Log
  const { data: oldVakanz } = await supabase
    .from('vakanzen_data')
    .select('status')
    .eq('id', id)
    .single()

  const updatePayload: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'Besetzt') {
    updatePayload.besetzt_seit = new Date().toISOString()
    updatePayload.published = false
  } else {
    updatePayload.besetzt_seit = null
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen_data')
    .update(updatePayload)
    .eq('id', id)
    .select('id, titel, status, besetzt_seit, published, published_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    console.error('PATCH /api/vakanzen/[id]/status error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  if (oldVakanz?.status && oldVakanz.status !== parsed.data.status) {
    await logVakanzHistorie({
      vakanzId: id,
      text: `Status geändert: ${oldVakanz.status} → ${parsed.data.status}`,
      erstelltVon: user.id,
    })
  }

  return NextResponse.json({ vakanz })
}
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 3: Bestehende Tests noch grün**

```bash
npx vitest run src/app/api/vakanzen
```
Erwartetes Ergebnis: Alle bestehenden Tests bestehen.

- [ ] **Schritt 4: Commit**

```bash
git add src/app/api/vakanzen/[id]/status/route.ts
git commit -m "feat: log status change in vakanz_historie"
```

---

## Task 5: PATCH /api/vakanzen/[id]/publish — Publish-Log

**Files:**
- Modify: `src/app/api/vakanzen/[id]/publish/route.ts`

**Interfaces:**
- Consumes: `logVakanzHistorie` aus `src/lib/log-vakanz-historie.ts`
- Produces: Eintrag `"Veröffentlicht"` oder `"Veröffentlichung aufgehoben"` in `vakanz_historie`

- [ ] **Schritt 1: Route anpassen**

Vollständiger neuer Inhalt von `src/app/api/vakanzen/[id]/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'

const publishSchema = z.object({ published: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  // Alten Status + published-Wert laden (Besetzt-Check + Log)
  const { data: oldVakanz } = await supabase
    .from('vakanzen_data')
    .select('status, published')
    .eq('id', id)
    .single()

  if (parsed.data.published === true && oldVakanz?.status === 'Besetzt') {
    return NextResponse.json({ error: 'Besetzte Vakanzen können nicht veröffentlicht werden' }, { status: 400 })
  }

  const { error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  if (oldVakanz?.published !== parsed.data.published) {
    await logVakanzHistorie({
      vakanzId: id,
      text: parsed.data.published ? 'Veröffentlicht' : 'Veröffentlichung aufgehoben',
      erstelltVon: user.id,
    })
  }

  return NextResponse.json({ published: parsed.data.published })
}
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/vakanzen/[id]/publish/route.ts
git commit -m "feat: log publish/unpublish in vakanz_historie"
```

---

## Task 6: PUT /api/vakanzen/[id] — Diff-Logging

**Files:**
- Modify: `src/app/api/vakanzen/[id]/route.ts`

**Interfaces:**
- Consumes: `logVakanzHistorie` aus `src/lib/log-vakanz-historie.ts`
- Produces: Einzelne Log-Einträge je geändertem Feld (Rolle, Status, Skills, etc.)

- [ ] **Schritt 1: Hilfsfunktionen + Import hinzufügen**

Am Anfang von `src/app/api/vakanzen/[id]/route.ts` — nach den bestehenden Imports — einfügen:

```typescript
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'

function formatVakanzDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE')
}

function formatVakanzRate(rate: number | null | undefined): string {
  if (rate == null) return '–'
  return `${rate.toLocaleString('de-DE')} €/Tag`
}

function buildVakanzHistorieEntries(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): string[] {
  const entries: string[] = []

  if (oldData.rolle !== newData.rolle) {
    entries.push(`Rolle geändert: ${oldData.rolle ?? '–'} → ${newData.rolle ?? '–'}`)
  }
  if (oldData.status !== newData.status) {
    entries.push(`Status geändert: ${oldData.status ?? '–'} → ${newData.status ?? '–'}`)
  }
  if (oldData.branche !== newData.branche) {
    entries.push(`Branche geändert: ${oldData.branche ?? '–'} → ${newData.branche ?? '–'}`)
  }
  if (oldData.kunde !== newData.kunde) {
    entries.push(`Kunde geändert: ${oldData.kunde ?? '–'} → ${newData.kunde ?? '–'}`)
  }
  if (oldData.erfahrungslevel !== newData.erfahrungslevel) {
    entries.push(`Erfahrungslevel geändert: ${oldData.erfahrungslevel ?? '–'} → ${newData.erfahrungslevel ?? '–'}`)
  }
  if (oldData.arbeitsmodell !== newData.arbeitsmodell) {
    entries.push(`Arbeitsmodell geändert: ${oldData.arbeitsmodell ?? '–'} → ${newData.arbeitsmodell ?? '–'}`)
  }
  if (oldData.startdatum !== newData.startdatum) {
    entries.push(`Startdatum geändert: ${formatVakanzDate(oldData.startdatum as string | null)} → ${formatVakanzDate(newData.startdatum as string | null)}`)
  }
  if (oldData.enddatum !== newData.enddatum) {
    entries.push(`Enddatum geändert: ${formatVakanzDate(oldData.enddatum as string | null)} → ${formatVakanzDate(newData.enddatum as string | null)}`)
  }
  if (oldData.budget_intern !== newData.budget_intern) {
    entries.push(`EK-Budget geändert: ${formatVakanzRate(oldData.budget_intern as number | null)} → ${formatVakanzRate(newData.budget_intern as number | null)}`)
  }
  if (oldData.fte_anzahl !== newData.fte_anzahl) {
    entries.push(`FTE geändert: ${oldData.fte_anzahl ?? '–'} → ${newData.fte_anzahl ?? '–'}`)
  }
  if (oldData.auslastung !== newData.auslastung) {
    entries.push(`Auslastung geändert: ${oldData.auslastung ?? '–'}% → ${newData.auslastung ?? '–'}%`)
  }
  if (oldData.standort !== newData.standort) {
    entries.push(`Standort geändert: ${oldData.standort ?? '–'} → ${newData.standort ?? '–'}`)
  }

  if (JSON.stringify(oldData.skills) !== JSON.stringify(newData.skills)) {
    const oldSkills = (oldData.skills as string[]) ?? []
    const newSkills = (newData.skills as string[]) ?? []
    const added = newSkills.filter((s) => !oldSkills.includes(s)).map((s) => `+${s}`)
    const removed = oldSkills.filter((s) => !newSkills.includes(s)).map((s) => `-${s}`)
    const diff = [...added, ...removed].join(', ')
    if (diff) entries.push(`Skills aktualisiert: ${diff}`)
  }

  if (JSON.stringify(oldData.skills_nice_have) !== JSON.stringify(newData.skills_nice_have)) {
    const oldSkills = (oldData.skills_nice_have as string[]) ?? []
    const newSkills = (newData.skills_nice_have as string[]) ?? []
    const added = newSkills.filter((s) => !oldSkills.includes(s)).map((s) => `+${s}`)
    const removed = oldSkills.filter((s) => !newSkills.includes(s)).map((s) => `-${s}`)
    const diff = [...added, ...removed].join(', ')
    if (diff) entries.push(`Nice-Have-Skills aktualisiert: ${diff}`)
  }

  return entries
}
```

- [ ] **Schritt 2: PUT-Handler — einzelnen konsolidierten `oldRecord`-Select einbauen**

Im PUT-Handler (ab ca. Zeile 188) die beiden separaten `select`-Aufrufe durch einen einzigen ersetzen. Der neue Block ersetzt alles zwischen Auth-Check und `const { data: vakanz, error } = await supabase.from('vakanzen_data').update(...)`:

```typescript
  // Konsolidierter Old-Record-Select (für besetzt_seit-Logik, enddatum-Sync + Diff-Log)
  const { data: oldRecord } = await supabase
    .from('vakanzen_data')
    .select('rolle, branche, kunde, erfahrungslevel, arbeitsmodell, startdatum, enddatum, budget_intern, fte_anzahl, auslastung, standort, skills, skills_nice_have, status, besetzt_seit')
    .eq('id', id)
    .single()

  // besetzt_seit setzen/zurücksetzen je nach Status
  if (parsed.data.status === 'Besetzt') {
    if (!oldRecord?.besetzt_seit || oldRecord.status !== 'Besetzt') {
      updateData.besetzt_seit = new Date().toISOString()
    }
  } else {
    updateData.besetzt_seit = null
  }

  const enddatumChanged = oldRecord?.enddatum !== parsed.data.enddatum
```

Dabei den alten Code löschen:
- Den `if (parsed.data.status === 'Besetzt') { const { data: existing } ... }` Block
- Den `const { data: existing } = await supabase.from('vakanzen_data').select('enddatum')...` Block
- Die zugehörige `const enddatumChanged = existing?.enddatum !== ...` Zeile

- [ ] **Schritt 3: Diff-Logging nach dem Update einfügen**

Nach dem `if (error) { ... return ... }` Block im PUT-Handler und VOR dem `if (enddatumChanged && ...)` Block:

```typescript
  const histEntries = buildVakanzHistorieEntries(
    (oldRecord ?? {}) as Record<string, unknown>,
    parsed.data as Record<string, unknown>
  )
  for (const text of histEntries) {
    await logVakanzHistorie({ vakanzId: id, text, erstelltVon: user.id })
  }
```

- [ ] **Schritt 4: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 5: Alle Vakanz-Tests noch grün**

```bash
npx vitest run src/app/api/vakanzen
```
Erwartetes Ergebnis: Alle Tests grün.

- [ ] **Schritt 6: Commit**

```bash
git add src/app/api/vakanzen/[id]/route.ts
git commit -m "feat: log vakanz edit diffs in vakanz_historie"
```

---

## Task 7: GET /api/admin/logs — Beide Tabellen mergen

**Files:**
- Modify: `src/app/api/admin/logs/route.ts`

**Interfaces:**
- Produces: `{ logs: MergedLogEntry[] }` wobei jeder Eintrag `source: 'ressource' | 'vakanz'` trägt; vakanz-Einträge haben `vakanz_id` + `vakanzen: { id, titel, vakanz_nr }`

- [ ] **Schritt 1: Route erweitern**

Vollständiger neuer Inhalt von `src/app/api/admin/logs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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

// ── GET /api/admin/logs ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rolle = searchParams.get('rolle')
  const userId = searchParams.get('user_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000)

  const admin = createAdminClient()

  // ── 1. ressource_historie ──────────────────────────────────────────────────

  let ressourceQuery = admin
    .from('ressource_historie')
    .select(`
      id, text, typ, created_at, link_id, ressource_id, erstellt_von,
      ressourcen!ressource_id(id, name, ressource_code)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    ressourceQuery = ressourceQuery.eq('erstellt_von', userId)
  }

  const { data: ressourceLogs, error: ressourceError } = await ressourceQuery

  if (ressourceError) {
    console.error('GET admin/logs ressource_historie error:', ressourceError)
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 })
  }

  // ── 2. vakanz_historie ─────────────────────────────────────────────────────

  let vakanzQuery = admin
    .from('vakanz_historie')
    .select(`
      id, text, typ, created_at, vakanz_id, erstellt_von,
      vakanzen_data!vakanz_id(id, titel, vakanz_nr)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    vakanzQuery = vakanzQuery.eq('erstellt_von', userId)
  }

  const { data: vakanzLogs, error: vakanzError } = await vakanzQuery

  if (vakanzError) {
    console.error('GET admin/logs vakanz_historie error:', vakanzError)
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 })
  }

  // ── 3. Alle User-IDs sammeln + Profiles laden ──────────────────────────────

  const allLogs = [
    ...(ressourceLogs ?? []).map((e) => ({ ...e, source: 'ressource' as const })),
    ...(vakanzLogs ?? []).map((e) => ({ ...e, source: 'vakanz' as const })),
  ]

  const userIds = [...new Set(allLogs.map((e) => e.erstellt_von).filter(Boolean))] as string[]

  const profilesMap: Record<string, { id: string; name: string; rolle: string }> = {}
  if (userIds.length > 0) {
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, name, rolle')
      .in('id', userIds)
    for (const p of profilesData ?? []) {
      profilesMap[p.id] = p
    }
  }

  // ── 4. Mergen, Profiles anhängen, nach Datum sortieren, Rollen-Filter ──────

  let logs = allLogs
    .map((entry) => ({
      ...entry,
      profiles: entry.erstellt_von ? (profilesMap[entry.erstellt_von] ?? null) : null,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  if (rolle && rolle !== 'alle') {
    logs = logs.filter((entry) => {
      const p = entry.profiles as { rolle?: string } | null
      return p?.rolle === rolle
    })
  }

  return NextResponse.json({ logs })
}
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/admin/logs/route.ts
git commit -m "feat: merge vakanz_historie into admin logs endpoint"
```

---

## Task 8: Admin-UI — "Referenz"-Spalte

**Files:**
- Modify: `src/app/admin/logs/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/logs` Response — jeder Eintrag hat nun `source`, optional `vakanz_id` + `vakanzen`

- [ ] **Schritt 1: Types erweitern + Spalte umbenennen + Vakanz-Link rendern**

In `src/app/admin/logs/page.tsx` den `interface LogEntry` Block ersetzen:

```typescript
interface RessourceRef {
  id: string
  name: string
  ressource_code: string
}

interface VakanzRef {
  id: string
  titel: string
  vakanz_nr: string | null
}

interface LogEntry {
  id: string
  text: string
  typ: "system" | "manuell"
  created_at: string
  source: "ressource" | "vakanz"
  profiles: { id: string; name: string; rolle: string } | null
  // ressource
  link_id?: string | null
  ressource_id?: string | null
  ressourcen?: RessourceRef | null
  // vakanz
  vakanz_id?: string | null
  vakanzen_data?: VakanzRef | null
}
```

In der `TableHeader`-Zeile "Ressource" → "Referenz" umbenennen:
```tsx
<TableHead className="w-36">Referenz</TableHead>
```

Im `TableBody`, die `<TableCell>` für die Ressource-Spalte ersetzen:

```tsx
{/* Referenz */}
<TableCell className="text-sm">
  {log.source === 'vakanz' && log.vakanzen_data ? (
    <a
      href={`/vakanzen/${log.vakanz_id}`}
      className="font-medium text-primary hover:underline"
    >
      {log.vakanzen_data.vakanz_nr
        ? `${log.vakanzen_data.vakanz_nr} — ${log.vakanzen_data.titel}`
        : log.vakanzen_data.titel}
    </a>
  ) : log.ressourcen ? (
    <a
      href={`/ressourcen/${log.ressource_id}`}
      className="font-medium text-primary hover:underline"
    >
      {log.ressourcen.ressource_code
        ? `${log.ressourcen.ressource_code} — ${log.ressourcen.name}`
        : log.ressourcen.name}
    </a>
  ) : (
    <span className="text-muted-foreground">–</span>
  )}
</TableCell>
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Schritt 3: Alle Tests grün**

```bash
npx vitest run
```
Erwartetes Ergebnis: Alle Tests bestehen.

- [ ] **Schritt 4: Commit**

```bash
git add src/app/admin/logs/page.tsx
git commit -m "feat: show vakanz logs in admin activity log with Referenz column"
```

---

## Manuelle Verifikation

Nach der Implementierung:

1. Eine neue Vakanz anlegen → Admin-Log zeigt `"Vakanz erstellt: [rolle]"`
2. Vakanz-Status ändern → `"Status geändert: Offen → In Auswahl"`
3. Vakanz veröffentlichen → `"Veröffentlicht"`
4. Vakanz-Skills bearbeiten → `"Skills aktualisiert: +X, -Y"`
5. Referenz-Spalte zeigt klickbaren Link zur Vakanz
