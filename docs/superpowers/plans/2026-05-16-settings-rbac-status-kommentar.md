# Settings RBAC Fix + Status Grid + Kommentar-Spalte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix manager access to /settings, fix truncated status badges in the Gespielte-Ressourcen-Tabelle, and add a dedicated Kommentar-Spalte (speech bubble tooltip) between Status and Agentur.

**Architecture:** Three independent changes — (1) RBAC route list update + test update, (2) grid column redistribution in GespielteRessourcenTable, (3) new read-only Kommentar column rendering `link_feedback` as a hoverable icon.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui (Tooltip), Vitest

---

## Files

- Modify: `src/lib/rbac.ts` — add `/settings` to all three role route lists
- Modify: `src/lib/rbac.test.ts` — add tests for `/settings` access per role
- Modify: `src/components/GespielteRessourcenTable.tsx` — grid redistribution + Kommentar column + remove inline feedback from status cell

---

## Task 1: Fix RBAC — `/settings` fehlt für alle Rollen

`/settings` is missing from every role in `ROLE_ROUTES`, so the middleware blocks all users from reaching the settings page.

**Files:**
- Modify: `src/lib/rbac.ts`
- Modify: `src/lib/rbac.test.ts`

- [ ] **Step 1.1: Write failing tests for /settings access**

In `src/lib/rbac.test.ts`, add inside each `describe` block:

```typescript
// inside describe('Admin', ...)
it('allows /settings', () => {
  expect(isAllowedRoute('/settings', 'Admin')).toBe(true)
})

// inside describe('Staffhub Manager', ...)
it('allows /settings', () => {
  expect(isAllowedRoute('/settings', 'Staffhub Manager')).toBe(true)
})

// inside describe('Agentur', ...)
it('allows /settings', () => {
  expect(isAllowedRoute('/settings', 'Agentur')).toBe(true)
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx vitest run src/lib/rbac.test.ts
```

Expected: 3 new tests fail with `expected false to be true`.

- [ ] **Step 1.3: Add `/settings` to all role route lists in rbac.ts**

In `src/lib/rbac.ts`, update `ROLE_ROUTES` to:

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
    '/agenturen',
    '/beauftragungen',
    '/abrechnung',
    '/slack-log',
    '/ressourcen',
    '/ideen',
    '/settings',
    '/api',
  ],
  Agentur: ['/dashboard', '/vakanzen', '/meine-profile', '/pool', '/ideen', '/settings', '/api'],
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx vitest run src/lib/rbac.test.ts
```

Expected: all tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/rbac.ts src/lib/rbac.test.ts
git commit -m "fix: add /settings to all role route lists in RBAC"
```

---

## Task 2: GespielteRessourcenTable — Grid + Kommentar-Spalte

**Files:**
- Modify: `src/components/GespielteRessourcenTable.tsx`

### Column layout changes

**Manager (12 cols):**
| Column | Old | New |
|--------|-----|-----|
| Name | col-span-3 | col-span-2 |
| Gespielt am | col-span-2 | col-span-2 |
| Match | col-span-1 | col-span-1 |
| Status | col-span-2 | col-span-3 |
| Kommentar | — | col-span-1 (new) |
| Agentur | col-span-2 | col-span-1 |
| Aktion | col-span-2 | col-span-2 |
| **Total** | **12** | **12** |

**Agentur (12 cols):**
| Column | Old | New |
|--------|-----|-----|
| Name | col-span-3 | col-span-3 |
| Gespielt am | col-span-2 | col-span-2 |
| Match | col-span-2 | col-span-1 |
| Status | col-span-3 | col-span-3 |
| Kommentar | — | col-span-1 (new) |
| Aktion | col-span-2 | col-span-2 |
| **Total** | **12** | **12** |

- [ ] **Step 2.1: Update header row**

Replace the header `div.grid` block (lines ~182–203) with:

```tsx
<div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted border-b border-border">
  <div className={`${isManager ? 'col-span-2' : 'col-span-3'} text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>Name</div>
  <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gespielt am</div>
  <div className="col-span-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
    Match
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 cursor-help opacity-60 hover:opacity-100 transition-opacity" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
        <p className="font-semibold mb-1">Wie wird der Score berechnet?</p>
        <p>GPT-4o-mini bewertet das Profil gegen die Vakanz — Skills, Level und Profiltext semantisch verglichen.</p>
        <p className="mt-1">0–100: <span className="text-emerald-600">≥ 70 gut</span> · <span className="text-amber-600">40–69 bedingt</span> · <span className="text-rose-600">&lt; 40 schwach</span></p>
      </TooltipContent>
    </Tooltip>
  </div>
  <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
  <div className="col-span-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kommentar</div>
  {isManager && (
    <div className="col-span-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agentur</div>
  )}
  <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Aktion</div>
</div>
```

- [ ] **Step 2.2: Update data rows — Name, Match, Status cells**

In the row `div.grid` (inside `resources.map`), replace the Name, Match, and Status cells:

**Name cell** (was col-span-3, now col-span-2 for manager):
```tsx
{/* Name */}
<div className={isManager ? 'col-span-2' : 'col-span-3'}>
  <p className="text-sm font-semibold text-foreground">{resource.name}</p>
  <p className="text-xs text-muted-foreground">{resource.erfahrungslevel}</p>
</div>
```

**Match cell** (always col-span-1 now):
```tsx
{/* Score */}
<div className="col-span-1">
  {isCalculating ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Berechne…
    </span>
  ) : (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold ${getScoreColor(noScore ? null : displayScore)}`}>
      {!noScore ? `${Math.round(displayScore as number)}` : '-'}
    </span>
  )}
</div>
```

**Status cell** (always col-span-3 now, inline feedback removed):
```tsx
{/* Status */}
<div className="col-span-3">
  {isManager && currentStatus !== 'Zurückgezogen' ? (
    isUpdating ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Speichert…
      </span>
    ) : (
      <Select value={currentStatus} onValueChange={(v) => handleStatusSelect(resource, v)}>
        <SelectTrigger className={`h-auto w-fit rounded-full border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer [&>svg]:hidden hover:opacity-80 active:scale-95 ${getStatusConfig(currentStatus).color}`}>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {getStatusConfig(currentStatus).icon}
            <span>{currentStatus}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </span>
        </SelectTrigger>
        <SelectContent>
          {LINK_STATUSES.map((s) => {
            const cfg = getStatusConfig(s)
            return (
              <SelectItem key={s} value={s} className="text-xs">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                  {s}
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  ) : (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusConfig(currentStatus).color}`}>
      {getStatusConfig(currentStatus).icon}
      {currentStatus}
    </span>
  )}
</div>
```

- [ ] **Step 2.3: Add Kommentar cell + fix Agentur cell span**

After the Status cell (and before the Agentur cell), add the new Kommentar cell:

```tsx
{/* Kommentar */}
<div className="col-span-1 flex items-center">
  {hasFeedback ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground transition-colors">
          <MessageSquare className="h-4 w-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs">
        <p className="font-semibold mb-1">Kommentar</p>
        <p className="whitespace-pre-wrap leading-relaxed">{resource.link_feedback}</p>
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-xs text-muted-foreground/40">–</span>
  )}
</div>
```

Also update the Agentur cell span from `col-span-2` to `col-span-1`:

```tsx
{/* Agentur — manager only */}
{isManager && (
  <div className="col-span-1">
    {resource.agentur_name ? (
      <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground truncate max-w-full">
        {resource.agentur_name}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground/40">–</span>
    )}
  </div>
)}
```

- [ ] **Step 2.4: Verify the app builds without errors**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/GespielteRessourcenTable.tsx
git commit -m "feat: fix status truncation + add Kommentar column to Gespielte-Ressourcen-Tabelle"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All three requirements covered — RBAC fix (Task 1), status width (Task 2.1–2.2), Kommentar column (Task 2.3)
- [x] **No placeholders:** All code is complete and literal
- [x] **Type consistency:** `hasFeedback`, `resource.link_feedback`, `MessageSquare` — all used correctly, already imported in the component
- [x] **Grid math:** Manager 2+2+1+3+1+1+2=12 ✓ · Agentur 3+2+1+3+1+2=12 ✓
- [x] **Inline feedback removed:** Old `hasFeedback` blocks under status cells are replaced by the new Kommentar column — no duplicate display
