import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const createVakanzSchema = z.object({
  titel: z.string().min(1, 'Titel ist erforderlich'),
  rolle: z.string().min(1, 'Rolle ist erforderlich'),
  beschreibung: z.string().min(1, 'Beschreibung ist erforderlich'),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(20),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  startdatum: z.string().min(1, 'Startdatum ist erforderlich'),
  laufzeit: z.string().min(1, 'Laufzeit ist erforderlich'),
  auslastung: z.number().int().min(1).max(100),
  arbeitsmodell: z.enum(['Remote', 'Hybrid', 'Onsite']),
  standort: z.string().nullable().optional(),
  budget_intern: z.number().nullable().optional(),
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

  // Vakanzen laden + Profil-Anzahl per JOIN
  const { data: vakanzen, error } = await supabase
    .from('vakanzen')
    .select(`
      id,
      titel,
      rolle,
      beschreibung,
      skills,
      erfahrungslevel,
      startdatum,
      laufzeit,
      auslastung,
      arbeitsmodell,
      status,
      standort,
      budget_intern,
      created_at,
      kandidaten_profile(count)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Vakanzen' }, { status: 500 })
  }

  // budget_intern für Agentur-Rolle herausfiltern + profile_anzahl normalisieren
  const result = (vakanzen ?? []).map((v) => {
    const { budget_intern, kandidaten_profile, ...rest } = v
    return {
      ...rest,
      profile_anzahl: (kandidaten_profile as { count: number }[])?.[0]?.count ?? 0,
      ...(isAgentur ? {} : { budget_intern }),
    }
  })

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
    .from('vakanzen')
    .insert({
      ...parsed.data,
      status: 'Offen',
    })
    .select('id, titel, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Erstellen der Vakanz' }, { status: 500 })
  }

  return NextResponse.json({ vakanz }, { status: 201 })
}
