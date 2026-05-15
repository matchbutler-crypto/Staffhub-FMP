import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const createVakanzSchema = z.object({
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
  standort: z.string().nullable().optional(),
  budget_intern: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).positive('EK Tagesrate ist erforderlich'),
  weitere_kommentare: z.string().nullable().optional(),
})

// ── Hilfsfunktion: Rolle aus Profil laden ──────────────────────────────────────

async function getUserRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/vakanzen ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserRole(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const isAgentur = profile.rolle === 'Agentur'

  // Besetzt-Vakanzen nach 3 Tagen ausblenden
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // Vakanzen laden + Profil-Anzahl per JOIN
  let query = supabase
    .from('vakanzen')
    .select(`
      id,
      titel,
      branche,
      kunde,
      rolle,
      beschreibung,
      skills,
      skills_nice_have,
      erfahrungslevel,
      startdatum,
      laufzeit,
      teamgroesse,
      fte_anzahl,
      auslastung,
      arbeitsmodell,
      ansprechpartner,
      status,
      besetzt_seit,
      standort,
      published,
      budget_intern,
      weitere_kommentare,
      slack_ts,
      slack_detail_posted_at,
      created_at,
      kandidaten_profile(count),
      ressource_vakanz_links(count)
    `)
    .or(`status.neq.Besetzt,besetzt_seit.gt.${threeDaysAgo},besetzt_seit.is.null`)
    .order('created_at', { ascending: false })
    .limit(200)

  // Agenturen sehen nur veröffentlichte Vakanzen
  if (isAgentur) {
    query = query.eq('published', true)
  }

  const { data: vakanzen, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Vakanzen' }, { status: 500 })
  }

  // budget_intern + slack_ts für Agentur-Rolle herausfiltern + profile_anzahl normalisieren
  const result = (vakanzen ?? []).map((v) => {
    const { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, kandidaten_profile, ressource_vakanz_links, ...rest } = v
    const profilCount = (kandidaten_profile as { count: number }[])?.[0]?.count ?? 0
    const linkCount = (ressource_vakanz_links as { count: number }[])?.[0]?.count ?? 0
    return {
      ...rest,
      profile_anzahl: profilCount + linkCount,
      ...(isAgentur ? {} : { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare }),
    }
  })
  // published-Feld nicht an Agenturen weitergeben (sie sehen ohnehin nur published=true)
  if (isAgentur) {
    return NextResponse.json({ vakanzen: result.map(({ published: _p, ...r }) => r) })
  }

  return NextResponse.json({ vakanzen: result })
}

// ── POST /api/vakanzen ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserRole(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen_data')
    .insert({
      ...parsed.data,
      titel: parsed.data.rolle,
      status: 'Offen',
      created_by: user.id,
    })
    .select('id, titel, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Erstellen der Vakanz' }, { status: 500 })
  }

  return NextResponse.json({ vakanz }, { status: 201 })
}
