# Zeitnachweis Upload & Controller Abrechnung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload monthly timesheet PDFs per Beauftragung, auto-parse hours via OpenAI, let a new Controller role enter margins and view actual monthly totals — all inside the existing `/abrechnung` page.

**Architecture:** New `zeitnachweise` DB table + Supabase Storage bucket + 3 new API routes + Controller RBAC role. Role detection comes from the `GET /api/beauftragungen` response (already returns per-role-filtered data; we add `rolle` to the response). No new top-level pages.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgREST + Storage), OpenAI SDK (`responses.create` with `input_file` — same pattern as `extractSkillsFromCVBuffer`), zod

---

## Files

- Modify: `src/lib/rbac.ts`
- Modify: `src/lib/openai.ts`
- Create: `src/app/api/zeitnachweise/route.ts`
- Create: `src/app/api/zeitnachweise/[id]/route.ts`
- Modify: `src/app/api/beauftragungen/route.ts`
- Modify: `src/app/api/beauftragungen/[id]/route.ts`
- Modify: `src/app/abrechnung/page.tsx`

---

## Column Layout Reference

| Role | Columns (count) |
|------|----------------|
| Staffhub Manager / Admin | expand, Kandidat, Vakanz, h/Woche, EK, VK, Marge%, Umsatz/Mo, Kosten/Mo, Marge/Mo, Zeitnachweis = **11** |
| Controller | expand, Kandidat, Vakanz, Marge €/Std (editable), Std/Mo (Ist), Marge/Mo = **6** |
| Agentur | expand, Kandidat, Vakanz, h/Woche, Zeitnachweis = **5** |

---

## Task 1: DB Migration + Storage Bucket

**Files:** Supabase MCP only

- [ ] **Step 1.1: Apply DB migration**

Use `mcp__supabase__apply_migration` (name: `create_zeitnachweise`) with:

```sql
create table if not exists zeitnachweise (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null,
  stunden_ist numeric,
  pdf_path text not null,
  parsed_raw jsonb,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (beauftragung_id, monat)
);

alter table zeitnachweise enable row level security;

create policy "zeitnachweise_manager_all" on zeitnachweise
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and rolle in ('Staffhub Manager', 'Admin', 'Controller')
        and aktiv = true
    )
  );

create policy "zeitnachweise_agentur_own" on zeitnachweise
  for all using (
    exists (
      select 1 from beauftragungen b
      join profiles p on p.id = auth.uid()
      where b.id = zeitnachweise.beauftragung_id
        and b.agentur_id = p.agentur_id
        and p.rolle = 'Agentur'
        and p.aktiv = true
    )
  );
```

- [ ] **Step 1.2: Create storage bucket**

Use `mcp__supabase__execute_sql` with:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zeitnachweise', 'zeitnachweise', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "zeitnachweise_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'zeitnachweise');

create policy "zeitnachweise_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'zeitnachweise');

create policy "zeitnachweise_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'zeitnachweise');
```

- [ ] **Step 1.3: Verify**

Use `mcp__supabase__execute_sql`: `select count(*) from zeitnachweise;`
Expected: `0`

- [ ] **Step 1.4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git commit --allow-empty -m "feat: create zeitnachweise table and storage bucket"
```

---

## Task 2: RBAC — Controller role + Agentur abrechnung access

**Files:**
- Modify: `src/lib/rbac.ts`

- [ ] **Step 2.1: Replace ROLE_ROUTES**

Replace the entire `ROLE_ROUTES` object in `src/lib/rbac.ts`:

```typescript
export const ROLE_ROUTES: Record<string, string[]> = {
  Admin: [
    '/dashboard',
    '/vakanzen',
    '/profile',
    '/agenturen',
    '/beauftragungen',
    '/abrechnung',
    '/admin',
    '/meine-profile',
    '/slack-log',
    '/ressourcen',
    '/ideen',
    '/settings',
    '/api',
  ],
  'Staffhub Manager': [
    '/dashboard',
    '/vakanzen',
    '/profile',
    '/beauftragungen',
    '/abrechnung',
    '/slack-log',
    '/ressourcen',
    '/ideen',
    '/settings',
    '/api',
  ],
  Controller: [
    '/dashboard',
    '/abrechnung',
    '/settings',
    '/api',
  ],
  Agentur: ['/dashboard', '/vakanzen', '/meine-profile', '/pool', '/abrechnung', '/ideen', '/settings', '/api'],
}
```

- [ ] **Step 2.2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 2.3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/lib/rbac.ts
git commit -m "feat: add Controller RBAC role, add /abrechnung to Agentur routes"
```

---

## Task 3: OpenAI lib — extractStundenFromPDF

**Files:**
- Modify: `src/lib/openai.ts`

Context: `extractSkillsFromCVBuffer` in this file already sends a PDF buffer via `responses.create` with `input_file`. Use the exact same pattern.

- [ ] **Step 3.1: Add function at end of file**

Append to `src/lib/openai.ts`:

```typescript
export async function extractStundenFromPDF(pdfBuffer: ArrayBuffer): Promise<number | null> {
  const base64 = Buffer.from(pdfBuffer).toString('base64')

  const response = await getOpenAI().responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: 'zeitnachweis.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
          {
            type: 'input_text',
            text: 'Du bekommst einen Zeitnachweis (Stundennachweis). Extrahiere die Gesamtanzahl der geleisteten Stunden als Dezimalzahl. Antworte nur mit der Zahl, ohne Einheit oder Erklärung. Beispiel: 160.5',
          },
        ],
      },
    ],
  })

  const text = response.output_text?.trim()
  if (!text) return null
  const num = parseFloat(text)
  return isNaN(num) || num < 0 ? null : num
}
```

- [ ] **Step 3.2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3.3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/lib/openai.ts
git commit -m "feat: add extractStundenFromPDF to OpenAI lib"
```

---

## Task 4: Zeitnachweise API — GET list + POST upload/parse

**Files:**
- Create: `src/app/api/zeitnachweise/route.ts`

- [ ] **Step 4.1: Create route file**

Create `src/app/api/zeitnachweise/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractStundenFromPDF } from '@/lib/openai'

export const maxDuration = 30

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/zeitnachweise?beauftragung_ids=id1,id2&monat=2026-05-01 ──────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('beauftragung_ids') ?? ''
  const monat = searchParams.get('monat')

  if (!monat || !idsParam) return NextResponse.json({ zeitnachweise: [] })

  const ids = idsParam.split(',').filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ zeitnachweise: [] })

  const { data, error } = await supabase
    .from('zeitnachweise')
    .select('id, beauftragung_id, monat, stunden_ist, uploaded_at')
    .in('beauftragung_id', ids)
    .eq('monat', monat)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ zeitnachweise: data ?? [] })
}

// ── POST /api/zeitnachweise ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user, profile } = await getProfile(supabase)
  if (!profile?.aktiv || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  const isAgentur = profile.rolle === 'Agentur'
  if (!isManager && !isAgentur) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const beauftragungId = formData.get('beauftragung_id') as string | null
  const monat = formData.get('monat') as string | null // YYYY-MM-DD

  if (!file || !beauftragungId || !monat) {
    return NextResponse.json({ error: 'file, beauftragung_id und monat sind erforderlich' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei darf maximal 10 MB groß sein' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monat)) {
    return NextResponse.json({ error: 'Ungültiges Monat-Format (erwartet YYYY-MM-DD)' }, { status: 400 })
  }

  if (isAgentur) {
    const { data: bauf } = await supabase
      .from('beauftragungen')
      .select('agentur_id')
      .eq('id', beauftragungId)
      .single()
    if (!bauf || bauf.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Beauftragung' }, { status: 403 })
    }
  }

  const monthLabel = monat.slice(0, 7)
  const storagePath = `${beauftragungId}/${monthLabel}.pdf`
  const pdfBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('zeitnachweise')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei' }, { status: 500 })
  }

  let stundenIst: number | null = null
  let parsedRaw: unknown = null
  try {
    stundenIst = await extractStundenFromPDF(pdfBuffer)
  } catch (err) {
    parsedRaw = { error: err instanceof Error ? err.message : String(err) }
  }

  const { data: record, error: dbError } = await supabase
    .from('zeitnachweise')
    .upsert(
      {
        beauftragung_id: beauftragungId,
        monat,
        stunden_ist: stundenIst,
        pdf_path: storagePath,
        parsed_raw: parsedRaw,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'beauftragung_id,monat' }
    )
    .select('id, beauftragung_id, monat, stunden_ist, uploaded_at')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ zeitnachweis: record })
}
```

- [ ] **Step 4.2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4.3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/api/zeitnachweise/route.ts
git commit -m "feat: add zeitnachweise API (GET list + POST upload/parse)"
```

---

## Task 5: Zeitnachweise detail API — download URL + DELETE

**Files:**
- Create: `src/app/api/zeitnachweise/[id]/route.ts`

- [ ] **Step 5.1: Create route file**

Create `src/app/api/zeitnachweise/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/zeitnachweise/[id] → signed download URL ────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: zn } = await supabase
    .from('zeitnachweise')
    .select('pdf_path, beauftragung_id')
    .eq('id', id)
    .single()

  if (!zn) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (profile.rolle === 'Agentur') {
    const { data: bauf } = await supabase
      .from('beauftragungen')
      .select('agentur_id')
      .eq('id', zn.beauftragung_id)
      .single()
    if (!bauf || bauf.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  }

  const { data: signedUrl, error } = await supabase.storage
    .from('zeitnachweise')
    .createSignedUrl(zn.pdf_path, 3600)

  if (error || !signedUrl) {
    return NextResponse.json({ error: 'Fehler beim Generieren der Download-URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signedUrl.signedUrl })
}

// ── DELETE /api/zeitnachweise/[id] ───────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  if (!isManager) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { data: zn } = await supabase
    .from('zeitnachweise')
    .select('pdf_path')
    .eq('id', id)
    .single()

  if (!zn) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await supabase.storage.from('zeitnachweise').remove([zn.pdf_path])

  const { error } = await supabase.from('zeitnachweise').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5.2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5.3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add "src/app/api/zeitnachweise/[id]/route.ts"
git commit -m "feat: add zeitnachweise detail API (download URL + delete)"
```

---

## Task 6: Beauftragungen API — Controller support + PATCH margenaufschlag

**Files:**
- Modify: `src/app/api/beauftragungen/route.ts`
- Modify: `src/app/api/beauftragungen/[id]/route.ts`

- [ ] **Step 6.1: Allow Controller in GET + add rolle to response**

In `src/app/api/beauftragungen/route.ts`, find:

```typescript
  const isAgentur = profile?.rolle === 'Agentur'
  const isManager = profile?.rolle === 'Staffhub Manager' || profile?.rolle === 'Admin'
```

Replace with:

```typescript
  const isAgentur = profile?.rolle === 'Agentur'
  const isManager = profile?.rolle === 'Staffhub Manager' || profile?.rolle === 'Admin' || profile?.rolle === 'Controller'
```

Then find both return statements at the bottom of `GET` and add `rolle: profile?.rolle` to each:

```typescript
    return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, pipeline, agentur_performance, rolle: profile?.rolle })
  }

  return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, rolle: profile?.rolle })
```

- [ ] **Step 6.2: Add PATCH handler to beauftragungen/[id]/route.ts**

In `src/app/api/beauftragungen/[id]/route.ts`, append after the existing `PUT` function:

```typescript
// ── PATCH /api/beauftragungen/[id] ────────────────────────────────────────────

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

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({ margenaufschlag: parsed.data.margenaufschlag })
    .eq('id', id)
    .select('id, margenaufschlag, verkaufspreis, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}
```

- [ ] **Step 6.3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 6.4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/api/beauftragungen/route.ts "src/app/api/beauftragungen/[id]/route.ts"
git commit -m "feat: allow Controller in beauftragungen GET, add PATCH margenaufschlag"
```

---

## Task 7: Abrechnung page — types, state, zeitnachweise fetch, updated calcs

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

Note: This task only touches the `// ── Types ──` section and the `// ── Helpers ──` section plus state/effects inside `AbrechnungPage`. No JSX table changes yet.

- [ ] **Step 7.1: Replace Types section**

Replace the `// ── Types ──` block (lines ~36–61) with:

```typescript
// ── Types ──────────────────────────────────────────────────────────────────────

interface Beauftragung {
  id: string
  profil_id: string
  agentur_id: string
  kandidatenname: string
  erfahrungslevel: string
  vakanz_titel: string
  agentur_name: string
  einkaufspreis?: number
  margenaufschlag?: number
  verkaufspreis?: number
  marge_prozent?: number
  startdatum: string
  stunden_woche: number
  aktiv: boolean
}

interface Zeitnachweis {
  id: string
  beauftragung_id: string
  monat: string
  stunden_ist: number | null
  uploaded_at: string
}

interface AgenturGruppe {
  agentur_name: string
  agentur_id: string
  zeilen: Beauftragung[]
  umsatz: number
  kosten: number
  marge: number
}
```

- [ ] **Step 7.2: Replace Helpers section**

Replace the `// ── Helpers ──` block (calcUmsatz, calcKosten, gruppiereNachAgentur, monateListe, aktuellerMonat, exportCSV, TableSkeletonRows) with:

```typescript
// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function effectiveStunden(b: Beauftragung, zn: Zeitnachweis | undefined): number {
  return zn?.stunden_ist ?? (b.stunden_woche * 4)
}

function calcUmsatz(b: Beauftragung, zn?: Zeitnachweis) {
  return (b.verkaufspreis ?? 0) * effectiveStunden(b, zn)
}

function calcKosten(b: Beauftragung, zn?: Zeitnachweis) {
  return (b.einkaufspreis ?? 0) * effectiveStunden(b, zn)
}

function gruppiereNachAgentur(
  daten: Beauftragung[],
  zeitnachweise: Map<string, Zeitnachweis>
): AgenturGruppe[] {
  const map = new Map<string, AgenturGruppe>()
  for (const b of daten) {
    if (!map.has(b.agentur_id)) {
      map.set(b.agentur_id, { agentur_name: b.agentur_name, agentur_id: b.agentur_id, zeilen: [], umsatz: 0, kosten: 0, marge: 0 })
    }
    const g = map.get(b.agentur_id)!
    const zn = zeitnachweise.get(b.id)
    const u = calcUmsatz(b, zn)
    const k = calcKosten(b, zn)
    g.zeilen.push(b)
    g.umsatz += u
    g.kosten += k
    g.marge += u - k
  }
  return Array.from(map.values()).sort((a, b) => a.agentur_name.localeCompare(b.agentur_name, "de"))
}

function monateListe() {
  const heute = new Date()
  const monate: { value: string; label: string }[] = []
  for (let i = -11; i <= 1; i++) {
    const d = new Date(heute.getFullYear(), heute.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    monate.push({ value, label })
  }
  return monate.reverse()
}

function aktuellerMonat() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function exportCSV(gruppen: AgenturGruppe[], monatLabel: string, zeitnachweise: Map<string, Zeitnachweis>) {
  const BOM = "﻿"
  const sep = ";"
  const header = ["Agentur", "Kandidat", "Vakanz", "h/Woche", "h/Mo (Ist)", "EK €/Tag", "VK €/Tag", "Marge%", "Umsatz/Mo", "Kosten/Mo", "Marge/Mo"].join(sep)
  const zeilen: string[] = [BOM + header]
  for (const g of gruppen) {
    for (const b of g.zeilen) {
      const zn = zeitnachweise.get(b.id)
      const stunden = effectiveStunden(b, zn)
      const u = calcUmsatz(b, zn)
      const k = calcKosten(b, zn)
      zeilen.push([
        b.agentur_name, b.kandidatenname, b.vakanz_titel, b.stunden_woche, stunden,
        (b.einkaufspreis ?? 0).toFixed(2).replace(".", ","),
        (b.verkaufspreis ?? 0).toFixed(2).replace(".", ","),
        `${b.marge_prozent ?? 0}%`,
        u.toFixed(2).replace(".", ","),
        k.toFixed(2).replace(".", ","),
        (u - k).toFixed(2).replace(".", ","),
      ].join(sep))
    }
    zeilen.push([`GESAMT ${g.agentur_name}`, "", "", "", "", "", "", "",
      g.umsatz.toFixed(2).replace(".", ","),
      g.kosten.toFixed(2).replace(".", ","),
      g.marge.toFixed(2).replace(".", ","),
    ].join(sep))
    zeilen.push("")
  }
  const blob = new Blob([zeilen.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Abrechnung_${monatLabel.replace(/\s/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
```

- [ ] **Step 7.3: Replace state declarations and useEffects in AbrechnungPage**

Replace the state block and useEffect(s) (everything from `const [beauftragungen, ...]` up to and including the `gefiltert` / `gruppen` / totals block) with:

```typescript
  const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [monat, setMonat] = React.useState(aktuellerMonat())
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [rolle, setRolle] = React.useState<string>("")
  const [zeitnachweise, setZeitnachweise] = React.useState<Map<string, Zeitnachweis>>(new Map())

  const monate = React.useMemo(() => monateListe(), [])

  React.useEffect(() => {
    fetch("/api/beauftragungen")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((body) => {
        const data: Beauftragung[] = Array.isArray(body) ? body : (body.data ?? [])
        setBeauftragungen(data)
        if (body.rolle) setRolle(body.rolle)
        const ids = [...new Set(data.map((b) => b.agentur_id))]
        setExpanded(Object.fromEntries(ids.map((id) => [id, true])))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    if (beauftragungen.length === 0) return
    const [year, month] = monat.split("-").map(Number)
    const monatDate = `${year}-${String(month).padStart(2, "0")}-01`
    const ids = beauftragungen.map((b) => b.id).join(",")
    fetch(`/api/zeitnachweise?beauftragung_ids=${ids}&monat=${monatDate}`)
      .then((r) => r.ok ? r.json() : { zeitnachweise: [] })
      .then((body) => {
        const map = new Map<string, Zeitnachweis>()
        for (const zn of (body.zeitnachweise ?? [])) map.set(zn.beauftragung_id, zn)
        setZeitnachweise(map)
      })
      .catch(() => {})
  }, [monat, beauftragungen])

  const [monatJahr, monatMonat] = monat.split("-").map(Number)
  const monatEnde = new Date(monatJahr, monatMonat, 0)
  const gefiltert = beauftragungen.filter((b) => new Date(b.startdatum) <= monatEnde && b.aktiv)

  const gruppen = React.useMemo(
    () => gruppiereNachAgentur(gefiltert, zeitnachweise),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monat, beauftragungen, zeitnachweise]
  )

  const isFinancial = rolle === 'Staffhub Manager' || rolle === 'Admin'
  const isController = rolle === 'Controller'
  const isAgentur = rolle === 'Agentur'
  const colCount = loading || isFinancial ? 11 : isController ? 6 : 5

  const totalUmsatz = gruppen.reduce((s, g) => s + g.umsatz, 0)
  const totalKosten = gruppen.reduce((s, g) => s + g.kosten, 0)
  const totalMarge = totalUmsatz - totalKosten
```

- [ ] **Step 7.4: Update exportCSV call**

Find the CSV button's `onClick` and update:

```tsx
onClick={() => exportCSV(gruppen, monatLabel, zeitnachweise)}
```

- [ ] **Step 7.5: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 7.6: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/abrechnung/page.tsx
git commit -m "feat: add zeitnachweise state, role detection, updated calcs in Abrechnung"
```

---

## Task 8: Abrechnung page — upload UI (Manager + Agentur)

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

- [ ] **Step 8.1: Add IconUpload import**

In the `@tabler/icons-react` import block, add `IconUpload` to the list.

- [ ] **Step 8.2: Add upload state + handler inside AbrechnungPage**

After the `zeitnachweise` state line, add:

```typescript
  const [uploadingId, setUploadingId] = React.useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = React.useState<Record<string, string>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const uploadTargetRef = React.useRef<{ beauftragungId: string; monat: string } | null>(null)
```

After `toggleAgentur`, add:

```typescript
  function triggerUpload(beauftragungId: string) {
    const [year, month] = monat.split("-").map(Number)
    uploadTargetRef.current = {
      beauftragungId,
      monat: `${year}-${String(month).padStart(2, "0")}-01`,
    }
    fileInputRef.current?.click()
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const target = uploadTargetRef.current
    if (!file || !target) return
    e.target.value = ""
    setUploadingId(target.beauftragungId)
    setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: "" }))
    const fd = new FormData()
    fd.append("file", file)
    fd.append("beauftragung_id", target.beauftragungId)
    fd.append("monat", target.monat)
    try {
      const r = await fetch("/api/zeitnachweise", { method: "POST", body: fd })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Upload fehlgeschlagen")
      const zn: Zeitnachweis = body.zeitnachweis
      setZeitnachweise((prev) => { const next = new Map(prev); next.set(zn.beauftragung_id, zn); return next })
      if (zn.stunden_ist === null) {
        setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: "Stunden konnten nicht extrahiert werden." }))
      }
    } catch (err) {
      setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: err instanceof Error ? err.message : "Upload fehlgeschlagen" }))
    } finally {
      setUploadingId(null)
      uploadTargetRef.current = null
    }
  }
```

- [ ] **Step 8.3: Add hidden file input to JSX**

Wrap the return value in a fragment and add the file input. Change:

```tsx
  return (
    <SidebarProvider
```

To:

```tsx
  return (
    <>
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
      <SidebarProvider
```

And change the closing `)` to close the fragment: at the end replace `</SidebarProvider>` + `)` with `</SidebarProvider></>)`.

- [ ] **Step 8.4: Update table header**

Replace the `<TableHeader>` block with:

```tsx
<TableHeader className="bg-muted sticky top-0 z-10">
  <TableRow>
    <TableHead className="w-8"></TableHead>
    <TableHead>Kandidat / Agentur</TableHead>
    <TableHead>Vakanz</TableHead>
    {(isFinancial || isAgentur) && (
      <TableHead className="text-right">h/Woche</TableHead>
    )}
    {isFinancial && (
      <>
        <TableHead className="text-right">
          <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />EK €/Tag</span>
        </TableHead>
        <TableHead className="text-right">VK €/Tag</TableHead>
        <TableHead className="text-right">
          <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge%</span>
        </TableHead>
        <TableHead className="text-right">Umsatz/Mo</TableHead>
        <TableHead className="text-right">
          <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Kosten/Mo</span>
        </TableHead>
        <TableHead className="text-right">
          <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge/Mo</span>
        </TableHead>
      </>
    )}
    {isController && (
      <>
        <TableHead className="text-right">Marge €/Std</TableHead>
        <TableHead className="text-right">Std/Mo (Ist)</TableHead>
        <TableHead className="text-right">Marge/Mo</TableHead>
      </>
    )}
    {!isController && (
      <TableHead className="text-right print:hidden">Zeitnachweis</TableHead>
    )}
  </TableRow>
</TableHeader>
```

- [ ] **Step 8.5: Update empty state and skeleton colSpan**

Replace `<TableSkeletonRows cols={10} />` with `<TableSkeletonRows cols={colCount} />`.

Replace `colSpan={10}` (empty state) with `colSpan={colCount}`.

- [ ] **Step 8.6: Replace Agentur-Header-Zeile (group row)**

Replace the group header `<TableRow>` JSX with:

```tsx
<TableRow
  className="bg-muted/40 cursor-pointer hover:bg-muted/60 font-medium"
  onClick={() => toggleAgentur(g.agentur_id)}
>
  <TableCell className="py-2">
    {isOpen ? <IconChevronDown className="size-4 text-muted-foreground" /> : <IconChevronRight className="size-4 text-muted-foreground" />}
  </TableCell>
  <TableCell colSpan={2} className="font-semibold">
    {g.agentur_name}{" "}
    <span className="text-xs font-normal text-muted-foreground">({g.zeilen.length} Beauftragungen)</span>
  </TableCell>
  {isFinancial && (
    <>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell className="text-right tabular-nums font-semibold">{fmt(g.umsatz)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(g.kosten)}</TableCell>
      <TableCell className="text-right tabular-nums text-green-700 font-semibold">{fmt(g.marge)}</TableCell>
    </>
  )}
  {isController && (
    <>
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell className="text-right tabular-nums text-green-700 font-semibold">
        {fmt(g.zeilen.reduce((sum, b) => {
          const zn = zeitnachweise.get(b.id)
          return sum + (b.margenaufschlag ?? 0) * effectiveStunden(b, zn)
        }, 0))}
      </TableCell>
    </>
  )}
  {isAgentur && (
    <>
      <TableCell></TableCell>
    </>
  )}
  {!isController && <TableCell className="print:hidden"></TableCell>}
</TableRow>
```

- [ ] **Step 8.7: Replace Kandidaten-Zeilen row**

Replace the inner `<TableRow key={b.id}>` block with:

```tsx
<TableRow key={b.id}>
  <TableCell></TableCell>
  <TableCell className="pl-6 text-sm">{b.kandidatenname}</TableCell>
  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{b.vakanz_titel}</TableCell>
  {(isFinancial || isAgentur) && (
    <TableCell className="text-right tabular-nums text-sm">{b.stunden_woche}</TableCell>
  )}
  {isFinancial && (
    <>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {(b.einkaufspreis ?? 0).toLocaleString("de-DE")} €
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium">
        {(b.verkaufspreis ?? 0).toLocaleString("de-DE")} €
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {b.marge_prozent ?? 0}%
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">{fmt(calcUmsatz(b, zeitnachweise.get(b.id)))}</TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmt(calcKosten(b, zeitnachweise.get(b.id)))}</TableCell>
      <TableCell className="text-right tabular-nums text-sm text-green-700">
        {fmt(calcUmsatz(b, zeitnachweise.get(b.id)) - calcKosten(b, zeitnachweise.get(b.id)))}
      </TableCell>
    </>
  )}
  {isController && (() => {
    const zn = zeitnachweise.get(b.id)
    const stunden = effectiveStunden(b, zn)
    const marge = b.margenaufschlag ?? 0
    return (
      <>
        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
          {marge.toLocaleString("de-DE")} €
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
  {!isController && (
    <TableCell className="text-right print:hidden">
      {uploadErrors[b.id] && (
        <p className="text-[10px] text-destructive mb-1">{uploadErrors[b.id]}</p>
      )}
      {zeitnachweise.has(b.id) ? (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-green-700 font-medium">
            {zeitnachweise.get(b.id)!.stunden_ist != null ? `${zeitnachweise.get(b.id)!.stunden_ist} Std.` : "Parsing fehlgeschlagen"}
          </span>
          <button
            className="text-[10px] text-muted-foreground hover:underline disabled:opacity-50"
            onClick={() => triggerUpload(b.id)}
            disabled={uploadingId === b.id}
          >
            {uploadingId === b.id ? "Lädt…" : "Ersetzen"}
          </button>
        </div>
      ) : (
        <button
          className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => triggerUpload(b.id)}
          disabled={uploadingId === b.id}
        >
          <IconUpload className="size-3" />
          {uploadingId === b.id ? "Lädt…" : "Upload"}
        </button>
      )}
    </TableCell>
  )}
</TableRow>
```

- [ ] **Step 8.8: Replace TableFooter**

Replace the `{!loading && gefiltert.length > 0 && (<TableFooter>...)}` block with:

```tsx
{!loading && gefiltert.length > 0 && (isFinancial || isController) && (
  <TableFooter>
    <TableRow className="bg-muted/80 font-bold">
      {isFinancial && (
        <>
          <TableCell colSpan={8} className="text-right">Gesamt {monatLabel}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt(totalUmsatz)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(totalKosten)}</TableCell>
          <TableCell className="text-right tabular-nums text-green-700">{fmt(totalMarge)}</TableCell>
          <TableCell className="print:hidden"></TableCell>
        </>
      )}
      {isController && (
        <>
          <TableCell colSpan={5} className="text-right">Gesamt {monatLabel}</TableCell>
          <TableCell className="text-right tabular-nums text-green-700">
            {fmt(gefiltert.reduce((sum, b) => {
              const zn = zeitnachweise.get(b.id)
              return sum + (b.margenaufschlag ?? 0) * effectiveStunden(b, zn)
            }, 0))}
          </TableCell>
        </>
      )}
    </TableRow>
  </TableFooter>
)}
```

- [ ] **Step 8.9: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 8.10: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/abrechnung/page.tsx
git commit -m "feat: add Zeitnachweis upload UI and role-based table layout in Abrechnung"
```

---

## Task 9: Abrechnung page — Controller inline margenaufschlag editing

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

Context: In Task 8 the Controller row shows `marge` as read-only text. This task makes it an editable input that PATCHes `/api/beauftragungen/[id]` on blur.

- [ ] **Step 9.1: Add margen override state**

After the `uploadErrors` state line, add:

```typescript
  const [margenOverrides, setMargenOverrides] = React.useState<Record<string, number>>({})
  const [savingMarge, setSavingMarge] = React.useState<Record<string, boolean>>({})
```

- [ ] **Step 9.2: Add saveMarge handler**

After `handleFileSelect`, add:

```typescript
  async function saveMarge(beauftragungId: string, value: number) {
    setSavingMarge((prev) => ({ ...prev, [beauftragungId]: true }))
    try {
      const r = await fetch(`/api/beauftragungen/${beauftragungId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ margenaufschlag: value }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? "Fehler")
      setBeauftragungen((prev) =>
        prev.map((b) => b.id === beauftragungId ? { ...b, margenaufschlag: value } : b)
      )
    } catch {
      setMargenOverrides((prev) => { const next = { ...prev }; delete next[beauftragungId]; return next })
    } finally {
      setSavingMarge((prev) => ({ ...prev, [beauftragungId]: false }))
    }
  }
```

- [ ] **Step 9.3: Replace the Controller Marge €/Std cell with editable input**

In the `isController` block of the Kandidaten row (from Task 8), replace:

```tsx
        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
          {marge.toLocaleString("de-DE")} €
        </TableCell>
```

With:

```tsx
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
```

Also update the `marge` variable in the same IIFE to use override:

```typescript
    const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
```

And update the group header Controller total to use overrides too (in Step 8.6):

Find the group row Controller block and replace the reduce:

```tsx
        {fmt(g.zeilen.reduce((sum, b) => {
          const zn = zeitnachweise.get(b.id)
          const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
          return sum + marge * effectiveStunden(b, zn)
        }, 0))}
```

And update the footer Controller total similarly:

```tsx
          {fmt(gefiltert.reduce((sum, b) => {
            const zn = zeitnachweise.get(b.id)
            const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
            return sum + marge * effectiveStunden(b, zn)
          }, 0))}
```

- [ ] **Step 9.4: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 9.5: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/abrechnung/page.tsx
git commit -m "feat: Controller inline margenaufschlag editing in Abrechnung"
```

---

## Self-Review

**Spec coverage:**
- ✅ `zeitnachweise` table with `unique(beauftragung_id, monat)` — Task 1
- ✅ Supabase Storage bucket `zeitnachweise` — Task 1
- ✅ Controller RBAC role — Task 2
- ✅ Agentur gets `/abrechnung` access — Task 2
- ✅ `extractStundenFromPDF` via OpenAI `responses.create` (no pdf-parse needed — same pattern as CV skill extraction) — Task 3
- ✅ POST upload + OpenAI parse + upsert — Task 4
- ✅ GET list by beauftragung_ids + monat — Task 4
- ✅ Agentur ownership check on upload — Task 4
- ✅ GET signed download URL — Task 5
- ✅ DELETE (Manager only) — Task 5
- ✅ Controller allowed in GET beauftragungen — Task 6
- ✅ `rolle` returned in GET beauftragungen response — Task 6
- ✅ PATCH margenaufschlag — Task 6
- ✅ Role detection in Abrechnung page — Task 7
- ✅ Actual hours replace estimated when Zeitnachweis exists — Task 7
- ✅ Upload button per row for Manager/Agentur — Task 8
- ✅ Parse error shown in UI — Task 8
- ✅ Re-upload overwrites (upsert) — Task 4 + Task 8
- ✅ Role-based column layout (11 / 6 / 5) — Task 8
- ✅ Controller sees Std/Mo (actual or estimated) — Task 8
- ✅ Controller inline margenaufschlag input — Task 9
- ✅ Controller total = margenaufschlag × stunden_ist — Task 9
- ✅ Footer total for Controller — Task 8 + 9

**Placeholder scan:** None — all code is complete and literal.

**Type consistency:**
- `Zeitnachweis` defined Task 7.1, used Tasks 8 + 9 ✅
- `effectiveStunden(b, zn)` defined Task 7.2, used Tasks 8 + 9 ✅
- `extractStundenFromPDF` defined Task 3, imported in Task 4 ✅
- `PATCH /api/beauftragungen/[id]` defined Task 6.2, called Task 9 ✅
- `margenOverrides` state added Task 9.1, used Task 9.3 ✅
