import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

const schema = z.object({ vakanzId: z.string().min(1) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'supply:write')
  if (authError) return authError

  const { id: profileId } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'vakanzId ist Pflicht' } }, { status: 400 })
  }

  const { vakanzId } = parsed.data
  const supabase = createServiceRoleClient()

  const [linkResult, vakanzResult, ressourceResult] = await Promise.all([
    supabase.from('ressource_vakanz_links').select('id, status').eq('ressource_id', profileId).eq('vakanz_id', vakanzId).single(),
    supabase.from('vakanzen').select('rolle, enddatum, fte_anzahl, status').eq('id', vakanzId).single(),
    supabase.from('ressourcen').select('id, name, email_geschaeftlich, telefon_geschaeftlich').eq('id', profileId).single(),
  ])

  const link = linkResult.data
  if (linkResult.error || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil-Vakanz-Verknüpfung nicht gefunden' } }, { status: 404 })
  }
  if (link.status === 'Beauftragt') {
    return NextResponse.json({ error: { code: 'LOCKED', message: 'Profil ist bereits gebucht' } }, { status: 409 })
  }

  const vakanz = vakanzResult.data
  const ressource = ressourceResult.data

  if (ressourceResult.error || !ressource) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Ressource nicht gefunden' } }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({ status: 'Beauftragt' })
    .eq('id', link.id)

  if (updateError) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: 'Status konnte nicht gesetzt werden' } }, { status: 500 })
  }

  if (vakanz?.enddatum) {
    await supabase
      .from('ressourcen')
      .update({ verfuegbarkeit: 'Verfügbar ab', verfuegbar_ab: vakanz.enddatum })
      .eq('id', profileId)
  }

  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: `Beauftragt (via MagentaOS)${vakanz?.rolle ? ` — Vakanz: "${vakanz.rolle}"` : ''}`,
    erstellt_von: null,
  })

  // FTE-Check → Vakanz automatisch auf Besetzt setzen
  if (vakanz) {
    const { count } = await supabase
      .from('ressource_vakanz_links')
      .select('*', { count: 'exact', head: true })
      .eq('vakanz_id', vakanzId)
      .eq('status', 'Beauftragt')

    const fte = vakanz.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
    if (fte !== null && (count ?? 0) >= fte && vakanz.status !== 'Besetzt') {
      await supabase
        .from('vakanzen')
        .update({ status: 'Besetzt', published: false, besetzt_seit: new Date().toISOString() })
        .eq('id', vakanzId)
    }
  }

  if (ressource) {
    sendProfileUpdated(vakanzId, {
      id: ressource.id,
      name: ressource.name,
      email: ressource.email_geschaeftlich ?? null,
      phone: ressource.telefon_geschaeftlich ?? null,
    }, 'BOOKED').catch((e) => console.error('MagentaOS webhook error:', e))
  }

  return NextResponse.json({ id: profileId, status: 'BOOKED' })
}
