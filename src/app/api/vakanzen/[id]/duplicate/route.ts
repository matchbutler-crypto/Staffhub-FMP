import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── POST /api/vakanzen/[id]/duplicate ─────────────────────────────────────────

export async function POST(
  _request: NextRequest,
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
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Originale Vakanz laden
  const { data: original, error: fetchError } = await supabase
    .from('vakanzen')
    .select(`
      branche, kunde, rolle, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, teamgroesse, fte_anzahl,
      auslastung, arbeitsmodell, onsite_anteil, ansprechpartner, standort,
      budget_intern, weitere_kommentare
    `)
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  // Neue Vakanz anlegen — ohne Ressourcen/Profile, frischer Status
  const { data: duplicate, error: insertError } = await supabase
    .from('vakanzen_data')
    .insert({
      branche: original.branche,
      kunde: original.kunde ?? null,
      rolle: original.rolle,
      titel: original.rolle,
      beschreibung: original.beschreibung,
      skills: original.skills,
      skills_nice_have: original.skills_nice_have ?? [],
      erfahrungslevel: original.erfahrungslevel,
      startdatum: original.startdatum,
      enddatum: original.enddatum ?? null,
      teamgroesse: original.teamgroesse ?? null,
      fte_anzahl: original.fte_anzahl,
      auslastung: original.auslastung ?? 100,
      arbeitsmodell: original.arbeitsmodell,
      onsite_anteil: original.onsite_anteil ?? null,
      ansprechpartner: original.ansprechpartner ?? null,
      standort: original.standort ?? null,
      budget_intern: original.budget_intern ?? null,
      weitere_kommentare: original.weitere_kommentare ?? null,
      status: 'Offen',
      published: false,
      created_by: user.id,
    })
    .select('id, rolle')
    .single()

  if (insertError || !duplicate) {
    return NextResponse.json({ error: 'Fehler beim Duplizieren der Vakanz' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: duplicate }, { status: 201 })
}
