import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
}).refine(
  (d) => d.verfuegbarkeit !== 'Verfügbar ab' || !!d.verfuegbar_ab,
  { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ['verfuegbar_ab'] }
)

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ressourcen ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
  const { searchParams } = new URL(request.url)
  const inclDeaktiviert = searchParams.get('deaktiviert') === 'true'
  const vakanzId = searchParams.get('vakanz_id')

  let query = supabase
    .from('ressourcen')
    .select(`
      id, agentur_id, name, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
      agenturen(name)
    `)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (!inclDeaktiviert) {
    query = query.neq('verfuegbarkeit', 'Deaktiviert')
  }

  // When called from "Ressource einsetzen" dialog: restrict to own pool for Agentur
  if (vakanzId && !isManager && profile.agentur_id) {
    query = query.eq('agentur_id', profile.agentur_id)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Ressourcen' }, { status: 500 })
  }

  let result = (data ?? []).map((r) => {
    const { ek_tagesrate, notizen, ...rest } = r
    const canSeePrivate = isManager || r.agentur_id === profile.agentur_id
    return {
      ...rest,
      ...(canSeePrivate ? { ek_tagesrate, notizen } : {}),
    }
  })

  // Add bereits_gespielt flag when filtering for a specific vacancy
  if (vakanzId) {
    const { data: links } = await supabase
      .from('ressource_vakanz_links')
      .select('ressource_id')
      .eq('vakanz_id', vakanzId)
    const gespielteIds = new Set((links ?? []).map((l: { ressource_id: string }) => l.ressource_id))
    result = result.map((r) => ({ ...r, bereits_gespielt: gespielteIds.has(r.id) }))
  }

  return NextResponse.json({ ressourcen: result })
}

// ── POST /api/ressourcen ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Nur Agenturen können Ressourcen anlegen' }, { status: 403 })
  }
  if (!profile.agentur_id) {
    return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createRessourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .insert({
      ...parsed.data,
      verfuegbar_ab: parsed.data.verfuegbar_ab ?? null,
      ek_tagesrate: parsed.data.ek_tagesrate ?? null,
      notizen: parsed.data.notizen ?? null,
      agentur_id: profile.agentur_id,
    })
    .select('id, name, verfuegbarkeit, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Erstellen der Ressource' }, { status: 500 })
  }

  return NextResponse.json({ ressource }, { status: 201 })
}
