# Feature Toggles per Agentur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kann Features pro Agentur aktivieren/deaktivieren; Agentur-User sehen nur freigegebene Features; optionale Release Note beim Aktivieren erscheint als Badge-Notification.

**Architecture:** JSONB-Spalte `features` auf `agenturen`-Tabelle speichert Feature-State. `feature_key`-Spalte auf `release_notes` verknüpft Notifications mit Features. `UserContext` lädt Features beim Login, `useFeatures()`-Hook steuert Sichtbarkeit in UI und Seiten.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + RLS), TypeScript, Zod, shadcn/ui, Tabler Icons

## Global Constraints

- Supabase-Client: `@/lib/supabase/server` für Server-Komponenten/API-Routen, `@/lib/supabase` (client) für Client-Komponenten
- Alle Admin-API-Routen prüfen Rolle `Admin` oder `Staffhub Manager` via `requireAdmin()`
- Zod für alle Eingabe-Validierungen
- Kein Breaking Change an bestehenden API-Routen — alle neuen Felder optional
- Feature-Keys als TypeScript-`const`-Array in `src/lib/features.ts` — einzige Source of Truth
- Für Nicht-Agentur-Rollen (Admin, Staffhub Manager, Controller): alle Features immer aktiv
- Hard-Hide: deaktiviertes Feature → client-seitiger Redirect auf `/dashboard`

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `migrations/010_feature_toggles.sql` | Neu | `features JSONB` auf `agenturen`, `feature_key TEXT` auf `release_notes` |
| `src/lib/features.ts` | Neu | `FEATURE_KEYS`, `FEATURE_META` — zentrale Definitionen |
| `src/context/user-context.tsx` | Ändern | `UserProfile.features` laden aus `agenturen.features` |
| `src/hooks/use-features.ts` | Neu | `useFeatures()` Hook — `enabled(key)` Hilfsfunktion |
| `src/app/api/admin/agenturen/[id]/route.ts` | Ändern | PATCH akzeptiert `features` Feld |
| `src/app/api/admin/agenturen/route.ts` | Ändern | POST akzeptiert optionales `features` Feld |
| `src/app/api/admin/release-notes/route.ts` | Neu | Admin erstellt Release Note mit `feature_key` |
| `src/app/api/release-notes/route.ts` | Ändern | GET filtert Notes nach `feature_key` für Agentur-User |
| `src/app/api/release-notes/unread-count/route.ts` | Ändern | Count filtert nach `feature_key` für Agentur-User |
| `src/components/app-sidebar.tsx` | Ändern | Feature-gated Nav-Items für Agentur |
| `src/app/admin/page.tsx` | Ändern | Feature-Toggles-Tab + `FeatureToggleSheet` + `NeueAgenturSheet`-Update |
| `src/app/pool/page.tsx` | Ändern | Client-seitiger Redirect wenn `mein_pool` deaktiviert |

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/010_feature_toggles.sql`

**Interfaces:**
- Produces: `agenturen.features JSONB`, `release_notes.feature_key TEXT`

- [ ] **Step 1: Migration schreiben**

```sql
-- migrations/010_feature_toggles.sql

-- Feature-State pro Agentur (leeres Objekt = alle Features deaktiviert)
ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';

-- Feature-Key auf bestehender release_notes-Tabelle (nullable = kein Feature-Gate)
ALTER TABLE release_notes
  ADD COLUMN IF NOT EXISTS feature_key TEXT;

-- Index für Feature-Key-Abfragen
CREATE INDEX IF NOT EXISTS idx_release_notes_feature_key
  ON release_notes(feature_key)
  WHERE feature_key IS NOT NULL;
```

- [ ] **Step 2: Migration in Supabase ausführen**

SQL-Editor in Supabase Dashboard öffnen → Migration einfügen → ausführen.

Prüfen:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agenturen' AND column_name = 'features';
-- Erwartung: 1 Zeile, data_type = 'jsonb'

SELECT column_name FROM information_schema.columns
WHERE table_name = 'release_notes' AND column_name = 'feature_key';
-- Erwartung: 1 Zeile
```

- [ ] **Step 3: Commit**

```bash
git add migrations/010_feature_toggles.sql
git commit -m "feat: migration für feature_toggles — features auf agenturen, feature_key auf release_notes"
```

---

## Task 2: Feature-Definitionen

**Files:**
- Create: `src/lib/features.ts`

**Interfaces:**
- Produces:
  - `FEATURE_KEYS: readonly ['mein_pool', 'abrechnung_agentur']`
  - `type FeatureKey = 'mein_pool' | 'abrechnung_agentur'`
  - `FEATURE_META: Record<FeatureKey, { label: string; beschreibung: string; navUrl?: string }>`

- [ ] **Step 1: `src/lib/features.ts` anlegen**

```ts
export const FEATURE_KEYS = ['mein_pool', 'abrechnung_agentur'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; beschreibung: string; navUrl?: string }
> = {
  mein_pool: {
    label: 'Mein Pool',
    beschreibung: 'Ressourcen-Pool — eigene Kandidaten verwalten und zuweisen.',
    navUrl: '/pool',
  },
  abrechnung_agentur: {
    label: 'Abrechnung',
    beschreibung: 'Abrechnungs-Modul — Zeitnachweise und Rechnungen einsehen.',
    navUrl: '/abrechnung',
  },
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features.ts
git commit -m "feat: FEATURE_KEYS und FEATURE_META definiert"
```

---

## Task 3: UserContext erweitern + useFeatures Hook

**Files:**
- Modify: `src/context/user-context.tsx`
- Create: `src/hooks/use-features.ts`

**Interfaces:**
- Consumes: `FeatureKey` aus `src/lib/features.ts`
- Produces:
  - `UserProfile.features: Record<string, boolean>`
  - `useFeatures(): { enabled: (key: FeatureKey) => boolean }`

- [ ] **Step 1: `UserProfile` Interface erweitern**

In `src/context/user-context.tsx` das Interface ändern:

```ts
export interface UserProfile {
  id: string
  name: string
  email: string
  rolle: Rolle
  agentur_id: string | null
  aktiv: boolean
  features: Record<string, boolean>
}
```

- [ ] **Step 2: `loadProfile` anpassen — Features aus `agenturen` laden**

In `src/context/user-context.tsx` die `loadProfile`-Funktion ersetzen:

```ts
async function loadProfile() {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    setUser(null)
    setLoading(false)
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, rolle, agentur_id, aktiv')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    setUser(null)
    setLoading(false)
    return
  }

  let features: Record<string, boolean> = {}
  if (profile.agentur_id) {
    const { data: agentur } = await supabase
      .from('agenturen')
      .select('features')
      .eq('id', profile.agentur_id)
      .single()
    features = (agentur?.features as Record<string, boolean>) ?? {}
  }

  setUser({ ...(profile as Omit<UserProfile, 'features'>), features })
  setLoading(false)
}
```

- [ ] **Step 3: `use-features.ts` anlegen**

```ts
// src/hooks/use-features.ts
'use client'

import { useUser } from '@/context/user-context'
import type { FeatureKey } from '@/lib/features'

export function useFeatures() {
  const { user } = useUser()

  function enabled(key: FeatureKey): boolean {
    if (!user) return false
    if (user.rolle !== 'Agentur') return true
    return user.features?.[key] === true
  }

  return { enabled }
}
```

- [ ] **Step 4: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/context/user-context.tsx src/hooks/use-features.ts
git commit -m "feat: UserProfile.features laden, useFeatures Hook"
```

---

## Task 4: API — PATCH Agenturen (features-Feld)

**Files:**
- Modify: `src/app/api/admin/agenturen/[id]/route.ts`

**Interfaces:**
- Consumes: `FEATURE_KEYS` aus `src/lib/features.ts`
- Produces: `PATCH /api/admin/agenturen/:id` akzeptiert `{ features: Record<FeatureKey, boolean> }`

- [ ] **Step 1: Schema und Route erweitern**

`src/app/api/admin/agenturen/[id]/route.ts` komplett ersetzen:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_KEYS } from '@/lib/features'

const featureRecord = z.record(
  z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
  z.boolean()
)

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  kontakt_email: z.string().email().optional(),
  features: featureRecord.optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager')) return null
  return user
}

// ── PATCH /api/admin/agenturen/[id] ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.kontakt_email !== undefined) updateData.kontakt_email = parsed.data.kontakt_email
  if (parsed.data.features !== undefined) updateData.features = parsed.data.features

  const { data, error } = await supabase
    .from('agenturen')
    .update(updateData)
    .eq('id', id)
    .select('id, name, kontakt_email, features')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ agentur: data })
}

// ── DELETE /api/admin/agenturen/[id] ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('agentur_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Agentur hat noch zugeordnete Benutzer und kann nicht gelöscht werden.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('agenturen').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manuell testen**

```bash
curl -X PATCH http://localhost:3000/api/admin/agenturen/<ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"features": {"mein_pool": true}}'
# Erwartung: { "agentur": { "id": "...", "features": { "mein_pool": true } } }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/agenturen/[id]/route.ts
git commit -m "feat: PATCH agenturen/:id akzeptiert features-Feld"
```

---

## Task 5: API — Admin Release Notes erstellen

**Files:**
- Create: `src/app/api/admin/release-notes/route.ts`

**Interfaces:**
- Consumes: `FEATURE_KEYS` aus `src/lib/features.ts`
- Produces: `POST /api/admin/release-notes` → erstellt Release Note mit `feature_key`

- [ ] **Step 1: Route anlegen**

```ts
// src/app/api/admin/release-notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_KEYS } from '@/lib/features'

const schema = z.object({
  feature_key: z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
  titel: z.string().min(1).max(200),
  beschreibung: z.string().optional(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager')) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('release_notes')
    .insert({
      feature_key: parsed.data.feature_key,
      title: parsed.data.titel,
      body: parsed.data.beschreibung ?? '',
      roles: ['Agentur'],
      datum: parsed.data.datum ?? today,
    })
    .select('id, feature_key, title, body, datum')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 })
  }

  return NextResponse.json({ release_note: data }, { status: 201 })
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/release-notes/route.ts
git commit -m "feat: POST /api/admin/release-notes Route"
```

---

## Task 6: Release-Notes API — feature_key-Filter

**Files:**
- Modify: `src/app/api/release-notes/route.ts`
- Modify: `src/app/api/release-notes/unread-count/route.ts`

**Interfaces:**
- Consumes: `agenturen.features` via Supabase-Join auf `profiles.agentur_id`
- Produces: Notes gefiltert nach aktivierten Features für Agentur-User

- [ ] **Step 1: `GET /api/release-notes` anpassen**

`src/app/api/release-notes/route.ts` ersetzen:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfileWithFeatures(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null, features: {} }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { user, profile: null, features: {} }

  let features: Record<string, boolean> = {}
  if (profile.agentur_id) {
    const { data: agentur } = await supabase
      .from('agenturen')
      .select('features')
      .eq('id', profile.agentur_id)
      .single()
    features = (agentur?.features as Record<string, boolean>) ?? {}
  }

  return { user, profile, features }
}

export async function GET() {
  const supabase = await createClient()
  const { user, profile, features } = await getProfileWithFeatures(supabase)
  if (!profile?.aktiv || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const rolle = profile.rolle as string
  const isInternal = ['Admin', 'Staffhub Manager', 'Controller'].includes(rolle)

  let query = supabase
    .from('release_notes')
    .select('id, datum, title, body, roles, feature_key, created_at')
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isInternal) {
    query = query.contains('roles', [rolle])
  }

  const { data: notes, error } = await query
  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  if (!notes || notes.length === 0) return NextResponse.json({ notes: [] })

  // Für Agentur: Notes mit feature_key nur zeigen wenn Feature aktiviert
  const filtered = isInternal
    ? notes
    : notes.filter((n) => !n.feature_key || features[n.feature_key] === true)

  if (filtered.length === 0) return NextResponse.json({ notes: [] })

  const noteIds = filtered.map((n) => n.id)
  const { data: reads } = await supabase
    .from('release_note_reads')
    .select('note_id')
    .eq('user_id', user.id)
    .in('note_id', noteIds)

  const readSet = new Set((reads ?? []).map((r) => r.note_id))

  return NextResponse.json({
    notes: filtered.map((n) => ({ ...n, is_read: readSet.has(n.id) })),
  })
}
```

- [ ] **Step 2: `GET /api/release-notes/unread-count` anpassen**

`src/app/api/release-notes/unread-count/route.ts` ersetzen:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ count: 0 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) return NextResponse.json({ count: 0 })

  const rolle = profile.rolle as string
  const isInternal = ['Admin', 'Staffhub Manager', 'Controller'].includes(rolle)

  let features: Record<string, boolean> = {}
  if (!isInternal && profile.agentur_id) {
    const { data: agentur } = await supabase
      .from('agenturen')
      .select('features')
      .eq('id', profile.agentur_id)
      .single()
    features = (agentur?.features as Record<string, boolean>) ?? {}
  }

  let query = supabase
    .from('release_notes')
    .select('id, feature_key')

  if (!isInternal) {
    query = query.contains('roles', [rolle])
  }

  const { data: notes } = await query
  if (!notes || notes.length === 0) return NextResponse.json({ count: 0 })

  const visibleNotes = isInternal
    ? notes
    : notes.filter((n) => !n.feature_key || features[n.feature_key] === true)

  if (visibleNotes.length === 0) return NextResponse.json({ count: 0 })

  const noteIds = visibleNotes.map((n) => n.id)
  const { data: reads } = await supabase
    .from('release_note_reads')
    .select('note_id')
    .eq('user_id', user.id)
    .in('note_id', noteIds)

  const readCount = reads?.length ?? 0
  return NextResponse.json({ count: Math.max(0, noteIds.length - readCount) })
}
```

- [ ] **Step 3: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/release-notes/route.ts src/app/api/release-notes/unread-count/route.ts
git commit -m "feat: release-notes API filtert nach feature_key für Agentur-User"
```

---

## Task 7: Admin UI — Feature Toggles Tab

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes:
  - `FEATURE_KEYS`, `FEATURE_META` aus `src/lib/features.ts`
  - `PATCH /api/admin/agenturen/:id` mit `{ features }`
  - `POST /api/admin/release-notes` mit `{ feature_key, titel, beschreibung }`
- Produces: Neuer Tab „Feature Toggles", `FeatureToggleSheet` Komponente

- [ ] **Step 1: Import erweitern**

Oben in `src/app/admin/page.tsx` die Imports ergänzen:

```ts
import { IconToggleRight } from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FEATURE_KEYS, FEATURE_META, type FeatureKey } from "@/lib/features"
```

- [ ] **Step 2: `FeatureToggleSheet` Komponente hinzufügen**

Vor der `AdminPage`-Funktion einfügen:

```tsx
interface FeatureToggleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentur: Agentur | null
  onSuccess: () => void
}

function FeatureToggleSheet({ open, onOpenChange, agentur, onSuccess }: FeatureToggleSheetProps) {
  const [features, setFeatures] = React.useState<Record<string, boolean>>({})
  const [releaseNotes, setReleaseNotes] = React.useState<Record<string, { titel: string; beschreibung: string }>>({})
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [prevFeatures, setPrevFeatures] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (open && agentur) {
      const f = (agentur as Agentur & { features?: Record<string, boolean> }).features ?? {}
      setFeatures(f)
      setPrevFeatures(f)
      setReleaseNotes({})
      setError(null)
    }
  }, [open, agentur])

  function toggleFeature(key: FeatureKey) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    if (!agentur) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/agenturen/${agentur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Fehler beim Speichern')
      }

      // Release Notes für neu aktivierte Features erstellen
      for (const key of FEATURE_KEYS) {
        const wasOff = !prevFeatures[key]
        const isNowOn = features[key]
        const note = releaseNotes[key]
        if (wasOff && isNowOn && note?.titel) {
          await fetch('/api/admin/release-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feature_key: key,
              titel: note.titel,
              beschreibung: note.beschreibung,
            }),
          })
        }
      }

      toast.success(`Features für „${agentur.name}" gespeichert`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Feature Toggles</SheetTitle>
          <SheetDescription>
            Features für <span className="font-medium text-foreground">{agentur?.name}</span> aktivieren oder deaktivieren.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-6">
            {FEATURE_KEYS.map((key) => {
              const meta = FEATURE_META[key]
              const isOn = !!features[key]
              const wasOff = !prevFeatures[key]
              const newlyActivated = wasOff && isOn
              return (
                <div key={key} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{meta.beschreibung}</span>
                    </div>
                    <Switch
                      checked={isOn}
                      onCheckedChange={() => toggleFeature(key)}
                    />
                  </div>
                  {newlyActivated && (
                    <div className="rounded-md border bg-muted/40 p-3 flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Release Note (optional)</p>
                      <Input
                        placeholder="Titel z.B. „Mein Pool ist jetzt verfügbar""
                        value={releaseNotes[key]?.titel ?? ''}
                        onChange={(e) =>
                          setReleaseNotes((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], titel: e.target.value },
                          }))
                        }
                      />
                      <Textarea
                        placeholder="Kurze Beschreibung…"
                        className="resize-none text-sm"
                        rows={2}
                        value={releaseNotes[key]?.beschreibung ?? ''}
                        onChange={(e) =>
                          setReleaseNotes((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], beschreibung: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <IconToggleRight className="size-4" />
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Agentur-Interface um `features` erweitern**

In `src/app/admin/page.tsx` das `Agentur`-Interface ändern:

```ts
interface Agentur {
  id: string
  name: string
  kontakt_email: string
  user_anzahl: number
  created_at: string
  features: Record<string, boolean>
}
```

- [ ] **Step 4: State + Handler für FeatureToggleSheet in `AdminPage` hinzufügen**

Im `AdminPage` Komponenten-Body nach den bestehenden State-Deklarationen einfügen:

```ts
const [featureToggleOpen, setFeatureToggleOpen] = React.useState(false)
const [featureToggleAgentur, setFeatureToggleAgentur] = React.useState<Agentur | null>(null)
```

Nach den bestehenden `open...`-Funktionen einfügen:

```ts
function openFeatureToggle(a: Agentur) {
  setFeatureToggleAgentur(a)
  setFeatureToggleOpen(true)
}
```

- [ ] **Step 5: Agenturen-GET-Route um `features` erweitern**

In `src/app/api/admin/agenturen/route.ts` das Select anpassen:

```ts
const { data, error } = await supabase
  .from('agenturen')
  .select('id, name, kontakt_email, features, created_at')
  .order('name')
```

Und im Mapping:

```ts
const agenturen = (data ?? []).map((a) => ({
  ...a,
  features: (a.features as Record<string, boolean>) ?? {},
  user_anzahl: userCounts[a.id] ?? 0,
}))
```

- [ ] **Step 6: Feature Toggles Tab in der Tabs-Komponente hinzufügen**

Im `AdminPage` JSX die `TabsList` ergänzen:

```tsx
<TabsList>
  <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
  <TabsTrigger value="agenturen">Agenturen</TabsTrigger>
  <TabsTrigger value="feature-toggles">Feature Toggles</TabsTrigger>
  <TabsTrigger value="api-keys">API Schlüssel</TabsTrigger>
</TabsList>
```

Neues `TabsContent` nach dem Agenturen-Tab einfügen:

```tsx
{/* ── Feature Toggles Tab ── */}
<TabsContent value="feature-toggles" className="mt-4">
  <div className="mb-4">
    <p className="text-sm text-muted-foreground">
      Features pro Agentur freigeben oder deaktivieren.
    </p>
  </div>
  <div className="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader className="bg-muted">
        <TableRow>
          <TableHead>Agentur</TableHead>
          {FEATURE_KEYS.map((key) => (
            <TableHead key={key} className="text-center">
              {FEATURE_META[key].label}
            </TableHead>
          ))}
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {loadingAgenturen ? (
          <TableSkeletonRows cols={2 + FEATURE_KEYS.length} />
        ) : agenturen.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2 + FEATURE_KEYS.length} className="py-10 text-center text-muted-foreground">
              Keine Agenturen vorhanden.
            </TableCell>
          </TableRow>
        ) : (
          agenturen.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.name}</TableCell>
              {FEATURE_KEYS.map((key) => (
                <TableCell key={key} className="text-center">
                  <Badge
                    variant="outline"
                    className={
                      a.features?.[key]
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }
                  >
                    {a.features?.[key] ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </TableCell>
              ))}
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => openFeatureToggle(a)}
                >
                  <IconToggleRight className="size-4" />
                  <span className="sr-only">Feature Toggles</span>
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
```

- [ ] **Step 7: `FeatureToggleSheet` im JSX registrieren**

Im Return-Block von `AdminPage` vor dem letzten `</SidebarProvider>` einfügen:

```tsx
<FeatureToggleSheet
  open={featureToggleOpen}
  onOpenChange={setFeatureToggleOpen}
  agentur={featureToggleAgentur}
  onSuccess={fetchAgenturen}
/>
```

- [ ] **Step 8: `NeueAgenturSheet` um Feature-Checkboxen erweitern**

Im `NeueAgenturSheet` Component State ergänzen:

```ts
const [features, setFeatures] = React.useState<Record<string, boolean>>({})
```

Reset im `useEffect`:

```ts
React.useEffect(() => {
  if (open) { setName(""); setKontaktEmail(""); setFeatures({}); setError(null) }
}, [open])
```

Im `handleSubmit` Body:

```ts
body: JSON.stringify({ name, kontakt_email: kontaktEmail, features }),
```

Im Form-JSX nach dem Kontakt-E-Mail-Feld einfügen:

```tsx
<div className="flex flex-col gap-2">
  <Label>Features freigeben</Label>
  <div className="flex flex-col gap-2">
    {FEATURE_KEYS.map((key) => (
      <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{FEATURE_META[key].label}</span>
          <span className="text-xs text-muted-foreground">{FEATURE_META[key].beschreibung}</span>
        </div>
        <Switch
          checked={!!features[key]}
          onCheckedChange={(checked) =>
            setFeatures((prev) => ({ ...prev, [key]: checked }))
          }
        />
      </div>
    ))}
  </div>
</div>
```

In `src/app/api/admin/agenturen/route.ts` das Schema erweitern:

```ts
import { FEATURE_KEYS } from '@/lib/features'

const featureRecord = z.record(
  z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
  z.boolean()
)

const agenturSchema = z.object({
  name: z.string().min(1).max(200),
  kontakt_email: z.string().email(),
  features: featureRecord.optional(),
})
```

Insert anpassen:

```ts
const { data, error } = await supabase
  .from('agenturen')
  .insert({
    name: parsed.data.name,
    kontakt_email: parsed.data.kontakt_email,
    features: parsed.data.features ?? {},
  })
  .select('id, name, kontakt_email, features, created_at')
  .single()
```

- [ ] **Step 9: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/page.tsx src/app/api/admin/agenturen/route.ts
git commit -m "feat: Feature Toggles Tab und FeatureToggleSheet im Admin"
```

---

## Task 8: Sidebar Feature-Gating

**Files:**
- Modify: `src/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `useFeatures()` aus `src/hooks/use-features.ts`
- Produces: Sidebar-Items für Agentur gefiltert nach aktivierten Features

- [ ] **Step 1: `useFeatures` import und Nav-Items mit `featureKey` annotieren**

In `src/components/app-sidebar.tsx`:

```ts
import { useFeatures } from '@/hooks/use-features'
import type { FeatureKey } from '@/lib/features'
```

`ALL_NAV_MAIN` Typ und Einträge anpassen:

```ts
const ALL_NAV_MAIN: {
  title: string
  url: string
  icon: typeof IconLayoutDashboard
  roles: string[]
  featureKey?: FeatureKey
}[] = [
  // ... bestehende Items ...
  {
    title: 'Mein Pool',
    url: '/pool',
    icon: IconDatabase,
    roles: ['Agentur'],
    featureKey: 'mein_pool',
  },
  // ... Rest unverändert ...
]
```

- [ ] **Step 2: Filter-Logik in `AppSidebar` erweitern**

```ts
const { enabled } = useFeatures()

const navMain = ALL_NAV_MAIN.filter(
  (item) =>
    item.roles.includes(rolle) &&
    (!item.featureKey || enabled(item.featureKey))
)
```

- [ ] **Step 3: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: Sidebar filtert Nav-Items nach Feature-Toggle"
```

---

## Task 9: Pool-Seite Feature-Gate

**Files:**
- Modify: `src/app/pool/page.tsx`

**Interfaces:**
- Consumes: `useFeatures()` aus `src/hooks/use-features.ts`
- Produces: Redirect auf `/dashboard` wenn `mein_pool` deaktiviert

- [ ] **Step 1: Feature-Guard einbauen**

In `src/app/pool/page.tsx` am Anfang der Seiten-Komponente:

```ts
import { useFeatures } from '@/hooks/use-features'
import { useRouter } from 'next/navigation'
```

In der Seiten-Komponente vor dem Return:

```ts
const { enabled } = useFeatures()
const router = useRouter()

React.useEffect(() => {
  const { user } = useUser() // user schon im Component vorhanden oder hinzufügen
  if (user?.rolle === 'Agentur' && !enabled('mein_pool')) {
    router.replace('/dashboard')
  }
}, [enabled, router])
```

Hinweis: Falls `pool/page.tsx` noch kein `useUser()` importiert, ergänzen:

```ts
import { useUser } from '@/context/user-context'
```

- [ ] **Step 2: TypeScript-Check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manuell testen**

1. Dev-Server starten: `npm run dev`
2. Als Agentur-User einloggen mit `mein_pool: false`
3. `/pool` direkt aufrufen → Erwartung: Redirect auf `/dashboard`
4. Im Admin `mein_pool` aktivieren → Sidebar-Eintrag erscheint → `/pool` erreichbar

- [ ] **Step 4: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: pool-Seite leitet um wenn mein_pool-Feature deaktiviert"
```

---

## Task 10: Integrations-Test (manuell)

- [ ] **Step 1: Dev-Server starten**

```bash
npm run dev
```

- [ ] **Step 2: Feature-Toggle-Flow testen**

1. Als Admin `/admin` öffnen → Tab „Feature Toggles" sichtbar
2. Agentur auswählen → Feature Toggle Sheet öffnen
3. `Mein Pool` aktivieren → Release Note Felder erscheinen
4. Titel eintragen → Speichern
5. Als Agentur-User einloggen → Sidebar zeigt „Mein Pool"
6. Badge erscheint bei „Release Notes"
7. `/release-notes` öffnen → neue Note sichtbar, Badge verschwindet

- [ ] **Step 3: Deaktivierungs-Flow testen**

1. Als Admin `Mein Pool` deaktivieren für Agentur
2. Agentur-User neu laden → Sidebar-Eintrag fehlt
3. `/pool` direkt aufrufen → Redirect auf `/dashboard`

- [ ] **Step 4: TypeScript-Check + Build**

```bash
npx tsc --noEmit && npm run build
```

Erwartung: keine Fehler.

- [ ] **Step 5: Final Commit**

```bash
git add -A
git commit -m "feat: Feature Toggles per Agentur — vollständig implementiert"
```
