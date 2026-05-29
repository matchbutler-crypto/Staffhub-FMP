# Agentur-Dashboard Pipeline-Erweiterung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 7-status config in `dashboard/page.tsx` with the shared `link-status-config` module so all 13 pipeline statuses render correctly in the Agentur and Manager dashboards.

**Architecture:** Single-file change. The local `LINK_STATUSES`, `linkStatusConfig`, and `getLinkStatusConfig` are removed and replaced with imports from `@/lib/link-status-config`. A local `LINK_STATUS_ICONS` map is added for the icon-per-status display in `LinkStatusBadge` (icons are UI-specific and intentionally not in the shared config). All `LINK_STATUSES` references are replaced with `LINK_STATUS_ORDER`.

**Tech Stack:** Next.js App Router (client component), lucide-react, `@/lib/link-status-config`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/dashboard/page.tsx` | Modify | Replace local status config with shared import + local icons map |

---

## Task 1: Replace local status config with shared import

**Files:**
- Modify: `src/app/dashboard/page.tsx`

### Context

**Current state (lines 12–20)** — lucide-react imports (7 icons, all for the old status config):
```ts
import {
  Send,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Ban,
  Undo2,
  Briefcase,
} from "lucide-react"
```

**Current state (lines 92–107)** — local status config block to be removed:
```ts
const LINK_STATUSES = ["Gespielt", "Interview geplant", "Zugesagt", "Beauftragt", "Abgesagt", "Abgelehnt", "Zurückgezogen"] as const
type LinkStatus = typeof LINK_STATUSES[number]

const linkStatusConfig: Record<LinkStatus, { color: string; dot: string; icon: React.ReactNode; label: string }> = {
  "Gespielt":          { color: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-400",    icon: <Send className="h-3 w-3" />,          label: "Gespielt" },
  "Interview geplant": { color: "bg-violet-50 text-violet-700 border-violet-200",  dot: "bg-violet-400",  icon: <CalendarClock className="h-3 w-3" />,  label: "Interview" },
  "Zugesagt":          { color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", icon: <CheckCircle2 className="h-3 w-3" />, label: "Zugesagt" },
  "Beauftragt":        { color: "bg-teal-50 text-teal-700 border-teal-200",          dot: "bg-teal-400",    icon: <Briefcase className="h-3 w-3" />,     label: "Beauftragt" },
  "Abgesagt":          { color: "bg-orange-50 text-orange-700 border-orange-200",  dot: "bg-orange-400",  icon: <XCircle className="h-3 w-3" />,        label: "Abgesagt" },
  "Abgelehnt":         { color: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-400",     icon: <Ban className="h-3 w-3" />,            label: "Abgelehnt" },
  "Zurückgezogen":     { color: "bg-gray-100 text-gray-500 border-gray-200",        dot: "bg-gray-400",    icon: <Undo2 className="h-3 w-3" />,          label: "Zurückgezogen" },
}

function getLinkStatusConfig(status: string) {
  return linkStatusConfig[status as LinkStatus] ?? { color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-300", icon: null, label: status }
}
```

**Current state (lines 122–130)** — `LinkStatusBadge` uses `cfg.icon` from local config:
```tsx
function LinkStatusBadge({ status }: { status: string }) {
  const cfg = getLinkStatusConfig(status)
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {status}
    </span>
  )
}
```

**`LINK_STATUSES` is referenced in 4 places:**
- `ManagerDashboard` line 143: `const activeLinkStatuses = LINK_STATUSES.filter(...)`
- `ManagerDashboard` line 196: `{LINK_STATUSES.filter(s => pool_stats.by_link_status[s]).map(...)}`
- `AgenturDashboard` line 420: `const activeLinkStatuses = LINK_STATUSES.filter(...)`
- `AgenturDashboard` line 444: `{LINK_STATUSES.filter(s => pool_stats.by_link_status[s]).map(...)}`

---

- [ ] **Step 1: Update the lucide-react import block**

Replace the existing lucide-react import with the full set (add 6 new icons for new pipeline statuses):

```ts
import {
  Ban,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Play,
  Send,
  Settings,
  ShoppingCart,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react"
```

- [ ] **Step 2: Add the shared config import**

After the existing `import { UnauthorizedToast }` line (around line 24), add:

```ts
import { LINK_STATUS_ORDER, getLinkStatusConfig } from "@/lib/link-status-config"
```

- [ ] **Step 3: Remove the local status config block**

Delete the following block entirely (lines 89–107, including the comment):

```ts
// ── Helpers ────────────────────────────────────────────────────────────────────

// Link-Status config (mirrors GespielteRessourcenTable)
const LINK_STATUSES = ["Gespielt", "Interview geplant", "Zugesagt", "Beauftragt", "Abgesagt", "Abgelehnt", "Zurückgezogen"] as const
type LinkStatus = typeof LINK_STATUSES[number]

const linkStatusConfig: Record<LinkStatus, { color: string; dot: string; icon: React.ReactNode; label: string }> = {
  "Gespielt":          { color: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-400",    icon: <Send className="h-3 w-3" />,          label: "Gespielt" },
  "Interview geplant": { color: "bg-violet-50 text-violet-700 border-violet-200",  dot: "bg-violet-400",  icon: <CalendarClock className="h-3 w-3" />,  label: "Interview" },
  "Zugesagt":          { color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", icon: <CheckCircle2 className="h-3 w-3" />, label: "Zugesagt" },
  "Beauftragt":        { color: "bg-teal-50 text-teal-700 border-teal-200",          dot: "bg-teal-400",    icon: <Briefcase className="h-3 w-3" />,     label: "Beauftragt" },
  "Abgesagt":          { color: "bg-orange-50 text-orange-700 border-orange-200",  dot: "bg-orange-400",  icon: <XCircle className="h-3 w-3" />,        label: "Abgesagt" },
  "Abgelehnt":         { color: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-400",     icon: <Ban className="h-3 w-3" />,            label: "Abgelehnt" },
  "Zurückgezogen":     { color: "bg-gray-100 text-gray-500 border-gray-200",        dot: "bg-gray-400",    icon: <Undo2 className="h-3 w-3" />,          label: "Zurückgezogen" },
}

function getLinkStatusConfig(status: string) {
  return linkStatusConfig[status as LinkStatus] ?? { color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-300", icon: null, label: status }
}
```

- [ ] **Step 4: Add `LINK_STATUS_ICONS` map and update `LinkStatusBadge`**

Replace the `LinkStatusBadge` component and add the icons map directly above it. The section currently reads (after removing the local config block):

```tsx
function fmt(n: number) { ... }

function KpiSkeleton() { ... }

function LinkStatusBadge({ status }: { status: string }) {
  const cfg = getLinkStatusConfig(status)
  return (
    <span ...>
      {cfg.icon}
      {status}
    </span>
  )
}
```

Replace `LinkStatusBadge` (and insert the icons map before it):

```tsx
// Icons are UI-specific — not part of the shared link-status-config
const LINK_STATUS_ICONS: Record<string, React.ReactNode> = {
  "Gespielt":                      <Send className="h-3 w-3" />,
  "Interview geplant":             <CalendarClock className="h-3 w-3" />,
  "Zugesagt":                      <CheckCircle2 className="h-3 w-3" />,
  "Stammdaten anfordern":          <FileText className="h-3 w-3" />,
  "Freelancer Prozess gestartet":  <UserCheck className="h-3 w-3" />,
  "Einkauf gestartet":             <ShoppingCart className="h-3 w-3" />,
  "Genehmigung gestartet":         <ClipboardCheck className="h-3 w-3" />,
  "Beauftragt":                    <Briefcase className="h-3 w-3" />,
  "Setup externe Mail & Hardware": <Settings className="h-3 w-3" />,
  "Running":                       <Play className="h-3 w-3" />,
  "Abgesagt":                      <XCircle className="h-3 w-3" />,
  "Abgelehnt":                     <Ban className="h-3 w-3" />,
  "Zurückgezogen":                 <Undo2 className="h-3 w-3" />,
}

function LinkStatusBadge({ status }: { status: string }) {
  const cfg = getLinkStatusConfig(status)
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {LINK_STATUS_ICONS[status] ?? null}
      {cfg.label || status}
    </span>
  )
}
```

- [ ] **Step 5: Replace all 4 `LINK_STATUSES` references with `LINK_STATUS_ORDER`**

There are exactly 4 occurrences. Find and replace each one:

**Occurrence 1** — in `ManagerDashboard` (activeLinkStatuses):
```ts
// Before:
const activeLinkStatuses = LINK_STATUSES.filter(s => ressourcen_pipeline.some(r => r.status === s))
// After:
const activeLinkStatuses = LINK_STATUS_ORDER.filter(s => ressourcen_pipeline.some(r => r.status === s))
```

**Occurrence 2** — in `ManagerDashboard` Pool Ressourcen tile:
```tsx
// Before:
{LINK_STATUSES.filter(s => pool_stats.by_link_status[s]).map((s) => {
// After:
{LINK_STATUS_ORDER.filter(s => pool_stats.by_link_status[s]).map((s) => {
```

**Occurrence 3** — in `AgenturDashboard` (activeLinkStatuses):
```ts
// Before:
const activeLinkStatuses = LINK_STATUSES.filter(s => ressourcen_pipeline.some(r => r.status === s))
// After:
const activeLinkStatuses = LINK_STATUS_ORDER.filter(s => ressourcen_pipeline.some(r => r.status === s))
```

**Occurrence 4** — in `AgenturDashboard` Mein Pool tile:
```tsx
// Before:
{LINK_STATUSES.filter(s => pool_stats.by_link_status[s]).map((s) => {
// After:
{LINK_STATUS_ORDER.filter(s => pool_stats.by_link_status[s]).map((s) => {
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx tsc --noEmit
```

Expected: No errors. If TypeScript complains about `getLinkStatusConfig` not found — verify step 2 (import) was applied. If it complains about `LINK_STATUS_ORDER` — same check.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: 236 passed, 10 failed (same pre-existing failures in spielen, ressource-feedback, feedback, vakanzen — unrelated to this change). No new failures.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: use shared link-status-config in dashboard, add 6 new pipeline statuses"
```
