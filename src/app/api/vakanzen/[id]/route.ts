import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const updateVakanzSchema = z.object({
  titel: z.string().min(1, 'Titel ist erforderlich'),
  rolle: z.string().min(1, 'Rolle ist erforderlich'),
  beschreibung: z.string().min(1, 'Beschreibung ist erforderlich'),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(20),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  startdatum: z.string().min(1, 'Startdatum ist erforderlich'),
  laufzeit: z.string().min(1, 'Laufzeit ist erforderlich'),
  auslastung: z.number().int().min(1).max(100),
  arbeitsmodell: z.enum(['Remote', 'Hybrid', 'Onsite']),
  status: z.enum(['Offen', 'In Auswahl', 'Besetzt', 'Pausiert', 'Geschlossen']),
  standort: z.string().nullable().optional(),
  budget_intern: z.number().nullable().optional(),
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
    titel: parsed.data.titel,
    rolle: parsed.data.rolle,
    beschreibung: parsed.data.beschreibung,
    skills: parsed.data.skills,
    erfahrungslevel: parsed.data.erfahrungslevel,
    startdatum: parsed.data.startdatum,
    laufzeit: parsed.data.laufzeit,
    auslastung: parsed.data.auslastung,
    arbeitsmodell: parsed.data.arbeitsmodell,
    status: parsed.data.status,
    standort: parsed.data.standort ?? null,
    budget_intern: parsed.data.budget_intern ?? null,
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen')
    .update(updateData)
    .eq('id', id)
    .select('id, titel, status, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Vakanz' }, { status: 500 })
  }

  return NextResponse.json({ vakanz })
}
