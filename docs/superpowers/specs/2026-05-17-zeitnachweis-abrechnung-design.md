# Zeitnachweis Upload & Controller Abrechnung

## Goal

Monthly timesheet PDFs (Zeitnachweise) can be uploaded per Beauftragung per month by Agentur and Manager. OpenAI API automatically extracts actual hours worked. A new Controller role uses actual hours to calculate monthly margins.

## Architecture

Extends the existing `/abrechnung` page — no new top-level routes. New DB table `zeitnachweise` stores parsed hours per Beauftragung per month. New Supabase Storage bucket `zeitnachweise` holds the PDF files. New RBAC role `Controller` with access limited to `/abrechnung`. Margin calculation switches from estimated (`stunden_woche × 4`) to actual (`stunden_ist`) when a Zeitnachweis exists for the selected month.

## Files

- Modify: `src/lib/rbac.ts` — add `Controller` role
- Modify: `src/app/abrechnung/page.tsx` — upload button, actual hours display, Controller margin editing
- Create: `src/app/api/zeitnachweise/route.ts` — POST upload + parse
- Create: `src/app/api/zeitnachweise/[id]/route.ts` — GET signed URL, DELETE
- Modify: `src/app/api/beauftragungen/[id]/route.ts` — add PATCH handler for margenaufschlag (file exists, only has PUT today)
- DB migration: create `zeitnachweise` table

## Data Model

### Table: `zeitnachweise`

```sql
create table zeitnachweise (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null, -- always first of month, e.g. 2026-05-01
  stunden_ist numeric,  -- null if OpenAI could not parse
  pdf_path text not null,
  parsed_raw jsonb,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (beauftragung_id, monat)
);
```

### Supabase Storage Bucket: `zeitnachweise`

- Private bucket (signed URLs, TTL 3600s)
- Path: `{beauftragung_id}/{YYYY-MM}.pdf`

### Existing table: `beauftragungen`

No schema changes. `margenaufschlag` already exists and is edited by Controller.

## RBAC

New role `Controller` in `src/lib/rbac.ts`:

```typescript
'Controller': [
  '/dashboard', '/abrechnung', '/settings', '/api',
],
```

## Upload Flow

1. Manager or Agentur clicks upload button on a Beauftragung row in `/abrechnung`
2. File picker opens (PDF only, max 10 MB)
3. `POST /api/zeitnachweise` — multipart/form-data: `file`, `beauftragung_id`, `monat` (YYYY-MM-DD)
4. API stores PDF in Supabase Storage at `{beauftragung_id}/{YYYY-MM}.pdf`
5. API sends PDF text content to OpenAI API — prompt asks to extract total hours worked as a number
6. API upserts `zeitnachweise` row: `stunden_ist`, `parsed_raw`, `pdf_path`, `uploaded_by`
7. Response: `{ id, stunden_ist, monat }` — UI updates row immediately

Re-upload on same `(beauftragung_id, monat)` overwrites the previous entry (upsert).

## OpenAI Parsing

The codebase already uses `responses.create` with `input_file` to send PDF buffers directly to OpenAI (see `extractSkillsFromCVBuffer` in `src/lib/openai.ts`). No pdf-parse needed — same pattern applies here.

Model: `gpt-4o-mini` (cheap, fast).

Prompt:
```
Du bekommst den Textinhalt eines Zeitnachweises (Stundennachweis). 
Extrahiere die Gesamtanzahl der geleisteten Stunden als Dezimalzahl.
Antworte nur mit der Zahl, ohne Einheit oder Erklärung. Beispiel: 160.5
```

If `pdf-parse` fails (corrupt/scanned PDF), `stunden_ist` is saved as null.
If OpenAI returns a non-numeric response or the request fails: save `stunden_ist: null`, save raw response in `parsed_raw`. UI shows "Stunden konnten nicht extrahiert werden" with the option to re-upload.

## Abrechnung UI Changes

### All roles (when Zeitnachweis exists for selected month)

- Hours column shows `stunden_ist` instead of `stunden_woche × 4`
- Small icon (e.g. checkmark badge) indicates Zeitnachweis is present
- Monthly margin calc: `(verkaufspreis - einkaufspreis) × stunden_ist`

### Manager & Agentur

- Upload button per Beauftragung row
- If Zeitnachweis exists: shows upload date + `stunden_ist`, button allows re-upload

### Controller only

- `margenaufschlag` cell is inline-editable (input field, saves on blur via `PATCH /api/beauftragungen/[id]`)
- Monthly total column: `margenaufschlag × stunden_ist` (falls back to `margenaufschlag × stunden_woche × 4` if no Zeitnachweis)
- Footer row: sum of all monthly totals

## API Routes

### `POST /api/zeitnachweise`

- Auth: Manager or Agentur only
- Body: multipart/form-data (`file`, `beauftragung_id`, `monat`)
- Validates: PDF only, max 10 MB, monat is valid date
- Returns: `{ id, stunden_ist, monat }`

### `GET /api/zeitnachweise?beauftragung_id=&monat=`

- Auth: all roles
- Returns: zeitnachweis record for that beauftragung+monat (or null)

### `GET /api/zeitnachweise/[id]/download`

- Auth: all roles
- Returns: signed URL (3600s TTL) for the PDF

### `DELETE /api/zeitnachweise/[id]`

- Auth: Manager only
- Removes storage file + DB row

### `PATCH /api/beauftragungen/[id]`

- Auth: Controller only (for `margenaufschlag`)
- Body: `{ margenaufschlag: number }`

## Error Handling

- PDF > 10 MB → 400, shown inline in UI
- OpenAI parse failure → `stunden_ist: null`, UI shows parse error message
- Re-upload → upsert, no error
- Controller edits `margenaufschlag` → optimistic UI update, revert on error

## Testing

- TypeScript check: `npx tsc --noEmit`
- No unit tests required — UI and API integration, no complex business logic to unit-test
