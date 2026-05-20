import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bewerteProfilMitOpenAI } from '@/lib/openai'

// ── GET /api/profile/[id]/ki-bewertung ────────────────────────────────────────
// Gibt die letzte KI-Bewertung für das Profil zurück.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv').eq('id', user.id).single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  const { data, error } = await supabase
    .from('ki_bewertungen')
    .select('*')
    .eq('profil_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ bewertung: null })
    return NextResponse.json({ error: 'Fehler beim Laden der KI-Bewertung' }, { status: 500 })
  }

  return NextResponse.json({ bewertung: data })
}

// ── POST /api/profile/[id]/ki-bewertung ───────────────────────────────────────
// Triggert eine neue KI-Bewertung via OpenAI und speichert das Ergebnis.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: userProfile } = await supabase
    .from('profiles').select('rolle, aktiv, agentur_id').eq('id', user.id).single()
  if (!userProfile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  // Profil + Vakanz aus DB laden
  const { data: profil, error: profilError } = await supabase
    .from('kandidaten_profile')
    .select(`
      id, kandidatenname, skills, erfahrungslevel, profiltext, agentur_id,
      vakanzen!inner(titel, beschreibung, skills, erfahrungslevel)
    `)
    .eq('id', id)
    .single()

  if (profilError || !profil) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  // Agentur darf nur eigene Profile bewerten
  const isManager = userProfile.rolle === 'Staffhub Manager' || userProfile.rolle === 'Admin'
  const isOwnProfile = userProfile.rolle === 'Agentur' && profil.agentur_id === userProfile.agentur_id
  if (!isManager && !isOwnProfile) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const vakanz = profil.vakanzen as unknown as {
    titel: string
    beschreibung: string
    skills: string[]
    erfahrungslevel: string
  }

  // OpenAI-Bewertung
  let result
  try {
    result = await bewerteProfilMitOpenAI(
      {
        titel: vakanz.titel,
        beschreibung: vakanz.beschreibung ?? '',
        skills: Array.isArray(vakanz.skills) ? vakanz.skills : [],
        erfahrungslevel: vakanz.erfahrungslevel ?? '',
      },
      {
        kandidatenname: profil.kandidatenname,
        skills: Array.isArray(profil.skills) ? profil.skills : [],
        erfahrungslevel: profil.erfahrungslevel ?? '',
        profiltext: profil.profiltext ?? '',
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: `OpenAI-Fehler: ${msg}` },
      { status: 503 }
    )
  }

  // Ergebnis in DB speichern
  const { data: bewertung, error: insertError } = await supabase
    .from('ki_bewertungen')
    .insert({
      profil_id: id,
      score: result.score,
      empfehlung: result.empfehlung,
      begruendung: result.begruendung,
      skill_vorhanden: result.skill_vorhanden,
      skill_fehlend: result.skill_fehlend,
      model: result.model,
    })
    .select('*')
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Fehler beim Speichern der KI-Bewertung' }, { status: 500 })
  }

  // ki_score auf kandidaten_profile aktualisieren (für Listenansicht)
  await supabase
    .from('kandidaten_profile')
    .update({ ki_score: result.score })
    .eq('id', id)

  return NextResponse.json({ bewertung }, { status: 201 })
}
