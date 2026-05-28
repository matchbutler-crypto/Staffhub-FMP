import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const LINK_STATUS = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
] as const
type LinkStatus = typeof LINK_STATUS[number]

// 'Zurückgezogen' ist ein terminaler Status (nur via /rueckzug Endpunkt erreichbar)
const TERMINAL_STATUSES = ['Zurückgezogen']

// Ordered forward-progression statuses — transitions must move forward in this list
const STATUS_ORDER: LinkStatus[] = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
]
const REJECTION_STATUSES: LinkStatus[] = ['Abgesagt', 'Abgelehnt']

const statusSchema = z.object({
  status: z.enum(LINK_STATUS),
  interview_datum: z.string().nullable().optional(),
  feedback: z.string().max(1000).nullable().optional(),
}).refine(
  (d) => d.status !== 'Interview geplant' || !!d.interview_datum,
  { message: 'interview_datum erforderlich bei Status "Interview geplant"', path: ['interview_datum'] }
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

  const { status: newStatus, interview_datum, feedback } = parsed.data

  // Aktuellen Link laden
  const { data: link } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id, vakanz_id, status, vakanzen(rolle, enddatum)')
    .eq('id', id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'Verknüpfung nicht gefunden' }, { status: 404 })
  }

  // Zurückgezogene Links können nicht weiter bearbeitet werden
  if (TERMINAL_STATUSES.includes(link.status as string)) {
    return NextResponse.json(
      { error: `Verknüpfung mit Status "${link.status}" kann nicht weiter bearbeitet werden` },
      { status: 409 }
    )
  }

  // Transition-Validierung: kein Rückschritt, kein Verharren im gleichen Status
  const currentOrderIdx = STATUS_ORDER.indexOf(link.status as LinkStatus)
  const newOrderIdx = STATUS_ORDER.indexOf(newStatus)
  const isRejection = REJECTION_STATUSES.includes(newStatus)
  if (!isRejection) {
    if (currentOrderIdx !== -1 && newOrderIdx !== -1 && newOrderIdx <= currentOrderIdx) {
      return NextResponse.json(
        { error: `Ungültiger Status-Übergang: "${link.status}" → "${newStatus}"` },
        { status: 400 }
      )
    }
  }

  // Update durchführen
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
  const vakanzenArray = Array.isArray(link.vakanzen) ? link.vakanzen : [link.vakanzen]
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

  // Bei Beauftragt: Verfügbarkeit automatisch auf Enddatum der Vakanz setzen
  if (newStatus === 'Beauftragt' && vakanzEnddatum) {
    await supabase
      .from('ressourcen')
      .update({ verfuegbarkeit: 'Verfügbar ab', verfuegbar_ab: vakanzEnddatum })
      .eq('id', link.ressource_id)

    const dateLabel = new Date(vakanzEnddatum).toLocaleDateString('de-DE')
    await supabase.from('ressource_historie').insert({
      ressource_id: link.ressource_id,
      link_id: id,
      typ: 'system',
      text: `Verfügbarkeit automatisch auf "Verfügbar ab ${dateLabel}" aktualisiert (Beauftragt für: "${vakanzRolle}")`,
      erstellt_von: user.id,
    })
  }

  // Pfad 1 — Vakanz automatisch auf "Besetzt" setzen wenn FTE-Ziel erreicht
  if (newStatus === 'Beauftragt') {
    const [countResult, vakanzResult] = await Promise.all([
      supabase
        .from('ressource_vakanz_links')
        .select('*', { count: 'exact', head: true })
        .eq('vakanz_id', link.vakanz_id)
        .eq('status', 'Beauftragt'),
      supabase
        .from('vakanzen')
        .select('status, fte_anzahl')
        .eq('id', link.vakanz_id)
        .single(),
    ])

    if (countResult.error || vakanzResult.error) {
      console.error('FTE-check queries failed:', countResult.error ?? vakanzResult.error)
    } else {
      const fte = vakanzResult.data?.fte_anzahl != null ? Number(vakanzResult.data.fte_anzahl) : null
      const count = countResult.count ?? 0

      if (fte !== null && count >= fte && vakanzResult.data?.status !== 'Besetzt') {
        await supabase
          .from('vakanzen')
          .update({
            status: 'Besetzt',
            published: false,
            besetzt_seit: new Date().toISOString(),
          })
          .eq('id', link.vakanz_id)

        await supabase.from('ressource_historie').insert({
          ressource_id: link.ressource_id,
          link_id: id,
          typ: 'system',
          text: `Vakanz automatisch auf "Besetzt" gesetzt — FTE-Ziel erreicht (${count}/${fte})`,
          erstellt_von: user.id,
        })
      }
    }
  }

  // Pfad 2 — Vakanz zurück auf "Offen" (Entwurf) wenn Beauftragung rückgängig
  if (link.status === 'Beauftragt' && newStatus !== 'Beauftragt') {
    const { data: vakanz, error: vakanzError } = await supabase
      .from('vakanzen')
      .select('status, fte_anzahl')
      .eq('id', link.vakanz_id)
      .single()

    if (vakanzError) {
      console.error('Pfad-2 vakanz query failed:', vakanzError)
    } else if (vakanz?.status === 'Besetzt') {
      const { count: beauftragtCount, error: countError } = await supabase
        .from('ressource_vakanz_links')
        .select('*', { count: 'exact', head: true })
        .eq('vakanz_id', link.vakanz_id)
        .eq('status', 'Beauftragt')

      if (countError) {
        console.error('Pfad-2 count query failed:', countError)
      } else {
        const fte = vakanz.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
        const count = beauftragtCount ?? 0

        if (fte !== null && count < fte) {
          const { error: revertError } = await supabase
            .from('vakanzen')
            .update({ status: 'Offen', published: false, besetzt_seit: null })
            .eq('id', link.vakanz_id)

          if (revertError) {
            console.error('Pfad-2 vakanz revert failed:', revertError)
          }

          await supabase.from('ressource_historie').insert({
            ressource_id: link.ressource_id,
            link_id: id,
            typ: 'system',
            text: `Vakanz auf "Offen" (Entwurf) gesetzt — Beauftragung rückgängig gemacht (${count}/${fte} FTE)`,
            erstellt_von: user.id,
          })
        }
      }
    }
  }

  return NextResponse.json({ link: updated })
}
