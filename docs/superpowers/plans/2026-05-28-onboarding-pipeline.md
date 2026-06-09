# Onboarding-Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `ressource_vakanz_links.status` pipeline with 6 new onboarding steps (Stammdaten anfordern → Freelancer Prozess gestartet → Einkauf gestartet → Genehmigung gestartet → Setup externe Mail & Hardware → Running), update backend validation, and display new statuses with correct colours across the UI.

**Architecture:** Single-table approach — all statuses live on `ressource_vakanz_links.status`. A new shared module `src/lib/link-status-config.ts` centralises colour/label config so both the Vakanz-table component and the Ressourcen-detail page stay in sync. No new API endpoints needed; the existing PATCH route already enforces forward-only transitions.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase (Postgres check constraint), Vitest, lucide-react icons.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/010_onboarding_pipeline_statuses.sql` | Create | DB: extend `status` check constraint |
| `src/lib/link-status-config.ts` | Create | Shared colour/dot/label config for all link statuses |
| `src/app/api/ressource-links/[id]/status/route.ts` | Modify | Extend `LINK_STATUS` + `STATUS_ORDER` |
| `src/app/api/ressource-links/[id]/status/route.test.ts` | Modify | Tests for new status transitions |
| `src/components/GespielteRessourcenTable.tsx` | Modify | New statuses, icons, updated dropdown/retract logic |
| `src/app/ressourcen/[id]/page.tsx` | Modify | Replace `BEAUFTRAGUNG_STATUS` with shared config |

---

## Task 1: DB Migration — extend status check constraint

**Files:**
- Create: `migrations/010_onboarding_pipeline_statuses.sql`

> Apply this SQL via the Supabase MCP tool (`mcp__supabase__execute_sql`) or paste into the Supabase SQL editor.

- [ ] **Step 1: Create migration file**

```sql
-- migrations/010_onboarding_pipeline_statuses.sql
-- Extends ressource_vakanz_links.status to allow new onboarding pipeline values.

ALTER TABLE ressource_vakanz_links
  DROP CONSTRAINT IF EXISTS ressource_vakanz_links_status_check;

ALTER TABLE ressource_vakanz_links
  ADD CONSTRAINT ressource_vakanz_links_status_check
  CHECK (status IN (
    'Gespielt',
    'Interview geplant',
    'Zugesagt',
    'Stammdaten anfordern',
    'Freelancer Prozess gestartet',
    'Einkauf gestartet',
    'Genehmigung gestartet',
    'Beauftragt',
    'Setup externe Mail & Hardware',
    'Running',
    'Abgesagt',
    'Abgelehnt',
    'Zurückgezogen'
  ));
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__supabase__execute_sql` tool with the SQL above. Confirm it returns no error.

- [ ] **Step 3: Verify constraint exists**

Run:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ressource_vakanz_links'::regclass
  AND contype = 'c';
```
Expected: one row with `ressource_vakanz_links_status_check` containing all 13 status values.

- [ ] **Step 4: Commit migration file**

```bash
git add migrations/010_onboarding_pipeline_statuses.sql
git commit -m "feat: extend ressource_vakanz_links status constraint for onboarding pipeline"
```

---

## Task 2: Shared link-status-config module

**Files:**
- Create: `src/lib/link-status-config.ts`

> This module is imported by both `GespielteRessourcenTable.tsx` and `ressourcen/[id]/page.tsx`. It provides colour classes and labels only — icons are defined in the component that renders them.

- [ ] **Step 1: Write the failing test**

Create `src/lib/link-status-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getLinkStatusConfig, LINK_STATUS_ORDER, LINK_STATUS_FALLBACK } from './link-status-config'

describe('getLinkStatusConfig', () => {
  it('returns config for every status in LINK_STATUS_ORDER', () => {
    for (const s of LINK_STATUS_ORDER) {
      const cfg = getLinkStatusConfig(s)
      expect(cfg.color).toBeTruthy()
      expect(cfg.dot).toBeTruthy()
      expect(cfg.label).toBeTruthy()
    }
  })

  it('returns fallback for unknown status', () => {
    const cfg = getLinkStatusConfig('Unbekannt')
    expect(cfg).toEqual(LINK_STATUS_FALLBACK)
  })

  it('returns fallback for null', () => {
    expect(getLinkStatusConfig(null)).toEqual(LINK_STATUS_FALLBACK)
  })

  it('LINK_STATUS_ORDER contains all 13 statuses', () => {
    expect(LINK_STATUS_ORDER).toHaveLength(13)
  })

  it('Stammdaten anfordern has amber colour', () => {
    expect(getLinkStatusConfig('Stammdaten anfordern').color).toContain('amber')
  })

  it('Running has green colour', () => {
    expect(getLinkStatusConfig('Running').color).toContain('green')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/link-status-config.test.ts
```
Expected: FAIL — `Cannot find module './link-status-config'`

- [ ] **Step 3: Create the module**

```ts
// src/lib/link-status-config.ts

export const LINK_STATUS_ORDER = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
  'Zurückgezogen',
] as const

export type LinkStatusValue = (typeof LINK_STATUS_ORDER)[number]

export interface LinkStatusStyle {
  color: string
  dot: string
  label: string
}

export const LINK_STATUS_CONFIG: Record<string, LinkStatusStyle> = {
  'Gespielt':                      { color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-400',    label: 'Gespielt' },
  'Interview geplant':             { color: 'bg-violet-50 text-violet-700 border-violet-200',  dot: 'bg-violet-400',  label: 'Interview geplant' },
  'Zugesagt':                      { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Zugesagt' },
  'Stammdaten anfordern':          { color: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400',   label: 'Stammdaten anfordern' },
  'Freelancer Prozess gestartet':  { color: 'bg-sky-50 text-sky-700 border-sky-200',           dot: 'bg-sky-400',     label: 'Freelancer Prozess gestartet' },
  'Einkauf gestartet':             { color: 'bg-indigo-50 text-indigo-700 border-indigo-200',  dot: 'bg-indigo-400',  label: 'Einkauf gestartet' },
  'Genehmigung gestartet':         { color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-400',    label: 'Genehmigung gestartet' },
  'Beauftragt':                    { color: 'bg-teal-50 text-teal-700 border-teal-200',        dot: 'bg-teal-400',    label: 'Beauftragt' },
  'Setup externe Mail & Hardware': { color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400',  label: 'Setup ext. Mail & HW' },
  'Running':                       { color: 'bg-green-50 text-green-700 border-green-200',     dot: 'bg-green-400',   label: 'Running' },
  'Abgesagt':                      { color: 'bg-orange-50 text-orange-700 border-orange-200',  dot: 'bg-orange-400',  label: 'Abgesagt' },
  'Abgelehnt':                     { color: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-400',     label: 'Abgelehnt' },
  'Zurückgezogen':                 { color: 'bg-gray-100 text-gray-500 border-gray-200',       dot: 'bg-gray-400',    label: 'Zurückgezogen' },
}

export const LINK_STATUS_FALLBACK: LinkStatusStyle = {
  color: 'bg-gray-100 text-gray-600 border-gray-200',
  dot: 'bg-gray-300',
  label: '',
}

export function getLinkStatusConfig(status: string | null | undefined): LinkStatusStyle {
  return LINK_STATUS_CONFIG[status ?? ''] ?? LINK_STATUS_FALLBACK
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/link-status-config.test.ts
```
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/link-status-config.ts src/lib/link-status-config.test.ts
git commit -m "feat: add shared link-status-config module"
```

---

## Task 3: Backend API — extend status enum + add tests

**Files:**
- Modify: `src/app/api/ressource-links/[id]/status/route.ts` (lines 5–14)
- Modify: `src/app/api/ressource-links/[id]/status/route.test.ts`

- [ ] **Step 1: Write failing tests for new status transitions**

Add these 3 test cases at the bottom of the `describe` block in `route.test.ts` (before the closing `})`):

```ts
  it('schaltet Zugesagt → Stammdaten anfordern erfolgreich', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Zugesagt', vakanzen: null },
      error: null,
    })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Stammdaten anfordern', interview_datum: null, feedback: null, updated_at: '2026-05-28T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ status: 'Stammdaten anfordern' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Stammdaten anfordern')
  })

  it('gibt 400 zurück bei Rückschritt Stammdaten anfordern → Zugesagt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Stammdaten anfordern', vakanzen: null },
      error: null,
    })

    const res = await PATCH(
      makeRequest({ status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Ungültiger Status-Übergang')
  })

  it('schaltet Setup externe Mail & Hardware → Running erfolgreich', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockLinkSelect.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Setup externe Mail & Hardware', vakanzen: null },
      error: null,
    })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', ressource_id: 'res-1', vakanz_id: 'vak-1', status: 'Running', interview_datum: null, feedback: null, updated_at: '2026-05-28T00:00:00Z' },
      error: null,
    })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(
      makeRequest({ status: 'Running' }),
      { params: Promise.resolve({ id: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Running')
  })
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
npx vitest run src/app/api/ressource-links/\[id\]/status/route.test.ts
```
Expected: existing tests pass, new 3 FAIL with `Received: 400` (because new statuses not yet in LINK_STATUS enum).

- [ ] **Step 3: Update LINK_STATUS and STATUS_ORDER in route.ts**

In `src/app/api/ressource-links/[id]/status/route.ts`, replace lines 5–14:

```ts
const LINK_STATUS = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
] as const
type LinkStatus = typeof LINK_STATUS[number]

// 'Zurückgezogen' ist ein terminaler Status (nur via /rueckzug Endpunkt erreichbar)
const TERMINAL_STATUSES = ['Zurückgezogen']

// Ordered forward-progression statuses — transitions must move forward in this list
const STATUS_ORDER: LinkStatus[] = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
]
const REJECTION_STATUSES: LinkStatus[] = ['Abgesagt', 'Abgelehnt']
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run src/app/api/ressource-links/\[id\]/status/route.test.ts
```
Expected: all tests PASS (existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ressource-links/\[id\]/status/route.ts src/app/api/ressource-links/\[id\]/status/route.test.ts
git commit -m "feat: extend onboarding pipeline statuses in status API"
```

---

## Task 4: GespielteRessourcenTable — new statuses, icons, dropdown logic

**Files:**
- Modify: `src/components/GespielteRessourcenTable.tsx`

> This component renders the list of resources for a Vakanz on the Vakanz detail page. It controls status badges, the status-change dropdown, and the Zurückziehen button. No automated tests exist for this component — manual verification after changes.

- [ ] **Step 1: Add new lucide-react icons to import**

Current import line (line 22):
```ts
import { Trash2, Loader2, Info, Download, MessageSquare, Send, CalendarClock, CheckCircle2, XCircle, Ban, Undo2, ChevronDown, Briefcase } from 'lucide-react'
```

Replace with:
```ts
import { Trash2, Loader2, Info, Download, MessageSquare, Send, CalendarClock, CheckCircle2, XCircle, Ban, Undo2, ChevronDown, Briefcase, FileText, UserCheck, ShoppingCart, ClipboardCheck, Settings, Play } from 'lucide-react'
```

- [ ] **Step 2: Import shared config and replace LINK_STATUSES + STATUS_CONFIG**

Add import at top of file (after existing imports):
```ts
import { LINK_STATUS_ORDER, getLinkStatusConfig } from '@/lib/link-status-config'
```

Replace lines 25–41 (the `LINK_STATUSES` and `STATUS_CONFIG` constants and `getStatusConfig` function) with:

```ts
const LINK_STATUSES = LINK_STATUS_ORDER

// Icons are only needed in this component — extend the shared style with an icon field
const STATUS_ICONS: Record<string, React.ReactNode> = {
  'Gespielt':                      <Send className="h-3 w-3" />,
  'Interview geplant':             <CalendarClock className="h-3 w-3" />,
  'Zugesagt':                      <CheckCircle2 className="h-3 w-3" />,
  'Stammdaten anfordern':          <FileText className="h-3 w-3" />,
  'Freelancer Prozess gestartet':  <UserCheck className="h-3 w-3" />,
  'Einkauf gestartet':             <ShoppingCart className="h-3 w-3" />,
  'Genehmigung gestartet':         <ClipboardCheck className="h-3 w-3" />,
  'Beauftragt':                    <Briefcase className="h-3 w-3" />,
  'Setup externe Mail & Hardware': <Settings className="h-3 w-3" />,
  'Running':                       <Play className="h-3 w-3" />,
  'Abgesagt':                      <XCircle className="h-3 w-3" />,
  'Abgelehnt':                     <Ban className="h-3 w-3" />,
  'Zurückgezogen':                 <Undo2 className="h-3 w-3" />,
}

function getStatusConfig(status: string | null | undefined) {
  const cfg = getLinkStatusConfig(status)
  return { ...cfg, icon: STATUS_ICONS[status ?? ''] ?? null }
}

const FALLBACK_STATUS = { color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-300', icon: null }
```

- [ ] **Step 3: Update isRetractable — exclude all post-commitment statuses**

Replace line 245–246:
```ts
const isRetractable = (status: string | null | undefined) =>
  status !== 'Zurückgezogen' && status !== 'Zugesagt' && status !== 'Beauftragt'
```

With:
```ts
const NON_RETRACTABLE_STATUSES = new Set([
  'Zurückgezogen',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
])
const isRetractable = (status: string | null | undefined) =>
  !NON_RETRACTABLE_STATUSES.has(status ?? '')
```

- [ ] **Step 4: Update dropdown display condition — allow Beauftragt, exclude Running**

On line 317, the condition controls whether managers see a dropdown or a static badge:
```tsx
{isManager && currentStatus !== 'Zurückgezogen' && currentStatus !== 'Beauftragt' ? (
```

Replace with:
```tsx
{isManager && currentStatus !== 'Zurückgezogen' && currentStatus !== 'Running' ? (
```

> Reason: `Beauftragt` can now advance to `Setup externe Mail & Hardware`, so it needs the dropdown. `Running` is the terminal forward state — no further advancement possible.

- [ ] **Step 5: Verify in browser**

Start the dev server (`npm run dev`) and navigate to a Vakanz detail page where a resource has status `Gespielt`. Confirm:
1. The status dropdown shows all new statuses in order
2. Setting status to `Stammdaten anfordern` works and shows amber badge
3. A resource with status `Beauftragt` now shows a dropdown (not a static badge)
4. A resource with status `Running` shows a static green badge (no dropdown)
5. The Zurückziehen button is hidden for statuses at/after `Zugesagt`

- [ ] **Step 6: Commit**

```bash
git add src/components/GespielteRessourcenTable.tsx
git commit -m "feat: extend GespielteRessourcenTable with onboarding pipeline statuses"
```

---

## Task 5: Ressourcen detail page — use shared config for Beauftragungen status badges

**Files:**
- Modify: `src/app/ressourcen/[id]/page.tsx`

> The Beauftragungen tab shows a `status` badge for each Beauftragung. Currently it uses a local `BEAUFTRAGUNG_STATUS` map. We replace it with the shared `getLinkStatusConfig` so new pipeline statuses get correct colours automatically.

- [ ] **Step 1: Add import for shared config**

Find the existing imports at the top of `src/app/ressourcen/[id]/page.tsx`. Add:
```ts
import { getLinkStatusConfig } from '@/lib/link-status-config'
```

- [ ] **Step 2: Remove BEAUFTRAGUNG_STATUS constant**

Find and delete lines 136–142 (the `BEAUFTRAGUNG_STATUS` constant):
```ts
const BEAUFTRAGUNG_STATUS: Record<string, string> = {
  Aktiv: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  Beauftragt: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  Abgeschlossen: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  Abgebrochen: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  Geplant: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
}
```

- [ ] **Step 3: Update Badge className to use shared config**

Find line 562 (the Badge in the Beauftragungen tab):
```tsx
className={`text-xs ${BEAUFTRAGUNG_STATUS[b.status] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}
```

Replace with:
```tsx
className={`text-xs ${getLinkStatusConfig(b.status).color}`}
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Verify in browser**

Navigate to a resource detail page that has Beauftragungen. Confirm:
1. Existing statuses (Beauftragt, Abgeschlossen etc.) still show with colours
2. If any Beauftragung has a new pipeline status, it shows the correct colour

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: all previously passing tests still pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/app/ressourcen/\[id\]/page.tsx
git commit -m "feat: use shared link-status-config for Beauftragungen status badges"
```

---

## Final: push to remote

```bash
git push origin master
```
