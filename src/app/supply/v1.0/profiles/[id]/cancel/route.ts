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

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('ressource_id', profileId)
    .eq('vakanz_id', vakanzId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil-Vakanz-Verknüpfung nicht gefunden' } }, { status: 404 })
  }
  if (link.status === 'Beauftragt') {
    return NextResponse.json({ error: { code: 'LOCKED', message: 'Gebuchtes Profil kann nicht abgelehnt werden' } }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({ status: 'Abgelehnt' })
    .eq('id', link.id)

  if (updateError) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: 'Status konnte nicht gesetzt werden' } }, { status: 500 })
  }

  await supabase.from('ressource_historie').insert({
    ressource_id: profileId,
    link_id: link.id,
    typ: 'system',
    text: 'Abgelehnt (via MagentaOS)',
    erstellt_von: null,
  })

  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('id, name, email_geschaeftlich, telefon_geschaeftlich')
    .eq('id', profileId)
    .single()

  if (ressource) {
    sendProfileUpdated(vakanzId, {
      id: ressource.id,
      name: ressource.name,
      email: ressource.email_geschaeftlich ?? null,
      phone: ressource.telefon_geschaeftlich ?? null,
    }, 'UNAVAILABLE').catch((e) => console.error('MagentaOS webhook error:', e))
  }

  return NextResponse.json({ id: profileId, status: 'UNAVAILABLE' })
}
