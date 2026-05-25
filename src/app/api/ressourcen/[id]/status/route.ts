import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const statusSchema = z.object({
  verfuegbarkeit: z.enum(['Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert']),
  verfuegbar_ab: z.string().nullable().optional(),
}).refine(
  (d) => d.verfuegbarkeit !== 'Verfügbar ab' || !!d.verfuegbar_ab,
  { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ['verfuegbar_ab'] }
)

// ── PATCH /api/ressourcen/[id]/status ─────────────────────────────────────────

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
  const isAgency = profile.rolle === 'Agentur'
  if (!isManager && !isAgency) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('ressourcen')
    .select('id, agentur_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  if (isAgency && existing.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: links } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', id)
    .eq('status', 'Beauftragt')

  const linkIds = (links ?? []).map((l) => l.id)
  let hasRunningBeauftragung = false

  if (linkIds.length > 0) {
    const { data: beauftragungen } = await supabase
      .from('beauftragungen')
      .select('id, status, startdatum, enddatum, aktiv')
      .in('ressource_link_id', linkIds)
      .eq('aktiv', true)

    const today = new Date().toISOString().slice(0, 10)
    hasRunningBeauftragung = (beauftragungen ?? []).some((b) => {
      const start = (b.startdatum ?? '').slice(0, 10)
      const end = b.enddatum ? b.enddatum.slice(0, 10) : null
      const activeWindow = start ? start <= today && (!end || end >= today) : true
      return activeWindow && (b.status === 'Beauftragt' || b.status === 'Aktiv' || !b.status)
    })
  }

  if (hasRunningBeauftragung) {
    return NextResponse.json(
      { error: 'Status kann bei laufender Beauftragung nicht geändert werden' },
      { status: 409 }
    )
  }

  const { data: ressource, error } = await supabase
    .from('ressourcen')
    .update({
      verfuegbarkeit: parsed.data.verfuegbarkeit,
      verfuegbar_ab: parsed.data.verfuegbarkeit === 'Verfügbar ab' ? (parsed.data.verfuegbar_ab ?? null) : null,
      reminder_sent_at: null, // Timer zurücksetzen nach Aktualisierung
    })
    .eq('id', id)
    .select('id, verfuegbarkeit, verfuegbar_ab, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  return NextResponse.json({ ressource })
}
