# Multi-Select Einreichen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mehrere Ressourcen gleichzeitig aus dem Pool auswählen und in einem Schritt auf eine Vakanz einreichen.

**Architecture:** Einzige Datei: `ressource-einsetzen-dialog.tsx`. State-Umbau von `selectedRessource: PoolRessource | null` auf `selectedIds: Set<string>`. Submit via `Promise.allSettled` für parallele Einreichung. Fehler werden pro Ressource als eigener Toast angezeigt.

**Tech Stack:** React, TypeScript, sonner (toast)

---

## Datei-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/components/ressource-einsetzen-dialog.tsx` | State, Click-Handler, handleSpielen, Button |

---

## Task 1: State von Single-Select auf Multi-Select umbauen

**Files:**
- Modify: `src/components/ressource-einsetzen-dialog.tsx`

- [ ] **Schritt 1: `selectedRessource`-State durch `selectedIds`-Set ersetzen**

Zeile 128 — diese Zeile ersetzen:
```typescript
const [selectedRessource, setSelectedRessource] = React.useState<PoolRessource | null>(null)
```
durch:
```typescript
const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
```

- [ ] **Schritt 2: Reset beim Schließen anpassen**

Zeile 138 — diese Zeile:
```typescript
setTab("pool"); setSearch(""); setSelectedRessource(null)
```
ersetzen durch:
```typescript
setTab("pool"); setSearch(""); setSelectedIds(new Set())
```

- [ ] **Schritt 3: `isSelected`-Prüfung in der Tabelle umstellen**

Zeile 287 — diese Zeile:
```typescript
const isSelected = selectedRessource?.id === r.id
```
ersetzen durch:
```typescript
const isSelected = selectedIds.has(r.id)
```

- [ ] **Schritt 4: Click-Handler auf Toggle umbauen**

Zeile 291 — diesen onClick:
```typescript
onClick={() => !isDisabled && setSelectedRessource(isSelected ? null : r)}
```
ersetzen durch:
```typescript
onClick={() => {
  if (isDisabled) return
  setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(r.id)) next.delete(r.id)
    else next.add(r.id)
    return next
  })
}}
```

- [ ] **Schritt 5: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartet: Fehler wegen `selectedRessource` in `handleSpielen` und Button — das ist erwartet, wird in Task 2 und 3 behoben.

- [ ] **Schritt 6: Commit**

```bash
git add src/components/ressource-einsetzen-dialog.tsx
git commit -m "refactor: replace single selectedRessource with selectedIds Set"
```

---

## Task 2: `handleSpielen` auf parallele Einreichung umbauen

**Files:**
- Modify: `src/components/ressource-einsetzen-dialog.tsx`

- [ ] **Schritt 1: `handleSpielen` komplett ersetzen**

Die gesamte Funktion (Zeilen 168–195):
```typescript
async function handleSpielen() {
  if (!selectedRessource) return
  setSubmitting(true)
  try {
    const res = await fetch(`/api/ressourcen/${selectedRessource.id}/spielen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vakanz_id: vakanzId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? "Fehler beim Einreichen")
    toast.success(`${selectedRessource.name} auf Vakanz gespielt`)

    // Trigger OpenAI score calculation in background
    fetch(`/api/ressourcen/${selectedRessource.id}/ki-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vakanz_id: vakanzId }),
    }).catch(() => {})

    onOpenChange(false)
    onSuccess()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Fehler beim Einreichen")
  } finally {
    setSubmitting(false)
  }
}
```

ersetzen durch:

```typescript
async function handleSpielen() {
  if (selectedIds.size === 0) return
  const selected = ressourcen.filter(r => selectedIds.has(r.id))
  setSubmitting(true)
  try {
    const results = await Promise.allSettled(
      selected.map(async (r) => {
        const res = await fetch(`/api/ressourcen/${r.id}/spielen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vakanz_id: vakanzId }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? "Fehler beim Einreichen")
        return r
      })
    )

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<PoolRessource> => r.status === "fulfilled")
      .map(r => r.value)

    // KI-match im Hintergrund für jede erfolgreiche Einreichung
    for (const r of succeeded) {
      fetch(`/api/ressourcen/${r.id}/ki-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      }).catch(() => {})
    }

    // Fehler-Toast pro fehlgeschlagener Ressource
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const name = selected[i].name
        const msg = result.reason instanceof Error ? result.reason.message : "Fehler beim Einreichen"
        toast.error(`${name}: ${msg}`)
      }
    })

    // Erfolgs-Toast
    if (succeeded.length > 0) {
      const total = selected.length
      toast.success(
        succeeded.length === total
          ? `${total === 1 ? "1 Ressource" : `${total} Ressourcen`} eingereicht`
          : `${succeeded.length} von ${total} Ressourcen eingereicht`
      )
    }

    onOpenChange(false)
    onSuccess()
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartet: Fehler nur noch im Button wegen `selectedRessource` — wird in Task 3 behoben.

- [ ] **Schritt 3: Commit**

```bash
git add src/components/ressource-einsetzen-dialog.tsx
git commit -m "feat: submit multiple resources in parallel with Promise.allSettled"
```

---

## Task 3: Button-Text und -Zustand anpassen

**Files:**
- Modify: `src/components/ressource-einsetzen-dialog.tsx`

- [ ] **Schritt 1: Button ersetzen**

Zeilen 325–327:
```tsx
<Button onClick={handleSpielen} disabled={!selectedRessource || submitting}>
  {submitting ? "Wird eingereicht…" : selectedRessource ? `${selectedRessource.name} einsetzen` : "Ressource auswählen"}
</Button>
```

ersetzen durch:

```tsx
<Button onClick={handleSpielen} disabled={selectedIds.size === 0 || submitting}>
  {submitting
    ? "Wird eingereicht…"
    : selectedIds.size === 0
      ? "Ressource auswählen"
      : selectedIds.size === 1
        ? "1 Ressource einsetzen"
        : `${selectedIds.size} Ressourcen einsetzen`}
</Button>
```

- [ ] **Schritt 2: TypeScript-Check — jetzt 0 Fehler**

```bash
npx tsc --noEmit
```

Erwartet: 0 Fehler

- [ ] **Schritt 3: Tests ausführen**

```bash
npx vitest run src/lib/calculateScore.test.ts src/lib/rbac.test.ts
```

Erwartet: alle grün

- [ ] **Schritt 4: Commit**

```bash
git add src/components/ressource-einsetzen-dialog.tsx
git commit -m "feat: multi-select button text shows count of selected resources"
```

---

## Task 4: Manueller Test + Deploy

- [ ] **Schritt 1: Dev-Server starten**

```bash
npm run dev
```

- [ ] **Schritt 2: Testen**

1. `/vakanzen` öffnen → „Ressource einsetzen" klicken
2. Mehrere Zeilen anklicken → jede markiert sich mit `IconCheck`, Button zeigt „N Ressourcen einsetzen"
3. Eine bereits markierte Zeile erneut klicken → Markierung wird entfernt
4. Suche eingeben → bereits ausgewählte Ressourcen bleiben ausgewählt (auch wenn sie aus der gefilterten Liste verschwinden)
5. „2 Ressourcen einsetzen" klicken → beide werden eingereicht, Toast zeigt „2 von 2 Ressourcen eingereicht"
6. Bereits eingereichte Ressourcen (ausgegraut) sind nicht anklickbar

- [ ] **Schritt 3: Deploy**

```bash
git checkout main
git merge master
git push origin main
git checkout master
```
