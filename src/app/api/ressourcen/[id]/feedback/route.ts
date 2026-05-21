import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logHistorie } from '@/lib/log-historie'

const feedbackSchema = z.object({
  text: z.string().min(1).max(2000),
  bewertung: z.number().int().min(1).max(5).nullable().optional(),
  vakanz_id: z.string().uuid().nullable().optional(),
})

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

// ── GET /api/ressourcen/[id]/feedback ────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ressourceId } = await params
  const supabase = await createClient()

  const auth = await getAuthProfile(supabase)
  if (!auth) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ressource_feedback')
    .select(`
      id, text, bewertung, created_at,
      vakanz_id,
      vakanzen(id, rolle),
      profiles!erstellt_von(id, name, rolle)
    `)
    .eq('ressource_id', ressourceId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ feedback: data ?? [] })
}

// ── POST /api/ressourcen/[id]/feedback ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ressourceId } = await params
  const supabase = await createClient()

  const auth = await getAuthProfile(supabase)
  if (!auth) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('ressource_feedback')
    .insert({
      ressource_id: ressourceId,
      text: parsed.data.text,
      bewertung: parsed.data.bewertung ?? null,
      vakanz_id: parsed.data.vakanz_id ?? null,
      erstellt_von: auth.user.id,
    })
    .select(`
      id, text, bewertung, created_at,
      vakanz_id,
      vakanzen(id, rolle),
      profiles!erstellt_von(id, name, rolle)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

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
}
