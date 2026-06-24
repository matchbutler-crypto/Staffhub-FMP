import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendProfileUpdated } from '@/lib/magenta-webhook'
import { sendSubmissionStatusChanged, sendPositionClosed } from '@/lib/agency-webhook'

const LINK_STATUS = ['Gespielt', 'Interview geplant', 'Zugesagt', 'Beauftragt', 'Abgesagt', 'Abgelehnt'] as const
type LinkStatus = typeof LINK_STATUS[number]

// 'Zurückgezogen' ist ein terminaler Status (nur via /rueckzug Endpunkt erreichbar)
const TERMINAL_STATUSES = ['Zurückgezogen']

// Ordered forward-progression statuses — transitions must move forward in this list
const STATUS_ORDER: LinkStatus[] = ['Gespielt', 'Interview geplant', 'Zugesagt', 'Beauftragt']
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

  // Beauftragt kann nur vom Admin geändert werden
  if (link.status === 'Beauftragt' && profile.rolle !== 'Admin') {
    return NextResponse.json(
      { error: 'Status „Beauftragt" kann nur von einem Admin geändert werden' },
      { status: 403 }
    )
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

  // Bei Zugesagt oder Beauftragt: Verfügbarkeit auf "Nicht verfügbar" setzen, verfuegbar_ab auf Enddatum der Vakanz
  if (newStatus === 'Zugesagt' || newStatus === 'Beauftragt') {
    const updatePayload: { verfuegbarkeit: string; verfuegbar_ab?: string | null } = {
      verfuegbarkeit: 'Nicht verfügbar',
      verfuegbar_ab: vakanzEnddatum ?? null,
    }
    await supabase
      .from('ressourcen')
      .update(updatePayload)
      .eq('id', link.ressource_id)

    const dateLabel = vakanzEnddatum
      ? new Date(vakanzEnddatum).toLocaleDateString('de-DE')
      : null
    const actionLabel = newStatus === 'Beauftragt' ? 'Beauftragt' : 'Zugesagt'
    const histText2 = dateLabel
      ? `Verfügbarkeit automatisch auf "Nicht verfügbar" gesetzt, verfügbar ab ${dateLabel} (${actionLabel} für: "${vakanzRolle}")`
      : `Verfügbarkeit automatisch auf "Nicht verfügbar" gesetzt (${actionLabel} für: "${vakanzRolle}")`
    await supabase.from('ressource_historie').insert({
      ressource_id: link.ressource_id,
      link_id: id,
      typ: 'system',
      text: histText2,
      erstellt_von: user.id,
    })
  }

  // Webhook an MagentaOS bei Beauftragt
  if (newStatus === 'Beauftragt') {
    const { data: ressource } = await supabase
      .from('ressourcen')
      .select('id, name, email_geschaeftlich, telefon_geschaeftlich')
      .eq('id', link.ressource_id)
      .single()

    if (ressource) {
      sendProfileUpdated(link.vakanz_id, {
        id: ressource.id,
        name: ressource.name,
        email: ressource.email_geschaeftlich ?? null,
        phone: ressource.telefon_geschaeftlich ?? null,
      }, 'BOOKED').catch((e) => console.error('MagentaOS webhook error:', e))
    }
  }

  // Agency Webhook: submission.status_changed für alle Status-Wechsel
  {
    const { data: ressourceForWebhook } = await supabase
      .from('ressourcen')
      .select('id, external_ref, agentur_id')
      .eq('id', updated.ressource_id)
      .single()

    if (ressourceForWebhook?.agentur_id) {
      sendSubmissionStatusChanged({
        vakanzId: updated.vakanz_id,
        profileId: updated.ressource_id,
        externalRef: ressourceForWebhook.external_ref ?? null,
        internalStatus: newStatus,
        agenturId: ressourceForWebhook.agentur_id,
      }).catch((e) => console.error('Agency webhook error:', e))
    }
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

        sendPositionClosed(link.vakanz_id, 'FILLED')
          .catch((e) => console.error('Agency webhook error (position.closed):', e))

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
