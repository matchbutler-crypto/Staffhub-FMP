# Stammdaten Kopieren Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clipboard icon button to the Stammdaten-Tab that copies all 6 Stammdaten fields as structured `Label: Wert` text to the clipboard.

**Architecture:** A pure formatting function `buildStammdatenText` is extracted to `src/lib/stammdaten-copy.ts` for testability. A small `CopyStammdatenButton` React component lives locally in `page.tsx` and uses this function. The button sits top-right of the read view, always visible to any user who can see the Stammdaten.

**Tech Stack:** Next.js App Router (client component), React `useState`, `navigator.clipboard.writeText`, `@tabler/icons-react`, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/stammdaten-copy.ts` | Create | Pure function that formats Stammdaten fields as structured text |
| `src/lib/stammdaten-copy.test.ts` | Create | Unit tests for the formatting function |
| `src/app/ressourcen/[id]/page.tsx` | Modify | Add `IconCopy` import, `CopyStammdatenButton` component, integration into `StammdatenTab` |

---

## Task 1: `buildStammdatenText` helper + tests

**Files:**
- Create: `src/lib/stammdaten-copy.ts`
- Create: `src/lib/stammdaten-copy.test.ts`

### Context

The function takes the 6 Stammdaten fields and formats them as:
```
Vorname: Max
Nachname: Mustermann
Geburtsdatum: 01.01.1990
E-Mail: max@example.com
Telefon: +49 123 456789
Wohnort: Berlin
```
Empty/null fields appear as `Feldname: —`. Geburtsdatum is formatted with `toLocaleDateString('de-DE')`.

---

- [ ] **Step 1: Write the failing test**

Create `src/lib/stammdaten-copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildStammdatenText } from './stammdaten-copy'

describe('buildStammdatenText', () => {
  it('formats all fields when fully populated', () => {
    const result = buildStammdatenText({
      vorname: 'Max',
      nachname: 'Mustermann',
      geburtsdatum: '1990-01-15',
      email: 'max@example.com',
      telefon: '+49 123 456789',
      wohnort: 'Berlin',
    })
    expect(result).toBe(
      'Vorname: Max\nNachname: Mustermann\nGeburtsdatum: 15.01.1990\nE-Mail: max@example.com\nTelefon: +49 123 456789\nWohnort: Berlin'
    )
  })

  it('renders null fields as —', () => {
    const result = buildStammdatenText({
      vorname: null,
      nachname: 'Mustermann',
      geburtsdatum: null,
      email: null,
      telefon: null,
      wohnort: null,
    })
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Geburtsdatum: —')
    expect(result).toContain('E-Mail: —')
    expect(result).toContain('Telefon: —')
    expect(result).toContain('Wohnort: —')
  })

  it('renders undefined fields as —', () => {
    const result = buildStammdatenText({})
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Nachname: —')
    expect(result).toContain('Geburtsdatum: —')
  })

  it('renders empty string fields as —', () => {
    const result = buildStammdatenText({ vorname: '', nachname: '  ' })
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Nachname: —')
  })

  it('preserves field order: Vorname first, Wohnort last', () => {
    const result = buildStammdatenText({
      vorname: 'A',
      nachname: 'B',
      geburtsdatum: '2000-06-01',
      email: 'a@b.de',
      telefon: '123',
      wohnort: 'München',
    })
    const lines = result.split('\n')
    expect(lines[0]).toMatch(/^Vorname:/)
    expect(lines[5]).toMatch(/^Wohnort:/)
  })

  it('formats Geburtsdatum as de-DE locale', () => {
    const result = buildStammdatenText({ geburtsdatum: '2000-06-01' })
    expect(result).toContain('Geburtsdatum: 01.06.2000')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx vitest run src/lib/stammdaten-copy.test.ts
```

Expected: FAIL with "Cannot find module './stammdaten-copy'"

- [ ] **Step 3: Implement `buildStammdatenText`**

Create `src/lib/stammdaten-copy.ts`:

```ts
export interface StammdatenFields {
  vorname?: string | null
  nachname?: string | null
  geburtsdatum?: string | null
  email?: string | null
  telefon?: string | null
  wohnort?: string | null
}

function fmt(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

function fmtDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return new Date(value).toLocaleDateString('de-DE')
}

export function buildStammdatenText(fields: StammdatenFields): string {
  return [
    `Vorname: ${fmt(fields.vorname)}`,
    `Nachname: ${fmt(fields.nachname)}`,
    `Geburtsdatum: ${fmtDate(fields.geburtsdatum)}`,
    `E-Mail: ${fmt(fields.email)}`,
    `Telefon: ${fmt(fields.telefon)}`,
    `Wohnort: ${fmt(fields.wohnort)}`,
  ].join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/stammdaten-copy.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/stammdaten-copy.ts src/lib/stammdaten-copy.test.ts
git commit -m "feat: add buildStammdatenText helper with tests"
```

---

## Task 2: `CopyStammdatenButton` + integration into `StammdatenTab`

**Files:**
- Modify: `src/app/ressourcen/[id]/page.tsx`

### Context

`page.tsx` currently imports these icons from `@tabler/icons-react` (lines 9–22):

```ts
import {
  IconArrowLeft,
  IconBriefcase,
  IconCheck,
  IconClock,
  IconDownload,
  IconHistory,
  IconLoader2,
  IconMapPin,
  IconPencil,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react"
```

`IconCheck` is already there. `IconCopy` must be added.

The `StammdatenTab` read view (around line 489) currently shows:

```tsx
return (
  <div className="space-y-5">
    {canEdit && (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="gap-1.5"
        >
          <IconPencil className="h-3.5 w-3.5" /> Bearbeiten
        </Button>
      </div>
    )}
    <div className="divide-y divide-border rounded-md border border-border bg-background">
      ...
    </div>
    ...
  </div>
)
```

The `Ressource` interface (line 59) already includes all 6 fields: `vorname`, `nachname`, `geburtsdatum`, `email`, `telefon`, `wohnort`.

`StammdatenTab` already receives `ressource: Ressource` as a prop.

---

- [ ] **Step 1: Add `IconCopy` to the import block**

In `src/app/ressourcen/[id]/page.tsx`, find the `@tabler/icons-react` import block and add `IconCopy`:

```ts
import {
  IconArrowLeft,
  IconBriefcase,
  IconCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconHistory,
  IconLoader2,
  IconMapPin,
  IconPencil,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react"
```

- [ ] **Step 2: Add the import for `buildStammdatenText`**

After the existing `getLinkStatusConfig` import (around line 49), add:

```ts
import { buildStammdatenText } from "@/lib/stammdaten-copy"
```

- [ ] **Step 3: Add `CopyStammdatenButton` component**

Add this component directly above the `StammdatenTab` function definition (around line 364):

```tsx
function CopyStammdatenButton({ ressource }: { ressource: Ressource }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildStammdatenText(ressource))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied
        ? <IconCheck className="h-3.5 w-3.5 text-green-600" />
        : <IconCopy className="h-3.5 w-3.5" />
      }
      Kopieren
    </Button>
  )
}
```

- [ ] **Step 4: Update the read view header in `StammdatenTab`**

In the `StammdatenTab` return block, replace:

```tsx
{canEdit && (
  <div className="flex justify-end">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsEditing(true)}
      className="gap-1.5"
    >
      <IconPencil className="h-3.5 w-3.5" /> Bearbeiten
    </Button>
  </div>
)}
```

With:

```tsx
<div className="flex justify-end gap-2">
  <CopyStammdatenButton ressource={ressource} />
  {canEdit && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsEditing(true)}
      className="gap-1.5"
    >
      <IconPencil className="h-3.5 w-3.5" /> Bearbeiten
    </Button>
  )}
</div>
```

- [ ] **Step 5: Verify the app compiles**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All previously passing tests still pass, the 6 new stammdaten-copy tests pass. The 10 pre-existing failures (spielen, ressource-feedback, feedback, vakanzen) remain but are unrelated to this feature.

- [ ] **Step 7: Commit**

```bash
git add src/app/ressourcen/\[id\]/page.tsx
git commit -m "feat: add Stammdaten kopieren button to resource detail view"
```
