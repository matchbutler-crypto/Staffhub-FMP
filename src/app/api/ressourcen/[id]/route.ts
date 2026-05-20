import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().max(200).nullable().optional(),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
  // Stammdaten
  nachname: z.string().min(1).max(200).nullable().optional(),
  vorname: z.string().min(1).max(200).nullable().optional(),
  geburtsdatum: z.string().date().nullable().optional(),
  geschlecht: z.enum(['Männlich', 'Weiblich', 'Divers', 'Keine Angabe']).nullable().optional(),
  firma: z.string().min(1).max(200).nullable().optional(),
  email_geschaeftlich: z.string().email('Ungültige E-Mail').nullable().optional(),
  telefon_geschaeftlich: z.string().max(50).nullable().optional(),
  wohnort: z.string().min(1).max(200).nullable().optional(),
  namenszusatz: z.string().max(100).nullable().optional(),
  titel: z.string().max(100).nullable().optional(),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']).optional(),
  location: z.string().max(200).nullable().optional(),
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

// ── GET /api/ressourcen/[id] ───────────────────────────────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .select('*, agenturen(name)')
    .eq('id', id)
    .single()

  if (error || !ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  const { ek_tagesrate, notizen, ...rest } = ressource
  const canSeePrivate = isManager || ressource.agentur_id === profile.agentur_id
  return NextResponse.json({
    ressource: { ...rest, ...(canSeePrivate ? { ek_tagesrate, notizen } : {}) },
  })
}

// ── PUT /api/ressourcen/[id] ───────────────────────────────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRessourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .update({
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: parsed.data.skills,
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab || null,
      ek_tagesrate: parsed.data.ek_tagesrate ?? null,
      notizen: parsed.data.notizen ?? null,
      nachname: parsed.data.nachname ?? null,
      vorname: parsed.data.vorname ?? null,
      geburtsdatum: parsed.data.geburtsdatum ?? null,
      geschlecht: parsed.data.geschlecht ?? null,
      firma: parsed.data.firma ?? null,
      email_geschaeftlich: parsed.data.email_geschaeftlich ?? null,
      telefon_geschaeftlich: parsed.data.telefon_geschaeftlich ?? null,
      wohnort: parsed.data.wohnort ?? null,
      namenszusatz: parsed.data.namenszusatz ?? null,
      titel: parsed.data.titel ?? null,
      arbeitsmodell: parsed.data.arbeitsmodell ?? 'Onshore',
      location: parsed.data.location ?? null,
    })
    .eq('id', id)
    .select('id, name, verfuegbarkeit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ ressource })
}

// ── PATCH /api/ressourcen/[id] ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRessourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .update({
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: parsed.data.skills,
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab || null,
      ek_tagesrate: parsed.data.ek_tagesrate ?? null,
      notizen: parsed.data.notizen ?? null,
      nachname: parsed.data.nachname ?? null,
      vorname: parsed.data.vorname ?? null,
      geburtsdatum: parsed.data.geburtsdatum ?? null,
      geschlecht: parsed.data.geschlecht ?? null,
      firma: parsed.data.firma ?? null,
      email_geschaeftlich: parsed.data.email_geschaeftlich ?? null,
      telefon_geschaeftlich: parsed.data.telefon_geschaeftlich ?? null,
      wohnort: parsed.data.wohnort ?? null,
      namenszusatz: parsed.data.namenszusatz ?? null,
      titel: parsed.data.titel ?? null,
      arbeitsmodell: parsed.data.arbeitsmodell ?? 'Onshore',
      location: parsed.data.location ?? null,
    })
    .eq('id', id)
    .select('id, name, verfuegbarkeit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ ressource })
}
