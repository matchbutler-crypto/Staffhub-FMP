import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const { data: historieRaw, error } = await supabase
    .from('ressource_historie')
    .select('id, ressource_id, link_id, typ, text, erstellt_von, created_at')
    .eq('ressource_id', id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Historie' }, { status: 500 })
  }

  // Fetch profile names via admin to avoid profiles RLS restricting joined data
  const erstelltVonIds = [...new Set((historieRaw ?? []).map(h => h.erstellt_von).filter(Boolean))]
  let profileMap: Record<string, { id: string; name: string; rolle: string }> = {}
  if (erstelltVonIds.length > 0) {
    const adminSupabase = createAdminClient()
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, name, rolle')
      .in('id', erstelltVonIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = p
    }
  }

  const historie = (historieRaw ?? []).map(h => ({
    id: h.id,
    ressource_id: h.ressource_id,
    link_id: h.link_id,
    typ: h.typ,
    text: h.text,
    created_at: h.created_at,
    profiles: h.erstellt_von ? (profileMap[h.erstellt_von] ?? null) : null,
  }))

  return NextResponse.json({ historie })
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

  const isManager = auth.profile.rolle === 'Admin' || auth.profile.rolle === 'Staffhub Manager'
  if (!isManager) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
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
