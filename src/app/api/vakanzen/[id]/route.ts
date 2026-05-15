import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/vakanzen/[id] ─────────────────────────────────────────────────────

export async function GET(
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

  const isAgentur = profile.rolle === 'Agentur'

  let vakanzQuery = supabase
    .from('vakanzen')
    .select(`
      id, titel, branche, kunde, rolle, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, teamgroesse, fte_anzahl, auslastung,
      arbeitsmodell, onsite_anteil, ansprechpartner, status, standort, published,
      budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, created_at,
      kandidaten_profile(count)
    `)
    .eq('id', id)

  // Agentur darf nicht-veröffentlichte Vakanzen nicht einsehen
  if (isAgentur) {
    vakanzQuery = vakanzQuery.eq('published', true)
  }

  const { data: vakanz, error } = await vakanzQuery.single()

  if (error || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  const { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, published, kandidaten_profile, ...rest } = vakanz
  return NextResponse.json({
    vakanz: {
      ...rest,
      profile_anzahl: (kandidaten_profile as { count: number }[])?.[0]?.count ?? 0,
      ...(isAgentur ? {} : { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, published }),
    },
  })
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const updateVakanzSchema = z.object({
  branche: z.string().min(1, 'Branche ist erforderlich'),
  kunde: z.string().nullable().optional(),
  rolle: z.string().min(1, 'Rolle ist erforderlich'),
  beschreibung: z.string().min(1, 'Projektkontext ist erforderlich'),
  skills: z.array(z.string()).min(1, 'Mindestens ein Must-Have-Skill erforderlich').max(20),
  skills_nice_have: z.array(z.string()).max(20).optional().default([]),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  startdatum: z.string().min(1, 'Projektstart ist erforderlich'),
  enddatum: z.string().min(1, 'Projektende ist erforderlich'),
  teamgroesse: z.number().int().min(1).nullable().optional(),
  fte_anzahl: z.number().min(0.1, 'FTE Anzahl ist erforderlich'),
  auslastung: z.number().int().min(1).max(100).optional().default(100),
  arbeitsmodell: z.enum(['Remote', 'Hybrid', 'Onsite']),
  onsite_anteil: z.number().int().min(0).max(100).nullable().optional(),
  ansprechpartner: z.string().nullable().optional(),
  status: z.enum(['Offen', 'In Auswahl', 'Besetzt', 'Pausiert', 'Geschlossen']),
  standort: z.string().nullable().optional(),
  budget_intern: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).positive('EK Tagesrate ist erforderlich'),
  weitere_kommentare: z.string().nullable().optional(),
})

// ── PUT /api/vakanzen/[id] ─────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
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

  const body = await request.json().catch(() => null)
  const parsed = updateVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // budget_intern nur speichern wenn Manager/Admin
  const updateData: Record<string, unknown> = {
    titel: parsed.data.rolle,
    branche: parsed.data.branche,
    kunde: parsed.data.kunde ?? null,
    rolle: parsed.data.rolle,
    beschreibung: parsed.data.beschreibung,
    skills: parsed.data.skills,
    skills_nice_have: parsed.data.skills_nice_have ?? [],
    erfahrungslevel: parsed.data.erfahrungslevel,
    startdatum: parsed.data.startdatum,
    enddatum: parsed.data.enddatum,
    teamgroesse: parsed.data.teamgroesse ?? null,
    fte_anzahl: parsed.data.fte_anzahl,
    auslastung: parsed.data.auslastung ?? 100,
    arbeitsmodell: parsed.data.arbeitsmodell,
    onsite_anteil: parsed.data.onsite_anteil ?? null,
    ansprechpartner: parsed.data.ansprechpartner ?? null,
    status: parsed.data.status,
    standort: parsed.data.standort ?? null,
    budget_intern: parsed.data.budget_intern,
    weitere_kommentare: parsed.data.weitere_kommentare ?? null,
  }

  // besetzt_seit setzen/zurücksetzen je nach Status
  if (parsed.data.status === 'Besetzt') {
    const { data: existing } = await supabase
      .from('vakanzen')
      .select('besetzt_seit, status')
      .eq('id', id)
      .single()
    if (!existing?.besetzt_seit || existing.status !== 'Besetzt') {
      updateData.besetzt_seit = new Date().toISOString()
    }
  } else {
    updateData.besetzt_seit = null
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen_data')
    .update(updateData)
    .eq('id', id)
    .select('id, titel, status, besetzt_seit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Vakanz' }, { status: 500 })
  }

  return NextResponse.json({ vakanz })
}
