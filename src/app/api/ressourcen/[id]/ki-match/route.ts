import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { bewerteProfilMitOpenAI } from '@/lib/openai'

const postSchema = z.object({
  vakanz_id: z.string().uuid(),
})

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ressourcen/[id]/ki-match?vakanz_id=<uuid> ──────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const profile = await getProfile(supabase, user.id)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id: ressourceId } = await params
  const vakanzId = request.nextUrl.searchParams.get('vakanz_id')

  // Agentur darf nur eigene Ressourcen sehen
  if (profile.rolle === 'Agentur') {
    const { data: ressource } = await supabase
      .from('ressourcen')
      .select('agentur_id')
      .eq('id', ressourceId)
      .single()
    if (!ressource || ressource.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }
  }

  let query = supabase
    .from('ressource_ki_scores')
    .select('*')
    .eq('ressource_id', ressourceId)

  if (vakanzId) {
    query = query.eq('vakanz_id', vakanzId)
  }

  const { data: scores } = await query.order('berechnet_am', { ascending: false }).limit(1)
  const score = scores?.[0] ?? null

  return NextResponse.json({ score })
}

// ── POST /api/ressourcen/[id]/ki-match ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const profile = await getProfile(supabase, user.id)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (profile.rolle !== 'Agentur' && profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
  }
  const { vakanz_id } = parsed.data
  const { id: ressourceId } = await params

  // Ressource laden
  const { data: ressource, error: ressourceError } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, notizen, agentur_id')
    .eq('id', ressourceId)
    .single()
  if (ressourceError || !ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  // Agentur darf nur eigene Ressourcen matchen
  if (profile.rolle === 'Agentur' && ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // Vakanz laden
  const { data: vakanz, error: vakanzError } = await supabase
    .from('vakanzen_data')
    .select('id, titel, rolle, beschreibung, skills, erfahrungslevel')
    .eq('id', vakanz_id)
    .single()
  if (vakanzError || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  // OpenAI KI-Bewertung
  let result
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API nicht konfiguriert' },
        { status: 503 }
      )
    }
    result = await bewerteProfilMitOpenAI(
      {
        titel: vakanz.titel || vakanz.rolle,
        beschreibung: vakanz.beschreibung ?? '',
        skills: vakanz.skills ?? [],
        erfahrungslevel: vakanz.erfahrungslevel,
      },
      {
        kandidatenname: ressource.name,
        skills: ressource.skills ?? [],
        erfahrungslevel: ressource.erfahrungslevel,
        profiltext: ressource.notizen ?? 'Keine Notizen vorhanden',
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI-Fehler'
    console.error('KI-Bewertung error:', msg)
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }

  // Score per UPSERT speichern
  const { data: score, error: upsertError } = await supabase
    .from('ressource_ki_scores')
    .upsert(
      {
        ressource_id: ressourceId,
        vakanz_id,
        score: result.score,
        empfehlung: result.empfehlung,
        begruendung: result.begruendung,
        skill_vorhanden: result.skill_vorhanden,
        skill_fehlend: result.skill_fehlend,
        model: result.model,
        berechnet_am: new Date().toISOString(),
        berechnet_von: user.id,
      },
      { onConflict: 'ressource_id,vakanz_id' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: 'Score konnte nicht gespeichert werden' }, { status: 500 })
  }

  return NextResponse.json({ score })
}
