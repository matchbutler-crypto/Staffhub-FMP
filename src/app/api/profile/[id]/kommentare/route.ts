import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const kommentarSchema = z.object({
  text: z.string().min(1, 'Kommentar darf nicht leer sein').max(2000),
})

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/profile/[id]/kommentare ──────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  // RLS stellt sicher dass Agentur nur Kommentare zu eigenen Profilen sieht
  const { data, error } = await supabase
    .from('profil_kommentare')
    .select('id, autor_id, autor_rolle, text, created_at')
    .eq('profil_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Kommentare' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST /api/profile/[id]/kommentare ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (!['Staffhub Manager', 'Admin', 'Agentur'].includes(profile.rolle ?? '')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = kommentarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Verify profil exists and user has access (RLS enforced)
  const { data: profil } = await supabase
    .from('kandidaten_profile')
    .select('id')
    .eq('id', id)
    .single()

  if (!profil) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  const { data: kommentar, error: insertError } = await supabase
    .from('profil_kommentare')
    .insert({
      profil_id: id,
      autor_id: user.id,
      autor_rolle: profile.rolle,
      text: parsed.data.text,
    })
    .select('id, autor_rolle, text, created_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Fehler beim Speichern des Kommentars' }, { status: 500 })
  }

  return NextResponse.json({ kommentar }, { status: 201 })
}
