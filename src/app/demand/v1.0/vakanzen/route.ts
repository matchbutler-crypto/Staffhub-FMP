import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

// Englische Enum-Werte → interne DB-Werte
const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior',
  MID:    'Mid',
  SENIOR: 'Senior',
  LEAD:   'Expert',
  // Interne Werte direkt durchlassen
  Junior: 'Junior',
  Mid:    'Mid',
  Senior: 'Senior',
  Expert: 'Expert',
}

const ARBEITSMODELL_MAP: Record<string, string> = {
  REMOTE: 'Remote',
  ONSITE: 'Onsite',
  HYBRID: 'Hybrid',
  Remote: 'Remote',
  Onsite: 'Onsite',
  Hybrid: 'Hybrid',
}

const createVakanzSchema = z.object({
  // Englische Felder (Magenta OS)
  externalRef:    z.string().max(255).optional(),
  title:          z.string().min(1).optional(),
  role:           z.string().min(1).optional(),
  description:    z.string().min(1).optional(),
  startDate:      z.string().min(1).optional(),
  endDate:        z.string().min(1).optional(),
  utilizationPct: z.number().int().min(1).max(100).optional(),
  seniority:      z.string().optional(),
  location: z.object({
    mode:    z.string().optional(),
    country: z.string().optional(),
    city:    z.string().optional(),
  }).optional(),
  maxRate: z.object({
    amount:   z.number().positive(),
    currency: z.string().optional(),
    per:      z.string().optional(),
  }).optional(),
  skills: z.union([
    z.array(z.string()),
    z.array(z.object({ name: z.string(), level: z.string().optional(), mandatory: z.boolean().optional() })),
  ]).optional(),
  languages: z.array(z.object({ code: z.string(), level: z.string().optional() })).optional(),

  // Interne Felder (Sören / Backoffice)
  branche:          z.string().min(1).optional(),
  kunde:            z.string().nullable().optional(),
  rolle:            z.string().min(1).optional(),
  beschreibung:     z.string().min(1).optional(),
  skills_nice_have: z.array(z.string()).max(20).optional(),
  erfahrungslevel:  z.enum(['Junior', 'Mid', 'Senior', 'Expert']).optional(),
  startdatum:       z.string().min(1).optional(),
  enddatum:         z.string().min(1).optional(),
  auslastung:       z.number().int().min(1).max(100).optional(),
  arbeitsmodell:    z.enum(['Remote', 'Hybrid', 'Onsite']).optional(),
  standort:         z.string().nullable().optional(),
  budget_intern:    z.number().positive().optional(),
  fte_anzahl:       z.number().min(0.1).optional(),
  weitere_kommentare: z.string().nullable().optional(),
}).refine(
  (d) => !!(d.rolle ?? d.role ?? d.title),
  { message: 'role oder rolle ist Pflicht' }
).refine(
  (d) => !!(d.startdatum ?? d.startDate),
  { message: 'startDate oder startdatum ist Pflicht' }
).refine(
  (d) => !!(d.enddatum ?? d.endDate),
  { message: 'endDate oder enddatum ist Pflicht' }
).refine(
  (d) => !!(d.budget_intern ?? d.maxRate?.amount),
  { message: 'maxRate.amount oder budget_intern ist Pflicht' }
)

function toDbPayload(d: z.infer<typeof createVakanzSchema>) {
  // Skills: strukturierte Objekte → nur Name-Array
  const rawSkills = d.skills ?? []
  const skillNames = rawSkills.map((s) =>
    typeof s === 'string' ? s : s.name
  )

  const erfahrungslevel = d.erfahrungslevel
    ?? (d.seniority ? SENIORITY_MAP[d.seniority] : undefined)
    ?? 'Mid'

  const arbeitsmodell = d.arbeitsmodell
    ?? (d.location?.mode ? ARBEITSMODELL_MAP[d.location.mode] : undefined)
    ?? 'Remote'

  return {
    external_ref:      d.externalRef ?? null,
    rolle:             d.rolle ?? d.role ?? d.title!,
    branche:           d.branche ?? 'IT',
    kunde:             d.kunde ?? null,
    beschreibung:      d.beschreibung ?? d.description ?? '',
    skills:            skillNames.length > 0 ? skillNames : [],
    skills_nice_have:  d.skills_nice_have ?? [],
    erfahrungslevel,
    startdatum:        d.startdatum ?? d.startDate!,
    enddatum:          d.enddatum ?? d.endDate!,
    fte_anzahl:        d.fte_anzahl ?? 1,
    auslastung:        d.auslastung ?? d.utilizationPct ?? 100,
    arbeitsmodell,
    onsite_anteil:     null,
    standort:          d.standort ?? d.location?.city ?? null,
    ansprechpartner:   null,
    budget_intern:     d.budget_intern ?? d.maxRate?.amount!,
    weitere_kommentare: d.weitere_kommentare ?? null,
    status:            'Offen',
  }
}

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const since = request.nextUrl.searchParams.get('since')
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  let query = supabase
    .from('vakanzen')
    .select('id, external_ref, vakanz_nr, branche, rolle, status, published, published_at, startdatum, enddatum, fte_anzahl, auslastung, arbeitsmodell, erfahrungslevel, standort, budget_intern, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gte('updated_at', since)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden der Vakanzen' } }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:create')
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = createVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().formErrors[0] ?? 'Validierungsfehler' }, details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const payload = toDbPayload(parsed.data)

  // Idempotenz: wenn externalRef gesetzt und bereits vorhanden → UPDATE
  if (payload.external_ref) {
    const { data: existing } = await supabase
      .from('vakanzen_data')
      .select('id')
      .eq('external_ref', payload.external_ref)
      .maybeSingle()

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('vakanzen_data')
        .update(payload)
        .eq('id', existing.id)
        .select('id, external_ref, vakanz_nr, rolle, status, updated_at')
        .single()

      if (updateError) return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
      return NextResponse.json({ vakanz: updated }, { status: 200 })
    }
  }

  const { data, error } = await supabase
    .from('vakanzen_data')
    .insert(payload)
    .select('id, external_ref, vakanz_nr, rolle, status, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: { code: 'INSERT_FAILED', message: 'Fehler beim Erstellen der Vakanz' } }, { status: 500 })
  return NextResponse.json({ vakanz: data }, { status: 201 })
}
