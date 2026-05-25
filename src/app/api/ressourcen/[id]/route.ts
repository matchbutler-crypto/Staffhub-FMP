import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Fetch beauftragungen via ressource_vakanz_links
    const { data: links } = await supabase
      .from('ressource_vakanz_links')
      .select(`
        id, status, created_at,
        vakanz_id,
        vakanzen_data(id, vakanz_nr, rolle, agenturen(name))
      `)
      .eq('ressource_id', id)
      .not('status', 'eq', 'Zurückgezogen')

    // Fetch actual beauftragungen table
    const { data: beauftragungen } = await supabase
      .from('beauftragungen')
      .select(`
        id, status, startdatum, enddatum,
        ressource_link_id,
        vakanzen_data(id, vakanz_nr, titel, agenturen(name))
      `)
      .in('ressource_link_id', (links ?? []).map((l: any) => l.id))

    const mappedBeauftragungen = (beauftragungen ?? []).map((b: any) => ({
      id: b.id,
      vakanz_nr: b.vakanzen_data?.vakanz_nr ?? '—',
      vakanz_titel: b.vakanzen_data?.titel ?? '—',
      status: b.status,
      startdatum: b.startdatum,
      enddatum: b.enddatum ?? null,
      agentur_name: b.vakanzen_data?.agenturen?.name ?? '—',
    }))

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
      agentur_name,
      beauftragungen: mappedBeauftragungen,
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
