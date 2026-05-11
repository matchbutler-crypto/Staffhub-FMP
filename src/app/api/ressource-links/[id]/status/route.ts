import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const LINK_STATUS = ['Gespielt', 'Interview geplant', 'Zugesagt', 'Abgesagt', 'Abgelehnt'] as const
type LinkStatus = typeof LINK_STATUS[number]

// Erlaubte Vorwärts-Übergänge (Manager-Workflow)
// 'Zurückgezogen' ist ein terminaler Status (nur via /rueckzug Endpunkt erreichbar)
const VALID_TRANSITIONS: Record<LinkStatus, LinkStatus[]> = {
  'Gespielt':          ['Interview geplant', 'Abgesagt', 'Abgelehnt'],
  'Interview geplant': ['Zugesagt', 'Abgesagt', 'Abgelehnt'],
  'Zugesagt':          [],
  'Abgesagt':          [],
  'Abgelehnt':         [],
}

const TERMINAL_STATUSES = ['Zurückgezogen']

const statusSchema = z.object({
  status: z.enum(LINK_STATUS),
  interview_datum: z.string().nullable().optional(),
}).refine(
  (d) => d.status !== 'Interview geplant' || !!d.interview_datum,
  { message: 'Datum erforderlich bei "Interview geplant"', path: ['interview_datum'] }
)

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

  // Aktuellen Link laden
  const { data: link } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id, status, vakanzen_data(rolle)')
    .eq('id', id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'Verknüpfung nicht gefunden' }, { status: 404 })
  }

  // Zurückgezogene Links können nicht weiter bearbeitet werden (AC-6 PROJ-14)
  if (TERMINAL_STATUSES.includes(link.status)) {
    return NextResponse.json(
      { error: `Verknüpfung mit Status "${link.status}" kann nicht weiter bearbeitet werden` },
      { status: 409 }
    )
  }

  const currentStatus = link.status as LinkStatus
  const newStatus = parsed.data.status

  // Status-Übergang validieren
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Ungültiger Status-Übergang: ${currentStatus} → ${newStatus}` },
      { status: 400 }
    )
  }

  // Update durchführen
  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({
      status: newStatus,
      interview_datum: newStatus === 'Interview geplant' ? (parsed.data.interview_datum ?? null) : null,
    })
    .eq('id', id)
    .select('id, ressource_id, vakanz_id, status, interview_datum, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  // Automatischer Historien-Eintrag
  const vakanzenArray = Array.isArray(link.vakanzen_data) ? link.vakanzen_data : [link.vakanzen_data]
  const vakanzRolle = vakanzenArray[0]?.rolle ?? 'unbekannte Vakanz'
  const histText = newStatus === 'Interview geplant' && parsed.data.interview_datum
    ? `Interview geplant am ${new Date(parsed.data.interview_datum).toLocaleDateString('de-DE')} (Vakanz: "${vakanzRolle}")`
    : `Status auf "${newStatus}" gesetzt (Vakanz: "${vakanzRolle}")`

  await supabase.from('ressource_historie').insert({
    ressource_id: link.ressource_id,
    link_id: id,
    typ: 'system',
    text: histText,
    erstellt_von: user.id,
  })

  return NextResponse.json({ link: updated })
}
