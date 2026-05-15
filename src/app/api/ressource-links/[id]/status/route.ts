import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const LINK_STATUS = ['Gespielt', 'Interview geplant', 'Zugesagt', 'Abgesagt', 'Abgelehnt'] as const
type LinkStatus = typeof LINK_STATUS[number]

// 'Zurückgezogen' ist ein terminaler Status (nur via /rueckzug Endpunkt erreichbar)
const TERMINAL_STATUSES = ['Zurückgezogen']

const statusSchema = z.object({
  status: z.enum(LINK_STATUS),
  interview_datum: z.string().nullable().optional(),
  feedback: z.string().max(1000).nullable().optional(),
})

// ── PATCH /api/ressource-links/[id]/status ────────────────────────────────────

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
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager') {
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

  const { status: newStatus, interview_datum, feedback } = parsed.data

  // Aktuellen Link laden
  const { data: link } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id, vakanz_id, status, vakanzen_data(rolle, enddatum)')
    .eq('id', id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'Verknüpfung nicht gefunden' }, { status: 404 })
  }

  // Zurückgezogene Links können nicht weiter bearbeitet werden
  if (TERMINAL_STATUSES.includes(link.status)) {
    return NextResponse.json(
      { error: `Verknüpfung mit Status "${link.status}" kann nicht weiter bearbeitet werden` },
      { status: 409 }
    )
  }

  // Update durchführen (Manager darf jeden Status setzen — keine Transition-Einschränkung)
  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({
      status: newStatus,
      interview_datum: newStatus === 'Interview geplant' ? (interview_datum ?? null) : null,
      feedback: feedback ?? null,
    })
    .eq('id', id)
    .select('id, ressource_id, vakanz_id, status, interview_datum, feedback, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  // Automatischer Historien-Eintrag
  const vakanzenArray = Array.isArray(link.vakanzen_data) ? link.vakanzen_data : [link.vakanzen_data]
  const vakanzRolle = vakanzenArray[0]?.rolle ?? 'unbekannte Vakanz'
  const vakanzEnddatum = vakanzenArray[0]?.enddatum ?? null
  let histText = newStatus === 'Interview geplant' && interview_datum
    ? `Interview geplant am ${new Date(interview_datum).toLocaleDateString('de-DE')} (Vakanz: "${vakanzRolle}")`
    : `Status auf "${newStatus}" gesetzt (Vakanz: "${vakanzRolle}")`
  if (feedback) histText += ` — Feedback: ${feedback}`

  await supabase.from('ressource_historie').insert({
    ressource_id: link.ressource_id,
    link_id: id,
    typ: 'system',
    text: histText,
    erstellt_von: user.id,
  })

  // Bei Zugesagt: Verfügbarkeit automatisch auf Enddatum der Vakanz setzen
  if (newStatus === 'Zugesagt' && vakanzEnddatum) {
    await supabase
      .from('ressourcen')
      .update({ verfuegbarkeit: 'Verfügbar ab', verfuegbar_ab: vakanzEnddatum })
      .eq('id', link.ressource_id)

    const dateLabel = new Date(vakanzEnddatum).toLocaleDateString('de-DE')
    await supabase.from('ressource_historie').insert({
      ressource_id: link.ressource_id,
      link_id: id,
      typ: 'system',
      text: `Verfügbarkeit automatisch auf "Verfügbar ab ${dateLabel}" aktualisiert (Beauftragung: "${vakanzRolle}")`,
      erstellt_von: user.id,
    })
  }

  return NextResponse.json({ link: updated })
}
