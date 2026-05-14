# Matchscore im „Ressource einsetzen" Modal — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im „Ressource einsetzen" Modal (Tab „Aus Pool auswählen") wird jede Ressource mit einem Matchscore in einer 4-spaltigen Tabelle (Name | Rolle | Verfügbar ab | Matchscore) angezeigt. Der Score wird client-seitig ohne KI berechnet.

**Architecture:** `calculateSkillMatchScore` wird aus `src/lib/calculateScore.ts` exportiert. `RessourceEinsetzenDialog` erhält zwei neue Props (`vakanzSkills`, `vakanzErfahrungslevel`), berechnet den Score per Ressource und rendert eine Tabelle statt Karten. Die Ressourcen werden absteigend nach Score sortiert.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

---

## Datei-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/lib/calculateScore.ts` | `calculateSkillMatchScore` exportieren |
| `src/lib/calculateScore.test.ts` | Tests für `calculateSkillMatchScore` (neu) |
| `src/components/ressource-einsetzen-dialog.tsx` | Props + Typ + Score-Berechnung + Tabellen-Layout |
| `src/app/vakanzen/page.tsx` | Zwei neue Props beim Dialog-Aufruf übergeben |

---

## Task 1: `calculateSkillMatchScore` exportieren

**Files:**
- Modify: `src/lib/calculateScore.ts`

- [ ] **Schritt 1: `export` zu `calculateSkillMatchScore` hinzufügen**

In `src/lib/calculateScore.ts`, Zeile 40 — `function` → `export function`:

```typescript
export function calculateSkillMatchScore(
  extractedSkills: string[],
  vacancySkills: string[]
): number {
```

- [ ] **Schritt 2: TypeScript-Check ausführen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Schritt 3: Commit**

```bash
git add src/lib/calculateScore.ts
git commit -m "feat: export calculateSkillMatchScore for client-side matching"
```

---

## Task 2: Tests für `calculateSkillMatchScore`

**Files:**
- Create: `src/lib/calculateScore.test.ts`

- [ ] **Schritt 1: Testdatei anlegen**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateSkillMatchScore } from './calculateScore'

describe('calculateSkillMatchScore', () => {
  it('returns 100 when vacancy has no skills', () => {
    expect(calculateSkillMatchScore(['Python', 'SQL'], [])).toBe(100)
  })

  it('returns 0 when resource has no skills', () => {
    expect(calculateSkillMatchScore([], ['Python', 'SQL'])).toBe(0)
  })

  it('returns 100 for full match', () => {
    expect(calculateSkillMatchScore(['Python', 'SQL'], ['Python', 'SQL'])).toBe(100)
  })

  it('returns 50 for half match', () => {
    expect(calculateSkillMatchScore(['Python'], ['Python', 'SQL'])).toBe(50)
  })

  it('is case-insensitive', () => {
    expect(calculateSkillMatchScore(['python', 'sql'], ['Python', 'SQL'])).toBe(100)
  })

  it('returns 0 when no skills overlap', () => {
    expect(calculateSkillMatchScore(['Java', 'Go'], ['Python', 'SQL'])).toBe(0)
  })
})
```

- [ ] **Schritt 2: Tests ausführen — alle müssen grün sein**

```bash
npx vitest run src/lib/calculateScore.test.ts
```

Erwartet: 6 passed

- [ ] **Schritt 3: Commit**

```bash
git add src/lib/calculateScore.test.ts
git commit -m "test: add calculateSkillMatchScore unit tests"
```

---

## Task 3: `PoolRessource`-Typ erweitern + neue Props

**Files:**
- Modify: `src/components/ressource-einsetzen-dialog.tsx` (Typ + Props)

- [ ] **Schritt 1: `verfuegbar_ab` zum `PoolRessource`-Interface hinzufügen**

In `src/components/ressource-einsetzen-dialog.tsx`, das Interface (aktuell Zeilen 34–45) so anpassen:

```typescript
export interface PoolRessource {
  id: string
  name: string
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  verfuegbar_ab?: string | null
  bereits_gespielt?: boolean
  link_id?: string | null
  link_status?: string | null
  link_created_at?: string | null
  ki_score?: number | null
}
```

- [ ] **Schritt 2: Neue Props zum Dialog hinzufügen**

Die Props-Definition von `RessourceEinsetzenDialog` (aktuell Zeilen 92–104) erweitern:

```typescript
export function RessourceEinsetzenDialog({
  open,
  onOpenChange,
  vakanzId,
  vakanzTitel,
  vakanzSkills,
  vakanzErfahrungslevel,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vakanzId: string
  vakanzTitel: string
  vakanzSkills: string[]
  vakanzErfahrungslevel: string
  onSuccess: () => void
}) {
```

- [ ] **Schritt 3: Import für `calculateSkillMatchScore` hinzufügen**

Ganz oben in der Datei, nach den bestehenden Imports:

```typescript
import { calculateSkillMatchScore } from '@/lib/calculateScore'
```

- [ ] **Schritt 4: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartet: Fehler in `vakanzen/page.tsx` wegen fehlender neuer Props — das ist erwartet und wird in Task 5 behoben.

- [ ] **Schritt 5: Commit**

```bash
git add src/components/ressource-einsetzen-dialog.tsx
git commit -m "feat: extend PoolRessource type and add vakanzSkills props to dialog"
```

---

## Task 4: Score-Berechnung + Sortierung + Tabellen-Layout

**Files:**
- Modify: `src/components/ressource-einsetzen-dialog.tsx` (Logik + Render)

- [ ] **Schritt 1: Score-Farbkonstanten und Level-Farben hinzufügen**

Nach der bestehenden `VERFUEGBARKEIT_COLORS`-Konstante (nach Zeile 52) einfügen:

```typescript
const ERFAHRUNGS_COLORS: Record<string, string> = {
  Junior: "bg-sky-100 text-sky-700 border-sky-200",
  Mid: "bg-violet-100 text-violet-700 border-violet-200",
  Senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-100 text-rose-700 border-rose-200",
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200"
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  return "bg-red-100 text-red-700 border-red-200"
}
```

- [ ] **Schritt 2: Gefilterte + sortierte Liste mit Score berechnen**

Die bestehende `filtered`-Variable (aktuell Zeilen 132–135) ersetzen:

```typescript
const filteredWithScore = ressourcen
  .filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  )
  .map((r) => ({
    ...r,
    matchScore: calculateSkillMatchScore(r.skills, vakanzSkills),
  }))
  .sort((a, b) => {
    // Bereits eingereichte ans Ende
    if (a.bereits_gespielt && !b.bereits_gespielt) return 1
    if (!a.bereits_gespielt && b.bereits_gespielt) return -1
    return b.matchScore - a.matchScore
  })
```

- [ ] **Schritt 3: Tab-Inhalt „Aus Pool" durch Tabellen-Layout ersetzen**

Den gesamten `TabsContent value="pool"`-Block (aktuell Zeilen 224–281) ersetzen:

```tsx
<TabsContent value="pool" className="flex flex-col gap-3 flex-1 overflow-hidden mt-3">
  <div className="relative">
    <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input className="pl-9" placeholder="Name oder Skill suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
  </div>
  <div className="flex-1 overflow-y-auto rounded-md border min-h-[200px] max-h-[280px]">
    {loadingPool ? (
      <div className="p-4 text-center text-sm text-muted-foreground">Lädt…</div>
    ) : filteredWithScore.length === 0 ? (
      <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
        {ressourcen.length === 0 ? (
          <>
            <p>Noch keine Pool-Ressourcen vorhanden.</p>
            <button className="text-primary underline-offset-4 hover:underline" onClick={() => setTab("neu")}>
              Erste Ressource anlegen
            </button>
          </>
        ) : "Keine Ressourcen gefunden."}
      </div>
    ) : (
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rolle</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Verfügbar ab</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Match</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filteredWithScore.map((r) => {
            const isDisabled = !!r.bereits_gespielt
            const isSelected = selectedRessource?.id === r.id
            return (
              <tr
                key={r.id}
                onClick={() => !isDisabled && setSelectedRessource(isSelected ? null : r)}
                className={`transition-colors ${isDisabled ? "cursor-not-allowed opacity-50" : isSelected ? "bg-primary/5 cursor-pointer" : "hover:bg-muted/50 cursor-pointer"}`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {isSelected && !isDisabled && <IconCheck className="size-3.5 text-primary shrink-0" />}
                    <span className="font-medium truncate max-w-[140px]">{r.name}</span>
                    {isDisabled && <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bereits eingereicht</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ERFAHRUNGS_COLORS[r.erfahrungslevel] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {r.erfahrungslevel}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.verfuegbar_ab
                    ? new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(r.matchScore)}`}>
                    {r.matchScore} %
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )}
  </div>
  <DialogFooter>
    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Abbrechen</Button>
    <Button onClick={handleSpielen} disabled={!selectedRessource || submitting}>
      {submitting ? "Wird eingereicht…" : selectedRessource ? `${selectedRessource.name} einsetzen` : "Ressource auswählen"}
    </Button>
  </DialogFooter>
</TabsContent>
```

- [ ] **Schritt 4: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartet: Fehler nur noch in `vakanzen/page.tsx` wegen fehlender Props

- [ ] **Schritt 5: Commit**

```bash
git add src/components/ressource-einsetzen-dialog.tsx
git commit -m "feat: replace card list with 4-column table and matchscore in Einreichen modal"
```

---

## Task 5: Props in `vakanzen/page.tsx` übergeben

**Files:**
- Modify: `src/app/vakanzen/page.tsx` (Zeilen 942–950)

- [ ] **Schritt 1: Zwei neue Props beim Dialog-Aufruf ergänzen**

Den `RessourceEinsetzenDialog`-Aufruf (aktuell Zeilen 942–950) anpassen:

```tsx
{ressourceEinsetzenVakanz && (
  <RessourceEinsetzenDialog
    open={ressourceEinsetzenOpen}
    onOpenChange={setRessourceEinsetzenOpen}
    vakanzId={ressourceEinsetzenVakanz.id}
    vakanzTitel={ressourceEinsetzenVakanz.rolle}
    vakanzSkills={ressourceEinsetzenVakanz.skills}
    vakanzErfahrungslevel={ressourceEinsetzenVakanz.erfahrungslevel}
    onSuccess={fetchVakanzen}
  />
)}
```

- [ ] **Schritt 2: TypeScript-Check — jetzt keine Fehler mehr**

```bash
npx tsc --noEmit
```

Erwartet: 0 Fehler

- [ ] **Schritt 3: Alle Tests ausführen**

```bash
npx vitest run
```

Erwartet: alle Tests grün

- [ ] **Schritt 4: Commit**

```bash
git add src/app/vakanzen/page.tsx
git commit -m "feat: pass vakanzSkills and vakanzErfahrungslevel to RessourceEinsetzenDialog"
```

---

## Task 6: Manueller Test + Deploy

- [ ] **Schritt 1: Dev-Server starten**

```bash
npm run dev
```

- [ ] **Schritt 2: Testen**

1. Auf `/vakanzen` navigieren
2. „Ressource einsetzen" an einer Vakanz klicken
3. Modal öffnet sich → Tab „Aus Pool auswählen"
4. Tabelle zeigt 4 Spalten: Name | Rolle | Verfügbar ab | Match
5. Ressourcen sind absteigend nach Match-% sortiert
6. Score-Badge ist grün (≥70 %), gelb (40–69 %) oder rot (<40 %)
7. Bereits eingereichte Ressourcen sind ausgegraut und stehen am Ende
8. Auswählen und Einreichen funktioniert wie bisher

- [ ] **Schritt 3: Deploy**

```bash
git checkout main
git merge master
git push origin main
git checkout master
```
