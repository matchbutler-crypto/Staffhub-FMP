import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const spielenSchema = z.object({
  vakanz_id: z.string().uuid('Ungültige Vakanz-ID'),
})

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

async function validateResourceAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ressourceId: string
): Promise<{ available: boolean; reason?: string }> {
  // Check if resource is currently beauftragt via ressource_vakanz_links
  const { data: aktiveLinks, error: linkError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', ressourceId)
    .eq('status', 'Beauftragt')

  if (linkError) {
    console.error('Error checking active links:', linkError)
    return { available: false, reason: 'Fehler bei der Verfügbarkeitsprüfung' }
  }

  if ((aktiveLinks?.length ?? 0) > 0) {
    return { available: false, reason: 'Diese Ressource ist derzeit beauftragt' }
  }

  return { available: true }
}

// ── POST /api/ressourcen/[id]/spielen ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ressourceId } = await params
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
  const isAgentur = profile.rolle === 'Agentur'
  if (!isManager && !isAgentur) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = spielenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { vakanz_id } = parsed.data

  // Ressource prüfen (existiert + nicht deaktiviert + Ownership für Agentur)
  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('id, name, verfuegbarkeit, agentur_id')
    .eq('id', ressourceId)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (isAgentur && ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Ressource' }, { status: 403 })
  }
  if (ressource.verfuegbarkeit === 'Deaktiviert') {
    return NextResponse.json({ error: 'Deaktivierte Ressource kann nicht gespielt werden' }, { status: 400 })
  }

  // Validate resource availability
  const validation = await validateResourceAvailability(supabase, ressourceId)
  if (!validation.available) {
    return NextResponse.json(
      { error: validation.reason || 'Ressource nicht verfügbar' },
      { status: 403 }
    )
  }

  // Vakanz prüfen (existiert + offen)
  const { data: vakanz } = await supabase
    .from('vakanzen_data')
    .select('id, rolle, status')
    .eq('id', vakanz_id)
    .single()

  if (!vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }
  if (vakanz.status === 'Geschlossen' || vakanz.status === 'Besetzt') {
    return NextResponse.json({ error: 'Ressource kann nur auf offene Vakanzen gespielt werden' }, { status: 400 })
  }

  // Prüfen ob bereits ein zurückgezogener Link existiert → dann re-aktivieren
  const { data: existingLink } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', ressourceId)
    .eq('vakanz_id', vakanz_id)
    .single()

  let link: { id: string; ressource_id: string; vakanz_id: string; status: string; created_at: string }

  if (existingLink?.status === 'Zurückgezogen') {
    // Zurückgezogene Einreichung reaktivieren
    const { data: updated, error: updateError } = await supabase
      .from('ressource_vakanz_links')
      .update({ status: 'Gespielt', grund_rueckzug: null })
      .eq('id', existingLink.id)
      .select('id, ressource_id, vakanz_id, status, created_at')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Fehler beim erneuten Einreichen' }, { status: 500 })
    }
    link = updated
  } else if (existingLink) {
    // Aktiver Link (Gespielt, Beauftragt etc.) → kein Duplikat
    return NextResponse.json(
      { error: 'Diese Ressource ist bereits auf diese Vakanz gespielt' },
      { status: 409 }
    )
  } else {
    // Neuer Link anlegen
    const { data: inserted, error: insertError } = await supabase
      .from('ressource_vakanz_links')
      .insert({
        ressource_id: ressourceId,
        vakanz_id,
        status: 'Gespielt',
        created_by: user.id,
      })
      .select('id, ressource_id, vakanz_id, status, created_at')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: 'Fehler beim Spielen der Ressource' }, { status: 500 })
    }
    link = inserted
  }

  // Automatischer Historien-Eintrag
  await supabase.from('ressource_historie').insert({
    ressource_id: ressourceId,
    link_id: link.id,
    typ: 'system',
    text: `Auf Vakanz "${vakanz.rolle}" gespielt`,
    erstellt_von: user.id,
  })

  return NextResponse.json({ link }, { status: 201 })
}
