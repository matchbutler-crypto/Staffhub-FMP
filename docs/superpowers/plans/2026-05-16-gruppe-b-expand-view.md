# Gruppe B — Expand View Redesign + Clickable Vakanz Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the compact expand row in the Manager Freelancer-Pool table with a proper mini-table matching the Agentur pool view, and make Vakanz names clickable in both views.

**Architecture:** Pure UI changes across two files — no API or database changes. The links endpoint (`GET /api/ressourcen/[id]/links`) already returns all needed vacancy fields. Two independent tasks, each committed separately.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, `next/navigation` useRouter

---

## Files

- Modify: `src/app/ressourcen/page.tsx` — extend `VakanzLink` type, re-add `useRouter`, replace expand row with mini-table
- Modify: `src/app/pool/page.tsx` — make Vakanz name cell in existing expand table clickable

---

## Task 1: Redesign expand row in `ressourcen/page.tsx`

**Files:**
- Modify: `src/app/ressourcen/page.tsx`

**Context:** This is the Manager-only Ressourcen page. When a resource row with Vakanz links is expanded, it currently shows a compact flex-div list (Vakanz name, status badge, interview date, created date). The Agentur pool page (`/pool`) already has a proper mini-table for its expand rows with columns: Vakanz, Status, Level, Standort/Remote, Sektor, Start, Ende. We want the manager view to match that.

The links API already returns the extra fields — the `VakanzLink.vakanzen_data` type in the file just needs to be extended to declare them.

- [ ] **Step 1.1: Add `useRouter` import and hook**

At the top of the file, `next/navigation` is not currently imported. Add it:

```tsx
import { useRouter } from "next/navigation"
```

Place this as the first import, before `import * as React from "react"` — or immediately after it (follow existing import order: `"use client"` → framework → internal).

Then inside `RessourcenPage()`, directly after the `showDeaktiviert` state line (around line 1074), add:

```tsx
const router = useRouter()
```

- [ ] **Step 1.2: Extend `VakanzLink.vakanzen_data` type**

Find the `VakanzLink` interface (around line 94):

```tsx
interface VakanzLink {
  id: string
  ressource_id: string
  vakanz_id: string
  status: LinkStatus
  interview_datum: string | null
  created_at: string
  updated_at: string
  vakanzen_data: { id: string; rolle: string; status: string } | null
}
```

Replace `vakanzen_data` with:

```tsx
interface VakanzLink {
  id: string
  ressource_id: string
  vakanz_id: string
  status: LinkStatus
  interview_datum: string | null
  created_at: string
  updated_at: string
  vakanzen_data: {
    id: string
    rolle: string
    status: string
    erfahrungslevel?: string | null
    arbeitsmodell?: string | null
    standort?: string | null
    branche?: string | null
    startdatum?: string | null
    enddatum?: string | null
  } | null
}
```

- [ ] **Step 1.3: Replace the expand row JSX**

Find this expand row block (around lines 1299–1335):

```tsx
{isExpanded && (
  <TableRow className="bg-muted/30 hover:bg-muted/30">
    <TableCell colSpan={8} className="py-3 px-4">
      {isLoadingLinks ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2].map((i) => <Skeleton key={i} className="h-5 w-full rounded" />)}
        </div>
      ) : cachedLinks.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconLink className="size-3.5" />
          Noch auf keine Vakanz gespielt.
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-md border bg-background">
          {cachedLinks.map((link) => (
            <div key={link.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {link.vakanzen_data?.rolle ?? "Unbekannte Vakanz"}
              </span>
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${linkStatusColors[link.status]}`}>
                {link.status}
              </span>
              {link.interview_datum && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <IconClock className="size-3" />
                  {new Date(link.interview_datum).toLocaleDateString("de-DE")}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(link.created_at).toLocaleDateString("de-DE")}
              </span>
            </div>
          ))}
        </div>
      )}
    </TableCell>
  </TableRow>
)}
```

Replace with:

```tsx
{isExpanded && (
  <TableRow className="bg-muted/30 hover:bg-muted/30">
    <TableCell colSpan={8} className="px-6 py-0">
      {isLoadingLinks ? (
        <div className="py-3 text-xs text-muted-foreground">Lädt…</div>
      ) : cachedLinks.length === 0 ? (
        <div className="py-3 text-xs text-muted-foreground">Noch auf keine Vakanz gespielt.</div>
      ) : (
        <div className="py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1.5 pr-4 text-left font-medium">Vakanz</th>
                <th className="py-1.5 pr-4 text-left font-medium">Status</th>
                <th className="py-1.5 pr-4 text-left font-medium">Level</th>
                <th className="py-1.5 pr-4 text-left font-medium">Standort/Remote</th>
                <th className="py-1.5 pr-4 text-left font-medium">Sektor</th>
                <th className="py-1.5 pr-4 text-left font-medium">Start</th>
                <th className="py-1.5 text-left font-medium">Ende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {cachedLinks.map((link) => {
                const vd = link.vakanzen_data
                const standortLabel = [vd?.arbeitsmodell, vd?.standort].filter(Boolean).join(" · ") || "—"
                return (
                  <tr key={link.id}>
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      <button
                        className="text-left hover:underline focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); router.push(`/vakanzen/${link.vakanz_id}`) }}
                      >
                        {vd?.rolle ?? "—"}
                      </button>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${linkStatusColors[link.status]}`}>
                        {link.status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{vd?.erfahrungslevel ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{standortLabel}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{vd?.branche ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      {vd?.startdatum ? new Date(vd.startdatum).toLocaleDateString("de-DE") : "—"}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {vd?.enddatum ? new Date(vd.enddatum).toLocaleDateString("de-DE") : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TableCell>
  </TableRow>
)}
```

- [ ] **Step 1.4: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 1.5: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/ressourcen/page.tsx
git commit -m "feat: redesign expand row in Manager Ressourcen page to match pool table style"
```

---

## Task 2: Make Vakanz name clickable in `pool/page.tsx`

**Files:**
- Modify: `src/app/pool/page.tsx`

**Context:** The Agentur pool page already has a well-structured mini-table in its expand rows. The Vakanz name column currently renders plain text. We just need to wrap it in a clickable button that navigates to `/vakanzen/[id]`. `useRouter` is already imported and available in this file.

- [ ] **Step 2.1: Find the Vakanz name cell in the expand table**

Search for this exact snippet in `src/app/pool/page.tsx` (around line 2311):

```tsx
<td className="py-1.5 pr-4 font-medium text-foreground">{vd?.rolle ?? "—"}</td>
```

Replace it with:

```tsx
<td className="py-1.5 pr-4 font-medium text-foreground">
  <button
    className="text-left hover:underline focus:outline-none"
    onClick={(e) => { e.stopPropagation(); router.push(`/vakanzen/${l.vakanz_id}`) }}
  >
    {vd?.rolle ?? "—"}
  </button>
</td>
```

Note: In `pool/page.tsx` the loop variable is `l` (not `link`) and the variable for `vakanzen_data` is `vd = l.vakanzen_data`. Verify the exact variable names before editing by reading the surrounding loop context.

- [ ] **Step 2.2: Verify TypeScript**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 2.3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
git add src/app/pool/page.tsx
git commit -m "feat: make Vakanz name clickable in Agentur pool expand row"
```

---

## Self-Review

**Spec coverage:**
- ✅ Manager Ressourcen expand row replaced with mini-table (Task 1)
- ✅ `VakanzLink.vakanzen_data` type extended with extra vacancy fields (Task 1.2)
- ✅ `useRouter` re-added to `ressourcen/page.tsx` (Task 1.1)
- ✅ Vakanz name clickable in manager view → `/vakanzen/[id]` (Task 1.3)
- ✅ Vakanz name clickable in Agentur pool view → `/vakanzen/[id]` (Task 2)
- ✅ `e.stopPropagation()` prevents expand toggle from firing on nav click (both tasks)

**Placeholder scan:** None found — all code is literal and complete.

**Type consistency:** `VakanzLink.vakanzen_data` type defined in Task 1.2 matches how it's accessed in Task 1.3 (`vd?.erfahrungslevel`, `vd?.arbeitsmodell`, etc.).
