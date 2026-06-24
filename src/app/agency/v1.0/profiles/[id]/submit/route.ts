import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const submitSchema = z.object({
  positionId: z.string().uuid('Ungültige Position-ID'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id: profileId } = await params
  const supabase = createServiceRoleClient()

  // Ressource prüfen + Ownership
  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('id, name, external_ref, agentur_id, verfuegbarkeit')
    .eq('id', profileId)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
  }
  if (ressource.agentur_id !== auth.agencyId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Keine Berechtigung für dieses Profil' } }, { status: 403 })
  }
  if (ressource.verfuegbarkeit === 'Deaktiviert') {
    return NextResponse.json({ error: { code: 'UNAVAILABLE', message: 'Deaktivierte Ressource kann nicht eingereicht werden' } }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const { positionId } = parsed.data

  // Vakanz prüfen: published + Offen
  const { data: vakanz } = await supabase
    .from('vakanzen')
    .select('id, rolle, status, published')
    .eq('id', positionId)
    .single()

  if (!vakanz) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }
  if (!vakanz.published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }
  if (vakanz.status === 'Besetzt' || vakanz.status === 'Geschlossen') {
    return NextResponse.json({ error: { code: 'POSITION_CLOSED', message: 'Position nimmt keine weiteren Profile an' } }, { status: 400 })
  }

  // Link anlegen (unique constraint verhindert Duplikate)
  const { data: link, error: insertError } = await supabase
    .from('ressource_vakanz_links')
    .insert({
      ressource_id: profileId,
      vakanz_id: positionId,
      status: 'Gespielt',
      created_by: null,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: { code: 'ALREADY_SUBMITTED', message: 'Profil bereits auf diese Position eingereicht' } },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Einreichen' } }, { status: 500 })
  }

  // Historien-Eintrag
  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: `Via Agency-API auf Position "${vakanz.rolle}" eingereicht`,
    erstellt_von: null,
  })

  return NextResponse.json({ submissionId: link.id }, { status: 201 })
}
