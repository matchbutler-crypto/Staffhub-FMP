import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Fetch resource from ressourcen table
    const { data: ressource, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error || !ressource) {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }

    const canSeePrivate = isManager || ressource.agentur_id === profile.agentur_id

    const agenturEntry = ressource.agenturen as { name: string } | { name: string }[] | null
    const agentur_name = Array.isArray(agenturEntry)
      ? (agenturEntry[0]?.name ?? null)
      : (agenturEntry?.name ?? null)

    let readClient: any = supabase
    try {
      readClient = createAdminClient()
    } catch {
      // Fallback to user-bound client if service role is unavailable
    }

    // Fetch beauftragungen via ressource_vakanz_links
    const { data: links } = await readClient
      .from('ressource_vakanz_links')
      .select(`
        id, status, created_at,
        vakanz_id,
        vakanzen_data(id, vakanz_nr, titel, rolle, enddatum, agenturen(name))
      `)
      .eq('ressource_id', id)
      .not('status', 'eq', 'Zurückgezogen')

    // Fetch actual beauftragungen table
    const { data: beauftragungen } = await readClient
      .from('beauftragungen')
      .select(`
        id, status, startdatum, enddatum,
        ressource_link_id,
        vakanzen_data(id, vakanz_nr, titel, agenturen(name))
      `)
      .in('ressource_link_id', (links ?? []).map((l: any) => l.id))

    const linkById = new Map<string, any>((links ?? []).map((l: any) => [l.id, l]))

    const mappedBeauftragungen = (beauftragungen ?? []).map((b: any) => {
      const link: any = linkById.get(b.ressource_link_id)
      return {
      id: b.id,
      ressource_link_id: b.ressource_link_id,
      vakanz_nr: b.vakanzen_data?.vakanz_nr ?? link?.vakanzen_data?.vakanz_nr ?? '—',
      vakanz_titel: b.vakanzen_data?.titel ?? link?.vakanzen_data?.titel ?? link?.vakanzen_data?.rolle ?? '—',
      status: b.status ?? link?.status ?? 'Eingereicht',
      startdatum: b.startdatum ?? link?.created_at,
      enddatum: b.enddatum ?? link?.vakanzen_data?.enddatum ?? null,
      agentur_name: b.vakanzen_data?.agenturen?.name ?? link?.vakanzen_data?.agenturen?.name ?? '—',
    }})

    // Fallback: if no beauftragungen rows exist yet, derive display rows from active links
    const fallbackFromLinks = (links ?? []).map((l: any) => ({
      id: `link-${l.id}`,
      ressource_link_id: l.id,
      vakanz_nr: l.vakanzen_data?.vakanz_nr ?? '—',
      vakanz_titel: l.vakanzen_data?.titel ?? l.vakanzen_data?.rolle ?? '—',
      status: l.status ?? 'Eingereicht',
      startdatum: l.created_at,
      enddatum: l.vakanzen_data?.enddatum ?? null,
      agentur_name: l.vakanzen_data?.agenturen?.name ?? '—',
    }))

    // Merge beauftragungen from DB with fallback links so active link assignments are never lost in UI
    const mergedMap = new Map<string, any>()
    for (const row of mappedBeauftragungen) {
      const key = row.ressource_link_id ?? row.id
      mergedMap.set(key, row)
    }
    for (const row of fallbackFromLinks) {
      const key = row.ressource_link_id ?? row.id
      if (!mergedMap.has(key)) mergedMap.set(key, row)
    }
    const mergedBeauftragungen = Array.from(mergedMap.values())

    const today = new Date().toISOString().slice(0, 10)
    const laufendeBeauftragung = mergedBeauftragungen.find((b: any) => {
      const start = (b.startdatum ?? '').slice(0, 10)
      const end = b.enddatum ? b.enddatum.slice(0, 10) : null
      const inTimeRange = start ? start <= today && (!end || end >= today) : true
      const isActiveStatus = b.status === 'Beauftragt' || b.status === 'Aktiv'
      return isActiveStatus && inTimeRange
    }) ?? null

    const {
      agenturen,
      email_geschaeftlich,
      telefon_geschaeftlich,
      ek_tagesrate,
      nachname, vorname, geburtsdatum, geschlecht,
      firma, wohnort, namenszusatz, titel,
      notizen,
      ...publicRest
    } = ressource

    const base = {
      ...publicRest,
      verfuegbarkeit: laufendeBeauftragung ? 'Beauftragt' : publicRest.verfuegbarkeit,
      verfuegbar_ab: laufendeBeauftragung?.enddatum ?? publicRest.verfuegbar_ab,
      agentur_name,
      beauftragungen: mergedBeauftragungen,
    }

    if (canSeePrivate) {
      return NextResponse.json({
        ...base,
        // Map DB field names to what the detail page expects
        email: email_geschaeftlich ?? null,
        telefon: telefon_geschaeftlich ?? null,
        ek_tagesrate: ek_tagesrate ?? null,
        nachname: nachname ?? null,
        vorname: vorname ?? null,
        geburtsdatum: geburtsdatum ?? null,
        geschlecht: geschlecht ?? null,
        firma: firma ?? null,
        wohnort: wohnort ?? null,
        namenszusatz: namenszusatz ?? null,
        titel: titel ?? null,
        notizen: notizen ?? null,
      })
    }

    return NextResponse.json(base)
  } catch (err) {
    console.error('Error fetching resource:', err)
    return NextResponse.json({ error: 'Fehler beim Laden der Ressource' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Check ownership
    const { data: ressource } = await supabase
      .from('ressourcen')
      .select('agentur_id')
      .eq('id', id)
      .single()

    const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
    if (!isManager && ressource?.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('ressourcen')
      .update({
        vorname: body.vorname,
        nachname: body.nachname,
        geburtsdatum: body.geburtsdatum || null,
        email_geschaeftlich: body.email,
        telefon_geschaeftlich: body.telefon,
        wohnort: body.adresse,
        notizen: body.notizen,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error updating resource:', err)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Ressource' }, { status: 500 })
  }
}

// ── PATCH /api/ressourcen/[id] — Stammdaten erfassen (Pool-Seite, direkte DB-Feldnamen) ──

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Check ownership
    const { data: existing } = await supabase
      .from('ressourcen')
      .select('agentur_id')
      .eq('id', id)
      .single()

    const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
    if (!isManager && existing?.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const body = await request.json()

    // Build update object — only include fields that are present in body
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    const directFields = [
      'name', 'rolle', 'skills', 'erfahrungslevel',
      'verfuegbarkeit', 'verfuegbar_ab', 'ek_tagesrate', 'notizen',
      'arbeitsmodell', 'location',
      'nachname', 'vorname', 'geburtsdatum', 'geschlecht', 'firma',
      'email_geschaeftlich', 'telefon_geschaeftlich',
      'wohnort', 'namenszusatz', 'titel',
    ] as const

    for (const field of directFields) {
      if (field in body) {
        update[field] = body[field] ?? null
      }
    }

    const { data, error } = await supabase
      .from('ressourcen')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error patching resource:', err)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Ressource' }, { status: 500 })
  }
}
