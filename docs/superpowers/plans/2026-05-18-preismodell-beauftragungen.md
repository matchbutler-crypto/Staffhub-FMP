# Preismodell & Margen-Tracking Beauftragungen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agenturen können Preise mit oder ohne enthaltene Staffhub-Marge eingeben — das System berechnet EK und VK automatisch und speichert beide Eingabewerte für den Audit-Trail.

**Architecture:** Eine neue Pure-Function `computePreise()` kapselt die Berechnungslogik und wird in beiden API-Routen und im Test verwendet. Zwei neue DB-Spalten (`agentur_rohpreis`, `marge_inkludiert`) werden zu `beauftragungen` hinzugefügt. Die UI-Formulare ersetzen das `einkaufspreis`-Eingabefeld durch Rohpreis + Checkbox + Live-Vorschau.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres), Zod validation, Vitest, React

**Spec:** `docs/superpowers/specs/2026-05-18-preismodell-beauftragungen-design.md`

---

## File Structure

| Datei | Änderung | Zweck |
|-------|----------|-------|
| `migrations/003_beauftragungen_preismodell.sql` | Create | DB-Columns, Backfill, verkaufspreis-Fix |
| `src/lib/beauftragungen-pricing.ts` | Create | Pure `computePreise()` Funktion |
| `src/lib/beauftragungen-pricing.test.ts` | Create | Unit-Tests für Preisberechnung |
| `src/app/api/beauftragungen/route.ts` | Modify | Debug cleanup, POST/GET anpassen |
| `src/app/api/beauftragungen/[id]/route.ts` | Modify | PUT/PATCH neue Felder + Recompute |
| `src/app/profile/[id]/page.tsx` | Modify | Beauftragung-Formular: Rohpreis + Checkbox |
| `src/app/beauftragungen/page.tsx` | Modify | Edit-Formular: Rohpreis + Checkbox |
| `src/app/abrechnung/page.tsx` | Modify | Interface + Controller-Spalten |

---

## Task 1: DB Migration — neue Spalten + Backfill

**Files:**
- Create: `migrations/003_beauftragungen_preismodell.sql`

- [ ] **Step 1: Migration-Datei schreiben**

```sql
-- migrations/003_beauftragungen_preismodell.sql

-- 1. Neue Spalten hinzufügen (nullable zuerst für Backfill)
ALTER TABLE beauftragungen
  ADD COLUMN IF NOT EXISTS agentur_rohpreis numeric,
  ADD COLUMN IF NOT EXISTS marge_inkludiert boolean NOT NULL DEFAULT false;

-- 2. Bestehende Zeilen befüllen: Rohpreis = bisheriger EK (marge_inkludiert war immer false)
UPDATE beauftragungen
SET agentur_rohpreis = einkaufspreis
WHERE agentur_rohpreis IS NULL;

-- 3. NOT NULL setzen nach Backfill
ALTER TABLE beauftragungen
  ALTER COLUMN agentur_rohpreis SET NOT NULL;

-- 4. Bestehende NULL-Werte in verkaufspreis reparieren
UPDATE beauftragungen
SET verkaufspreis = einkaufspreis + margenaufschlag
WHERE verkaufspreis IS NULL;
```

- [ ] **Step 2: Migration via Supabase MCP anwenden**

Verwende `mcp__supabase__apply_migration` mit:
- `project_id`: `vrlbexouqarkpiwpksgl`
- `name`: `003_beauftragungen_preismodell`
- `query`: Inhalt der SQL-Datei oben

- [ ] **Step 3: Ergebnis prüfen**

Führe aus:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'beauftragungen'
ORDER BY ordinal_position;
```

Erwartetes Ergebnis: Spalten `agentur_rohpreis` (numeric, NOT NULL) und `marge_inkludiert` (boolean, NOT NULL, default false) sind vorhanden.

- [ ] **Step 4: Commit**

```bash
git add migrations/003_beauftragungen_preismodell.sql
git commit -m "feat: add agentur_rohpreis and marge_inkludiert columns to beauftragungen"
```

---

## Task 2: Pure Pricing-Funktion + Unit-Tests

**Files:**
- Create: `src/lib/beauftragungen-pricing.ts`
- Create: `src/lib/beauftragungen-pricing.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

Erstelle `src/lib/beauftragungen-pricing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computePreise } from './beauftragungen-pricing'

describe('computePreise', () => {
  it('Marge nicht enthalten: EK = Rohpreis, VK = Rohpreis + Marge', () => {
    const result = computePreise(500, 75, false)
    expect(result.einkaufspreis).toBe(500)
    expect(result.verkaufspreis).toBe(575)
  })

  it('Marge enthalten: VK = Rohpreis, EK = Rohpreis - Marge', () => {
    const result = computePreise(600, 75, true)
    expect(result.einkaufspreis).toBe(525)
    expect(result.verkaufspreis).toBe(600)
  })

  it('Marge = 0: EK = VK = Rohpreis (beide Modi)', () => {
    expect(computePreise(500, 0, false)).toEqual({ einkaufspreis: 500, verkaufspreis: 500 })
    expect(computePreise(500, 0, true)).toEqual({ einkaufspreis: 500, verkaufspreis: 500 })
  })

  it('Beispiel aus Spec: 550€ EK + 50€ Marge', () => {
    const result = computePreise(550, 50, false)
    expect(result.einkaufspreis).toBe(550)
    expect(result.verkaufspreis).toBe(600)
  })

  it('Beispiel aus Spec: 600€ VK inkl. 50€ Marge', () => {
    const result = computePreise(600, 50, true)
    expect(result.einkaufspreis).toBe(550)
    expect(result.verkaufspreis).toBe(600)
  })
})
```

- [ ] **Step 2: Tests laufen lassen (müssen FAIL)**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx vitest run src/lib/beauftragungen-pricing.test.ts
```

Erwartetes Ergebnis: FAIL mit `Cannot find module './beauftragungen-pricing'`

- [ ] **Step 3: Implementierung schreiben**

Erstelle `src/lib/beauftragungen-pricing.ts`:

```typescript
export interface Preise {
  einkaufspreis: number
  verkaufspreis: number
}

export function computePreise(
  agenturRohpreis: number,
  margenaufschlag: number,
  margeInkludiert: boolean
): Preise {
  if (margeInkludiert) {
    return {
      verkaufspreis: agenturRohpreis,
      einkaufspreis: agenturRohpreis - margenaufschlag,
    }
  }
  return {
    einkaufspreis: agenturRohpreis,
    verkaufspreis: agenturRohpreis + margenaufschlag,
  }
}
```

- [ ] **Step 4: Tests laufen lassen (müssen PASS)**

```bash
npx vitest run src/lib/beauftragungen-pricing.test.ts
```

Erwartetes Ergebnis: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/beauftragungen-pricing.ts src/lib/beauftragungen-pricing.test.ts
git commit -m "feat: add computePreise utility with unit tests"
```

---

## Task 3: API Route GET/POST anpassen + Debug cleanup

**Files:**
- Modify: `src/app/api/beauftragungen/route.ts`

Die aktuelle `route.ts` hat Debug-Logs und das alte `einkaufspreis`-Schema. Hier ist der vollständige neue Inhalt:

- [ ] **Step 1: `route.ts` komplett ersetzen**

Ersetze den gesamten Inhalt von `src/app/api/beauftragungen/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computePreise } from '@/lib/beauftragungen-pricing'

const beauftragungSchema = z.object({
  profil_id: z.string().uuid(),
  agentur_id: z.string().uuid(),
  agentur_rohpreis: z.number().positive(),
  marge_inkludiert: z.boolean().default(false),
  margenaufschlag: z.number().min(0).default(75),
  startdatum: z.string().date('Ungültiges Datum (erwartet YYYY-MM-DD)'),
  stunden_woche: z.number().int().min(1).max(168),
})

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null, error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return { user, profile, error: 'inactive' as const }
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') {
    return { user, profile, error: 'forbidden' as const }
  }
  return { user, profile, error: null }
}

async function requireAny(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null, error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return { user, profile, error: 'inactive' as const }
  return { user, profile, error: null }
}

// ── GET /api/beauftragungen ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile, error: authErr } = await requireAny(supabase)

  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr === 'inactive') return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  const isAgentur = profile?.rolle === 'Agentur'
  const isManager = profile?.rolle === 'Staffhub Manager' || profile?.rolle === 'Admin' || profile?.rolle === 'Controller'

  if (!isAgentur && !isManager) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (isAgentur && !profile?.agentur_id) {
    return NextResponse.json({ error: 'Kein Agentur-Profil gefunden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const nurAktive = searchParams.get('aktiv') !== 'false'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '100', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('beauftragungen')
    .select(`
      id,
      profil_id,
      agentur_id,
      agentur_rohpreis,
      marge_inkludiert,
      einkaufspreis,
      margenaufschlag,
      verkaufspreis,
      startdatum,
      stunden_woche,
      aktiv,
      created_at,
      updated_at,
      kandidaten_profile!inner(kandidatenname, erfahrungslevel, vakanz_id, vakanzen!inner(titel)),
      agenturen!inner(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (nurAktive) query = query.eq('aktiv', true)
  if (isAgentur) query = query.eq('agentur_id', profile.agentur_id!)

  const { data, error, count } = await query

  if (error) {
    console.error('GET /api/beauftragungen error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Laden der Beauftragungen' }, { status: 500 })
  }

  const result = (data ?? []).map((b) => {
    const { kandidaten_profile, agenturen, einkaufspreis, margenaufschlag, verkaufspreis, ...rest } = b as typeof b & {
      kandidaten_profile: { kandidatenname: string; erfahrungslevel: string; vakanz_id: string; vakanzen: { titel: string } | null } | null
      agenturen: { name: string } | null
    }
    const marge_euro = Number(margenaufschlag)
    const vk = Number(verkaufspreis)

    const base = {
      ...rest,
      kandidatenname: kandidaten_profile?.kandidatenname ?? '–',
      erfahrungslevel: kandidaten_profile?.erfahrungslevel ?? '–',
      vakanz_titel: kandidaten_profile?.vakanzen?.titel ?? '–',
      agentur_name: agenturen?.name ?? '–',
    }

    if (isManager) {
      return {
        ...base,
        einkaufspreis: Number(einkaufspreis),
        margenaufschlag: Number(margenaufschlag),
        verkaufspreis: vk,
        marge_prozent: vk > 0 ? Math.round((marge_euro / vk) * 100) : 0,
      }
    }

    return base
  })

  if (isManager) {
    const [pipelineRes, agenturPerfRes] = await Promise.allSettled([
      supabase.from('kandidaten_profile').select('status'),
      supabase.from('kandidaten_profile')
        .select('agentur_id, ki_score, agenturen!inner(name)')
        .not('agentur_id', 'is', null),
    ])

    const pipelineRaw = pipelineRes.status === 'fulfilled' && !pipelineRes.value.error
      ? (pipelineRes.value.data ?? [])
      : []
    const pipeline: Record<string, number> = {}
    for (const p of pipelineRaw) pipeline[p.status] = (pipeline[p.status] ?? 0) + 1

    type AgenturPerfRaw = { agentur_id: string | null; ki_score: number | null; agenturen: { name: string }[] | { name: string } | null }
    const agenturRaw = agenturPerfRes.status === 'fulfilled' && !agenturPerfRes.value.error
      ? (agenturPerfRes.value.data as AgenturPerfRaw[] ?? [])
      : []
    const agenturMap: Record<string, { name: string; count: number; scoreSum: number; scoreCount: number }> = {}
    for (const p of agenturRaw) {
      if (!p.agentur_id) continue
      const agenturen = p.agenturen
      const name = Array.isArray(agenturen) ? agenturen[0]?.name : agenturen?.name
      if (!name) continue
      if (!agenturMap[p.agentur_id]) agenturMap[p.agentur_id] = { name, count: 0, scoreSum: 0, scoreCount: 0 }
      agenturMap[p.agentur_id].count++
      if (p.ki_score !== null) { agenturMap[p.agentur_id].scoreSum += p.ki_score; agenturMap[p.agentur_id].scoreCount++ }
    }
    const agentur_performance = Object.values(agenturMap)
      .map(({ name, count, scoreSum, scoreCount }) => ({
        name,
        count,
        avg_score: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
      }))
      .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))

    return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, pipeline, agentur_performance, rolle: profile?.rolle })
  }

  return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, rolle: profile?.rolle })
}

// ── POST /api/beauftragungen ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { error: authErr } = await requireManager(supabase)

  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr === 'inactive') return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (authErr === 'forbidden') return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = beauftragungSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { agentur_rohpreis, margenaufschlag, marge_inkludiert } = parsed.data
  const { einkaufspreis, verkaufspreis } = computePreise(agentur_rohpreis, margenaufschlag, marge_inkludiert)

  if (einkaufspreis <= 0) {
    return NextResponse.json(
      { error: 'EK-Preis muss > 0 sein (Rohpreis muss größer als Marge sein wenn "Marge enthalten")' },
      { status: 400 }
    )
  }

  const { data: profil } = await supabase
    .from('kandidaten_profile')
    .select('id, status')
    .eq('id', parsed.data.profil_id)
    .single()

  if (!profil) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (profil.status !== 'Beauftragt') {
    return NextResponse.json(
      { error: 'Beauftragung nur bei Status „Beauftragt" möglich' },
      { status: 409 }
    )
  }

  const { data: neu, error } = await supabase
    .from('beauftragungen')
    .insert({
      profil_id: parsed.data.profil_id,
      agentur_id: parsed.data.agentur_id,
      agentur_rohpreis,
      marge_inkludiert,
      einkaufspreis,
      margenaufschlag,
      verkaufspreis,
      startdatum: parsed.data.startdatum,
      stunden_woche: parsed.data.stunden_woche,
    })
    .select('id, einkaufspreis, margenaufschlag, verkaufspreis, aktiv, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Anlegen der Beauftragung' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: neu }, { status: 201 })
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx tsc --noEmit 2>&1 | grep "beauftragungen/route"
```

Erwartetes Ergebnis: keine Fehler für diese Datei

- [ ] **Step 3: Commit**

```bash
git add src/app/api/beauftragungen/route.ts
git commit -m "feat: update beauftragungen POST/GET to use agentur_rohpreis + marge_inkludiert"
```

---

## Task 4: API Route [id] — PUT und PATCH anpassen

**Files:**
- Modify: `src/app/api/beauftragungen/[id]/route.ts`

- [ ] **Step 1: `[id]/route.ts` komplett ersetzen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computePreise } from '@/lib/beauftragungen-pricing'

const updateSchema = z.object({
  agentur_rohpreis: z.number().positive(),
  marge_inkludiert: z.boolean().default(false),
  margenaufschlag: z.number().min(0).default(75),
  startdatum: z.string().date('Ungültiges Datum (erwartet YYYY-MM-DD)'),
  stunden_woche: z.number().int().min(1).max(168),
})

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv').eq('id', user.id).single()
  if (!profile?.aktiv) return { error: 'inactive' as const }
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') return { error: 'forbidden' as const }
  return { error: null }
}

// ── PUT /api/beauftragungen/[id] ───────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { error: authErr } = await requireManager(supabase)
  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { agentur_rohpreis, margenaufschlag, marge_inkludiert } = parsed.data
  const { einkaufspreis, verkaufspreis } = computePreise(agentur_rohpreis, margenaufschlag, marge_inkludiert)

  if (einkaufspreis <= 0) {
    return NextResponse.json(
      { error: 'EK-Preis muss > 0 sein (Rohpreis muss größer als Marge sein wenn "Marge enthalten")' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({
      agentur_rohpreis,
      marge_inkludiert,
      einkaufspreis,
      margenaufschlag,
      verkaufspreis,
      startdatum: parsed.data.startdatum,
      stunden_woche: parsed.data.stunden_woche,
    })
    .eq('id', id)
    .select('id, agentur_rohpreis, marge_inkludiert, einkaufspreis, margenaufschlag, verkaufspreis, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}

// ── PATCH /api/beauftragungen/[id] ────────────────────────────────────────────
// Nur margenaufschlag ändern — recomputes EK/VK basierend auf gespeichertem Rohpreis

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (!['Controller', 'Staffhub Manager', 'Admin'].includes(profile.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = z.object({ margenaufschlag: z.number().min(0) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Bestehenden Rohpreis und Modus laden, um EK/VK neu zu berechnen
  const { data: current, error: fetchErr } = await supabase
    .from('beauftragungen')
    .select('agentur_rohpreis, marge_inkludiert')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
  }

  const { einkaufspreis, verkaufspreis } = computePreise(
    Number(current.agentur_rohpreis),
    parsed.data.margenaufschlag,
    current.marge_inkludiert
  )

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({ margenaufschlag: parsed.data.margenaufschlag, einkaufspreis, verkaufspreis })
    .eq('id', id)
    .select('id, margenaufschlag, einkaufspreis, verkaufspreis, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit 2>&1 | grep "beauftragungen/\[id\]"
```

Erwartetes Ergebnis: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add src/app/api/beauftragungen/[id]/route.ts
git commit -m "feat: update beauftragungen [id] PUT/PATCH to recompute EK/VK from rohpreis"
```

---

## Task 5: Profile-Seite — Beauftragung-Formular umbauen

**Files:**
- Modify: `src/app/profile/[id]/page.tsx`

Die betroffenen Stellen sind ca. Zeile 152–158 (State), 260–296 (Submit-Logik) und 688–757 (Form-JSX).

- [ ] **Step 1: Form-State anpassen (Zeile 152–158)**

Ersetze:
```typescript
const [beauftragungForm, setBeauftragungForm] = React.useState({
  einkaufspreis: "",
  margenaufschlag: "0",
  startdatum: "",
  stunden_woche: "",
})
```

Mit:
```typescript
const [beauftragungForm, setBeauftragungForm] = React.useState({
  agentur_rohpreis: "",
  marge_inkludiert: false,
  margenaufschlag: "75",
  startdatum: "",
  stunden_woche: "",
})
```

- [ ] **Step 2: Reset beim Öffnen des Dialogs (Zeile 235)**

Ersetze:
```typescript
setBeauftragungForm({ einkaufspreis: "", margenaufschlag: "0", startdatum: "", stunden_woche: "" })
```

Mit:
```typescript
setBeauftragungForm({ agentur_rohpreis: "", marge_inkludiert: false, margenaufschlag: "75", startdatum: "", stunden_woche: "" })
```

- [ ] **Step 3: Validierung + Submit-Logik anpassen (Zeile 260–296)**

Ersetze den Block ab `const ek = parseFloat(beauftragungForm.einkaufspreis)`:
```typescript
const rohpreis = parseFloat(beauftragungForm.agentur_rohpreis)
const mg = parseFloat(beauftragungForm.margenaufschlag || "75")
const stunden = parseInt(beauftragungForm.stunden_woche)
const margeInkludiert = beauftragungForm.marge_inkludiert

if (isNaN(rohpreis) || rohpreis <= 0) { toast.error("Agentur-Preis ungültig."); return }
if (isNaN(mg) || mg < 0) { toast.error("Margenaufschlag ungültig."); return }
if (margeInkludiert && rohpreis <= mg) { toast.error("Rohpreis muss größer als Marge sein."); return }
if (isNaN(stunden) || stunden < 1 || stunden > 168) { toast.error("Stunden/Woche: Wert zwischen 1 und 168."); return }
if (!beauftragungForm.startdatum) { toast.error("Startdatum ist erforderlich."); return }
```

Ersetze im `fetch("/api/beauftragungen")`-Body (Zeile 289–296):
```typescript
body: JSON.stringify({
  profil_id: id,
  agentur_id: profil.agentur_id,
  agentur_rohpreis: rohpreis,
  marge_inkludiert: margeInkludiert,
  margenaufschlag: mg,
  startdatum: beauftragungForm.startdatum,
  stunden_woche: stunden,
}),
```

- [ ] **Step 4: Form-JSX ersetzen (Zeile 688–757)**

Ersetze den `<div className="grid gap-4 py-2">` Block:

```tsx
<div className="grid gap-4 py-2">
  <div className="grid gap-1.5">
    <Label htmlFor="b-rohpreis">Agentur-Preis (€ / Tag)</Label>
    <Input
      id="b-rohpreis"
      type="number"
      min={0}
      step={1}
      placeholder="z.B. 600"
      value={beauftragungForm.agentur_rohpreis}
      onChange={(e) =>
        setBeauftragungForm((f) => ({ ...f, agentur_rohpreis: e.target.value }))
      }
    />
  </div>

  <div className="grid gap-1.5">
    <Label htmlFor="b-mg">Marge (€ / Tag)</Label>
    <Input
      id="b-mg"
      type="number"
      min={0}
      step={1}
      placeholder="z.B. 75"
      value={beauftragungForm.margenaufschlag}
      onChange={(e) =>
        setBeauftragungForm((f) => ({ ...f, margenaufschlag: e.target.value }))
      }
    />
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
      <input
        type="checkbox"
        checked={beauftragungForm.marge_inkludiert}
        onChange={(e) =>
          setBeauftragungForm((f) => ({ ...f, marge_inkludiert: e.target.checked }))
        }
        className="rounded"
      />
      Marge bereits im Preis enthalten
    </label>
    {beauftragungForm.agentur_rohpreis && (() => {
      const rohpreis = parseFloat(beauftragungForm.agentur_rohpreis || "0")
      const mg = parseFloat(beauftragungForm.margenaufschlag || "75")
      const inkl = beauftragungForm.marge_inkludiert
      const ek = inkl ? rohpreis - mg : rohpreis
      const vk = inkl ? rohpreis : rohpreis + mg
      const valid = ek > 0
      return (
        <div className={`mt-1 rounded border px-3 py-2 text-xs ${valid ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/10"}`}>
          <div className="flex justify-between"><span className="text-muted-foreground">EK (an Agentur):</span><span>{valid ? `${ek.toLocaleString("de-DE")} €` : "–"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Staffhub-Marge:</span><span>{mg.toLocaleString("de-DE")} €</span></div>
          <div className="flex justify-between font-medium"><span>VK (an Kunden):</span><span>{valid ? `${vk.toLocaleString("de-DE")} €` : "–"}</span></div>
          {!valid && <p className="mt-1 text-destructive">Rohpreis muss größer als Marge sein.</p>}
        </div>
      )
    })()}
  </div>

  <div className="grid gap-1.5">
    <Label htmlFor="b-start">Startdatum</Label>
    <Input
      id="b-start"
      type="date"
      value={beauftragungForm.startdatum}
      onChange={(e) =>
        setBeauftragungForm((f) => ({ ...f, startdatum: e.target.value }))
      }
    />
  </div>

  <div className="grid gap-1.5">
    <Label htmlFor="b-stunden">Stunden / Woche</Label>
    <Input
      id="b-stunden"
      type="number"
      min={1}
      max={168}
      step={1}
      placeholder="z.B. 40"
      value={beauftragungForm.stunden_woche}
      onChange={(e) =>
        setBeauftragungForm((f) => ({ ...f, stunden_woche: e.target.value }))
      }
    />
  </div>
</div>
```

- [ ] **Step 5: TypeScript prüfen**

```bash
npx tsc --noEmit 2>&1 | grep "profile/\[id\]"
```

Erwartetes Ergebnis: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/[id]/page.tsx
git commit -m "feat: update Beauftragung form to use Rohpreis + Marge-Checkbox"
```

---

## Task 6: Beauftragungen-Edit-Formular anpassen

**Files:**
- Modify: `src/app/beauftragungen/page.tsx`

- [ ] **Step 1: Interface + State anpassen**

In der `Beauftragung`-Interface (Zeile ~67) ergänzen:
```typescript
interface Beauftragung {
  // ... bestehende Felder ...
  agentur_rohpreis?: number
  marge_inkludiert?: boolean
  einkaufspreis?: number
  margenaufschlag?: number
  verkaufspreis?: number
  marge_prozent?: number
  // ... rest ...
}
```

Edit-Form-State (Zeile ~165): ersetze `einkaufspreis: ""` mit:
```typescript
const [editForm, setEditForm] = React.useState({
  agentur_rohpreis: "",
  marge_inkludiert: false,
  margenaufschlag: "75",
  startdatum: "",
  stunden_woche: "",
})
```

- [ ] **Step 2: Pre-fill beim Bearbeiten anpassen (Zeile ~207)**

Ersetze den Block wo editForm beim Öffnen befüllt wird:
```typescript
setEditForm({
  agentur_rohpreis: String(b.agentur_rohpreis ?? b.einkaufspreis ?? ""),
  marge_inkludiert: b.marge_inkludiert ?? false,
  margenaufschlag: String(b.margenaufschlag ?? "75"),
  startdatum: b.startdatum,
  stunden_woche: String(b.stunden_woche),
})
```

- [ ] **Step 3: Submit-Logik anpassen (Zeile ~216)**

Ersetze `const ek = parseFloat(editForm.einkaufspreis)` und Folgecode:
```typescript
const rohpreis = parseFloat(editForm.agentur_rohpreis)
const mg = parseFloat(editForm.margenaufschlag || "75")
const stunden = parseInt(editForm.stunden_woche)
const margeInkludiert = editForm.marge_inkludiert

if (isNaN(rohpreis) || rohpreis <= 0) { toast.error("Agentur-Preis ungültig."); return }
if (isNaN(mg) || mg < 0) { toast.error("Margenaufschlag ungültig."); return }
if (margeInkludiert && rohpreis <= mg) { toast.error("Rohpreis muss größer als Marge sein."); return }
if (isNaN(stunden) || stunden < 1 || stunden > 168) { toast.error("Stunden/Woche ungültig."); return }
```

Im fetch-Body zu `PUT`:
```typescript
body: JSON.stringify({
  agentur_rohpreis: rohpreis,
  marge_inkludiert: margeInkludiert,
  margenaufschlag: mg,
  startdatum: editForm.startdatum,
  stunden_woche: stunden,
}),
```

- [ ] **Step 4: Form-JSX ersetzen**

Ersetze den Bereich mit `Label htmlFor="edit-ek"` und `Label htmlFor="edit-mg"`:

```tsx
<div className="grid gap-1.5">
  <Label htmlFor="edit-rohpreis">Agentur-Preis (€ / Tag)</Label>
  <Input
    id="edit-rohpreis"
    type="number"
    min={0}
    step={1}
    value={editForm.agentur_rohpreis}
    onChange={(e) => setEditForm((f) => ({ ...f, agentur_rohpreis: e.target.value }))}
  />
</div>

<div className="grid gap-1.5">
  <Label htmlFor="edit-mg">Marge (€ / Tag)</Label>
  <Input
    id="edit-mg"
    type="number"
    min={0}
    step={1}
    value={editForm.margenaufschlag}
    onChange={(e) => setEditForm((f) => ({ ...f, margenaufschlag: e.target.value }))}
  />
  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
    <input
      type="checkbox"
      checked={editForm.marge_inkludiert}
      onChange={(e) => setEditForm((f) => ({ ...f, marge_inkludiert: e.target.checked }))}
      className="rounded"
    />
    Marge bereits im Preis enthalten
  </label>
  {editForm.agentur_rohpreis && (() => {
    const rohpreis = parseFloat(editForm.agentur_rohpreis || "0")
    const mg = parseFloat(editForm.margenaufschlag || "75")
    const inkl = editForm.marge_inkludiert
    const ek = inkl ? rohpreis - mg : rohpreis
    const vk = inkl ? rohpreis : rohpreis + mg
    const valid = ek > 0
    return (
      <div className={`mt-1 rounded border px-3 py-2 text-xs ${valid ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/10"}`}>
        <div className="flex justify-between"><span className="text-muted-foreground">EK:</span><span>{valid ? `${ek.toLocaleString("de-DE")} €` : "–"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Marge:</span><span>{mg.toLocaleString("de-DE")} €</span></div>
        <div className="flex justify-between font-medium"><span>VK:</span><span>{valid ? `${vk.toLocaleString("de-DE")} €` : "–"}</span></div>
        {!valid && <p className="mt-1 text-destructive">Rohpreis muss größer als Marge sein.</p>}
      </div>
    )
  })()}
</div>
```

- [ ] **Step 5: TypeScript prüfen**

```bash
npx tsc --noEmit 2>&1 | grep "beauftragungen/page"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/beauftragungen/page.tsx
git commit -m "feat: update Beauftragungen edit form to use Rohpreis + Marge-Checkbox"
```

---

## Task 7: Abrechnung-Seite — Interface + Controller-Columns

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

- [ ] **Step 1: `Beauftragung`-Interface ergänzen (Zeile ~38)**

Ergänze in der Interface:
```typescript
interface Beauftragung {
  // ... bestehende Felder ...
  agentur_rohpreis?: number
  marge_inkludiert?: boolean
  // einkaufspreis, margenaufschlag, verkaufspreis, marge_prozent bleiben wie gehabt
}
```

- [ ] **Step 2: Controller-TableHeader erweitern (Zeile ~447)**

Ersetze den `isController`-Header-Block:
```tsx
{isController && (
  <>
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />EK €/Tag</span>
    </TableHead>
    <TableHead className="text-right">VK €/Tag</TableHead>
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge €/Tag</span>
    </TableHead>
    <TableHead className="text-right">Std/Mo (Ist)</TableHead>
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge/Mo</span>
    </TableHead>
  </>
)}
```

- [ ] **Step 3: Controller-Agentur-Gruppenzeile aktualisieren (Zeile ~499)**

Ersetze den `isController`-Block in der Agentur-Header-Zeile:
```tsx
{isController && (
  <>
    <TableCell></TableCell>
    <TableCell></TableCell>
    <TableCell></TableCell>
    <TableCell></TableCell>
    <TableCell className="text-right tabular-nums text-green-700 font-semibold">
      {fmt(g.zeilen.reduce((sum, b) => {
        const zn = zeitnachweise.get(b.id)
        const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
        return sum + marge * effectiveStunden(b, zn)
      }, 0))}
    </TableCell>
  </>
)}
```

- [ ] **Step 4: Controller-Kandidatenzeile aktualisieren (Zeile ~559)**

Ersetze den `isController`-Kandidatenzeilen-Block:
```tsx
{isController && (() => {
  const zn = zeitnachweise.get(b.id)
  const stunden = effectiveStunden(b, zn)
  const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
  return (
    <>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {(b.einkaufspreis ?? 0).toLocaleString("de-DE")} €
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium">
        {(b.verkaufspreis ?? 0).toLocaleString("de-DE")} €
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        <input
          type="number"
          min="0"
          step="0.01"
          value={margenOverrides[b.id] ?? b.margenaufschlag ?? 0}
          onChange={(e) => setMargenOverrides((prev) => ({ ...prev, [b.id]: parseFloat(e.target.value) || 0 }))}
          onBlur={(e) => saveMarge(b.id, parseFloat(e.target.value) || 0)}
          disabled={savingMarge[b.id]}
          className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {stunden}{zn?.stunden_ist != null ? "" : <span className="ml-1 text-[10px] text-muted-foreground/60">est.</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-green-700">
        {fmt(marge * stunden)}
      </TableCell>
    </>
  )
})()}
```

- [ ] **Step 5: `colCount` anpassen (Zeile ~247)**

Ersetze:
```typescript
const colCount = loading || isFinancial ? (canEditMarge ? 12 : 11) : isController ? 6 : 5
```

Mit:
```typescript
const colCount = loading || isFinancial ? (canEditMarge ? 12 : 11) : isController ? 8 : 5
```

- [ ] **Step 6: Controller-Footer anpassen (Zeile ~637)**

Ersetze den `isController`-Footer-Block:
```tsx
{isController && (
  <>
    <TableCell colSpan={7} className="text-right">Gesamt {monatLabel}</TableCell>
    <TableCell className="text-right tabular-nums text-green-700">
      {fmt(gefiltert.reduce((sum, b) => {
        const zn = zeitnachweise.get(b.id)
        const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
        return sum + marge * effectiveStunden(b, zn)
      }, 0))}
    </TableCell>
  </>
)}
```

- [ ] **Step 7: TypeScript prüfen + alle Tests laufen lassen**

```bash
npx tsc --noEmit 2>&1 | grep "abrechnung"
npx vitest run
```

Erwartetes Ergebnis: keine TS-Fehler, alle Tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/abrechnung/page.tsx
git commit -m "feat: add EK/VK columns to Controller view in Abrechnung"
```

---

## Abschlusskontrolle

- [ ] Alle Tests grün: `npx vitest run`
- [ ] Kein TypeScript-Fehler: `npx tsc --noEmit`
- [ ] Beauftragung anlegen (Profile-Seite): beide Modi (Marge inkl./exkl.) testen
- [ ] Abrechnung-Seite: Controller sieht EK, VK und Marge-Spalten
- [ ] PATCH Margenaufschlag in Abrechnung: EK/VK werden korrekt neu berechnet
