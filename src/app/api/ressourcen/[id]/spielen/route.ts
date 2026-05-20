import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isResourceUnavailable, type Beauftragung } from '@/lib/resource-availability'

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
  // Check resource status
  const { data: ressource, error: resError } = await supabase
    .from('ressourcen')
    .select('status')
    .eq('id', ressourceId)
    .single()

  if (resError || !ressource) {
    return { available: false, reason: 'Ressource nicht gefunden' }
  }

  if (ressource.status === 'nicht_verfügbar') {
    return { available: false, reason: 'Diese Ressource ist derzeit nicht verfügbar' }
  }

  // Check for active beauftragungen for this resource
  const { data: beauftragungen, error: baufError } = await supabase
    .from('beauftragungen')
    .select('id, start_date, end_date')
    .eq('ressource_id', ressourceId)

  if (baufError) {
    console.error('Error checking beauftragungen:', baufError)
    return { available: false, reason: 'Fehler bei der Verfügbarkeitsprüfung' }
  }

  // Convert to Beauftragung type and check availability
  const convertedBeauftragungen: Beauftragung[] = (beauftragungen || []).map((b) => ({
    id: b.id,
    ressource_id: ressourceId,
    start_date: b.start_date,
    end_date: b.end_date,
  }))

  if (isResourceUnavailable(ressourceId, convertedBeauftragungen, ressource.status)) {
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

  // Verknüpfung anlegen (unique constraint verhindert Duplikate)
  const { data: link, error: insertError } = await supabase
    .from('ressource_vakanz_links')
    .insert({
      ressource_id: ressourceId,
      vakanz_id,
      status: 'Gespielt',
      created_by: user.id,
    })
    .select('id, ressource_id, vakanz_id, status, created_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'Diese Ressource ist bereits auf diese Vakanz gespielt' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Fehler beim Spielen der Ressource' }, { status: 500 })
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
