# Bug-Reporting & Admin Kanban — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-App Bug-Reporting mit Floating Button, Freitext + annotiertem Screenshot, sowie Admin-Kanban-Board (Offen / In Bearbeitung / Erledigt).

**Architecture:** Neue Supabase-Tabelle `bug_reports` + privater Storage-Bucket. Floating `BugReportWidget` Client-Komponente im Root-Layout. Admin-Seite `/admin/bugs` mit `@dnd-kit` Drag & Drop. Kein Feedback zurück an Melder.

**Tech Stack:** Next.js 15 App Router, Supabase (DB + Storage), Zod, `html2canvas`, `@dnd-kit/core` (bereits installiert), Shadcn UI, Tabler Icons, Vitest

---

## File Map

| Aktion | Pfad | Zweck |
|---|---|---|
| Create | `supabase/migrations/bug_reports.sql` | DB-Migration |
| Create | `src/app/api/bugs/route.ts` | POST (alle) + GET (Admin) |
| Create | `src/app/api/bugs/[id]/route.ts` | PATCH Status (Admin) |
| Create | `src/components/bug-report-widget.tsx` | Floating Button + Modal + Annotation |
| Create | `src/app/admin/bugs/page.tsx` | Admin Kanban Board |
| Modify | `src/app/layout.tsx` | Widget einbinden |
| Modify | `src/components/app-sidebar.tsx` | Nav-Eintrag „Bugs" |
| Modify | `src/lib/rbac.ts` | `/admin/bugs` zur Admin-Route hinzufügen |

---

## Task 1: html2canvas installieren

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Paket installieren**

```bash
cd /Users/easy/Staffhub-FMP
npm install html2canvas
```

Erwartete Ausgabe: `added 1 package` (o.ä.), kein Error.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2canvas for bug screenshot capture"
```

---

## Task 2: Supabase DB-Migration

**Files:**
- Create: `supabase/migrations/bug_reports.sql`

- [ ] **Step 1: Migration-Datei schreiben**

```sql
-- supabase/migrations/bug_reports.sql

-- Tabelle
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  beschreibung text not null,
  screenshot_url text,
  seite_url   text not null,
  status      text not null default 'offen'
                check (status in ('offen', 'in_bearbeitung', 'erledigt')),
  melder_id   uuid not null references public.profiles(id) on delete set null,
  melder_rolle text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at Trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bug_reports_updated_at
  before update on public.bug_reports
  for each row execute procedure public.set_updated_at();

-- RLS aktivieren
alter table public.bug_reports enable row level security;

-- INSERT: alle aktiven eingeloggten User
create policy "bug_reports_insert" on public.bug_reports
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and aktiv = true
    )
  );

-- SELECT: nur Admin
create policy "bug_reports_select_admin" on public.bug_reports
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );

-- UPDATE: nur Admin
create policy "bug_reports_update_admin" on public.bug_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );
```

- [ ] **Step 2: Migration in Supabase ausführen**

Im Supabase Dashboard → SQL Editor → Inhalt der Datei einfügen und ausführen. Alternativ via CLI:

```bash
supabase db push
```

- [ ] **Step 3: Storage Bucket anlegen**

Im Supabase Dashboard → Storage → „New Bucket":
- Name: `bug-screenshots`
- Public: **Nein** (private)

Oder via SQL:

```sql
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', false)
on conflict do nothing;
```

Storage-Policy für Upload (alle aktiven User) und Download (nur Admin):

```sql
-- Upload: alle aktiven eingeloggten User
create policy "bug_screenshots_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bug-screenshots'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and aktiv = true
    )
  );

-- Download: nur Admin
create policy "bug_screenshots_select_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bug-screenshots'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/bug_reports.sql
git commit -m "feat: add bug_reports table, RLS, storage bucket"
```

---

## Task 3: API-Route POST + GET `/api/bugs`

**Files:**
- Create: `src/app/api/bugs/route.ts`

- [ ] **Step 1: Datei anlegen**

```typescript
// src/app/api/bugs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createBugSchema = z.object({
  beschreibung: z.string().min(10, 'Mindestens 10 Zeichen'),
  screenshot_url: z.string().url().optional(),
  seite_url: z.string().min(1),
})

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', userId)
    .single()
  return data
}

// ── POST /api/bugs ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createBugSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bug_reports')
    .insert({
      beschreibung: parsed.data.beschreibung,
      screenshot_url: parsed.data.screenshot_url ?? null,
      seite_url: parsed.data.seite_url,
      melder_id: user.id,
      melder_rolle: profile.rolle,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// ── GET /api/bugs ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getProfile(supabase, user.id)
  if (profile?.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('bug_reports')
    .select(`
      id, beschreibung, screenshot_url, seite_url, status,
      melder_rolle, created_at, updated_at,
      melder:profiles!bug_reports_melder_id_fkey(name, rolle)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bugs/route.ts
git commit -m "feat: POST + GET /api/bugs"
```

---

## Task 4: API-Route PATCH `/api/bugs/[id]`

**Files:**
- Create: `src/app/api/bugs/[id]/route.ts`

- [ ] **Step 1: Datei anlegen**

```typescript
// src/app/api/bugs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateStatusSchema = z.object({
  status: z.enum(['offen', 'in_bearbeitung', 'erledigt']),
})

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle')
    .eq('id', user.id)
    .single()

  if (profile?.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bug_reports')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bugs/[id]/route.ts
git commit -m "feat: PATCH /api/bugs/[id] status update"
```

---

## Task 5: BugReportWidget — Floating Button + Modal Schritt 1

**Files:**
- Create: `src/components/bug-report-widget.tsx`

- [ ] **Step 1: Komponente anlegen (nur Floating Button + Schritt 1 Modal)**

```typescript
// src/components/bug-report-widget.tsx
'use client'

import * as React from 'react'
import { IconBug, IconX, IconCamera, IconSend } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useUser } from '@/context/user-context'
import { AnnotationCanvas } from '@/components/bug-report-annotation-canvas'

type Step = 'form' | 'annotate'

export function BugReportWidget() {
  const { user } = useUser()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('form')
  const [beschreibung, setBeschreibung] = React.useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null)
  const [annotatedDataUrl, setAnnotatedDataUrl] = React.useState<string | null>(null)
  const [capturing, setCapturing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  if (!user) return null

  async function handleCaptureScreenshot() {
    setCapturing(true)
    setOpen(false)
    // kurze Pause damit Modal ausblendet
    await new Promise((r) => setTimeout(r, 150))

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio,
    })
    const dataUrl = canvas.toDataURL('image/png')
    setScreenshotDataUrl(dataUrl)
    setAnnotatedDataUrl(dataUrl)
    setOpen(true)
    setStep('annotate')
    setCapturing(false)
  }

  async function handleSubmit(screenshotUrl?: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschreibung,
          screenshot_url: screenshotUrl ?? undefined,
          seite_url: window.location.href,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Senden')
      toast.success('Bug gemeldet, danke!')
      handleClose()
    } catch {
      toast.error('Fehler beim Senden des Bugs')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitWithScreenshot() {
    if (!annotatedDataUrl) {
      await handleSubmit()
      return
    }

    // Base64 → Blob → Upload zu Supabase Storage
    const { createClient } = await import('@/lib/supabase/server')
    // Client-seitig: Browser-Client nutzen
    const { supabase } = await import('@/lib/supabase')
    const blob = await (await fetch(annotatedDataUrl)).blob()
    const path = `${user!.id}/${crypto.randomUUID()}.png`
    const { data: uploadData, error } = await supabase.storage
      .from('bug-screenshots')
      .upload(path, blob, { contentType: 'image/png' })

    if (error || !uploadData) {
      toast.error('Screenshot-Upload fehlgeschlagen')
      await handleSubmit()
      return
    }

    const { data: urlData } = supabase.storage
      .from('bug-screenshots')
      .getPublicUrl(uploadData.path)

    await handleSubmit(urlData?.publicUrl)
  }

  function handleClose() {
    setOpen(false)
    setStep('form')
    setBeschreibung('')
    setScreenshotDataUrl(null)
    setAnnotatedDataUrl(null)
  }

  const beschreibungValid = beschreibung.trim().length >= 10

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
        aria-label="Bug melden"
        title="Bug melden"
      >
        <IconBug size={22} />
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBug size={18} />
              Bug melden
            </DialogTitle>
          </DialogHeader>

          {step === 'form' && (
            <div className="flex flex-col gap-4">
              <Textarea
                placeholder="Was ist passiert? (mindestens 10 Zeichen)"
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                rows={4}
                className="resize-none"
              />

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleCaptureScreenshot}
                  disabled={!beschreibungValid || capturing}
                  className="gap-2"
                >
                  <IconCamera size={16} />
                  {capturing ? 'Aufnehmen…' : 'Screenshot aufnehmen'}
                </Button>

                <Button
                  onClick={() => handleSubmit()}
                  disabled={!beschreibungValid || submitting}
                  variant="secondary"
                  className="gap-2"
                >
                  <IconSend size={16} />
                  Ohne Screenshot senden
                </Button>
              </div>
            </div>
          )}

          {step === 'annotate' && screenshotDataUrl && (
            <AnnotationCanvas
              screenshotDataUrl={screenshotDataUrl}
              onDone={(dataUrl) => {
                setAnnotatedDataUrl(dataUrl)
              }}
              onSubmit={handleSubmitWithScreenshot}
              onRetake={() => {
                setStep('form')
                setScreenshotDataUrl(null)
              }}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bug-report-widget.tsx
git commit -m "feat: BugReportWidget floating button + form modal"
```

---

## Task 6: Annotation Canvas Komponente

**Files:**
- Create: `src/components/bug-report-annotation-canvas.tsx`

- [ ] **Step 1: Komponente anlegen**

```typescript
// src/components/bug-report-annotation-canvas.tsx
'use client'

import * as React from 'react'
import {
  IconArrowUpRight,
  IconSquare,
  IconArrowBackUp,
  IconCheck,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

type Tool = 'arrow' | 'rect'

interface Shape {
  tool: Tool
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Props {
  screenshotDataUrl: string
  onDone: (dataUrl: string) => void
  onSubmit: () => void
  onRetake: () => void
  submitting: boolean
}

export function AnnotationCanvas({ screenshotDataUrl, onDone, onSubmit, onRetake, submitting }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = React.useState<Tool>('arrow')
  const [shapes, setShapes] = React.useState<Shape[]>([])
  const [drawing, setDrawing] = React.useState(false)
  const [current, setCurrent] = React.useState<Omit<Shape, 'tool'> | null>(null)
  const [imageEl, setImageEl] = React.useState<HTMLImageElement | null>(null)
  const [done, setDone] = React.useState(false)

  // Bild laden
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => setImageEl(img)
    img.src = screenshotDataUrl
  }, [screenshotDataUrl])

  // Canvas neu zeichnen wenn shapes oder current sich ändert
  React.useEffect(() => {
    if (!canvasRef.current || !imageEl) return
    const ctx = canvasRef.current.getContext('2d')!
    canvasRef.current.width = imageEl.naturalWidth
    canvasRef.current.height = imageEl.naturalHeight
    ctx.drawImage(imageEl, 0, 0)
    drawShapes(ctx, shapes)
    if (current) drawShapes(ctx, [{ ...current, tool }])
  }, [shapes, current, imageEl, tool])

  function drawShapes(ctx: CanvasRenderingContext2D, list: Shape[]) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    for (const s of list) {
      if (s.tool === 'rect') {
        ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1)
      } else {
        // Pfeil: Linie + Pfeilkopf
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
        const headLen = 16

        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(s.x2, s.y2)
        ctx.lineTo(
          s.x2 - headLen * Math.cos(angle - Math.PI / 6),
          s.y2 - headLen * Math.sin(angle - Math.PI / 6)
        )
        ctx.moveTo(s.x2, s.y2)
        ctx.lineTo(
          s.x2 - headLen * Math.cos(angle + Math.PI / 6),
          s.y2 - headLen * Math.sin(angle + Math.PI / 6)
        )
        ctx.stroke()
      }
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (done) return
    const { x, y } = getPos(e)
    setDrawing(true)
    setCurrent({ x1: x, y1: y, x2: x, y2: y })
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !current) return
    const { x, y } = getPos(e)
    setCurrent((c) => c ? { ...c, x2: x, y2: y } : c)
  }

  function onMouseUp() {
    if (!drawing || !current) return
    setShapes((prev) => [...prev, { ...current, tool }])
    setCurrent(null)
    setDrawing(false)
  }

  function undo() {
    setShapes((prev) => prev.slice(0, -1))
    setDone(false)
  }

  function handleDone() {
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    onDone(dataUrl)
    setDone(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1">
        <Button
          size="sm"
          variant={tool === 'arrow' ? 'default' : 'ghost'}
          onClick={() => setTool('arrow')}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconArrowUpRight size={14} /> Pfeil
        </Button>
        <Button
          size="sm"
          variant={tool === 'rect' ? 'default' : 'ghost'}
          onClick={() => setTool('rect')}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconSquare size={14} /> Rechteck
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={shapes.length === 0}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconArrowBackUp size={14} /> Undo
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetake}
            className="gap-1 h-7 px-2 text-xs"
          >
            <IconRefresh size={14} /> Neu aufnehmen
          </Button>
          {!done ? (
            <Button
              size="sm"
              onClick={handleDone}
              className="gap-1 h-7 px-2 text-xs"
            >
              <IconCheck size={14} /> Fertig
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="gap-1 h-7 px-2 text-xs"
            >
              <IconSend size={14} />
              {submitting ? 'Senden…' : 'Absenden'}
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto rounded-md border bg-muted/20">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="max-w-full cursor-crosshair"
          style={{ display: 'block' }}
        />
      </div>

      {done && (
        <p className="text-xs text-muted-foreground">
          Annotation gespeichert. Klicke „Absenden" um den Bug zu melden.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bug-report-annotation-canvas.tsx
git commit -m "feat: AnnotationCanvas with arrow + rect tools"
```

---

## Task 7: Storage-Upload Fix im Widget

Der `BugReportWidget` in Task 5 importiert fälschlicherweise `createClient` aus `server` im Browser. Das muss korrigiert werden — Storage-Upload läuft direkt mit dem Browser-Supabase-Client.

**Files:**
- Modify: `src/components/bug-report-widget.tsx`

- [ ] **Step 1: `handleSubmitWithScreenshot` korrigieren**

Ersetze die Funktion `handleSubmitWithScreenshot` in `src/components/bug-report-widget.tsx`:

```typescript
async function handleSubmitWithScreenshot() {
  if (!annotatedDataUrl) {
    await handleSubmit()
    return
  }

  const { supabase } = await import('@/lib/supabase')
  const blob = await (await fetch(annotatedDataUrl)).blob()
  const path = `${user!.id}/${crypto.randomUUID()}.png`

  const { data: uploadData, error } = await supabase.storage
    .from('bug-screenshots')
    .upload(path, blob, { contentType: 'image/png' })

  if (error || !uploadData) {
    toast.error('Screenshot-Upload fehlgeschlagen, sende ohne Screenshot')
    await handleSubmit()
    return
  }

  // Signed URL für private Bucket (60 min)
  const { data: signedData } = await supabase.storage
    .from('bug-screenshots')
    .createSignedUrl(uploadData.path, 3600)

  await handleSubmit(signedData?.signedUrl ?? undefined)
}
```

Entferne auch den fälschlichen Import `import { createClient } from '@/lib/supabase/server'` aus Task 5 — der war ein Fehler.

- [ ] **Step 2: Commit**

```bash
git add src/components/bug-report-widget.tsx
git commit -m "fix: use browser supabase client for screenshot upload"
```

---

## Task 8: Widget in Root-Layout einbinden

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Import + Einbindung**

Ändere `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/context/user-context'
import { BugReportWidget } from '@/components/bug-report-widget'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Staffhub FMP',
  description: 'Freelancer Management Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UserProvider>
            {children}
            <BugReportWidget />
          </UserProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add BugReportWidget to root layout"
```

---

## Task 9: Admin Kanban Board `/admin/bugs`

**Files:**
- Create: `src/app/admin/bugs/page.tsx`

- [ ] **Step 1: Seite anlegen**

```typescript
// src/app/admin/bugs/page.tsx
'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import {
  IconBug,
  IconExternalLink,
  IconPhoto,
} from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

type BugStatus = 'offen' | 'in_bearbeitung' | 'erledigt'

interface BugReport {
  id: string
  beschreibung: string
  screenshot_url: string | null
  seite_url: string
  status: BugStatus
  melder_rolle: string
  created_at: string
  melder: { name: string; rolle: string } | null
}

const COLUMNS: { id: BugStatus; label: string }[] = [
  { id: 'offen', label: 'Offen' },
  { id: 'in_bearbeitung', label: 'In Bearbeitung' },
  { id: 'erledigt', label: 'Erledigt' },
]

// ── Droppable Spalte ────────────────────────────────────────────────────────

function KanbanColumn({
  id,
  label,
  bugs,
  onCardClick,
}: {
  id: BugStatus
  label: string
  bugs: BugReport[]
  onCardClick: (bug: BugReport) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 transition-colors ${
        isOver ? 'bg-muted/80 ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-xs">
          {bugs.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {bugs.map((bug) => (
          <DraggableBugCard key={bug.id} bug={bug} onClick={() => onCardClick(bug)} />
        ))}
      </div>
    </div>
  )
}

// ── Draggable Card ──────────────────────────────────────────────────────────

function DraggableBugCard({ bug, onClick }: { bug: BugReport; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: bug.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border bg-background p-3 shadow-sm transition-opacity active:cursor-grabbing ${
        isDragging ? 'opacity-30' : ''
      }`}
      onClick={onClick}
    >
      <BugCardContent bug={bug} />
    </div>
  )
}

function BugCardContent({ bug }: { bug: BugReport }) {
  return (
    <>
      <p className="line-clamp-2 text-sm text-foreground">{bug.beschreibung}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{bug.melder?.name ?? '—'}</span>
        <span>·</span>
        <span>{bug.melder_rolle}</span>
        <span>·</span>
        <span>
          {formatDistanceToNow(new Date(bug.created_at), { addSuffix: true, locale: de })}
        </span>
        {bug.screenshot_url && <IconPhoto size={12} className="ml-auto shrink-0" />}
      </div>
      {bug.seite_url && (
        <a
          href={bug.seite_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center gap-1 truncate text-xs text-blue-500 hover:underline"
        >
          <IconExternalLink size={10} />
          {bug.seite_url}
        </a>
      )}
    </>
  )
}

// ── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function AdminBugsPage() {
  const [bugs, setBugs] = React.useState<BugReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeBug, setActiveBug] = React.useState<BugReport | null>(null)
  const [selectedBug, setSelectedBug] = React.useState<BugReport | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  React.useEffect(() => {
    fetch('/api/bugs')
      .then((r) => r.json())
      .then((data) => setBugs(data))
      .catch(() => toast.error('Fehler beim Laden der Bugs'))
      .finally(() => setLoading(false))
  }, [])

  function bugsByStatus(status: BugStatus) {
    return bugs.filter((b) => b.status === status)
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveBug(bugs.find((b) => b.id === e.active.id) ?? null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveBug(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const bug = bugs.find((b) => b.id === active.id)
    const newStatus = over.id as BugStatus
    if (!bug || bug.status === newStatus) return

    // Optimistisches Update
    setBugs((prev) =>
      prev.map((b) => (b.id === bug.id ? { ...b, status: newStatus } : b))
    )

    const res = await fetch(`/api/bugs/${bug.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      // Rollback
      setBugs((prev) =>
        prev.map((b) => (b.id === bug.id ? { ...b, status: bug.status } : b))
      )
      toast.error('Status konnte nicht gespeichert werden')
    }
  }

  async function handleStatusChange(bugId: string, newStatus: BugStatus) {
    const bug = bugs.find((b) => b.id === bugId)
    if (!bug) return

    setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b)))
    setSelectedBug((prev) => (prev?.id === bugId ? { ...prev, status: newStatus } : prev))

    const res = await fetch(`/api/bugs/${bugId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: bug.status } : b)))
      setSelectedBug((prev) => (prev?.id === bugId ? { ...prev, status: bug.status } : prev))
      toast.error('Fehler beim Speichern')
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <IconBug size={20} />
            <h1 className="text-xl font-semibold">Bug-Reports</h1>
            <Badge variant="outline" className="ml-auto">
              {bugs.length} gesamt
            </Badge>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-24" />
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-3 gap-4">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    label={col.label}
                    bugs={bugsByStatus(col.id)}
                    onCardClick={setSelectedBug}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeBug && (
                  <div className="cursor-grabbing rounded-md border bg-background p-3 shadow-xl opacity-90">
                    <BugCardContent bug={activeBug} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </SidebarInset>

      {/* Detail Slide-over */}
      <Sheet open={!!selectedBug} onOpenChange={(o) => !o && setSelectedBug(null)}>
        <SheetContent className="w-[480px] overflow-y-auto">
          {selectedBug && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <IconBug size={16} />
                  Bug-Report
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Beschreibung</p>
                  <p className="mt-1 text-sm">{selectedBug.beschreibung}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Seite</p>
                  <a
                    href={selectedBug.seite_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm text-blue-500 hover:underline"
                  >
                    <IconExternalLink size={12} />
                    {selectedBug.seite_url}
                  </a>
                </div>

                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Melder</p>
                    <p className="mt-1 text-sm">{selectedBug.melder?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Rolle</p>
                    <p className="mt-1 text-sm">{selectedBug.melder_rolle}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Gemeldet</p>
                    <p className="mt-1 text-sm">
                      {formatDistanceToNow(new Date(selectedBug.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                  <Select
                    value={selectedBug.status}
                    onValueChange={(v) =>
                      handleStatusChange(selectedBug.id, v as BugStatus)
                    }
                  >
                    <SelectTrigger className="mt-1 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offen">Offen</SelectItem>
                      <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                      <SelectItem value="erledigt">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedBug.screenshot_url && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                      Screenshot
                    </p>
                    <img
                      src={selectedBug.screenshot_url}
                      alt="Bug Screenshot"
                      className="w-full rounded-md border"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bugs/page.tsx
git commit -m "feat: admin kanban board /admin/bugs"
```

---

## Task 10: Sidebar + RBAC anpassen

**Files:**
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/lib/rbac.ts`

- [ ] **Step 1: Nav-Eintrag in Sidebar hinzufügen**

In `src/components/app-sidebar.tsx`, füge zu `ALL_NAV_MAIN` nach dem Eintrag für `Aktivitäts-Log` hinzu:

```typescript
{
  title: 'Bug-Reports',
  url: '/admin/bugs',
  icon: IconBug,
  roles: ['Admin'],
},
```

Und füge `IconBug` zum Import-Block hinzu:

```typescript
import {
  IconActivity,
  IconBrandSlack,
  IconBriefcase,
  IconBug,          // <-- NEU
  IconBuilding,
  IconBulb,
  // ... rest unverändert
} from '@tabler/icons-react'
```

- [ ] **Step 2: RBAC aktualisieren**

In `src/lib/rbac.ts`, füge `/admin/bugs` zur Admin-Route-Liste hinzu. Die Liste enthält bereits `/admin` als Präfix, was `/admin/bugs` abdeckt — **kein Änderungsbedarf**, da `/admin` als Präfix bereits greift.

Verifizieren:

```bash
grep "'/admin'" src/lib/rbac.ts
```

Erwartete Ausgabe: `'/admin',` in der Admin-Routen-Liste. Falls vorhanden — fertig, kein Edit nötig.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add Bug-Reports nav item to admin sidebar"
```

---

## Task 11: Smoke-Test manuell

- [ ] **Step 1: Dev-Server starten**

```bash
npm run dev
```

- [ ] **Step 2: Widget testen**
  1. Als nicht-Admin einloggen → Floating Bug-Button (unten rechts) sichtbar
  2. Klicken → Modal öffnet
  3. Mindestens 10 Zeichen eingeben
  4. „Screenshot aufnehmen" → Screenshot erscheint im Canvas
  5. Pfeil zeichnen → Undo → Rechteck zeichnen → „Fertig"
  6. „Absenden" → Toast „Bug gemeldet, danke!"

- [ ] **Step 3: Admin Kanban testen**
  1. Als Admin einloggen → Sidebar zeigt „Bug-Reports"
  2. `/admin/bugs` öffnen → Kanban mit 3 Spalten
  3. Bug-Card auf andere Spalte ziehen → Status ändert sich
  4. Auf Card klicken → Slide-over mit Details + Screenshot + Status-Dropdown

- [ ] **Step 4: Final Commit**

```bash
git add .
git commit -m "feat: bug reporting system complete"
```
