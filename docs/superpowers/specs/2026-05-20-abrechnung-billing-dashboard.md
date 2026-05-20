# Monatliche Abrechnung: Billing Dashboard mit KPIs & Zahlungstracking

**Datum:** 2026-05-20  
**Status:** Approved  
**Feature:** Invoice-based billing dashboard with KPI metrics, hour tracking, payment status, and role-based access

---

## Goal

Manager/Admin/Controller users see a company-wide billing dashboard on `/abrechnung` with:
- **KPI metrics** (Gesamtstunden Soll vs. Ist, Gesamtumsatz, active assignment count, outstanding amounts)
- **Month selector** for dynamic month view
- **Unified 7-column table** showing all Beauftragungen with inline data
- **Sorting** by Margin, Gesamtbetrag, Ressourcen-Name, Payment Status
- **Filtering** by Agentur and Zahlungsstatus
- **Zeitnachweis uploads** (PDF → OpenAI hour extraction)
- **Invoice management** (draft/sent/paid status tracking)
- **Controller margin editing** (inline, saves to DB)

---

## Architecture

Extends `/abrechnung` page. New DB tables `zeitnachweise` and `rechnungen` track hours and billing. New `Controller` RBAC role. All data fetched once on load, client-side filtering/sorting for UX. No new top-level routes.

---

## Data Model

### Table: `zeitnachweise`

```sql
create table zeitnachweise (
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
```

### Table: `rechnungen` (NEW)

```sql
create table rechnungen (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null,
  gesamtbetrag numeric not null,
  status text not null default 'Entwurf', -- 'Entwurf', 'Versendet', 'Bezahlt'
  betrag_bezahlt numeric default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  unique (beauftragung_id, monat)
);
```

### Supabase Storage Bucket: `zeitnachweise`

- Private bucket (signed URLs, TTL 3600s)
- Path: `{beauftragung_id}/{YYYY-MM}.pdf`

---

## RBAC

Modify `src/lib/rbac.ts`:

```typescript
'Controller': [
  '/dashboard',
  '/abrechnung',
  '/settings',
  '/api',
],
```

Manager/Admin already have `/abrechnung` access.

---

## Dashboard UI — `/abrechnung`

### Layout (top to bottom)

1. **Header** — "Abrechnung" title, Month selector dropdown, Export CSV button
2. **KPI Metrics** — 4 cards in a row:
   - **Gesamtstunden** — Shows "XXX Soll / YYY Ist" (Soll = stunden_woche × 4 sum, Ist = zeitnachweis stunden_ist sum)
   - **Gesamtumsatz** — Sum of (verkaufspreis × effective_stunden) across all beauftragungen
   - **Aktive Beauftragungen** — Count of beauftragungen with startdatum ≤ month-end and aktiv = true
   - **Offene Beträge** — Sum of (gesamtbetrag - betrag_bezahlt) for all unpaid invoices (status ≠ 'Bezahlt')
3. **Filter/Sort Controls** — Agentur dropdown, Zahlungsstatus dropdown, Sort-by selector (all client-side)
4. **Unified Table** — 7 columns, sortable, filterable
5. **Footer** — Totals row (only for financial columns)

---

## Table Columns (Unified 7 columns for all roles)

| # | Column | Description | Data |
|---|--------|-------------|------|
| 1 | **Ressource** | Candidate name | `kandidatenname` |
| 2 | **Vakanz** | Job title | `vakanz_titel` |
| 3 | **Marge €** | Monthly margin in EUR | `(verkaufspreis - einkaufspreis) × effective_stunden` |
| 4 | **Gesamtbetrag** | Monthly revenue | `verkaufspreis × effective_stunden` |
| 5 | **Status** | Invoice payment status | `rechnungen.status` (Entwurf/Versendet/Bezahlt) or "—" if no invoice |
| 6 | **Offene Beträge** | Amount still owed (only if unpaid) | `rechnungen.gesamtbetrag - rechnungen.betrag_bezahlt`, or "—" if paid/no invoice |
| 7 | **Zeitnachweis** | Hour tracking + upload button | Icon + upload button (Manager/Agentur only) |

### Sorting behavior

Clicking a column header sorts by that column (ascending/descending toggle). State tracks current sort column + direction.

Sorting by:
- **Marge €** — numeric (high to low default)
- **Gesamtbetrag** — numeric (high to low default)
- **Ressource** — alphabetic
- **Status** — by enum order (Entwurf → Versendet → Bezahlt)
- **Offene Beträge** — numeric

### Filtering behavior (client-side)

- **Agentur filter** — Dropdown of all agentur_name values; "Alle" shows everything. Filters by beauftragung.agentur_id.
- **Zahlungsstatus filter** — Dropdown: "Alle", "Entwurf", "Versendet", "Bezahlt", "Kein Rechnung". Filters by rechnungen.status or whether invoice exists.

---

## Calculations

### Effective Hours

```
effective_stunden = zeitnachweis.stunden_ist ?? (beauftragung.stunden_woche × 4)
```

If Zeitnachweis uploaded for the month, use actual hours. Otherwise, use estimate (weekly × 4 weeks).

### Monthly Metrics (per Beauftragung)

- **Marge €** = `(verkaufspreis - einkaufspreis) × effective_stunden`
- **Gesamtbetrag (Umsatz)** = `verkaufspreis × effective_stunden`
- **Gesamtkosten** = `einkaufspreis × effective_stunden`

### KPI Cards (sums across all beauftragungen for selected month)

- **Gesamtstunden Soll** = `sum(stunden_woche × 4)` across all active beauftragungen
- **Gesamtstunden Ist** = `sum(effective_stunden)` across all active beauftragungen
- **Gesamtumsatz** = `sum(Gesamtbetrag)` across all active beauftragungen
- **Aktive Beauftragungen** = `count(beauftragungen where startdatum ≤ month-end and aktiv = true)`
- **Offene Beträge** = `sum(gesamtbetrag - betrag_bezahlt) where status ≠ 'Bezahlt'` across all invoices in month

---

## Zeitnachweis Upload

Same as existing feature:

1. Manager/Agentur clicks "Upload" button in Zeitnachweis column
2. File picker → PDF only, max 10 MB
3. POST `/api/zeitnachweise` with file, beauftragung_id, monat
4. API stores PDF in Storage, sends to OpenAI for hour extraction (gpt-4o-mini)
5. API upserts `zeitnachweise` row with `stunden_ist`
6. UI updates row, effective_stunden recalculates, metrics refresh

Re-upload overwrites previous entry (upsert on `beauftragung_id, monat`).

---

## Invoice Management (Controller only)

### Manual Invoice Creation

Controller can manually create an invoice for a Beauftragung + month (future enhancement):
- Button: "Rechnung erstellen"
- Creates `rechnungen` row with status = 'Entwurf', gesamtbetrag = calculated monthly revenue
- Rechnung appears in Status column

### Inline Status Update

In Status column (future: Controller only):
- Dropdown or inline button to change status: Entwurf → Versendet → Bezahlt
- PATCH `/api/rechnungen/[id]` with new status
- On "Bezahlt": set `betrag_bezahlt = gesamtbetrag`, record `paid_at` timestamp

---

## API Routes

### `POST /api/zeitnachweise`

- Auth: Manager/Agentur only
- Body: multipart/form-data (file, beauftragung_id, monat)
- Returns: `{ id, stunden_ist, monat }`

### `GET /api/zeitnachweise?beauftragung_id=&monat=`

- Auth: all roles
- Returns: zeitnachweis record or null

### `GET /api/zeitnachweise/[id]`

- Auth: all roles
- Returns: signed download URL

### `DELETE /api/zeitnachweise/[id]`

- Auth: Manager only
- Removes PDF + DB row

### `GET /api/abrechnung?monat=YYYY-MM` (NEW)

- Auth: Manager/Admin/Controller only
- Returns: `{ beauftragungen, rechnungen, zeitnachweise }` for the month
- All data fetched once; UI handles filtering/sorting

### `PATCH /api/rechnungen/[id]` (NEW — Future)

- Auth: Controller only
- Body: `{ status: 'Versendet' | 'Bezahlt' }`
- Updates DB, returns updated record

---

## UI Interactions

### Month Selector

- Dropdown showing 12 months (current ±11 months)
- Default: current month
- On change: refetch beauftragungen + rechnungen + zeitnachweise for new month

### Sorting

- Column headers are clickable
- Click → sort ascending; click again → descending
- Visual indicator (↑/↓) on active sort column
- Client-side sort, no server round-trip

### Filtering

- **Agentur**: Dropdown, default "Alle"
- **Zahlungsstatus**: Dropdown, default "Alle"
- Both apply immediately (client-side)
- Can combine filters (AND logic)

### Export CSV

- Button exports current month's data (after filters applied)
- Columns: Ressource, Vakanz, h/Woche, Stunden (Ist), EK €, VK €, Marge%, Umsatz, Kosten, Marge €, Status, Offene Beträge
- BOM + semicolon-separated

---

## Affected Files

| File | Change |
|------|--------|
| DB Migrations | Create `zeitnachweise` + `rechnungen` tables, Storage bucket |
| `src/lib/rbac.ts` | Add Controller role |
| `src/lib/openai.ts` | Add `extractStundenFromPDF()` function |
| `src/app/api/zeitnachweise/route.ts` | POST upload + parse, GET list |
| `src/app/api/zeitnachweise/[id]/route.ts` | GET signed URL, DELETE |
| `src/app/api/rechnungen/route.ts` | GET list (new) |
| `src/app/api/rechnungen/[id]/route.ts` | PATCH status (new, future) |
| `src/app/api/beauftragungen/route.ts` | Allow Controller, add rolle to response |
| `src/app/abrechnung/page.tsx` | Complete redesign: KPI cards, unified table, sorting, filtering, upload UI |

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No Zeitnachweis for month | Effective hours = estimated (stunden_woche × 4) |
| Beauftragung ends mid-month | Calculate revenue for partial month (only if within selected month) |
| No rechnungen for assignment | Status column shows "—", no Offene Beträge |
| Invoice already paid | Status = "Bezahlt", Offene Beträge = 0 |
| Agentur uploads Zeitnachweis | Ownership check in POST handler (agentur_id match required) |
| Controller edits Zeitnachweis | Not allowed; Manager/Agentur only |

---

## Out of Scope (Future)

- Automatic invoice generation (creation is manual; status updates future)
- Email sending when invoice status changes
- PDF invoice rendering/download
- Payment method tracking
- Multi-month or bulk operations
- Audit logs for invoice changes

---

## Testing

- TypeScript: `npx tsc --noEmit`
- Manual test: load /abrechnung, verify KPI cards calculate correctly, filter/sort works, upload UI functional
