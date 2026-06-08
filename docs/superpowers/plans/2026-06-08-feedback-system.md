# Feedback-System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BugDrop with a custom in-app feedback system: floating button → screenshot + annotation → Supabase, with an Admin Kanban board at `/feedback`.

**Architecture:** Users click a floating `FeedbackButton` (rendered in root layout), which opens a 3-step modal: screenshot via `html-to-image`, annotation via canvas overlay, then a description/category form. Submissions go to `POST /api/feedback` which uploads the screenshot to Supabase Storage and saves metadata to a `feedbacks` table. Admins see all feedback in a Kanban board at `/feedback` with drag-and-drop status management via `@dnd-kit/core`.

**Tech Stack:** Next.js 15 App Router, Supabase (postgres + storage), `html-to-image`, `@dnd-kit/core` + `@dnd-kit/utilities` (already installed), Tabler Icons, shadcn/ui components, Vitest + jsdom

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/feedback/annotation-canvas.tsx` | Canvas overlay for drawing rectangles on screenshot |
| Create | `src/components/feedback/feedback-modal.tsx` | 3-step modal: screenshot → annotate → form |
| Create | `src/components/feedback/feedback-button.tsx` | Floating fixed button + modal trigger |
| Create | `src/components/feedback/feedback-card.tsx` | Single Kanban card |
| Create | `src/components/feedback/feedback-detail-sheet.tsx` | Full-size screenshot + annotation overlay in a Sheet |
| Create | `src/components/feedback/feedback-kanban.tsx` | 4-column Kanban with dnd-kit |
| Create | `src/app/feedback/page.tsx` | Admin-only page rendering FeedbackKanban |
| Create | `src/app/api/feedback/route.ts` | GET (admin) + POST (all users) |
| Create | `src/app/api/feedback/route.test.ts` | Unit tests for GET + POST |
| Create | `src/app/api/feedback/[id]/route.ts` | PATCH status (admin) |
| Create | `src/app/api/feedback/[id]/route.test.ts` | Unit tests for PATCH |
| Modify | `src/app/layout.tsx` | Remove BugDrop Script, add FeedbackButton |
| Modify | `src/components/app-sidebar.tsx` | Add Feedback nav entry |

---

## Task 1: Remove BugDrop + install html-to-image

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install html-to-image**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npm install html-to-image
```

Expected: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Remove BugDrop from layout.tsx**

In `src/app/layout.tsx`, replace the entire file content with:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/context/user-context'

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
          </UserProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "chore: remove BugDrop, install html-to-image"
```

---

## Task 2: Supabase migration — feedbacks table + storage bucket

**Files:**
- Create: migration in Supabase (via MCP or dashboard)

- [ ] **Step 1: Run migration via Supabase MCP**

Execute the following SQL using `mcp__supabase__apply_migration` (tool name) or via the Supabase SQL editor:

```sql
-- feedbacks table
create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  beschreibung text not null,
  kategorie text not null check (kategorie in ('Bug', 'Idee', 'Sonstiges')),
  status text not null default 'backlog'
    check (status in ('backlog', 'in_progress', 'review', 'done')),
  screenshot_url text,
  annotations jsonb not null default '[]',
  seite_url text,
  created_at timestamptz not null default now()
);

-- RLS
alter table feedbacks enable row level security;

-- All authenticated users can insert their own feedbacks
create policy "Users can insert own feedback"
  on feedbacks for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only admins can select all feedbacks (enforced in API, RLS allows service role)
create policy "Service role can select all"
  on feedbacks for select
  to service_role
  using (true);

-- Service role can update status
create policy "Service role can update"
  on feedbacks for update
  to service_role
  using (true);
```

- [ ] **Step 2: Create storage bucket via Supabase MCP or dashboard**

Execute via SQL editor:

```sql
insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', false)
on conflict (id) do nothing;

-- Allow service role to upload
create policy "Service role upload"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'feedback-screenshots');

-- Allow service role to read (for signed URL generation)
create policy "Service role read"
  on storage.objects for select
  to service_role
  using (bucket_id = 'feedback-screenshots');
```

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: add feedbacks table and storage bucket migration"
```

---

## Task 3: API — POST + GET /api/feedback

**Files:**
- Create: `src/app/api/feedback/route.ts`
- Create: `src/app/api/feedback/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/feedback/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockProfileSelect, mockFeedbackInsert, mockFeedbackSelect, mockStorageUpload, mockStorageSignedUrl } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockFeedbackInsert: vi.fn(),
  mockFeedbackSelect: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      if (table === 'feedbacks') {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockFeedbackInsert }) }),
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue(mockFeedbackSelect()) }),
        }
      }
      return {}
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageSignedUrl,
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageSignedUrl,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => ({ then: (r: (v: unknown) => unknown) => r(mockFeedbackSelect()) })),
      }),
    }),
  }),
}))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: true }, error: null })
  mockFeedbackSelect.mockReturnValue({ data: [], error: null })
  mockFeedbackInsert.mockResolvedValue({ data: { id: 'fb-1', beschreibung: 'Test' }, error: null })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.url/img.png' }, error: null })
})

describe('POST /api/feedback', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: 'Test', kategorie: 'Bug', annotations: [], seite_url: '/dashboard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: '', kategorie: 'Invalid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates feedback without screenshot', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ beschreibung: 'Bug found', kategorie: 'Bug', annotations: [], seite_url: '/dashboard' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('GET /api/feedback', () => {
  it('returns 403 for non-admin', async () => {
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })
    const req = new NextRequest('http://localhost/api/feedback')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns feedbacks for admin', async () => {
    const req = new NextRequest('http://localhost/api/feedback')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.feedbacks)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx vitest run src/app/api/feedback/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/feedback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const annotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

const postSchema = z.object({
  beschreibung: z.string().min(1).max(2000),
  kategorie: z.enum(['Bug', 'Idee', 'Sonstiges']),
  annotations: z.array(annotationSchema).default([]),
  seite_url: z.string().max(500).optional(),
  screenshot_base64: z.string().optional(),
})

async function requireAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const user = await requireAuth(supabase)
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

// ── GET /api/feedback (Admin only) ────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('feedbacks')
    .select('id, user_id, beschreibung, kategorie, status, screenshot_url, annotations, seite_url, created_at, profiles(name, email)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })

  // Generate signed URLs for screenshots (1 hour expiry)
  const feedbacks = await Promise.all(
    (data ?? []).map(async (fb) => {
      if (!fb.screenshot_url) return fb
      const path = fb.screenshot_url.replace(/^feedback-screenshots\//, '')
      const { data: signed } = await adminClient.storage
        .from('feedback-screenshots')
        .createSignedUrl(path, 3600)
      return { ...fb, screenshot_url: signed?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ feedbacks })
}

// ── POST /api/feedback (All authenticated users) ──────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await requireAuth(supabase)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { beschreibung, kategorie, annotations, seite_url, screenshot_base64 } = parsed.data
  const adminClient = createAdminClient()
  let screenshotStoragePath: string | null = null

  if (screenshot_base64) {
    const base64Data = screenshot_base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `${user.id}/${Date.now()}.png`

    const { error: uploadError } = await adminClient.storage
      .from('feedback-screenshots')
      .upload(filename, buffer, { contentType: 'image/png', upsert: false })

    if (!uploadError) {
      screenshotStoragePath = `feedback-screenshots/${filename}`
    }
  }

  const { data: feedback, error } = await adminClient
    .from('feedbacks')
    .insert({
      user_id: user.id,
      beschreibung,
      kategorie,
      annotations,
      seite_url: seite_url ?? null,
      screenshot_url: screenshotStoragePath,
      status: 'backlog',
    })
    .select('id, beschreibung, kategorie, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })

  return NextResponse.json({ feedback }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/feedback/route.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback/route.ts src/app/api/feedback/route.test.ts
git commit -m "feat: add GET + POST /api/feedback"
```

---

## Task 4: API — PATCH /api/feedback/[id]

**Files:**
- Create: `src/app/api/feedback/[id]/route.ts`
- Create: `src/app/api/feedback/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/feedback/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockProfileSelect, mockFeedbackUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockFeedbackUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockProfileSelect }) }) }
      }
      return {}
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockFeedbackUpdate }) }) }),
    }),
  }),
}))

import { PATCH } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockProfileSelect.mockResolvedValue({ data: { rolle: 'Admin', aktiv: true }, error: null })
  mockFeedbackUpdate.mockResolvedValue({ data: { id: 'fb-1', status: 'in_progress' }, error: null })
})

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/feedback/fb-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const params = Promise.resolve({ id: 'fb-1' })

describe('PATCH /api/feedback/[id]', () => {
  it('returns 403 for non-admin', async () => {
    mockProfileSelect.mockResolvedValue({ data: { rolle: 'Agentur', aktiv: true }, error: null })
    const res = await PATCH(makeReq({ status: 'in_progress' }), { params })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid status', async () => {
    const res = await PATCH(makeReq({ status: 'invalid' }), { params })
    expect(res.status).toBe(400)
  })

  it('updates status successfully', async () => {
    const res = await PATCH(makeReq({ status: 'in_progress' }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.feedback.status).toBe('in_progress')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run "src/app/api/feedback/\[id\]/route.test.ts"
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/feedback/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const patchSchema = z.object({
  status: z.enum(['backlog', 'in_progress', 'review', 'done']),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: feedback, error } = await adminClient
    .from('feedbacks')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })

  return NextResponse.json({ feedback })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run "src/app/api/feedback/\[id\]/route.test.ts"
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/feedback/[id]/route.ts" "src/app/api/feedback/[id]/route.test.ts"
git commit -m "feat: add PATCH /api/feedback/[id]"
```

---

## Task 5: AnnotationCanvas component

**Files:**
- Create: `src/components/feedback/annotation-canvas.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/feedback/annotation-canvas.tsx`:

```tsx
'use client'

import * as React from 'react'

export interface Annotation {
  x: number      // percentage 0-100
  y: number      // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
}

interface AnnotationCanvasProps {
  annotations: Annotation[]
  onChange: (annotations: Annotation[]) => void
  className?: string
}

export function AnnotationCanvas({ annotations, onChange, className }: AnnotationCanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = React.useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  function getRelativePos(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const pos = getRelativePos(e)
    setDrawing({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    const pos = getRelativePos(e)
    setDrawing((d) => d ? { ...d, currentX: pos.x, currentY: pos.y } : null)
  }

  function onMouseUp() {
    if (!drawing) return
    const x = Math.min(drawing.startX, drawing.currentX)
    const y = Math.min(drawing.startY, drawing.currentY)
    const width = Math.abs(drawing.currentX - drawing.startX)
    const height = Math.abs(drawing.currentY - drawing.startY)
    if (width > 1 && height > 1) {
      onChange([...annotations, { x, y, width, height }])
    }
    setDrawing(null)
  }

  const preview = drawing ? {
    x: Math.min(drawing.startX, drawing.currentX),
    y: Math.min(drawing.startY, drawing.currentY),
    width: Math.abs(drawing.currentX - drawing.startX),
    height: Math.abs(drawing.currentY - drawing.startY),
  } : null

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 cursor-crosshair select-none ${className ?? ''}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {annotations.map((a, i) => (
        <div
          key={i}
          className="absolute border-2 border-red-500 bg-red-500/10"
          style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
          onClick={(e) => {
            e.stopPropagation()
            onChange(annotations.filter((_, idx) => idx !== i))
          }}
        />
      ))}
      {preview && (
        <div
          className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
          style={{ left: `${preview.x}%`, top: `${preview.y}%`, width: `${preview.width}%`, height: `${preview.height}%` }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feedback/annotation-canvas.tsx
git commit -m "feat: add AnnotationCanvas component"
```

---

## Task 6: FeedbackModal component

**Files:**
- Create: `src/components/feedback/feedback-modal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/feedback/feedback-modal.tsx`:

```tsx
'use client'

import * as React from 'react'
import { toPng } from 'html-to-image'
import { IconX, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AnnotationCanvas, type Annotation } from './annotation-canvas'

type Step = 'screenshot' | 'annotate' | 'form' | 'sending'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [step, setStep] = React.useState<Step>('screenshot')
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null)
  const [annotations, setAnnotations] = React.useState<Annotation[]>([])
  const [beschreibung, setBeschreibung] = React.useState('')
  const [kategorie, setKategorie] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setStep('screenshot')
    setScreenshotDataUrl(null)
    setAnnotations([])
    setBeschreibung('')
    setKategorie('')
    setError(null)

    // Take screenshot after a short delay to allow modal to not be in the capture
    const timer = setTimeout(async () => {
      try {
        const dataUrl = await toPng(document.body, {
          pixelRatio: 1,
          filter: (node) => !node.classList?.contains('feedback-modal-exclude'),
        })
        // Scale down to max 1920px
        const scaled = await scaleImage(dataUrl, 1920)
        setScreenshotDataUrl(scaled)
      } catch {
        setScreenshotDataUrl(null)
      } finally {
        setStep('annotate')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [open])

  async function handleSubmit() {
    if (!beschreibung.trim() || !kategorie) {
      setError('Bitte Beschreibung und Kategorie ausfüllen.')
      return
    }
    setStep('sending')
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschreibung: beschreibung.trim(),
          kategorie,
          annotations,
          seite_url: window.location.pathname,
          screenshot_base64: screenshotDataUrl ?? undefined,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Senden')
      toast.success('Feedback gesendet — danke!')
      onOpenChange(false)
    } catch {
      setError('Feedback konnte nicht gesendet werden. Bitte erneut versuchen.')
      setStep('form')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="feedback-modal-exclude max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'screenshot' && 'Screenshot wird erstellt…'}
            {step === 'annotate' && 'Markierungen einzeichnen'}
            {step === 'form' && 'Feedback beschreiben'}
            {step === 'sending' && 'Wird gesendet…'}
          </DialogTitle>
        </DialogHeader>

        {step === 'screenshot' && (
          <div className="flex h-48 items-center justify-center">
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        )}

        {step === 'annotate' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Klicke und ziehe um Bereiche zu markieren. Klicke auf eine Markierung um sie zu entfernen.
            </p>
            <div className="relative overflow-hidden rounded-lg border bg-muted">
              {screenshotDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshotDataUrl} alt="Screenshot" className="w-full" draggable={false} />
                  <AnnotationCanvas annotations={annotations} onChange={setAnnotations} />
                </>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Kein Screenshot verfügbar
                </div>
              )}
            </div>
            {annotations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setAnnotations([])}
              >
                <IconTrash className="mr-1 size-4" />
                Alle Markierungen entfernen
              </Button>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={() => setStep('form')}>Weiter</Button>
            </div>
          </div>
        )}

        {(step === 'form' || step === 'sending') && (
          <div className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-kategorie">Kategorie *</Label>
              <Select value={kategorie} onValueChange={setKategorie} disabled={step === 'sending'}>
                <SelectTrigger id="fb-kategorie"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug</SelectItem>
                  <SelectItem value="Idee">Idee</SelectItem>
                  <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-beschreibung">Beschreibung *</Label>
              <textarea
                id="fb-beschreibung"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="Was ist passiert? Was hast du erwartet?"
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                disabled={step === 'sending'}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('annotate')} disabled={step === 'sending'}>
                Zurück
              </Button>
              <Button onClick={handleSubmit} disabled={step === 'sending'}>
                {step === 'sending' ? 'Wird gesendet…' : 'Feedback senden'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

async function scaleImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(dataUrl); return }
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = Math.round((img.height / img.width) * maxWidth)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feedback/feedback-modal.tsx
git commit -m "feat: add FeedbackModal with screenshot + annotation"
```

---

## Task 7: FeedbackButton + Root Layout integration

**Files:**
- Create: `src/components/feedback/feedback-button.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create FeedbackButton**

Create `src/components/feedback/feedback-button.tsx`:

```tsx
'use client'

import * as React from 'react'
import { IconBug } from '@tabler/icons-react'
import { FeedbackModal } from './feedback-modal'

export function FeedbackButton() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="feedback-modal-exclude fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Feedback geben"
        title="Feedback geben"
      >
        <IconBug className="size-5" />
      </button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 2: Add FeedbackButton to layout**

In `src/app/layout.tsx`, add the import and the component. The final file should look like:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/context/user-context'
import { FeedbackButton } from '@/components/feedback/feedback-button'

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
          </UserProvider>
          <Toaster />
          <FeedbackButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/feedback/feedback-button.tsx src/app/layout.tsx
git commit -m "feat: add FeedbackButton to root layout"
```

---

## Task 8: FeedbackCard + FeedbackDetailSheet

**Files:**
- Create: `src/components/feedback/feedback-card.tsx`
- Create: `src/components/feedback/feedback-detail-sheet.tsx`

- [ ] **Step 1: Define the shared Feedback type**

Create `src/components/feedback/types.ts`:

```typescript
export interface FeedbackAnnotation {
  x: number
  y: number
  width: number
  height: number
}

export interface Feedback {
  id: string
  user_id: string
  beschreibung: string
  kategorie: 'Bug' | 'Idee' | 'Sonstiges'
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  screenshot_url: string | null
  annotations: FeedbackAnnotation[]
  seite_url: string | null
  created_at: string
  profiles?: { name: string; email: string } | null
}
```

- [ ] **Step 2: Create FeedbackDetailSheet**

Create `src/components/feedback/feedback-detail-sheet.tsx`:

```tsx
'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { Feedback } from './types'

const kategorieColors: Record<string, string> = {
  Bug: 'bg-red-100 text-red-700 border-red-200',
  Idee: 'bg-blue-100 text-blue-700 border-blue-200',
  Sonstiges: 'bg-gray-100 text-gray-600 border-gray-200',
}

interface FeedbackDetailSheetProps {
  feedback: Feedback | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDetailSheet({ feedback, open, onOpenChange }: FeedbackDetailSheetProps) {
  if (!feedback) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[560px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="outline" className={kategorieColors[feedback.kategorie]}>
              {feedback.kategorie}
            </Badge>
            Feedback-Detail
          </SheetTitle>
          <SheetDescription>
            {feedback.profiles?.name ?? 'Unbekannt'} · {format(new Date(feedback.created_at), 'dd. MMM yyyy HH:mm', { locale: de })}
            {feedback.seite_url && <> · <span className="font-mono text-xs">{feedback.seite_url}</span></>}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          <p className="text-sm whitespace-pre-wrap">{feedback.beschreibung}</p>
          {feedback.screenshot_url && (
            <div className="relative overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feedback.screenshot_url} alt="Screenshot" className="w-full" />
              {feedback.annotations.map((a, i) => (
                <div
                  key={i}
                  className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
                  style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Create FeedbackCard**

Create `src/components/feedback/feedback-card.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { Feedback } from './types'

const kategorieColors: Record<string, string> = {
  Bug: 'bg-red-100 text-red-700 border-red-200',
  Idee: 'bg-blue-100 text-blue-700 border-blue-200',
  Sonstiges: 'bg-gray-100 text-gray-600 border-gray-200',
}

interface FeedbackCardProps {
  feedback: Feedback
  onClick: (feedback: Feedback) => void
}

export function FeedbackCard({ feedback, onClick }: FeedbackCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feedback.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing flex flex-col gap-2"
      onClick={() => onClick(feedback)}
      {...listeners}
      {...attributes}
    >
      {feedback.screenshot_url && (
        <div className="overflow-hidden rounded border bg-muted h-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={feedback.screenshot_url} alt="Screenshot" className="w-full h-full object-cover object-top" />
        </div>
      )}
      <p className="text-sm line-clamp-2">{feedback.beschreibung}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={`text-xs ${kategorieColors[feedback.kategorie]}`}>
          {feedback.kategorie}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(feedback.created_at), 'dd.MM.yy', { locale: de })}
        </span>
      </div>
      {feedback.profiles?.name && (
        <p className="text-xs text-muted-foreground truncate">{feedback.profiles.name}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/feedback/types.ts src/components/feedback/feedback-card.tsx src/components/feedback/feedback-detail-sheet.tsx
git commit -m "feat: add FeedbackCard and FeedbackDetailSheet"
```

---

## Task 9: FeedbackKanban

**Files:**
- Create: `src/components/feedback/feedback-kanban.tsx`

- [ ] **Step 1: Create FeedbackKanban**

Create `src/components/feedback/feedback-kanban.tsx`:

```tsx
'use client'

import * as React from 'react'
import { DndContext, type DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedbackCard } from './feedback-card'
import { FeedbackDetailSheet } from './feedback-detail-sheet'
import type { Feedback } from './types'

type Status = 'backlog' | 'in_progress' | 'review' | 'done'

const COLUMNS: { id: Status; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
]

function KanbanColumn({ id, label, items, onCardClick }: {
  id: Status
  label: string
  items: Feedback[]
  onCardClick: (f: Feedback) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="flex flex-col gap-2 min-h-[200px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 rounded-lg p-2 transition-colors ${isOver ? 'bg-muted/60' : 'bg-muted/30'}`}
      >
        {items.map((f) => (
          <FeedbackCard key={f.id} feedback={f} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

interface FeedbackKanbanProps {
  feedbacks: Feedback[]
  loading: boolean
  onStatusChange: (id: string, status: Status) => void
}

export function FeedbackKanban({ feedbacks, loading, onStatusChange }: FeedbackKanbanProps) {
  const [selected, setSelected] = React.useState<Feedback | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as Status
    const feedback = feedbacks.find((f) => f.id === active.id)
    if (!feedback || feedback.status === newStatus) return
    onStatusChange(feedback.id, newStatus)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2 min-h-[200px]">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              items={feedbacks.filter((f) => f.status === col.id)}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </DndContext>
      <FeedbackDetailSheet
        feedback={selected}
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feedback/feedback-kanban.tsx
git commit -m "feat: add FeedbackKanban with dnd-kit"
```

---

## Task 10: /feedback page + Sidebar entry

**Files:**
- Create: `src/app/feedback/page.tsx`
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Create /feedback page**

Create `src/app/feedback/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { IconBug } from '@tabler/icons-react'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { FeedbackKanban } from '@/components/feedback/feedback-kanban'
import { useUser } from '@/context/user-context'
import type { Feedback } from '@/components/feedback/types'

export default function FeedbackPage() {
  const { user } = useUser()
  const router = useRouter()
  const [feedbacks, setFeedbacks] = React.useState<Feedback[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (user && user.rolle !== 'Admin') {
      router.replace('/dashboard')
    }
  }, [user, router])

  async function fetchFeedbacks() {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFeedbacks(data.feedbacks ?? [])
    } catch {
      toast.error('Feedbacks konnten nicht geladen werden')
    } finally {
      setLoading(false) }
  }

  React.useEffect(() => { fetchFeedbacks() }, [])

  async function handleStatusChange(id: string, status: 'backlog' | 'in_progress' | 'review' | 'done') {
    // Optimistic update
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, status } : f))
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Status konnte nicht aktualisiert werden')
      fetchFeedbacks() // rollback by re-fetching
    }
  }

  return (
    <SidebarProvider style={{ '--sidebar-width': '18rem', '--header-height': '3rem' } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Feedback" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="flex items-center gap-2">
                  <IconBug className="size-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Feedback</h2>
                </div>
                <p className="text-sm text-muted-foreground">Eingegangene Feedbacks verwalten</p>
              </div>
              <div className="px-4 lg:px-6 overflow-x-auto">
                <FeedbackKanban
                  feedbacks={feedbacks}
                  loading={loading}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Add Feedback to sidebar**

In `src/components/app-sidebar.tsx`, add `IconBug` to the imports:

```tsx
import {
  IconBrandSlack,
  IconBriefcase,
  IconBug,
  IconBuilding,
  // ... rest unchanged
```

Then add to `ALL_NAV_SECONDARY` (after the 'Admin' entry):

```tsx
const ALL_NAV_SECONDARY = [
  {
    title: 'Release Notes',
    url: '/release-notes',
    icon: IconSpeakerphone,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Einstellungen',
    url: '/settings',
    icon: IconSettingsCog,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Admin',
    url: '/admin',
    icon: IconSettings,
    roles: ['Admin'],
  },
  {
    title: 'Feedback',
    url: '/feedback',
    icon: IconBug,
    roles: ['Admin'],
  },
]
```

- [ ] **Step 3: Run full test suite to verify nothing is broken**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npx vitest run
```

Expected: All existing tests pass, new API tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/feedback/page.tsx src/components/app-sidebar.tsx
git commit -m "feat: add /feedback page and sidebar nav entry"
```

---

## Self-Review

**Spec coverage check:**
- ✅ BugDrop entfernen → Task 1
- ✅ `feedbacks` Tabelle + Storage Bucket → Task 2
- ✅ POST /api/feedback (Screenshot-Upload + Metadaten) → Task 3
- ✅ GET /api/feedback (Admin-only, signed URLs) → Task 3
- ✅ PATCH /api/feedback/[id] (Status-Update) → Task 4
- ✅ AnnotationCanvas (Rechtecke zeichnen, entfernen) → Task 5
- ✅ FeedbackModal (3 Schritte: screenshot → annotate → form) → Task 6
- ✅ Screenshot-Skalierung auf max. 1920px → Task 6 (`scaleImage`)
- ✅ Fallback wenn Screenshot fehlschlägt → Task 6 (leerer State + Hinweis)
- ✅ FeedbackButton (floating, fixed bottom-right) → Task 7
- ✅ `feedback-modal-exclude` CSS-Klasse verhindert Selbsterfassung → Task 7
- ✅ FeedbackCard (Kanban-Karte mit Thumbnail) → Task 8
- ✅ FeedbackDetailSheet (Vollansicht mit Annotationen als Overlay) → Task 8
- ✅ FeedbackKanban (4 Spalten, dnd-kit, optimistisches Update + Rollback) → Task 9
- ✅ /feedback Page (Admin-Redirect-Guard) → Task 10
- ✅ Sidebar-Eintrag für Admin → Task 10

**Type consistency:**
- `Feedback` type defined in `types.ts` (Task 8 Step 1), used in Tasks 8, 9, 10 ✅
- `Annotation` type defined in `annotation-canvas.tsx` (Task 5), imported in `feedback-modal.tsx` (Task 6) ✅
- `Status` type consistent across `types.ts`, `feedback-kanban.tsx`, PATCH route ✅
- API returns `profiles` as `{ name, email }` — matches `Feedback` interface ✅
