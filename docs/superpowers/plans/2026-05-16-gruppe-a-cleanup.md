# Gruppe A Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dark/light mode toggle in sidebar, remove two KPI cards from dashboard and move them to Beauftragungen, fix Vakanzen-ohne-Profile query, remove Agenturen from manager sidebar/RBAC, and remove the Kandidatenprofile tab from Ressourcen.

**Architecture:** Six independent tasks: (1) ModeToggle component, (2) Dashboard KPI removal, (3) Beauftragungen KPI cards + API extension, (4) Vakanzen-ohne-Profile query fix, (5) Manager RBAC cleanup, (6) Ressourcen tab removal. Each task commits independently.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, next-themes, Vitest, Supabase

---

## Files

- Create: `src/components/mode-toggle.tsx`
- Modify: `src/components/app-sidebar.tsx` — add ModeToggle, remove Agenturen for Manager role
- Modify: `src/app/dashboard/page.tsx` — remove Row 2 (Kandidaten-Pipeline + Agentur-Performance)
- Modify: `src/app/api/beauftragungen/route.ts` — add pipeline + agentur_performance to GET response
- Modify: `src/app/beauftragungen/page.tsx` — render KPI cards from API response
- Modify: `src/app/api/dashboard/route.ts` — fix Vakanzen-ohne-Profile to include ressource_vakanz_links
- Modify: `src/lib/rbac.ts` — remove /agenturen from Staffhub Manager
- Modify: `src/lib/rbac.test.ts` — update /agenturen test for Manager to expect false
- Modify: `src/app/ressourcen/page.tsx` — remove Kandidatenprofile tab + all related state/logic

---

## Task 1: ModeToggle — Dark/Light Mode Switcher

**Files:**
- Create: `src/components/mode-toggle.tsx`
- Modify: `src/components/app-sidebar.tsx`

`next-themes` is already installed and configured in `src/app/layout.tsx` with `attribute="class"` and `defaultTheme="system"`. Only the toggle button is missing.

- [ ] **Step 1.1: Create `src/components/mode-toggle.tsx`**

```tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
      aria-label="Design wechseln"
    >
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </button>
  )
}
```

- [ ] **Step 1.2: Add ModeToggle to app-sidebar.tsx**

In `src/components/app-sidebar.tsx`, add the import after the existing imports:

```tsx
import { ModeToggle } from '@/components/mode-toggle'
```

Then replace the `<SidebarFooter>` block (currently just wraps `<NavUser>`):

```tsx
<SidebarFooter>
  <div className="flex items-center justify-end px-2 py-1 group-data-[collapsible=icon]:justify-center">
    <ModeToggle />
  </div>
  <NavUser
    user={{
      name: user?.name ?? '…',
      email: user?.email ?? '',
      avatar: '',
      rolle: user?.rolle ?? '',
      initials,
    }}
  />
</SidebarFooter>
```

- [ ] **Step 1.3: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/mode-toggle.tsx src/components/app-sidebar.tsx
git commit -m "feat: add dark/light mode toggle to sidebar footer"
```

---

## Task 2: Dashboard — Remove Kandidaten-Pipeline + Agentur-Performance Cards

**Files:**
- Modify: `src/app/dashboard/page.tsx`

The `ManagerDashboard` component (used for both Admin and Staffhub Manager) has a Row 2 containing "Kandidaten-Pipeline" and "Agentur-Performance" cards. These move to the Beauftragungen page (Task 3). Row 3 becomes the new Row 2.

- [ ] **Step 2.1: Remove Row 2 block from ManagerDashboard**

In `src/app/dashboard/page.tsx`, inside `function ManagerDashboard`, remove the entire Row 2 block — from the comment through the closing `</div>`:

```tsx
      {/* ── Row 2: Pipeline + Agentur-Performance ── */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kandidaten-Pipeline</CardTitle>
            <CardDescription>Profile nach Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE_ORDER.map((status) => {
              const count = pipeline[status] ?? 0
              const pct = Math.round((count / pipelineMax) * 100)
              const isAlert = status === "In Prüfung" && count > 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`w-28 shrink-0 text-xs ${isAlert ? "font-semibold text-yellow-700" : "text-muted-foreground"}`}>
                    {isAlert && "⚠ "}{status}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div className={`h-full rounded-sm transition-all ${pipelineBarColors[status] ?? "bg-gray-400"}`} style={{ width: count === 0 ? "0%" : `${Math.max(pct, 3)}%` }} />
                    </div>
                    <span className={`w-6 text-right text-xs tabular-nums font-medium ${isAlert ? "text-yellow-700" : "text-foreground"}`}>{count}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Agentur-Performance</CardTitle>
              <CardDescription>Ø KI-Score · Einreichungen gesamt</CardDescription>
            </div>
            <Link href="/agenturen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Alle →</Link>
          </CardHeader>
          <CardContent>
            {agentur_performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
            ) : (
              <div className="space-y-2">
                {agentur_performance.map((a) => (
                  <div key={a.name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <IconBuilding className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">{a.count} Profile</span>
                      <ScoreBadge score={a.avg_score} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
```

- [ ] **Step 2.2: Remove now-unused code from dashboard.tsx**

Remove the following top-level declarations that are now dead code (they were only used by the removed Row 2):

1. `interface AgenturPerf { ... }` (lines ~47-51)
2. `type ProfilStatus = ...` (line ~45)
3. `const PIPELINE_ORDER: ProfilStatus[] = [...]` (line ~101)
4. `const statusColors: Record<ProfilStatus, string> = {...}` (lines ~103-112)
5. `const pipelineBarColors: Record<string, string> = {...}` (lines ~113-120)
6. `function ScoreBadge({ score }: { score: number | null }) { ... }` (lines ~143-147)

Also remove from `ManagerDashboard` function:
- `pipeline` and `agentur_performance` from the destructuring on line ~171:

  Replace:
  ```tsx
  const { kpis, neueste_vakanzen, pool_stats, bald_verfuegbar, pipeline, agentur_performance, vakanzen_ohne_profile, bald_auslaufend, ressourcen_pipeline } = data
  ```
  With:
  ```tsx
  const { kpis, neueste_vakanzen, pool_stats, bald_verfuegbar, vakanzen_ohne_profile, bald_auslaufend, ressourcen_pipeline } = data
  ```

- `pipelineMax` const (was `const pipelineMax = Math.max(...)`)

Also remove from `ManagerData` interface:
```tsx
  pipeline: Record<string, number>
  agentur_performance: AgenturPerf[]
```

Also remove `IconBuilding` from the tabler import if it's no longer used anywhere else in the file (check: was it only in the Agentur-Performance card? If so, remove it from `import { ..., IconBuilding, ... } from "@tabler/icons-react"`).

- [ ] **Step 2.3: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: remove Kandidaten-Pipeline + Agentur-Performance tiles from dashboard"
```

---

## Task 3: Beauftragungen — KPI Cards (API Extension + Page)

**Files:**
- Modify: `src/app/api/beauftragungen/route.ts`
- Modify: `src/app/beauftragungen/page.tsx`

The `GET /api/beauftragungen` response is extended for manager users to include `pipeline` and `agentur_performance`. The page renders these as two cards above the existing table.

### 3A: API Extension

- [ ] **Step 3.1: Add pipeline + agentur_performance to GET /api/beauftragungen**

In `src/app/api/beauftragungen/route.ts`, find the section just before the final `return NextResponse.json({ data: result, total: count ?? 0, page, pageSize })` on line ~131. Replace it with:

```typescript
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

    return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, pipeline, agentur_performance })
  }

  return NextResponse.json({ data: result, total: count ?? 0, page, pageSize })
```

### 3B: Page Update

- [ ] **Step 3.2: Add imports to beauftragungen/page.tsx**

In `src/app/beauftragungen/page.tsx`, add to the existing imports:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IconBuilding } from "@tabler/icons-react"
```

- [ ] **Step 3.3: Add types + helpers + state to BeauftragungPage**

After the existing `TableSkeletonRows` helper (around line 107, before `// ── Page ───`), add:

```tsx
// ── KPI Helpers (Manager only) ─────────────────────────────────────────────────

interface AgenturPerf {
  name: string
  count: number
  avg_score: number | null
}

const PIPELINE_ORDER = ["Eingereicht", "In Prüfung", "Präsentiert", "Interview", "Beauftragt", "Abgelehnt"] as const

const pipelineBarColors: Record<string, string> = {
  Eingereicht: "bg-blue-400",
  "In Prüfung": "bg-yellow-400",
  Präsentiert: "bg-purple-400",
  Interview: "bg-orange-400",
  Beauftragt: "bg-green-500",
  Abgelehnt: "bg-red-400",
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>
  const color = score >= 70
    ? "bg-green-100 text-green-700 border-green-200"
    : score >= 40
    ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}
```

Inside `BeauftragungPage`, add state variables alongside the existing ones (around line 130, after `const [beending, setBeending] = React.useState(false)`):

```tsx
  const [pipeline, setPipeline] = React.useState<Record<string, number>>({})
  const [agenturPerf, setAgenturPerf] = React.useState<AgenturPerf[]>([])
```

- [ ] **Step 3.4: Extract pipeline + agenturPerf from fetch response**

In `BeauftragungPage`, find the existing `useEffect` fetch block (around line 136):

```tsx
  React.useEffect(() => {
    fetch("/api/beauftragungen")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((body) => {
        const data: Beauftragung[] = Array.isArray(body) ? body : (body.data ?? [])
        setItems(data)
        // Expand all agencies by default
        const ids = [...new Set(data.map((b) => b.agentur_id))]
        setExpanded(Object.fromEntries(ids.map((id) => [id, true])))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
```

Replace with:

```tsx
  React.useEffect(() => {
    fetch("/api/beauftragungen")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((body) => {
        const data: Beauftragung[] = Array.isArray(body) ? body : (body.data ?? [])
        setItems(data)
        const ids = [...new Set(data.map((b) => b.agentur_id))]
        setExpanded(Object.fromEntries(ids.map((id) => [id, true])))
        if (body.pipeline) setPipeline(body.pipeline)
        if (body.agentur_performance) setAgenturPerf(body.agentur_performance)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
```

- [ ] **Step 3.5: Render KPI cards in BeauftragungPage return**

In the return JSX of `BeauftragungPage`, after the `{/* Header */}` div (line ~256) and before `{/* Error */}`, add:

```tsx
            {/* KPI Cards — Manager/Admin only */}
            {isManager && (
              <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">
                {/* Kandidaten-Pipeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Kandidaten-Pipeline</CardTitle>
                    <CardDescription>Profile nach Status</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {PIPELINE_ORDER.map((status) => {
                      const count = pipeline[status] ?? 0
                      const pipelineMax = Math.max(...PIPELINE_ORDER.map(s => pipeline[s] ?? 0), 1)
                      const pct = Math.round((count / pipelineMax) * 100)
                      const isAlert = status === "In Prüfung" && count > 0
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className={`w-28 shrink-0 text-xs ${isAlert ? "font-semibold text-yellow-700" : "text-muted-foreground"}`}>
                            {isAlert && "⚠ "}{status}
                          </span>
                          <div className="flex flex-1 items-center gap-2">
                            <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted">
                              <div
                                className={`h-full rounded-sm transition-all ${pipelineBarColors[status] ?? "bg-gray-400"}`}
                                style={{ width: count === 0 ? "0%" : `${Math.max(pct, 3)}%` }}
                              />
                            </div>
                            <span className={`w-6 text-right text-xs tabular-nums font-medium ${isAlert ? "text-yellow-700" : "text-foreground"}`}>
                              {count}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Agentur-Performance */}
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Agentur-Performance</CardTitle>
                      <CardDescription>Ø KI-Score · Einreichungen gesamt</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {agenturPerf.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
                    ) : (
                      <div className="space-y-2">
                        {agenturPerf.map((a) => (
                          <div key={a.name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <IconBuilding className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-sm truncate">{a.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground tabular-nums">{a.count} Profile</span>
                              <ScoreBadge score={a.avg_score} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
```

Note: the `@2xl/main:grid-cols-2` responsive class requires the `@container/main` to be active. Check if the beauftragungen page wrapper has `@container/main` — if not, use `sm:grid-cols-2` instead.

Looking at the current beauftragungen page layout:
```tsx
<div className="flex flex-1 flex-col">
  <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
```

It does NOT have `@container/main`. Use `sm:grid-cols-2` instead of `@2xl/main:grid-cols-2`.

The final class for the grid div should be:
```tsx
<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2">
```

- [ ] **Step 3.6: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3.7: Commit**

```bash
git add src/app/api/beauftragungen/route.ts src/app/beauftragungen/page.tsx
git commit -m "feat: move Kandidaten-Pipeline + Agentur-Performance cards to Beauftragungen page"
```

---

## Task 4: Fix Vakanzen ohne Profile — Include ressource_vakanz_links

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

The current query only checks `kandidaten_profile`. Vacancies with pool links via `ressource_vakanz_links` are incorrectly shown as "ohne Profile". Fix: also join `ressource_vakanz_links` and filter on both.

- [ ] **Step 4.1: Update the vakanzOhneProfile query**

In `src/app/api/dashboard/route.ts`, find line ~117:

```typescript
    supabase.from('vakanzen').select('id, rolle, created_at, kandidaten_profile(id)').eq('status', 'Offen').order('created_at', { ascending: true }),
```

Replace with:

```typescript
    supabase.from('vakanzen').select('id, rolle, created_at, kandidaten_profile(id), ressource_vakanz_links(id)').eq('status', 'Offen').order('created_at', { ascending: true }),
```

- [ ] **Step 4.2: Update the VakanzWithProfiles type and filter logic**

Find (around line ~160):

```typescript
  type VakanzWithProfiles = { id: string; rolle: string; created_at: string; kandidaten_profile: { id: string }[] }
  const vakanzRaw = vakanzOhneProfileRes.status === 'fulfilled' && !vakanzOhneProfileRes.value.error ? (vakanzOhneProfileRes.value.data as VakanzWithProfiles[] ?? []) : []
  const vakanzenOhneProfile = vakanzRaw
    .filter(v => !v.kandidaten_profile || v.kandidaten_profile.length === 0)
```

Replace with:

```typescript
  type VakanzWithProfiles = { id: string; rolle: string; created_at: string; kandidaten_profile: { id: string }[]; ressource_vakanz_links: { id: string }[] }
  const vakanzRaw = vakanzOhneProfileRes.status === 'fulfilled' && !vakanzOhneProfileRes.value.error ? (vakanzOhneProfileRes.value.data as VakanzWithProfiles[] ?? []) : []
  const vakanzenOhneProfile = vakanzRaw
    .filter(v =>
      (!v.kandidaten_profile || v.kandidaten_profile.length === 0) &&
      (!v.ressource_vakanz_links || v.ressource_vakanz_links.length === 0)
    )
```

- [ ] **Step 4.3: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "fix: Vakanzen-ohne-Profile now also checks ressource_vakanz_links"
```

---

## Task 5: Remove Agenturen from Manager RBAC + Sidebar

**Files:**
- Modify: `src/lib/rbac.ts`
- Modify: `src/lib/rbac.test.ts`
- Modify: `src/components/app-sidebar.tsx`

The Staffhub Manager role currently has access to `/agenturen`. This is removed.

- [ ] **Step 5.1: Write failing test for Manager blocking /agenturen**

In `src/lib/rbac.test.ts`, inside `describe('Staffhub Manager', ...)`, find:

```typescript
    it('allows /agenturen', () => {
      expect(isAllowedRoute('/agenturen', 'Staffhub Manager')).toBe(true)
    })
```

Replace with:

```typescript
    it('blocks /agenturen', () => {
      expect(isAllowedRoute('/agenturen', 'Staffhub Manager')).toBe(false)
    })
```

- [ ] **Step 5.2: Run test to confirm it fails**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx vitest run src/lib/rbac.test.ts 2>&1 | tail -20
```

Expected: 1 test fails with `expected true to be false`.

- [ ] **Step 5.3: Remove /agenturen from Staffhub Manager in rbac.ts**

In `src/lib/rbac.ts`, update `ROLE_ROUTES['Staffhub Manager']` by removing `'/agenturen'`:

```typescript
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
```

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx vitest run src/lib/rbac.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5.5: Remove Agenturen from Manager in app-sidebar.tsx**

In `src/components/app-sidebar.tsx`, find the Agenturen entry in `ALL_NAV_MAIN`:

```tsx
  {
    title: 'Agenturen',
    url: '/agenturen',
    icon: IconBuilding,
    roles: ['Admin', 'Staffhub Manager'],
  },
```

Replace with:

```tsx
  {
    title: 'Agenturen',
    url: '/agenturen',
    icon: IconBuilding,
    roles: ['Admin'],
  },
```

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/rbac.ts src/lib/rbac.test.ts src/components/app-sidebar.tsx
git commit -m "feat: remove /agenturen access from Staffhub Manager role"
```

---

## Task 6: Ressourcen — Remove Kandidatenprofile Tab

**Files:**
- Modify: `src/app/ressourcen/page.tsx`

The Ressourcen page has two tabs: "Freelancer-Pool" (to keep) and "Kandidatenprofile" (to remove). The Tabs wrapper is removed entirely; the pool content is rendered directly.

- [ ] **Step 6.1: Remove Kandidatenprofile state, fetch logic, and helpers**

In `src/app/ressourcen/page.tsx`, remove the entire "Kandidatenprofile state" section (lines ~1164–1203):

```typescript
  // ── Kandidatenprofile state ─────────────────────────────────────────────────
  const router = useRouter()
  const [profile, setProfile] = React.useState<KandidatenProfil[]>([])
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileLoaded, setProfileLoaded] = React.useState(false)
  const [profileSearchQuery, setProfileSearchQuery] = React.useState("")
  const [profileStatusFilter, setProfileStatusFilter] = React.useState("alle")
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  async function fetchProfile() {
    setProfileLoading(true)
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProfile(await res.json())
    } catch { /* silently fail */ }
    finally { setProfileLoading(false); setProfileLoaded(true) }
  }

  async function handleCvDownload(profilId: string) {
    setDownloadingId(profilId)
    try {
      const res = await fetch(`/api/profile/${profilId}/cv`)
      if (!res.ok) { toast.error("CV konnte nicht geladen werden."); return }
      const { url } = await res.json()
      window.open(url, "_blank", "noopener,noreferrer")
    } catch { toast.error("Verbindungsfehler beim CV-Download.") }
    finally { setDownloadingId(null) }
  }

  React.useEffect(() => {
    if (activeTab === "profile" && !profileLoaded) fetchProfile()
  }, [activeTab, profileLoaded])

  const filteredProfile = profile.filter((p) => {
    const q = profileSearchQuery.toLowerCase()
    const matchSearch = !q || p.kandidatenname.toLowerCase().includes(q) || (p.vakanz_titel ?? "").toLowerCase().includes(q)
    const matchStatus = profileStatusFilter === "alle" || p.status === profileStatusFilter
    return matchSearch && matchStatus
  })
```

Also remove the tab state block (lines ~1051–1063):

```typescript
  // ── Tab state (reads ?tab=profile from URL on mount) ────────────────────────
  const [activeTab, setActiveTab] = React.useState("pool")
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("tab") === "profile") setActiveTab("profile")
  }, [])
  function handleTabChange(value: string) {
    setActiveTab(value)
    const url = new URL(window.location.href)
    if (value === "profile") url.searchParams.set("tab", "profile")
    else url.searchParams.delete("tab")
    window.history.replaceState({}, "", url.toString())
  }
```

- [ ] **Step 6.2: Remove Tabs wrapper and profile TabsContent from the JSX**

In the return JSX (line ~1205), replace the `<Tabs>` wrapper and its structure:

Current structure:
```tsx
      <SiteHeader title="Ressourcen" />
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col">
        {/* Tab switcher */}
        <div className="px-4 lg:px-6 pt-4 pb-2">
          <TabsList>
            <TabsTrigger value="pool">Freelancer-Pool</TabsTrigger>
            <TabsTrigger value="profile">Kandidatenprofile</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: Freelancer-Pool ─────────────────────────────────────── */}
        <TabsContent value="pool" className="mt-0 flex-1">
          ...pool content...
        </TabsContent>

        {/* ── Tab 2: Kandidatenprofile ───────────────────────────────────── */}
        <TabsContent value="profile" className="mt-0 flex-1">
          ...profile content (lines ~1443–1561)...
        </TabsContent>
      </Tabs>
```

Replace with:
```tsx
      <SiteHeader title="Ressourcen" />
      <div className="flex flex-1 flex-col">
        ...pool content (unchanged, just unwrap from TabsContent)...
      </div>
```

Specifically:
1. Remove `<Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col">` → replace with `<div className="flex flex-1 flex-col">`
2. Remove the entire `<div className="px-4 lg:px-6 pt-4 pb-2"><TabsList>...</TabsList></div>` block (the tab switcher)
3. Replace `<TabsContent value="pool" className="mt-0 flex-1">` → `<div className="flex-1">`
4. Replace the corresponding `</TabsContent>` (end of pool content) → `</div>`
5. Remove the entire `{/* ── Tab 2: Kandidatenprofile ── */}` block including all its contents (lines ~1442–1561)
6. Replace closing `</Tabs>` → `</div>`

- [ ] **Step 6.3: Remove unused imports**

In `src/app/ressourcen/page.tsx`, remove the following from imports:
- `Tabs, TabsContent, TabsList, TabsTrigger` from `@/components/ui/tabs`
- `useRouter` from `next/navigation` (if present)
- `KandidatenProfil` interface or import (if it was defined locally — remove the type definition too)
- Any imports only used in the Kandidatenprofile content (check: `IconSearch` used for profile search? Only if not also used in the pool section)

Check: `toast` from `sonner` — was it only used for `handleCvDownload`? If yes, remove. If the pool section also uses it (e.g., for error handling), keep it.

- [ ] **Step 6.4: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If there are unused variable errors (e.g., `router`, `profile`, etc.), remove those too.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/ressourcen/page.tsx
git commit -m "feat: remove Kandidatenprofile tab from Ressourcen page"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 5 requirements covered — (1) dark/light toggle, (2) remove KPI tiles from dashboard, (3) KPI tiles on Beauftragungen, (4) Vakanzen-ohne-Profile fix, (5) Agenturen removed from manager, (6) Kandidatenprofile tab removed
- [x] **No placeholders:** All code blocks are complete and literal
- [x] **Type consistency:** `AgenturPerf` interface duplicated in both dashboard (removed) and beauftragungen (added) — intentional YAGNI, no shared component needed
- [x] **Grid math:** Beauftragungen KPI cards use `sm:grid-cols-2` (not `@container`) — noted in Step 3.5
- [x] **RBAC + sidebar in sync:** Both `rbac.ts` and `app-sidebar.tsx` updated for Agenturen removal (Task 5)
- [x] **Test update:** rbac.test.ts updated to reflect new Manager behavior — test written before implementation (Steps 5.1–5.4)
