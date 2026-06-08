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
