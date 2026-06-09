# Ressourcen-Historienfeed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vierter Tab „Historie" in der Ressourcen-Detailansicht, der alle Änderungen als Timeline anzeigt — mit manuellem Notizfeld für Admins/Manager.

**Architecture:** Bestehendes Backend (`ressource_historie` Tabelle, GET/POST API, `logHistorie` helper) wird um automatisches Stammdaten-Tracking erweitert. POST-Endpoint wird auf Manager eingeschränkt. Neue `HistorieTab`-Komponente lädt Einträge parallel zu den anderen Daten.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest, Tailwind CSS, Tabler Icons

---

## Dateiübersicht

| Datei | Aktion | Zweck |
|---|---|---|
| `src/app/api/ressourcen/[id]/historie/route.ts` | Modify | POST auf Manager einschränken |
| `src/app/api/ressourcen/[id]/historie/route.test.ts` | Create | Tests für GET + POST |
| `src/app/api/ressourcen/[id]/route.ts` | Modify | `logHistorie` nach PATCH + PUT ergänzen |
| `src/app/api/ressourcen/[id]/route-stammdaten.test.ts` | Create | Tests für PATCH/PUT mit Historien-Logging |
| `src/app/ressourcen/[id]/page.tsx` | Modify | `HistorieTab` + Daten laden + Tab registrieren |

---

## Task 1: POST-Permission auf Manager einschränken + Test

**Files:**
- Modify: `src/app/api/ressourcen/[id]/historie/route.ts`
- Create: `src/app/api/ressourcen/[id]/historie/route.test.ts`

- [ ] **Step 1.1: Failing-Test schreiben**

Erstelle `src/app/api/ressourcen/[id]/historie/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockProfileSelect,
  mockHistorieSelect,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockHistorieSelect: vi.fn(),
  mockHistorieInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSelect }),
          }),
        }
      }
      if (table === 'ressource_historie') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockHistorieSelect()),
              }),
            }),
          }),
          insert: mockHistorieInsert,
        }
      }
      return {}
    }),
  }),
}))

import { GET, POST } from './route'

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const adminProfile = { rolle: 'Admin', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }

function makeGet(): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1/historie', { method: 'GET' })
}
function makePost(text: string): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1/historie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

describe('GET /api/ressourcen/[id]/historie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt Historieneinträge zurück für Manager', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockHistorieSelect.mockReturnValue({
      data: [{ id: 'h1', typ: 'system', text: 'Stammdaten aktualisiert', created_at: '2026-05-28T10:00:00Z', profiles: { name: 'Max M.', rolle: 'Staffhub Manager' } }],
      error: null,
    })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.historie).toHaveLength(1)
    expect(json.historie[0].typ).toBe('system')
  })

  it('gibt Historieneinträge zurück für Agentur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    mockHistorieSelect.mockReturnValue({ data: [], error: null })
    const res = await GET(makeGet(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/ressourcen/[id]/historie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makePost('Test'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur-Nutzer', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: agenturProfile, error: null })
    const res = await POST(makePost('Test'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
  })

  it('legt manuellen Eintrag für Manager an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await POST(makePost('Kandidat hat zugesagt'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
  })

  it('legt manuellen Eintrag für Admin an', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: adminProfile, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await POST(makePost('Vertrag unterzeichnet'), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(201)
  })

  it('gibt 400 zurück bei leerem Text', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    const res = await POST(makePost(''), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 1.2: Test ausführen und sicherstellen dass er fehlschlägt**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx vitest run src/app/api/ressourcen/\\[id\\]/historie/route.test.ts
```

Erwartet: `FAIL` — der POST-Test für Agentur schlägt fehl, weil der aktuelle Code Agenturen erlaubt.

- [ ] **Step 1.3: POST-Permission in `route.ts` auf Manager einschränken**

Ersetze in `src/app/api/ressourcen/[id]/historie/route.ts` den Agentur-Block:

```typescript
// Vorher (Zeilen 68–77):
// Agentur: only own resources
if (auth.profile.rolle === 'Agentur') {
  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('agentur_id')
    .eq('id', id)
    .single()
  if (!ressource || ressource.agentur_id !== auth.profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
}

// Nachher — ersetzen durch:
const isManager = auth.profile.rolle === 'Admin' || auth.profile.rolle === 'Staffhub Manager'
if (!isManager) {
  return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
}
```

- [ ] **Step 1.4: Tests ausführen — alle grün**

```bash
npx vitest run src/app/api/ressourcen/\\[id\\]/historie/route.test.ts
```

Erwartet: alle Tests `PASS`

- [ ] **Step 1.5: Commit**

```bash
git add src/app/api/ressourcen/\[id\]/historie/route.ts src/app/api/ressourcen/\[id\]/historie/route.test.ts
git commit -m "fix: restrict manual history POST to managers only + add tests"
```

---

## Task 2: `logHistorie` nach PATCH (Stammdaten) + Test

**Files:**
- Modify: `src/app/api/ressourcen/[id]/route.ts`
- Create: `src/app/api/ressourcen/[id]/route-stammdaten.test.ts`

- [ ] **Step 2.1: Failing-Test schreiben**

Erstelle `src/app/api/ressourcen/[id]/route-stammdaten.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourceSelect,
  mockRessourceUpdate,
  mockHistorieInsert,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockRessourceUpdate: vi.fn(),
  mockHistorieInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSelect }),
          }),
        }
      }
      if (table === 'ressourcen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockRessourceSelect }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockRessourceUpdate }),
            }),
          }),
        }
      }
      if (table === 'ressource_historie') {
        return { insert: mockHistorieInsert }
      }
      return {}
    }),
  }),
}))

import { PATCH, PUT } from './route'

const managerProfile = { rolle: 'Staffhub Manager', aktiv: true, agentur_id: null }
const agenturProfile = { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' }
const ressource = { id: 'res-1', agentur_id: 'ag-1' }

function makePatch(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function makePut(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/ressourcen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück für Agentur mit fremder Ressource', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { ...agenturProfile, agentur_id: 'ag-2' }, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(403)
  })

  it('aktualisiert Stammdaten und schreibt Historieneintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockRessourceUpdate.mockResolvedValue({ data: { id: 'res-1', vorname: 'Max' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PATCH(makePatch({ vorname: 'Max' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
    expect(mockHistorieInsert).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Stammdaten aktualisiert', typ: 'system' })
    )
  })
})

describe('PUT /api/ressourcen/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aktualisiert Stammdaten und schreibt Historieneintrag', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: managerProfile, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockRessourceUpdate.mockResolvedValue({ data: { id: 'res-1', vorname: 'Max' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })

    const res = await PUT(makePut({ vorname: 'Max', nachname: 'M.' }), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    expect(mockHistorieInsert).toHaveBeenCalledOnce()
    expect(mockHistorieInsert).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Stammdaten aktualisiert', typ: 'system' })
    )
  })
})
```

- [ ] **Step 2.2: Test ausführen — muss fehlschlagen**

```bash
npx vitest run src/app/api/ressourcen/\\[id\\]/route-stammdaten.test.ts
```

Erwartet: `FAIL` — `mockHistorieInsert` wird nicht aufgerufen, weil der Code noch kein `logHistorie` enthält.

- [ ] **Step 2.3: `logHistorie` import + call in `route.ts` ergänzen**

**Import hinzufügen** (Zeile 3, nach den bestehenden Imports):
```typescript
import { logHistorie } from '@/lib/log-historie'
```

**In der `PATCH`-Funktion** — nach `if (error) { return ... }` und vor `return NextResponse.json(data)` (aktuell Zeile 342):
```typescript
    if (error) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 400 })
    }

    // Historie-Eintrag nach erfolgreichem Update
    await logHistorie({
      ressourceId: id,
      text: 'Stammdaten aktualisiert',
      typ: 'system',
      erstelltVon: user.id,
      supabase,
    })

    return NextResponse.json(data)
```

- [ ] **Step 2.4: Tests ausführen — alle grün**

```bash
npx vitest run src/app/api/ressourcen/\\[id\\]/route-stammdaten.test.ts
```

Erwartet: alle Tests `PASS`

- [ ] **Step 2.5: Commit**

```bash
git add src/app/api/ressourcen/\[id\]/route.ts src/app/api/ressourcen/\[id\]/route-stammdaten.test.ts
git commit -m "feat: log history entry after stammdaten PATCH update"
```

---

## Task 3: `logHistorie` nach PUT (vollständige Bearbeitung)

**Files:**
- Modify: `src/app/api/ressourcen/[id]/route.ts`

Die Tests aus Task 2 decken bereits PUT ab — kein neues Test-File nötig.

- [ ] **Step 3.1: Test für PUT ausführen — muss noch fehlschlagen**

```bash
npx vitest run src/app/api/ressourcen/\\[id\\]/route-stammdaten.test.ts --reporter=verbose 2>&1 | grep "PUT"
```

Erwartet: `FAIL` für den PUT-Test (PUT hat noch kein logHistorie).

- [ ] **Step 3.2: `logHistorie` call in der `PUT`-Funktion ergänzen**

In `src/app/api/ressourcen/[id]/route.ts` — in der `PUT`-Funktion nach `if (error) { return ... }` und vor `return NextResponse.json(data)` (aktuell nach Zeile 272):

```typescript
    if (error) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 400 })
    }

    // Historie-Eintrag nach erfolgreichem Update
    await logHistorie({
      ressourceId: id,
      text: 'Stammdaten aktualisiert',
      typ: 'system',
      erstelltVon: user.id,
      supabase,
    })

    return NextResponse.json(data)
```

**Hinweis:** `user` ist in der PUT-Funktion bereits aus `supabase.auth.getUser()` verfügbar (Zeile ~228).

- [ ] **Step 3.3: Alle Stammdaten-Tests ausführen — alle grün**

```bash
npx vitest run src/app/api/ressourcen/\\[id\\]/route-stammdaten.test.ts
```

Erwartet: alle Tests `PASS`

- [ ] **Step 3.4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Step 3.5: Commit**

```bash
git add src/app/api/ressourcen/\[id\]/route.ts
git commit -m "feat: log history entry after stammdaten PUT update"
```

---

## Task 4: `HistorieTab` UI-Komponente + Datenladen + Tab registrieren

**Files:**
- Modify: `src/app/ressourcen/[id]/page.tsx`

- [ ] **Step 4.1: `HistorieEintrag`-Interface ergänzen**

In `src/app/ressourcen/[id]/page.tsx` — nach dem `Zeitnachweis`-Interface (nach Zeile ~93):

```typescript
interface HistorieEintrag {
  id: string
  typ: 'system' | 'manuell'
  text: string
  created_at: string
  profiles: { id: string; name: string; rolle: string } | null
}
```

- [ ] **Step 4.2: State + paralleler Fetch in `loadData` ergänzen**

In der Hauptkomponente den State ergänzen (nach `const [zeitnachweise, ...]`):

```typescript
const [historie, setHistorie] = React.useState<HistorieEintrag[]>([])
```

Und `loadData` so erweitern:

```typescript
const loadData = React.useCallback(async () => {
  if (!params.id) return
  try {
    const [ressourceRes, zeitnachweiseRes, historieRes] = await Promise.all([
      fetch(`/api/ressourcen/${params.id}`),
      fetch(`/api/ressourcen/${params.id}/zeitnachweise`),
      fetch(`/api/ressourcen/${params.id}/historie`),
    ])
    if (ressourceRes.ok) setRessource(await ressourceRes.json())
    if (zeitnachweiseRes.ok) setZeitnachweise(await zeitnachweiseRes.json())
    if (historieRes.ok) {
      const json = await historieRes.json()
      setHistorie(json.historie ?? [])
    }
  } catch {
    toast.error("Fehler beim Laden der Daten")
  } finally {
    setLoading(false)
  }
}, [params.id])
```

- [ ] **Step 4.3: `HistorieTab`-Komponente schreiben**

Füge die Komponente **vor** `ZeitnachweisTab` ein:

```typescript
function HistorieTab({
  eintraege,
  isManager,
  ressourceId,
  onEintragAdded,
}: {
  eintraege: HistorieEintrag[]
  isManager: boolean
  ressourceId: string
  onEintragAdded: () => void
}) {
  const [notiz, setNotiz] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const handleSubmit = async () => {
    if (!notiz.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/historie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: notiz.trim() }),
      })
      if (!res.ok) throw new Error()
      setNotiz("")
      toast.success("Notiz gespeichert")
      onEintragAdded()
    } catch {
      toast.error("Fehler beim Speichern der Notiz")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {isManager && (
        <div className="space-y-2">
          <Textarea
            placeholder="Manuelle Notiz hinzufügen…"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!notiz.trim() || saving}
              onClick={handleSubmit}
            >
              {saving ? (
                <IconLoader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <IconCheck className="h-4 w-4 mr-1.5" />
              )}
              Notiz speichern
            </Button>
          </div>
        </div>
      )}

      {eintraege.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center text-muted-foreground">
          Noch keine Einträge vorhanden.
        </div>
      ) : (
        <div className="relative space-y-0">
          {eintraege.map((e, i) => (
            <div key={e.id} className="flex gap-3">
              {/* Timeline-Linie + Punkt */}
              <div className="flex flex-col items-center">
                <div
                  className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                    e.typ === "manuell" ? "bg-foreground" : "bg-muted-foreground/50"
                  }`}
                />
                {i < eintraege.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1" />
                )}
              </div>

              {/* Inhalt */}
              <div className={`pb-5 flex-1 ${i === eintraege.length - 1 ? "pb-0" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {e.typ === "manuell" && (
                      <IconPencil className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <p className="text-sm text-foreground leading-snug">{e.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap flex-shrink-0">
                    {new Date(e.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
                {e.profiles && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.profiles.name} · {e.profiles.rolle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.4: Tab registrieren und `HistorieTab` einbinden**

Suche die Tabs-Definition (enthält `stammdaten`, `beauftragungen`, `zeitnachweise`) und füge `historie` als vierten Tab hinzu.

Tabs-Array:
```typescript
// vorher:
const tabs = [
  { id: "stammdaten", label: "Stammdaten", icon: IconUser },
  { id: "beauftragungen", label: "Beauftragungen", icon: IconBriefcase },
  { id: "zeitnachweise", label: "Zeitnachweise", icon: IconClock },
]

// nachher:
const tabs = [
  { id: "stammdaten", label: "Stammdaten", icon: IconUser },
  { id: "beauftragungen", label: "Beauftragungen", icon: IconBriefcase },
  { id: "zeitnachweise", label: "Zeitnachweise", icon: IconClock },
  { id: "historie", label: "Historie", icon: IconHistory },
]
```

`IconHistory` aus `@tabler/icons-react` importieren — Importzeile ergänzen:
```typescript
import {
  IconArrowLeft,
  IconBriefcase,
  IconCheck,
  IconClock,
  IconDownload,
  IconHistory,   // ← neu
  IconLoader2,
  IconMapPin,
  IconPencil,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react"
```

`TabsContent` für Historie einfügen (nach dem Zeitnachweis-Block):
```tsx
<TabsContent value="historie" className="mt-0 focus-visible:outline-none">
  <HistorieTab
    eintraege={historie}
    isManager={isManager}
    ressourceId={ressource.id}
    onEintragAdded={loadData}
  />
</TabsContent>
```

- [ ] **Step 4.5: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Step 4.6: Lokal testen**

Dev-Server läuft auf `http://localhost:3000`. Prüfe:
1. Tab „Historie" erscheint als vierter Tab
2. Als Manager: Textarea + „Notiz speichern"-Button sichtbar
3. Als Agentur: kein Eingabefeld
4. Nach Stammdaten speichern: neuer System-Eintrag erscheint in der Timeline
5. Manuell gespeicherte Notiz erscheint mit Stift-Icon

- [ ] **Step 4.7: Commit**

```bash
git add src/app/ressourcen/\[id\]/page.tsx
git commit -m "feat: add Historie tab to resource detail view with timeline and manual notes"
```

---

## Task 5: Alle Tests + Push

- [ ] **Step 5.1: Vollständige Test-Suite ausführen**

```bash
npx vitest run
```

Erwartet: alle Tests `PASS`, keine Fehler

- [ ] **Step 5.2: Push zu Vercel**

```bash
git push origin master
```
