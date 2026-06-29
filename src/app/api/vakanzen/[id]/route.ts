import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'

function formatVakanzDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE')
}

function formatVakanzRate(rate: number | null | undefined): string {
  if (rate == null) return '–'
  return `${rate.toLocaleString('de-DE')} €/Tag`
}

function buildVakanzHistorieEntries(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): string[] {
  const entries: string[] = []

  if (oldData.rolle !== newData.rolle) {
    entries.push(`Rolle geändert: ${oldData.rolle ?? '–'} → ${newData.rolle ?? '–'}`)
  }
  if (oldData.status !== newData.status) {
    entries.push(`Status geändert: ${oldData.status ?? '–'} → ${newData.status ?? '–'}`)
  }
  if (oldData.branche !== newData.branche) {
    entries.push(`Branche geändert: ${oldData.branche ?? '–'} → ${newData.branche ?? '–'}`)
  }
  if (oldData.kunde !== newData.kunde) {
    entries.push(`Kunde geändert: ${oldData.kunde ?? '–'} → ${newData.kunde ?? '–'}`)
  }
  if (oldData.erfahrungslevel !== newData.erfahrungslevel) {
    entries.push(`Erfahrungslevel geändert: ${oldData.erfahrungslevel ?? '–'} → ${newData.erfahrungslevel ?? '–'}`)
  }
  if (oldData.arbeitsmodell !== newData.arbeitsmodell) {
    entries.push(`Arbeitsmodell geändert: ${oldData.arbeitsmodell ?? '–'} → ${newData.arbeitsmodell ?? '–'}`)
  }
  if (oldData.startdatum !== newData.startdatum) {
    entries.push(`Startdatum geändert: ${formatVakanzDate(oldData.startdatum as string | null)} → ${formatVakanzDate(newData.startdatum as string | null)}`)
  }
  if (oldData.enddatum !== newData.enddatum) {
    entries.push(`Enddatum geändert: ${formatVakanzDate(oldData.enddatum as string | null)} → ${formatVakanzDate(newData.enddatum as string | null)}`)
  }
  if (oldData.budget_intern !== newData.budget_intern) {
    entries.push(`EK-Budget geändert: ${formatVakanzRate(oldData.budget_intern as number | null)} → ${formatVakanzRate(newData.budget_intern as number | null)}`)
  }
  if (oldData.fte_anzahl !== newData.fte_anzahl) {
    entries.push(`FTE geändert: ${oldData.fte_anzahl ?? '–'} → ${newData.fte_anzahl ?? '–'}`)
  }
  if (oldData.auslastung !== newData.auslastung) {
    entries.push(`Auslastung geändert: ${oldData.auslastung ?? '–'}% → ${newData.auslastung ?? '–'}%`)
  }
  if (oldData.standort !== newData.standort) {
    entries.push(`Standort geändert: ${oldData.standort ?? '–'} → ${newData.standort ?? '–'}`)
  }

  if (JSON.stringify(oldData.skills) !== JSON.stringify(newData.skills)) {
    const oldSkills = (oldData.skills as string[]) ?? []
    const newSkills = (newData.skills as string[]) ?? []
    const added = newSkills.filter((s) => !oldSkills.includes(s)).map((s) => `+${s}`)
    const removed = oldSkills.filter((s) => !newSkills.includes(s)).map((s) => `-${s}`)
    const diff = [...added, ...removed].join(', ')
    if (diff) entries.push(`Skills aktualisiert: ${diff}`)
  }

  if (JSON.stringify(oldData.skills_nice_have) !== JSON.stringify(newData.skills_nice_have)) {
    const oldSkills = (oldData.skills_nice_have as string[]) ?? []
    const newSkills = (newData.skills_nice_have as string[]) ?? []
    const added = newSkills.filter((s) => !oldSkills.includes(s)).map((s) => `+${s}`)
    const removed = oldSkills.filter((s) => !newSkills.includes(s)).map((s) => `-${s}`)
    const diff = [...added, ...removed].join(', ')
    if (diff) entries.push(`Nice-Have-Skills aktualisiert: ${diff}`)
  }

  return entries
}

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
      arbeitsmodell, onsite_anteil, ansprechpartner, status, standort, published, published_at,
      budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, created_at, vakanz_nr,
      external_ref, kandidaten_profile(count)
    `)
    .eq('id', id)

  // Agentur: nur veröffentlichte Vakanzen, AUSSER sie haben eine Ressource auf dieser Vakanz eingereicht
  if (isAgentur) {
    const { data: eigenerLink } = await supabase
      .from('ressource_vakanz_links')
      .select('id')
      .eq('vakanz_id', id)
      .limit(1)
      .maybeSingle()

    if (!eigenerLink) {
      vakanzQuery = vakanzQuery.eq('published', true)
    }
    // Hat Link → Vakanz auch bei published=false anzeigen (z.B. nach Besetzt-Setzen)
  }

  let { data: vakanz, error } = await vakanzQuery.single()

  // Fallback für Agentur mit Link: RLS könnte published=false blockieren → Service Role
  if ((error || !vakanz) && isAgentur) {
    const { data: eigenerLink } = await supabase
      .from('ressource_vakanz_links')
      .select('id')
      .eq('vakanz_id', id)
      .limit(1)
      .maybeSingle()

    if (eigenerLink) {
      const serviceSupabase = createServiceRoleClient()
      const { data: vakanzSR, error: errSR } = await serviceSupabase
        .from('vakanzen')
        .select(`
          id, titel, branche, kunde, rolle, beschreibung, skills, skills_nice_have,
          erfahrungslevel, startdatum, enddatum, teamgroesse, fte_anzahl, auslastung,
          arbeitsmodell, onsite_anteil, ansprechpartner, status, standort, published, published_at,
          budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, created_at, vakanz_nr,
          external_ref, kandidaten_profile(count)
        `)
        .eq('id', id)
        .single()

      if (!errSR && vakanzSR) {
        vakanz = vakanzSR
        error = null
      }
    }
  }

  if (error || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  const { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, published, published_at, kandidaten_profile, ...rest } = vakanz
  return NextResponse.json({
    vakanz: {
      ...rest,
      profile_anzahl: (kandidaten_profile as { count: number }[])?.[0]?.count ?? 0,
      ...(isAgentur ? {} : { budget_intern, slack_ts, slack_detail_posted_at, weitere_kommentare, published, published_at }),
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
  status: z.enum(['Offen', 'In Auswahl', 'Ausreichend Profile', 'Besetzt', 'Pausiert', 'Geschlossen']),
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

  // Konsolidierter Old-Record-Select (für besetzt_seit-Logik, enddatum-Sync + Diff-Log)
  const { data: oldRecord } = await supabase
    .from('vakanzen_data')
    .select('rolle, branche, kunde, erfahrungslevel, arbeitsmodell, startdatum, enddatum, budget_intern, fte_anzahl, auslastung, standort, skills, skills_nice_have, status, besetzt_seit')
    .eq('id', id)
    .single()

  // besetzt_seit setzen/zurücksetzen je nach Status
  if (parsed.data.status === 'Besetzt') {
    if (!oldRecord?.besetzt_seit || oldRecord.status !== 'Besetzt') {
      updateData.besetzt_seit = new Date().toISOString()
    }
  } else {
    updateData.besetzt_seit = null
  }

  const enddatumChanged = oldRecord?.enddatum !== parsed.data.enddatum

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

  const histEntries = buildVakanzHistorieEntries(
    (oldRecord ?? {}) as Record<string, unknown>,
    parsed.data as Record<string, unknown>
  )
  for (const text of histEntries) {
    await logVakanzHistorie({ vakanzId: id, text, erstelltVon: user.id })
  }

  // Bei Enddatum-Änderung: Verfügbarkeit + Beauftragung-Enddatum für beauftragte/zugesagte Ressourcen synchronisieren
  if (enddatumChanged && parsed.data.enddatum) {
    const serviceSupabase = createServiceRoleClient()

    const { data: relevantLinks } = await serviceSupabase
      .from('ressource_vakanz_links')
      .select('id, ressource_id')
      .eq('vakanz_id', id)
      .in('status', ['Beauftragt', 'Zugesagt'])

    if (relevantLinks && relevantLinks.length > 0) {
      const ressourceIds = relevantLinks.map((l) => l.ressource_id).filter((id): id is string => id !== null)
      const linkIds = relevantLinks.map((l) => l.id)

      if (ressourceIds.length > 0) {
        await serviceSupabase
          .from('ressourcen')
          .update({ verfuegbarkeit: 'Nicht verfügbar', verfuegbar_ab: parsed.data.enddatum })
          .in('id', ressourceIds)
      }

      await serviceSupabase
        .from('beauftragungen')
        .update({ enddatum: parsed.data.enddatum })
        .in('ressource_link_id', linkIds)
    }
  }

  return NextResponse.json({ vakanz })
}
