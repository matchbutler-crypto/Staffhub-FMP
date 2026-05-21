# Ressource Verlauf (Audit Log) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständiges, nicht-bearbeitbares Audit-Log für alle Aktionen auf einer Ressource — angezeigt in einem neuen "Verlauf"-Tab im RessourceDetailSheet.

**Architecture:** Zentraler `logHistorie()` Helper schreibt in die bereits existierende `ressource_historie` Tabelle. Alle schreibenden API-Routen werden erweitert um Profil-Diffs, Feedback- und CV-Events zu loggen. Der GET-Endpoint wird um Autornamen erweitert. Das UI erhält einen 4. Tab mit Timeline + manueller Notiz-Eingabe.

**Tech Stack:** Next.js 15 App Router, Supabase (server client), TypeScript, React, Tailwind CSS, shadcn/ui (Tabs, Textarea, Button)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/log-historie.ts` | Create | Shared helper `logHistorie()` — DRY history writing |
| `src/app/api/ressourcen/[id]/historie/route.ts` | Modify | GET: join profiles for author names; POST: new manual note endpoint |
| `src/app/api/ressourcen/[id]/route.ts` | Modify | PATCH + PUT: diff tracked fields, write history entries |
| `src/app/api/ressourcen/[id]/feedback/route.ts` | Modify | POST: log "Feedback hinzugefügt" after insert |
| `src/app/api/ressource-feedback/[id]/route.ts` | Modify | DELETE: fetch ressource_id first, log "Feedback gelöscht" |
| `src/app/api/ressourcen/[id]/cv/route.ts` | Modify | POST: log "CV hochgeladen"; DELETE: log "CV gelöscht" |
| `src/app/ressourcen/page.tsx` | Modify | Add VerlaufTab component + 4th tab to RessourceDetailSheet |

---

## Task 1: Shared `logHistorie` Helper

**Files:**
- Create: `src/lib/log-historie.ts`

- [ ] **Step 1: Create the helper file**

```typescript
// src/lib/log-historie.ts
import { createClient } from '@/lib/supabase/server'

interface LogHistorieOptions {
  ressourceId: string
  text: string
  typ?: 'system' | 'manuell'
  linkId?: string | null
  erstelltVon?: string | null
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function logHistorie({
  ressourceId,
  text,
  typ = 'system',
  linkId = null,
  erstelltVon = null,
  supabase,
}: LogHistorieOptions): Promise<void> {
  await supabase.from('ressource_historie').insert({
    ressource_id: ressourceId,
    text,
    typ,
    link_id: linkId,
    erstellt_von: erstelltVon,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/log-historie.ts
git commit -m "feat: add logHistorie helper for ressource audit log"
```

---

## Task 2: Enhance GET + Add POST to `/api/ressourcen/[id]/historie`

**Files:**
- Modify: `src/app/api/ressourcen/[id]/historie/route.ts`

- [ ] **Step 1: Replace the entire file with the new version**

```typescript
// src/app/api/ressourcen/[id]/historie/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logHistorie } from '@/lib/log-historie'

async function getAuthProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return null
  return { user, profile }
}

// ── GET /api/ressourcen/[id]/historie ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const auth = await getAuthProfile(supabase)
  if (!auth) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: historie, error } = await supabase
    .from('ressource_historie')
    .select(`
      id, ressource_id, link_id, typ, text, created_at,
      profiles!erstellt_von(id, name, rolle)
    `)
    .eq('ressource_id', id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Historie' }, { status: 500 })
  }

  return NextResponse.json({ historie: historie ?? [] })
}

// ── POST /api/ressourcen/[id]/historie (manuelle Notiz) ───────────────────────

const notizSchema = z.object({
  text: z.string().min(1).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const auth = await getAuthProfile(supabase)
  if (!auth) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

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

  const body = await request.json().catch(() => null)
  const parsed = notizSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  await logHistorie({
    ressourceId: id,
    text: parsed.data.text,
    typ: 'manuell',
    erstelltVon: auth.user.id,
    supabase,
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ressourcen/[id]/historie/route.ts
git commit -m "feat: enhance historie GET with author names, add POST for manual notes"
```

---

## Task 3: Profile Diff Logging in PATCH + PUT

**Files:**
- Modify: `src/app/api/ressourcen/[id]/route.ts`

The PATCH and PUT handlers are identical in structure. Both need to:
1. Read the old record before updating
2. Compare tracked fields
3. Write one history entry per changed field

- [ ] **Step 1: Add `logHistorie` import and `buildProfileHistorie` helper at top of file**

After the existing imports, add:

```typescript
import { logHistorie } from '@/lib/log-historie'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE')
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return '–'
  return `${rate.toLocaleString('de-DE')} €/Tag`
}

async function buildProfileHistorieEntries(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Promise<string[]> {
  const entries: string[] = []

  if (oldData.ek_tagesrate !== newData.ek_tagesrate) {
    entries.push(
      `EK-Rate geändert: ${formatRate(oldData.ek_tagesrate as number | null)} → ${formatRate(newData.ek_tagesrate as number | null)}`
    )
  }

  if (JSON.stringify(oldData.skills) !== JSON.stringify(newData.skills)) {
    const oldSkills = (oldData.skills as string[]) ?? []
    const newSkills = (newData.skills as string[]) ?? []
    const added = newSkills.filter((s) => !oldSkills.includes(s)).map((s) => `+${s}`)
    const removed = oldSkills.filter((s) => !newSkills.includes(s)).map((s) => `-${s}`)
    const diff = [...added, ...removed].join(', ')
    entries.push(`Skills aktualisiert: ${diff}`)
  }

  if (oldData.verfuegbarkeit !== newData.verfuegbarkeit) {
    entries.push(
      `Verfügbarkeit geändert: ${oldData.verfuegbarkeit} → ${newData.verfuegbarkeit}`
    )
  }

  if (oldData.verfuegbar_ab !== newData.verfuegbar_ab) {
    entries.push(
      `Verfügbar ab geändert: ${formatDate(oldData.verfuegbar_ab as string | null)} → ${formatDate(newData.verfuegbar_ab as string | null)}`
    )
  }

  if (oldData.erfahrungslevel !== newData.erfahrungslevel) {
    entries.push(
      `Erfahrungslevel geändert: ${oldData.erfahrungslevel} → ${newData.erfahrungslevel}`
    )
  }

  if (oldData.arbeitsmodell !== newData.arbeitsmodell) {
    entries.push(
      `Arbeitsmodell geändert: ${oldData.arbeitsmodell} → ${newData.arbeitsmodell}`
    )
  }

  if (oldData.rolle !== newData.rolle) {
    entries.push(
      `Rolle geändert: ${oldData.rolle ?? '–'} → ${newData.rolle ?? '–'}`
    )
  }

  if (oldData.notizen !== newData.notizen) {
    entries.push('Notizen aktualisiert')
  }

  return entries
}
```

- [ ] **Step 2: Update the PATCH handler to load old record + log diffs**

Replace the PATCH handler body. Find the section after the Agentur ownership check (after `if (!ressource || ressource.agentur_id !== profile.agentur_id)`) and before `const body = await request.json()`. 

The updated PATCH handler (full replacement from line 150 onwards):

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
  if (!isManager && profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Load old record for diff + Agentur ownership check
  const { data: oldRecord } = await supabase
    .from('ressourcen')
    .select('agentur_id, ek_tagesrate, skills, verfuegbarkeit, verfuegbar_ab, erfahrungslevel, arbeitsmodell, rolle, notizen')
    .eq('id', id)
    .single()

  if (!oldRecord) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  if (!isManager && profile.rolle === 'Agentur') {
    if (oldRecord.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRessourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .update({
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: parsed.data.skills,
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab ?? null,
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
      arbeitsmodell: parsed.data.arbeitsmodell ?? 'Onshore',
      location: parsed.data.location ?? null,
    })
    .eq('id', id)
    .select('id, name, verfuegbarkeit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  // Log diffs (fire and forget — don't block response)
  const histEntries = await buildProfileHistorieEntries(
    oldRecord as Record<string, unknown>,
    parsed.data as Record<string, unknown>
  )
  for (const text of histEntries) {
    await logHistorie({ ressourceId: id, text, erstelltVon: user.id, supabase })
  }

  return NextResponse.json({ ressource })
}
```

- [ ] **Step 3: Apply the same diff logic to the PUT handler**

Replace PUT handler body (same structure — only change is PUT is Agentur-only, no isManager path):

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Load old record for diff
  const { data: oldRecord } = await supabase
    .from('ressourcen')
    .select('agentur_id, ek_tagesrate, skills, verfuegbarkeit, verfuegbar_ab, erfahrungslevel, arbeitsmodell, rolle, notizen')
    .eq('id', id)
    .single()

  if (!oldRecord || oldRecord.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRessourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .update({
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: parsed.data.skills,
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab ?? null,
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
      arbeitsmodell: parsed.data.arbeitsmodell ?? 'Onshore',
      location: parsed.data.location ?? null,
    })
    .eq('id', id)
    .select('id, name, verfuegbarkeit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  const histEntries = await buildProfileHistorieEntries(
    oldRecord as Record<string, unknown>,
    parsed.data as Record<string, unknown>
  )
  for (const text of histEntries) {
    await logHistorie({ ressourceId: id, text, erstelltVon: user.id, supabase })
  }

  return NextResponse.json({ ressource })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ressourcen/[id]/route.ts
git commit -m "feat: log profile field diffs to ressource_historie on PATCH/PUT"
```

---

## Task 4: Feedback Event Logging

**Files:**
- Modify: `src/app/api/ressourcen/[id]/feedback/route.ts`
- Modify: `src/app/api/ressource-feedback/[id]/route.ts`

- [ ] **Step 1: Add logHistorie import to feedback/route.ts and log after POST insert**

Add import at top of `src/app/api/ressourcen/[id]/feedback/route.ts`:
```typescript
import { logHistorie } from '@/lib/log-historie'
```

After the successful insert in the POST handler (after `return NextResponse.json({ feedback: data }, { status: 201 })`), insert logging before the return:

```typescript
  // Log history entry
  const stars = parsed.data.bewertung
    ? '★'.repeat(parsed.data.bewertung) + '☆'.repeat(5 - parsed.data.bewertung)
    : null
  await logHistorie({
    ressourceId,
    text: stars ? `Feedback hinzugefügt (${stars})` : 'Feedback hinzugefügt',
    erstelltVon: auth.user.id,
    supabase,
  })

  return NextResponse.json({ feedback: data }, { status: 201 })
```

- [ ] **Step 2: Update the DELETE feedback handler to fetch ressource_id first and log**

Replace entire `src/app/api/ressource-feedback/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logHistorie } from '@/lib/log-historie'

// ── DELETE /api/ressource-feedback/[id] ──────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // Fetch before delete to get ressource_id for history logging
  const { data: existing } = await supabase
    .from('ressource_feedback')
    .select('id, ressource_id')
    .eq('id', id)
    .eq('erstellt_von', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: 'Feedback nicht gefunden oder keine Berechtigung' },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from('ressource_feedback')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  await logHistorie({
    ressourceId: existing.ressource_id,
    text: 'Feedback gelöscht',
    erstelltVon: user.id,
    supabase,
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ressourcen/[id]/feedback/route.ts src/app/api/ressource-feedback/[id]/route.ts
git commit -m "feat: log feedback add/delete events to ressource_historie"
```

---

## Task 5: CV Event Logging

**Files:**
- Modify: `src/app/api/ressourcen/[id]/cv/route.ts`

- [ ] **Step 1: Add logHistorie import**

Add at top of `src/app/api/ressourcen/[id]/cv/route.ts`:
```typescript
import { logHistorie } from '@/lib/log-historie'
```

- [ ] **Step 2: Log after CV upload (POST handler)**

After `await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', id)`, add:

```typescript
  await logHistorie({
    ressourceId: id,
    text: 'CV hochgeladen',
    erstelltVon: user.id,
    supabase,
  })
```

- [ ] **Step 3: Log after CV delete (DELETE handler)**

After `await supabase.from('ressourcen').update({ cv_pfad: null }).eq('id', id)`, add:

```typescript
  await logHistorie({
    ressourceId: id,
    text: 'CV gelöscht',
    erstelltVon: user.id,
    supabase,
  })
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ressourcen/[id]/cv/route.ts
git commit -m "feat: log CV upload/delete events to ressource_historie"
```

---

## Task 6: Verlauf-Tab UI

**Files:**
- Modify: `src/app/ressourcen/page.tsx`

- [ ] **Step 1: Add VerlaufTab component**

Find the line `// ── FeedbackTab ──` (around line 487) and insert the new `VerlaufTab` component **before** it:

```typescript
// ── VerlaufTab ─────────────────────────────────────────────────────────────────

interface HistorieEintrag {
  id: string
  typ: 'system' | 'manuell'
  text: string
  link_id: string | null
  created_at: string
  profiles: { id: string; name: string; rolle: string } | null
}

interface VerlaufTabProps {
  ressourceId: string
}

function VerlaufTab({ ressourceId }: VerlaufTabProps) {
  const [eintraege, setEintraege] = React.useState<HistorieEintrag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notiz, setNotiz] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  async function loadHistorie() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/historie`)
      if (res.ok) {
        const d = await res.json()
        setEintraege(d.historie ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadHistorie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ressourceId])

  async function handleNotizSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notiz.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/historie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: notiz.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Fehler')
      }
      setNotiz('')
      await loadHistorie()
      toast.success('Notiz gespeichert')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  function getIcon(eintrag: HistorieEintrag): string {
    if (eintrag.typ === 'manuell') return '📝'
    if (eintrag.link_id) return '🔗'
    return '⚙️'
  }

  function getAuthorLabel(eintrag: HistorieEintrag): string {
    if (!eintrag.profiles) return 'System'
    const { name, rolle } = eintrag.profiles
    const short = name.split(' ').map((n, i) => (i === 0 ? n : n[0] + '.')).join(' ')
    return `${short} (${rolle})`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Notiz-Eingabe */}
      <form onSubmit={handleNotizSubmit} className="flex flex-col gap-2">
        <Textarea
          placeholder="Notiz hinzufügen… (max. 500 Zeichen)"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value.slice(0, 500))}
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{notiz.length}/500</span>
          <Button type="submit" size="sm" disabled={!notiz.trim() || saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </form>

      <div className="border-t" />

      {/* Timeline */}
      {loading && (
        <p className="text-center text-sm text-muted-foreground py-6">Laden…</p>
      )}

      {!loading && eintraege.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Noch keine Verlaufseinträge vorhanden.
        </p>
      )}

      {!loading && eintraege.length > 0 && (
        <div className="flex flex-col gap-3">
          {eintraege.map((eintrag) => (
            <div key={eintrag.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 shrink-0 text-base leading-none">
                {getIcon(eintrag)}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <p className="leading-snug break-words">{eintrag.text}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{getAuthorLabel(eintrag)}</span>
                  <span className="shrink-0">{formatDateTime(eintrag.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Textarea import**

In the imports section at the top of `page.tsx`, find the line that imports `Button` from `@/components/ui/button` and add `Textarea` if not already imported:

```typescript
import { Textarea } from "@/components/ui/textarea"
```

- [ ] **Step 3: Add the 4th tab trigger**

Find the line:
```typescript
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
```

Add after it:
```typescript
              <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
```

- [ ] **Step 4: Add the 4th tab content**

Find:
```typescript
          </Tabs>
        </SheetContent>
```

Insert before `</Tabs>`:
```typescript
            {/* ── Tab 4: Verlauf ── */}
            <TabsContent
              value="verlauf"
              className="mt-0 flex-1 overflow-y-auto px-6 py-4"
            >
              <VerlaufTab ressourceId={ressource.id} />
            </TabsContent>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/ressourcen/page.tsx
git commit -m "feat: add Verlauf tab to RessourceDetailSheet with timeline and manual notes"
```

---

## Task 7: Push + Verify

- [ ] **Step 1: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 2: Manual smoke test**

1. Öffne eine Ressource → Tab "Verlauf" ist sichtbar
2. Profil bearbeiten (EK-Rate ändern) → Verlauf zeigt `EK-Rate geändert: ... → ...`
3. Feedback hinzufügen → Verlauf zeigt `Feedback hinzugefügt (★★★★☆)`
4. CV hochladen → Verlauf zeigt `CV hochgeladen`
5. Manuelle Notiz eingeben → erscheint oben in der Timeline als 📝
6. Als Agentur-User: Verlauf-Tab sichtbar, manuelle Notiz funktioniert
