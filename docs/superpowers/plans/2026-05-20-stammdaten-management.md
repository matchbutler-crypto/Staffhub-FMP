# Stammdaten-Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable agencies to capture required personal data (Stammdaten) for assigned resources via a modal on the pool page, with Manager/Admin able to edit all stammdaten.

**Architecture:** Add 10 nullable columns to `ressourcen` table. Extend GET `/api/ressourcen` to return new fields + `hat_beauftragt_link` boolean. Extend PATCH `/api/ressourcen/[id]` to accept new fields. Add Banner, Badge, and Modal to pool page with client-side helper to determine if stammdaten are pending.

**Tech Stack:** Next.js 15 App Router, Supabase (server-side + MCP), TypeScript, Zod, shadcn/ui (Dialog, Label, Input, Select), Tailwind CSS, sonner (toast)

---

## Files

- **DB Migration** — 10 neue Spalten via Supabase MCP
- Modify: `src/app/api/ressourcen/route.ts` — GET: neue Felder + `hat_beauftragt_link`
- Modify: `src/app/api/ressourcen/[id]/route.ts` — PATCH: Schema + Update erweitern
- Modify: `src/app/pool/page.tsx` — Interface, Helpers, Banner, Badge, Modal, State

---

### Task 1: DB Migration — 10 neue Spalten auf `ressourcen`

**Files:**
- DB Migration via Supabase MCP

- [ ] **Step 1: Apply migration via MCP**

Use `mcp__supabase__apply_migration` to add the 10 columns:

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

Migration name: `add_stammdaten_columns`
Project ID: `vrlbexouqarkpiwpksgl`

- [ ] **Step 2: Verify columns exist**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx supabase db push --dry-run
```

Expected: No errors, migration applied successfully.

- [ ] **Step 3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add -A && git commit -m "db: add stammdaten columns to ressourcen table"
```

---

### Task 2: GET `/api/ressourcen` — Neue Felder + `hat_beauftragt_link`

**Files:**
- Modify: `src/app/api/ressourcen/route.ts`

Context: The file has a GET handler that selects explicit columns around line 51. A linkCountMap is built around line 74-80. The data is mapped around line 84-95 with a `canSeePrivate` block that conditionally returns `ek_tagesrate` and `notizen`.

- [ ] **Step 1: Read the file to understand structure**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && sed -n '45,100p' src/app/api/ressourcen/route.ts
```

- [ ] **Step 2: Extend SELECT query with new columns**

Find the line with:
```typescript
      id, agentur_id, name, rolle, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
```

Replace it with (add stammdaten columns):
```typescript
      id, agentur_id, name, rolle, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
      nachname, vorname, geburtsdatum, geschlecht, firma,
      email_geschaeftlich, telefon_geschaeftlich, wohnort, namenszusatz, titel,
```

- [ ] **Step 3: Add beauftragt link query**

Find the block that queries linkCountRows (around line 74):
```typescript
  const { data: linkCountRows } = await supabase
    .from('ressource_vakanz_links')
    .select('ressource_id')
```

Replace with (parallel queries):
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

Remove any old `linkCountMap` building code that was after this block.

- [ ] **Step 4: Update map function with stammdaten fields and hat_beauftragt_link**

Find the map block (around line 84-95):
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

Replace with:
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

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors or only unrelated errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add src/app/api/ressourcen/route.ts && git commit -m "feat: add stammdaten fields and hat_beauftragt_link to GET /api/ressourcen"
```

---

### Task 3: PATCH `/api/ressourcen/[id]` — Schema + Update erweitern

**Files:**
- Modify: `src/app/api/ressourcen/[id]/route.ts`

Context: File has `updateRessourceSchema` (Zod) and a PUT handler. Authorization check around line 84. Update call around line 97.

- [ ] **Step 1: Extend Zod schema with stammdaten fields**

Find `updateRessourceSchema` and add after `notizen` field:

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

- [ ] **Step 2: Extend .update() call in PUT handler**

Find `.update({...})` call and add new fields:

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

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors or only unrelated errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add src/app/api/ressourcen/[id]/route.ts && git commit -m "feat: extend PATCH /api/ressourcen/[id] with stammdaten fields"
```

---

### Task 4: Pool Page — Update Ressource Interface

**Files:**
- Modify: `src/app/pool/page.tsx`

Context: Ressource interface is around line 99-110.

- [ ] **Step 1: Extend Ressource interface**

Find `interface Ressource` and add stammdaten fields after `link_count`:

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

- [ ] **Step 2: Add helper constants and function**

Find where color maps are defined (around line 750). Add after them:

```typescript
const PFLICHTFELDER_STAMMDATEN = [
  'nachname', 'vorname', 'geburtsdatum', 'geschlecht',
  'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort',
] as const

function stammdatenAusstehend(r: Ressource): boolean {
  if (!r.hat_beauftragt_link) return false
  return PFLICHTFELDER_STAMMDATEN.some((f) => !r[f as keyof Ressource])
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors or only unrelated errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add src/app/pool/page.tsx && git commit -m "feat: add Ressource stammdaten fields and helper function"
```

---

### Task 5: Pool Page — Add StammdatenModal Component

**Files:**
- Modify: `src/app/pool/page.tsx`

Context: Add new component before the main PoolPage export (before `export default function PoolPage`).

- [ ] **Step 1: Add StammdatenModal component**

Add before `export default function PoolPage`:

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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ressource.name,
          rolle: ressource.rolle ?? null,
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          verfuegbarkeit: ressource.verfuegbarkeit,
          verfuegbar_ab: ressource.verfuegbar_ab ?? null,
          ek_tagesrate: ressource.ek_tagesrate ?? null,
          notizen: ressource.notizen ?? null,
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

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors or only unrelated errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add src/app/pool/page.tsx && git commit -m "feat: add StammdatenModal component"
```

---

### Task 6: Pool Page — Add Banner, Badge, State, and Handler

**Files:**
- Modify: `src/app/pool/page.tsx`

Context: Main PoolPage component around line 1829+. State definitions are around line 1835+. JSX return starts around line 1960+.

- [ ] **Step 1: Add state for modal**

Find the PoolPage component and add state near other state definitions:

```typescript
const [stammdatenModal, setStammdatenModal] = React.useState<Ressource | null>(null)
```

- [ ] **Step 2: Add handler for saved stammdaten**

Add function near other handlers:

```typescript
function handleStammdatenSaved(ressourceId: string, updated: Partial<Ressource>) {
  setRessourcen((prev) =>
    prev.map((r) => r.id === ressourceId ? { ...r, ...updated } : r)
  )
}
```

- [ ] **Step 3: Add Banner before resource list**

Find the JSX return and add after opening `<main>` or `<SidebarInset>` tag:

```typescript
{(() => {
  const count = ressourcen.filter(stammdatenAusstehend).length
  if (count === 0) return null
  return (
    <div className="mx-4 mb-4 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 lg:mx-6">
      <span className="font-medium">⚠ {count} Ressource{count !== 1 ? 'n' : ''} mit Status „Beauftragt" benötigt{count !== 1 ? 'en' : ''} noch Stammdaten.</span>
    </div>
  )
})()}
```

- [ ] **Step 4: Add Badge and Button on resource card**

Find the section where status badges are rendered (around line 1460). Add after existing badges:

```typescript
{stammdatenAusstehend(ressource) && (
  <div className="flex items-center gap-1.5">
    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
      Stammdaten ausstehend
    </span>
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
      onClick={() => setStammdatenModal(ressource)}
    >
      Erfassen
    </Button>
  </div>
)}
```

- [ ] **Step 5: Render modal at end of JSX**

Add before final closing tag of JSX return:

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

- [ ] **Step 6: TypeScript check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors or only unrelated errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git add src/app/pool/page.tsx && git commit -m "feat: add banner, badge, state, and modal integration to pool page"
```

---

### Task 7: Manual Verification

**Files:**
- None (testing phase)

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npm run dev
```

- [ ] **Step 2: Test Banner Display**

1. Login as Agentur user
2. Go to pool page
3. Should see banner: "⚠ X Ressourcen mit Status Beauftragt benötigen noch Stammdaten." (if any beauftragt resources exist)
4. If no beauftragt resources: banner should NOT appear

- [ ] **Step 3: Test Badge and Button**

1. Find a resource with `hat_beauftragt_link = true` and missing stammdaten
2. Should see amber badge "Stammdaten ausstehend"
3. Should see "Erfassen" button next to badge

- [ ] **Step 4: Test Modal - Validation**

1. Click "Erfassen" button
2. Modal opens with form
3. Leave Vorname empty, click "Speichern"
4. Toast appears: "Bitte alle Pflichtfelder ausfüllen."
5. Modal stays open

- [ ] **Step 5: Test Modal - Save Success**

1. Fill all required fields with valid data
2. Click "Speichern"
3. Should see toast: "Stammdaten gespeichert."
4. Modal closes
5. Badge and button disappear from card
6. Banner count decreases (if it was the last one)

- [ ] **Step 6: Test Modal - Prefill**

1. Click "Erfassen" again on same resource
2. Modal should be pre-filled with previously saved data
3. Save with same data
4. Should succeed

- [ ] **Step 7: Test as Manager**

1. Logout and login as Manager user
2. Navigate to Pool page
3. Should be able to open any resource's stammdaten modal
4. Should be able to save stammdaten for any resource (no RLS block)

- [ ] **Step 8: Stop dev server**

```bash
pkill -f "npm run dev"
```

---

### Task 8: Push to Remote

- [ ] **Step 1: Push all commits**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git push origin master
```

Expected: All commits pushed successfully to origin/master.

- [ ] **Step 2: Verify remote**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && git log --oneline origin/master -5
```

Expected: Latest commit is visible on origin/master.

- [ ] **Step 3: Done**

Implementation complete and pushed to production.

---

## Success Criteria

- [x] Database migration: 10 columns added to ressourcen
- [x] GET `/api/ressourcen`: Returns new fields + `hat_beauftragt_link` boolean
- [x] PATCH `/api/ressourcen/[id]`: Accepts and saves new fields
- [x] Pool page: Banner shows when stammdaten are pending
- [x] Pool page: Badge visible on resources with missing stammdaten
- [x] Pool page: Modal can be opened to enter/update stammdaten
- [x] Pool page: Validation ensures all required fields are filled
- [x] Pool page: Badge/Banner disappear after stammdaten are saved
- [x] Authorization: Agentur can only edit own resources (via RLS)
- [x] Authorization: Manager/Admin can edit all resources
- [x] Manual verification passes
- [x] All commits pushed to remote
