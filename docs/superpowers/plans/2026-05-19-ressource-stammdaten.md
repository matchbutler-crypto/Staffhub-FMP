# Ressource Stammdaten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wenn eine Pool-Ressource "Beauftragt" wird, sieht die Agentur in ihrer Pool-Seite einen Banner + Badge und kann über ein Modal Stammdaten (Vor-/Nachname, Geburtsdatum etc.) erfassen, die auf der `ressourcen`-Tabelle gespeichert werden.

**Architecture:** 10 neue nullable Spalten auf `ressourcen`. GET `/api/ressourcen` liefert ein `hat_beauftragt_link` Boolean + die neuen Felder im `canSeePrivate`-Block. PUT `/api/ressourcen/[id]` akzeptiert die neuen Felder. Die Pool-Seite berechnet `stammdatenAusstehend` client-seitig und rendert Banner, Badge und Modal.

**Tech Stack:** Next.js 15 App Router, Supabase (server-side + MCP), TypeScript, Zod, shadcn/ui (Dialog, Label, Input, Select), Tailwind CSS

---

## Files

- **DB Migration** — 10 neue Spalten auf `ressourcen` via Supabase MCP
- Modify: `src/app/api/ressourcen/route.ts` — GET: neue Felder + `hat_beauftragt_link`
- Modify: `src/app/api/ressourcen/[id]/route.ts` — PUT: Schema + update erweitern
- Modify: `src/app/pool/page.tsx` — `Ressource`-Interface, Helper, Banner, Badge, Modal

---

### Task 1: DB Migration — 10 neue Spalten auf `ressourcen`

**Files:**
- DB Migration via Supabase MCP (`project_id: vrlbexouqarkpiwpksgl`)

- [ ] **Schritt 1: Migration ausführen**

Führe folgende SQL-Migration via `mcp__supabase__apply_migration` aus:

```sql
ALTER TABLE ressourcen
  ADD COLUMN IF NOT EXISTS nachname text,
  ADD COLUMN IF NOT EXISTS vorname text,
  ADD COLUMN IF NOT EXISTS geburtsdatum date,
  ADD COLUMN IF NOT EXISTS geschlecht text,
  ADD COLUMN IF NOT EXISTS firma text,
  ADD COLUMN IF NOT EXISTS email_geschaeftlich text,
  ADD COLUMN IF NOT EXISTS telefon_geschaeftlich text,
  ADD COLUMN IF NOT EXISTS wohnort text,
  ADD COLUMN IF NOT EXISTS namenszusatz text,
  ADD COLUMN IF NOT EXISTS titel text;
```

Migration name: `add_stammdaten_to_ressourcen`

- [ ] **Schritt 2: Spalten verifizieren**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ressourcen'
  AND column_name IN ('nachname','vorname','geburtsdatum','geschlecht','firma',
                      'email_geschaeftlich','telefon_geschaeftlich','wohnort',
                      'namenszusatz','titel')
ORDER BY column_name;
```

Erwartet: 10 Zeilen, alle `is_nullable = YES`.

- [ ] **Schritt 3: Commit**

```bash
git add -A
git commit -m "feat: add stammdaten columns to ressourcen table"
```

---

### Task 2: GET `/api/ressourcen` — neue Felder + `hat_beauftragt_link`

**Files:**
- Modify: `src/app/api/ressourcen/route.ts`

Kontext: Die Datei hat einen `GET`-Handler. Die SELECT-Query (Zeile ~51) listet Spalten explizit auf. Der `canSeePrivate`-Block (Zeile ~93) verbreitet `ek_tagesrate` und `notizen` nur für berechtigte User. Eine separate Query (Zeile ~74) holt `link_count` via `ressource_vakanz_links`. Wir müssen:
1. Die 10 neuen Spalten zur SELECT-Query hinzufügen
2. Sie im `canSeePrivate`-Block mitliefern
3. Eine parallele Query für Beauftragt-Links hinzufügen und `hat_beauftragt_link` setzen

- [ ] **Schritt 1: SELECT-Query erweitern**

Finde die Zeile:
```typescript
      id, agentur_id, name, rolle, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
```

Ersetze sie durch:
```typescript
      id, agentur_id, name, rolle, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
      nachname, vorname, geburtsdatum, geschlecht, firma,
      email_geschaeftlich, telefon_geschaeftlich, wohnort, namenszusatz, titel,
```

- [ ] **Schritt 2: Beauftragt-Link-Query hinzufügen**

Finde den Block der `linkCountRows` holt (ca. Zeile 74):
```typescript
  const { data: linkCountRows } = await supabase
    .from('ressource_vakanz_links')
    .select('ressource_id')
```

Ersetze ihn durch (beide Queries parallel):
```typescript
  const [{ data: linkCountRows }, { data: beauftragtLinkRows }] = await Promise.all([
    supabase.from('ressource_vakanz_links').select('ressource_id'),
    supabase.from('ressource_vakanz_links').select('ressource_id').eq('status', 'Beauftragt'),
  ])

  const linkCountMap = new Map<string, number>()
  for (const l of (linkCountRows ?? [])) {
    const rid = (l as { ressource_id: string }).ressource_id
    linkCountMap.set(rid, (linkCountMap.get(rid) ?? 0) + 1)
  }

  const beauftragtSet = new Set((beauftragtLinkRows ?? []).map((l) => (l as { ressource_id: string }).ressource_id))
```

Entferne den alten `linkCountMap`-Aufbau der danach stand (die `for`-Schleife) — der ist jetzt im obigen Block enthalten.

- [ ] **Schritt 3: `canSeePrivate`-Block + `hat_beauftragt_link` ergänzen**

Finde den map-Block (ca. Zeile 84):
```typescript
  let result = (data ?? []).map((r) => {
    const { ek_tagesrate, notizen, agenturen, ...rest } = r
    const canSeePrivate = isManager || r.agentur_id === profile.agentur_id
    const agenturEntry = agenturen as { name: string } | { name: string }[] | null
    const agentur_name = Array.isArray(agenturEntry) ? (agenturEntry[0]?.name ?? null) : (agenturEntry?.name ?? null)
    return {
      ...rest,
      agentur_name,
      link_count: linkCountMap.get(r.id) ?? 0,
      ...(canSeePrivate ? { ek_tagesrate, notizen } : {}),
    }
  })
```

Ersetze durch:
```typescript
  let result = (data ?? []).map((r) => {
    const { ek_tagesrate, notizen, nachname, vorname, geburtsdatum, geschlecht,
            firma, email_geschaeftlich, telefon_geschaeftlich, wohnort,
            namenszusatz, titel, agenturen, ...rest } = r
    const canSeePrivate = isManager || r.agentur_id === profile.agentur_id
    const agenturEntry = agenturen as { name: string } | { name: string }[] | null
    const agentur_name = Array.isArray(agenturEntry) ? (agenturEntry[0]?.name ?? null) : (agenturEntry?.name ?? null)
    return {
      ...rest,
      agentur_name,
      link_count: linkCountMap.get(r.id) ?? 0,
      hat_beauftragt_link: beauftragtSet.has(r.id),
      ...(canSeePrivate ? {
        ek_tagesrate, notizen,
        nachname, vorname, geburtsdatum, geschlecht, firma,
        email_geschaeftlich, telefon_geschaeftlich, wohnort,
        namenszusatz, titel,
      } : {}),
    }
  })
```

- [ ] **Schritt 4: TypeScript-Check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Schritt 5: Commit**

```bash
git add src/app/api/ressourcen/route.ts
git commit -m "feat: add stammdaten fields and hat_beauftragt_link to GET /api/ressourcen"
```

---

### Task 3: PUT `/api/ressourcen/[id]` — Schema + Update erweitern

**Files:**
- Modify: `src/app/api/ressourcen/[id]/route.ts`

Kontext: Die Datei hat ein `updateRessourceSchema` (Zod) und einen `PUT`-Handler. Nur Agenturen dürfen updaten (Zeile 84: `if (profile.rolle !== 'Agentur')`). Das `.update()`-Call (Zeile ~97) listet alle Felder explizit auf.

- [ ] **Schritt 1: Zod-Schema erweitern**

Finde `updateRessourceSchema` und füge nach dem `notizen`-Feld die neuen Felder hinzu:

```typescript
const updateRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().max(200).nullable().optional(),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
  // Stammdaten
  nachname: z.string().min(1).max(200).nullable().optional(),
  vorname: z.string().min(1).max(200).nullable().optional(),
  geburtsdatum: z.string().date().nullable().optional(),
  geschlecht: z.enum(['Männlich', 'Weiblich', 'Divers', 'Keine Angabe']).nullable().optional(),
  firma: z.string().min(1).max(200).nullable().optional(),
  email_geschaeftlich: z.string().email('Ungültige E-Mail').nullable().optional(),
  telefon_geschaeftlich: z.string().max(50).nullable().optional(),
  wohnort: z.string().min(1).max(200).nullable().optional(),
  namenszusatz: z.string().max(100).nullable().optional(),
  titel: z.string().max(100).nullable().optional(),
}).refine(
  (d) => d.verfuegbarkeit !== 'Verfügbar ab' || !!d.verfuegbar_ab,
  { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ['verfuegbar_ab'] }
)
```

- [ ] **Schritt 2: `.update()`-Call erweitern**

Finde das `.update({...})`-Call im PUT-Handler und füge die neuen Felder hinzu:

```typescript
    .update({
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: parsed.data.skills,
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab || null,
      ek_tagesrate: parsed.data.ek_tagesrate ?? null,
      notizen: parsed.data.notizen ?? null,
      nachname: parsed.data.nachname ?? null,
      vorname: parsed.data.vorname ?? null,
      geburtsdatum: parsed.data.geburtsdatum ?? null,
      geschlecht: parsed.data.geschlecht ?? null,
      firma: parsed.data.firma ?? null,
      email_geschaeftlich: parsed.data.email_geschaeftlich ?? null,
      telefon_geschaeftlich: parsed.data.telefon_geschaeftlich ?? null,
      wohnort: parsed.data.wohnort ?? null,
      namenszusatz: parsed.data.namenszusatz ?? null,
      titel: parsed.data.titel ?? null,
    })
```

- [ ] **Schritt 3: TypeScript-Check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Schritt 4: Commit**

```bash
git add src/app/api/ressourcen/[id]/route.ts
git commit -m "feat: extend PUT /api/ressourcen/[id] with stammdaten fields"
```

---

### Task 4: Pool-Seite — Interface, Helper, Banner, Badge, Modal

**Files:**
- Modify: `src/app/pool/page.tsx`

Kontext: Die `Ressource`-Interface liegt ca. Zeile 98. Die Pool-Hauptkomponente (ca. Zeile 1829+) hat `ressourcen` State und `fetchRessourcen`. Ressourcen werden ohne `vakanz_id` von `/api/ressourcen` geholt. Die Seite rendert Ressourcenkarten; Badges werden mit `Badge`-Komponente und Tailwind gerendert (Zeile ~1460). Das `Dialog`-Komponente ist bereits importiert.

- [ ] **Schritt 1: `Ressource`-Interface um Stammdaten-Felder erweitern**

Finde `interface Ressource` (ca. Zeile 98) und füge nach `notizen` hinzu:

```typescript
interface Ressource {
  id: string
  agentur_id: string
  name: string
  rolle?: string | null
  skills: string[]
  erfahrungslevel: Erfahrungslevel
  verfuegbarkeit: RessourceVerfuegbarkeit
  verfuegbar_ab?: string | null
  cv_pfad?: string | null
  ek_tagesrate?: number | null
  notizen?: string | null
  link_count?: number
  hat_beauftragt_link?: boolean
  // Stammdaten
  nachname?: string | null
  vorname?: string | null
  geburtsdatum?: string | null
  geschlecht?: string | null
  firma?: string | null
  email_geschaeftlich?: string | null
  telefon_geschaeftlich?: string | null
  wohnort?: string | null
  namenszusatz?: string | null
  titel?: string | null
  created_at: string
  updated_at: string
  agenturen?: { name: string } | null
}
```

- [ ] **Schritt 2: Helper `stammdatenAusstehend` hinzufügen**

Füge nach den `linkStatusColors` (ca. Zeile 754) ein:

```typescript
const PFLICHTFELDER_STAMMDATEN = [
  'nachname', 'vorname', 'geburtsdatum', 'geschlecht',
  'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort',
] as const

function stammdatenAusstehend(r: Ressource): boolean {
  if (!r.hat_beauftragt_link) return false
  return PFLICHTFELDER_STAMMDATEN.some((f) => !r[f])
}
```

- [ ] **Schritt 3: Stammdaten-Modal-Komponente hinzufügen**

Füge vor der Pool-Hauptkomponente (vor `export default function PoolPage`) eine neue Komponente ein:

```typescript
interface StammdatenModalProps {
  ressource: Ressource
  open: boolean
  onClose: () => void
  onSaved: (updated: Partial<Ressource>) => void
}

function StammdatenModal({ ressource, open, onClose, onSaved }: StammdatenModalProps) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    nachname: ressource.nachname ?? '',
    vorname: ressource.vorname ?? '',
    geburtsdatum: ressource.geburtsdatum ?? '',
    geschlecht: ressource.geschlecht ?? '',
    firma: ressource.firma ?? '',
    email_geschaeftlich: ressource.email_geschaeftlich ?? '',
    telefon_geschaeftlich: ressource.telefon_geschaeftlich ?? '',
    wohnort: ressource.wohnort ?? '',
    namenszusatz: ressource.namenszusatz ?? '',
    titel: ressource.titel ?? '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSave() {
    const required = ['nachname', 'vorname', 'geburtsdatum', 'geschlecht', 'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort'] as const
    if (required.some((f) => !form[f].trim())) {
      toast.error('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Bestehende Pflichtfelder der Ressource mitschicken (PUT überschreibt alles)
          name: ressource.name,
          rolle: ressource.rolle ?? null,
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          verfuegbarkeit: ressource.verfuegbarkeit,
          verfuegbar_ab: ressource.verfuegbar_ab ?? null,
          ek_tagesrate: ressource.ek_tagesrate ?? null,
          notizen: ressource.notizen ?? null,
          // Stammdaten
          nachname: form.nachname.trim() || null,
          vorname: form.vorname.trim() || null,
          geburtsdatum: form.geburtsdatum || null,
          geschlecht: form.geschlecht || null,
          firma: form.firma.trim() || null,
          email_geschaeftlich: form.email_geschaeftlich.trim() || null,
          telefon_geschaeftlich: form.telefon_geschaeftlich.trim() || null,
          wohnort: form.wohnort.trim() || null,
          namenszusatz: form.namenszusatz.trim() || null,
          titel: form.titel.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Fehler beim Speichern.')
        return
      }
      onSaved({
        nachname: form.nachname.trim() || null,
        vorname: form.vorname.trim() || null,
        geburtsdatum: form.geburtsdatum || null,
        geschlecht: form.geschlecht || null,
        firma: form.firma.trim() || null,
        email_geschaeftlich: form.email_geschaeftlich.trim() || null,
        telefon_geschaeftlich: form.telefon_geschaeftlich.trim() || null,
        wohnort: form.wohnort.trim() || null,
        namenszusatz: form.namenszusatz.trim() || null,
        titel: form.titel.trim() || null,
      })
      toast.success('Stammdaten gespeichert.')
      onClose()
    } catch {
      toast.error('Verbindungsfehler.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stammdaten erfassen</DialogTitle>
          <DialogDescription>
            Pflichtfelder für <span className="font-medium">{ressource.name}</span> (Beauftragt).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sd-vorname">Vorname <span className="text-destructive">*</span></Label>
            <Input id="sd-vorname" value={form.vorname} onChange={set('vorname')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-nachname">Nachname <span className="text-destructive">*</span></Label>
            <Input id="sd-nachname" value={form.nachname} onChange={set('nachname')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-geburtsdatum">Geburtsdatum <span className="text-destructive">*</span></Label>
            <Input id="sd-geburtsdatum" type="date" value={form.geburtsdatum} onChange={set('geburtsdatum')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-geschlecht">Geschlecht <span className="text-destructive">*</span></Label>
            <select
              id="sd-geschlecht"
              value={form.geschlecht}
              onChange={set('geschlecht')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Bitte wählen</option>
              <option value="Männlich">Männlich</option>
              <option value="Weiblich">Weiblich</option>
              <option value="Divers">Divers</option>
              <option value="Keine Angabe">Keine Angabe</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-namenszusatz">Namenszusatz</Label>
            <Input id="sd-namenszusatz" value={form.namenszusatz} onChange={set('namenszusatz')} placeholder="optional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-titel">Titel</Label>
            <Input id="sd-titel" value={form.titel} onChange={set('titel')} placeholder="optional" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="sd-firma">Firma <span className="text-destructive">*</span></Label>
            <Input id="sd-firma" value={form.firma} onChange={set('firma')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-email">E-Mail geschäftlich <span className="text-destructive">*</span></Label>
            <Input id="sd-email" type="email" value={form.email_geschaeftlich} onChange={set('email_geschaeftlich')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-telefon">Telefon geschäftlich <span className="text-destructive">*</span></Label>
            <Input id="sd-telefon" value={form.telefon_geschaeftlich} onChange={set('telefon_geschaeftlich')} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="sd-wohnort">Wohnort <span className="text-destructive">*</span></Label>
            <Input id="sd-wohnort" value={form.wohnort} onChange={set('wohnort')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Schritt 4: State + Handler für das Modal in der Hauptkomponente hinzufügen**

Finde die Pool-Hauptkomponente (suche nach `const [ressourcen, setRessourcen]`). Füge nach den anderen State-Definitionen hinzu:

```typescript
const [stammdatenModal, setStammdatenModal] = React.useState<Ressource | null>(null)
```

Füge eine Handler-Funktion für gespeicherte Stammdaten hinzu:

```typescript
function handleStammdatenSaved(ressourceId: string, updated: Partial<Ressource>) {
  setRessourcen((prev) =>
    prev.map((r) => r.id === ressourceId ? { ...r, ...updated } : r)
  )
}
```

- [ ] **Schritt 5: Banner hinzufügen**

Finde den Beginn des JSX-Returns in der Hauptkomponente. Füge nach dem öffnenden `<SidebarInset>` / `<main>` Tag (vor der ersten Ressourcenliste) ein:

```typescript
{(() => {
  const count = ressourcen.filter(stammdatenAusstehend).length
  if (count === 0) return null
  return (
    <div className="mx-4 mb-2 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 lg:mx-6">
      <span className="font-medium">⚠ {count} Ressource{count !== 1 ? 'n' : ''} mit Status „Beauftragt" benötigt{count !== 1 ? 'en' : ''} noch Stammdaten.</span>
    </div>
  )
})()}
```

- [ ] **Schritt 6: Badge + Button auf der Ressourcenkarte hinzufügen**

Suche in der Ressourcenlisten-Render-Logik nach dem Block der die Status-Badges rendert (ca. Zeile 1460: `{/* Status badges */}`). Füge nach den bestehenden Badges hinzu:

```typescript
{stammdatenAusstehend(ressource) && (
  <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
    Stammdaten ausstehend
  </span>
)}
```

Füge direkt danach (oder in den Action-Buttons der Karte) einen "Erfassen"-Button ein:

```typescript
{stammdatenAusstehend(ressource) && (
  <Button
    size="sm"
    variant="outline"
    className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
    onClick={() => setStammdatenModal(ressource)}
  >
    Stammdaten erfassen
  </Button>
)}
```

- [ ] **Schritt 7: Modal rendern**

Füge am Ende des JSX-Returns der Hauptkomponente (vor dem letzten schließenden Tag) ein:

```typescript
{stammdatenModal && (
  <StammdatenModal
    ressource={stammdatenModal}
    open={true}
    onClose={() => setStammdatenModal(null)}
    onSaved={(updated) => handleStammdatenSaved(stammdatenModal.id, updated)}
  />
)}
```

- [ ] **Schritt 8: TypeScript-Check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Schritt 9: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: add Stammdaten banner, badge and modal to Pool page"
```

---

### Task 5: Push & manuelle Verifikation

- [ ] **Schritt 1: Push**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git push origin master
```

- [ ] **Schritt 2: Manuelle Verifikation**

1. Als Agentur-User: Pool-Seite öffnen → Banner erscheint wenn eine Ressource Beauftragt ist
2. Badge "Stammdaten ausstehend" auf der Ressourcenkarte sichtbar
3. Button "Stammdaten erfassen" öffnet Modal
4. Pflichtfelder leer lassen → Toast "Bitte alle Pflichtfelder ausfüllen."
5. Alle Felder ausfüllen → Speichern → Badge und Banner verschwinden
6. Seite neu laden → Daten sind gespeichert (pre-filled im Modal)
7. Als Manager: Pool-Seite lädt ohne Fehler (kein Banner — nur für Agenturen relevant)
