import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createRessourceSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().max(200).nullable().optional(),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich').max(30),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
  ek_tagesrate: z.number().positive().nullable().optional(),
  notizen: z.string().max(2000).nullable().optional(),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']).optional(),
  location: z.string().max(200).nullable().optional(),
  tempCvPfad: z.string().max(500).optional(),
}).refine(
  (d) => d.verfuegbarkeit !== 'Verfügbar ab' || !!d.verfuegbar_ab,
  { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ['verfuegbar_ab'] }
)

function normalizeSkillNames(skills: string[]): string[] {
  const normalized = new Map<string, string>()

  for (const skill of skills) {
    const trimmed = skill.trim()
    if (!trimmed) continue

    const key = trimmed.toLowerCase()
    if (!normalized.has(key)) {
      normalized.set(key, trimmed)
    }
  }

  return Array.from(normalized.values())
}

async function generateNextRessourceCode(supabaseAdmin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('ressourcen')
    .select('ressource_code')
    .like('ressource_code', 'D3XP%')
    .order('ressource_code', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Ressourcen-Code konnte nicht erzeugt werden: ${error.message}`)
  }

  const latestCode = data?.[0]?.ressource_code
  const latestNumber =
    typeof latestCode === 'string'
      ? Number.parseInt(latestCode.replace(/^D3XP/, ''), 10)
      : 0
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1

  return `D3XP${String(nextNumber).padStart(4, '0')}`
}

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
      id, ressource_code, agentur_id, name, rolle, skills, erfahrungslevel,
      verfuegbarkeit, verfuegbar_ab, cv_pfad,
      ek_tagesrate, notizen, created_at, updated_at,
      arbeitsmodell, location,
      nachname, vorname, geburtsdatum, geschlecht, firma,
      email_geschaeftlich, telefon_geschaeftlich, wohnort, namenszusatz, titel,
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

  // Separate query for link counts — RLS filters to own resources for Agentur
  const [{ data: linkCountRows, error: linkCountError }, { data: beauftragtLinkRows, error: beauftragtError }] = await Promise.all([
    supabase.from('ressource_vakanz_links').select('ressource_id'),
    supabase.from('ressource_vakanz_links').select('ressource_id').eq('status', 'Beauftragt'),
  ])
  if (linkCountError || beauftragtError) {
    return NextResponse.json({ error: 'Fehler beim Laden der Link-Informationen' }, { status: 500 })
  }

  const linkCountMap = new Map<string, number>()
  for (const l of (linkCountRows ?? [])) {
    const rid = (l as { ressource_id: string }).ressource_id
    linkCountMap.set(rid, (linkCountMap.get(rid) ?? 0) + 1)
  }

  const beauftragtSet = new Set((beauftragtLinkRows ?? []).map((l) => (l as { ressource_id: string }).ressource_id))

  let result = (data ?? []).map((r) => {
    const { ek_tagesrate, notizen, nachname, vorname, geburtsdatum, geschlecht,
            firma, email_geschaeftlich, telefon_geschaeftlich, wohnort,
            namenszusatz, titel, agenturen, ...rest } = r
    const canSeePrivate = isManager || r.agentur_id === profile.agentur_id
    const agenturEntry = agenturen as { name: string } | { name: string }[] | null
    const agentur_name = Array.isArray(agenturEntry) ? (agenturEntry[0]?.name ?? null) : (agenturEntry?.name ?? null)
    return {
      ...rest,
      agentur_name,
      link_count: linkCountMap.get(r.id) ?? 0,
      hat_beauftragt_link: beauftragtSet.has(r.id),
      ...(canSeePrivate ? {
        ek_tagesrate, notizen,
        nachname, vorname, geburtsdatum, geschlecht, firma,
        email_geschaeftlich, telefon_geschaeftlich, wohnort,
        namenszusatz, titel,
      } : {}),
    }
  })

  // Add bereits_gespielt + link_id + ki_score when filtering for a specific vacancy
  if (vakanzId) {
    const [{ data: links }, { data: kiScores }] = await Promise.all([
      supabase
        .from('ressource_vakanz_links')
        .select('id, ressource_id, status, created_at, feedback')
        .eq('vakanz_id', vakanzId),
      supabase
        .from('ressource_ki_scores')
        .select('ressource_id, vakanz_id, score')
        .eq('vakanz_id', vakanzId),
    ])

    const linkMap = new Map((links ?? []).map((l: { id: string; ressource_id: string; status: string; created_at: string; feedback?: string | null }) => [l.ressource_id, l]))
    const kiScoreMap = new Map((kiScores ?? []).map((k: { ressource_id: string; vakanz_id: string; score: number }) => [k.ressource_id, k.score]))

    result = result.map((r) => {
      const link = linkMap.get(r.id)
      const kiScore = kiScoreMap.get(r.id)
      // Zurückgezogene Einreichungen gelten nicht als "bereits gespielt" → können erneut eingereicht werden
      const isActiveLink = !!link && link.status !== 'Zurückgezogen'
      return {
        ...r,
        bereits_gespielt: isActiveLink,
        link_id: link?.id ?? null,
        link_status: link?.status ?? null,
        link_created_at: link?.created_at ?? null,
        link_feedback: link?.feedback ?? null,
        ki_score: kiScore ?? null
      }
    })
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
  const isAdmin = profile.rolle === 'Admin'
  const isManager = profile.rolle === 'Staffhub Manager'

  if (!isAdmin && !isManager && profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  if (!isAdmin && !isManager && !profile.agentur_id) {
    return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)

  const withAgenturSchema = createRessourceSchema.and(
    z.object({ agentur_id: z.string().uuid('Agentur ist erforderlich') })
  )
  const parsed = (isAdmin || isManager)
    ? withAgenturSchema.safeParse(body)
    : createRessourceSchema.safeParse(body)

  if (!parsed.success) {
    console.error('POST /api/ressourcen validation failed', {
      rolle: profile.rolle,
      bodyKeys: body ? Object.keys(body) : null,
      fieldErrors: parsed.error.flatten().fieldErrors,
    })
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const agenturId = (isAdmin || isManager)
    ? (parsed.data as typeof parsed.data & { agentur_id: string }).agentur_id
    : profile.agentur_id!

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch (error) {
    console.error('Ressource admin client error:', error)
    return NextResponse.json({ error: 'Server-Konfigurationsfehler' }, { status: 500 })
  }

  let ressourceCode: string
  try {
    ressourceCode = await generateNextRessourceCode(supabaseAdmin)
  } catch (error) {
    console.error('Ressource code generation error:', error)
    return NextResponse.json({ error: 'Fehler beim Erzeugen der Ressourcen-ID' }, { status: 500 })
  }

  const insertClient = (isAdmin || isManager) ? supabaseAdmin : supabase

  const { data: ressource, error } = await insertClient
    .from('ressourcen')
    .insert({
      ressource_code: ressourceCode,
      name: parsed.data.name,
      rolle: parsed.data.rolle ?? null,
      skills: normalizeSkillNames(parsed.data.skills),
      erfahrungslevel: parsed.data.erfahrungslevel,
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbar_ab || null,
      ek_tagesrate: parsed.data.ek_tagesrate ?? null,
      notizen: parsed.data.notizen ?? null,
      arbeitsmodell: parsed.data.arbeitsmodell ?? 'Onshore',
      location: parsed.data.location ?? null,
      agentur_id: agenturId,
    })
    .select('id, name, verfuegbarkeit, created_at')
    .single()

  if (error) {
    console.error('Ressource insert error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Erstellen der Ressource' }, { status: 500 })
  }

  // Temp CV von bulk-temp/ in finalen Pfad verschieben
  if (parsed.data.tempCvPfad && parsed.data.tempCvPfad.startsWith(`bulk-temp/${agenturId}/`)) {
    const finalCvPfad = `${agenturId}/${ressource.id}.pdf`
    const { error: moveError } = await supabaseAdmin.storage
      .from('ressourcen-cvs')
      .move(parsed.data.tempCvPfad, finalCvPfad)

    if (!moveError) {
      const { error: updateError } = await supabaseAdmin
        .from('ressourcen')
        .update({ cv_pfad: finalCvPfad })
        .eq('id', ressource.id)
      if (updateError) {
        console.error('cv_pfad update failed after move:', ressource.id, updateError.message)
      }
    }
  }

  return NextResponse.json({ ressource }, { status: 201 })
}
