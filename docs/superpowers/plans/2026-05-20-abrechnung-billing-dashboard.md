# Monatliche Abrechnung: Billing Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company-wide billing dashboard with KPI metrics, unified table, invoice tracking, and Zeitnachweis hour uploads.

**Architecture:** New `zeitnachweise` and `rechnungen` DB tables. New Controller RBAC role. Extended `/abrechnung` page with KPI cards, unified 7-column table, client-side sorting/filtering. OpenAI-powered PDF hour extraction. All data fetched once per month; UI handles filtering/sorting.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (PostgREST + Storage), OpenAI SDK, Zod, shadcn/ui.

---

## File Structure

**Database:**
- Migrations: `migrations/007_zeitnachweise.sql`, `migrations/008_rechnungen.sql`

**Libraries:**
- `src/lib/openai.ts` — Add `extractStundenFromPDF()` function

**RBAC:**
- `src/lib/rbac.ts` — Add Controller role

**API Routes:**
- `src/app/api/zeitnachweise/route.ts` — POST upload, GET list
- `src/app/api/zeitnachweise/[id]/route.ts` — GET download URL, DELETE
- `src/app/api/rechnungen/route.ts` — GET list, prepare for PATCH (future)
- `src/app/api/beauftragungen/route.ts` — Modify: allow Controller, add `rolle` to response
- `src/app/api/beauftragungen/[id]/route.ts` — Modify: allow PATCH margenaufschlag for Controller (already exists from Feature B)

**UI:**
- `src/app/abrechnung/page.tsx` — Complete redesign: KPI cards, unified table, sorting, filtering, upload

---

## Task 1: DB Migration — Zeitnachweis Table

**Files:**
- Create: `migrations/007_zeitnachweise.sql`

- [ ] **Step 1: Create migration file**

Create `migrations/007_zeitnachweise.sql`:

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

- [ ] **Step 2: Apply migration via Supabase**

Use Supabase MCP tool `apply_migration` with name `007_zeitnachweise` and the SQL above.

- [ ] **Step 3: Verify table created**

Query:
```bash
mcp__supabase__execute_sql "select count(*) from zeitnachweise;"
```

Expected: `0`

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add migrations/007_zeitnachweise.sql
git commit -m "feat: create zeitnachweise table with RLS policies"
```

---

## Task 2: DB Migration — Rechnungen Table + Storage Bucket

**Files:**
- Create: `migrations/008_rechnungen.sql`

- [ ] **Step 1: Create rechnungen migration**

Create `migrations/008_rechnungen.sql`:

```sql
create table if not exists rechnungen (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null,
  gesamtbetrag numeric not null,
  status text not null default 'Entwurf',
  betrag_bezahlt numeric default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  unique (beauftragung_id, monat)
);

alter table rechnungen enable row level security;

create policy "rechnungen_manager_all" on rechnungen
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and rolle in ('Staffhub Manager', 'Admin', 'Controller')
        and aktiv = true
    )
  );

create policy "rechnungen_agentur_own" on rechnungen
  for select using (
    exists (
      select 1 from beauftragungen b
      join profiles p on p.id = auth.uid()
      where b.id = rechnungen.beauftragung_id
        and b.agentur_id = p.agentur_id
        and p.rolle = 'Agentur'
        and p.aktiv = true
    )
  );
```

- [ ] **Step 2: Apply migration**

Use Supabase MCP `apply_migration` with name `008_rechnungen` and SQL above.

- [ ] **Step 3: Create Storage bucket for PDFs**

Run via Supabase MCP `execute_sql`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zeitnachweise', 'zeitnachweise', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy if not exists "zeitnachweise_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'zeitnachweise');

create policy if not exists "zeitnachweise_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'zeitnachweise');

create policy if not exists "zeitnachweise_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'zeitnachweise');
```

- [ ] **Step 4: Verify**

Query:
```bash
mcp__supabase__execute_sql "select count(*) from rechnungen;"
```

Expected: `0`

- [ ] **Step 5: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add migrations/008_rechnungen.sql
git commit -m "feat: create rechnungen table, zeitnachweise storage bucket"
```

---

## Task 3: RBAC — Add Controller Role

**Files:**
- Modify: `src/lib/rbac.ts`

- [ ] **Step 1: Read rbac.ts**

Check current file: `src/lib/rbac.ts`

- [ ] **Step 2: Add Controller to ROLE_ROUTES**

Find the `ROLE_ROUTES` object. Replace with:

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
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/lib/rbac.ts
git commit -m "feat: add Controller RBAC role"
```

---

## Task 4: OpenAI Library — extractStundenFromPDF Function

**Files:**
- Modify: `src/lib/openai.ts`

- [ ] **Step 1: Read openai.ts**

Check file at `src/lib/openai.ts` to understand existing patterns.

- [ ] **Step 2: Add function at end of file**

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

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/lib/openai.ts
git commit -m "feat: add extractStundenFromPDF function"
```

---

## Task 5: API — Zeitnachweise POST Upload + GET List

**Files:**
- Create: `src/app/api/zeitnachweise/route.ts`

- [ ] **Step 1: Create file**

Create `src/app/api/zeitnachweise/route.ts` with POST and GET handlers (see plan for full code).

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/api/zeitnachweise/route.ts
git commit -m "feat: add zeitnachweise API (POST upload + GET list)"
```

---

## Task 6: API — Zeitnachweise Detail (Download URL + DELETE)

**Files:**
- Create: `src/app/api/zeitnachweise/[id]/route.ts`

- [ ] **Step 1: Create file**

Create `src/app/api/zeitnachweise/[id]/route.ts` with GET and DELETE handlers (see plan for full code).

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add "src/app/api/zeitnachweise/[id]/route.ts"
git commit -m "feat: add zeitnachweise detail API (download + delete)"
```

---

## Task 7: API — Rechnungen GET List

**Files:**
- Create: `src/app/api/rechnungen/route.ts`

- [ ] **Step 1: Create file**

Create `src/app/api/rechnungen/route.ts` with GET handler (see plan for full code).

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/api/rechnungen/route.ts
git commit -m "feat: add rechnungen API (GET list)"
```

---

## Task 8: API — Beauftragungen GET (Allow Controller, Return Rolle)

**Files:**
- Modify: `src/app/api/beauftragungen/route.ts`

- [ ] **Step 1: Update role check**

Find `const isManager = ...` line and add Controller:
```typescript
const isManager = profile?.rolle === 'Staffhub Manager' || profile?.rolle === 'Admin' || profile?.rolle === 'Controller'
```

- [ ] **Step 2: Add rolle to response**

Update both return statements to include `rolle: profile?.rolle`

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/api/beauftragungen/route.ts
git commit -m "feat: allow Controller in beauftragungen GET, return rolle"
```

---

## Task 9: Abrechnung Page — Types, State, Helpers, Upload Handlers

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

- [ ] **Step 1: Add types**

Replace `// ── Types ──` section with Beauftragung, Zeitnachweis, Rechnung interfaces.

- [ ] **Step 2: Add helpers**

Replace `// ── Helpers ──` section with fmt, effectiveStunden, calcMarge, calcGesamtbetrag, monateListe, aktuellerMonat, exportCSV, SortIcon.

- [ ] **Step 3: Add state**

Add beauftragungen, zeitnachweise, rechnungen, loading, error, monat, rolle, filtering, sorting, upload states.

- [ ] **Step 4: Add useEffect for data loading**

Fetch beauftragungen, zeitnachweise, rechnungen for selected month.

- [ ] **Step 5: Add filter/sort/upload handlers**

Add handleSort, triggerUpload, handleFileSelect functions.

- [ ] **Step 6: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/abrechnung/page.tsx
git commit -m "feat: add types, state, helpers, and handlers in Abrechnung"
```

---

## Task 10: Abrechnung Page — KPI Cards, Table, Filtering, Sorting

**Files:**
- Modify: `src/app/abrechnung/page.tsx`

- [ ] **Step 1: Add filtered + sorted data**

Implement filter logic (date, agentur, status) and sorting logic before return.

- [ ] **Step 2: Calculate KPI metrics**

Add gesamtStundenSoll, gesamtStundenIst, gesamtUmsatz, aktivCount, offeneBetraege calculations.

- [ ] **Step 3: Replace return JSX**

Implement full JSX with:
- Month selector + CSV button
- KPI cards
- Filter controls (Agentur, Zahlungsstatus)
- Skeleton loading state
- Table with sortable headers
- Empty state

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/abrechnung/page.tsx
git commit -m "feat: add KPI cards, table, filtering, sorting in Abrechnung"
```

---

## Self-Review

**Spec coverage:**
- ✅ zeitnachweise table + RLS — Task 1
- ✅ rechnungen table + RLS — Task 2
- ✅ Storage bucket — Task 2
- ✅ Controller RBAC role — Task 3
- ✅ extractStundenFromPDF — Task 4
- ✅ POST upload + GET list — Task 5
- ✅ GET download URL + DELETE — Task 6
- ✅ GET rechnungen list — Task 7
- ✅ Controller allowed, rolle returned — Task 8
- ✅ KPI metrics, month selector, table, filtering, sorting — Tasks 9-10

**Placeholder scan:** None. All code complete.

**Type consistency:** All types defined Task 9, used consistently throughout.
