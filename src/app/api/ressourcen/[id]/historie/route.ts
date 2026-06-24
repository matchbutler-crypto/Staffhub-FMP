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
    console.error('GET historie error:', error)
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
