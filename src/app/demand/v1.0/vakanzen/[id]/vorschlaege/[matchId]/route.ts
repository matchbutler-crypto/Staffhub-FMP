import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const statusSchema = z.object({
  status: z.enum(['SHORTLISTED', 'REJECTED', 'ACCEPTED']),
  note:   z.string().max(1000).optional(),
})

const STATUS_MAP: Record<string, string> = {
  ACCEPTED:    'Zugesagt',
  REJECTED:    'Abgelehnt',
  SHORTLISTED: 'Shortlist',
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:update')
  if (authError) return authError

  const { id: vakanzId, matchId } = await params
  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Erlaubte Status-Werte: SHORTLISTED, REJECTED, ACCEPTED' } },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('id', matchId)
    .eq('vakanz_id', vakanzId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Vorschlag nicht gefunden' } }, { status: 404 })
  }

  const dbStatus = STATUS_MAP[parsed.data.status]
  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({
      status: dbStatus,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
    })
    .eq('id', matchId)
    .eq('vakanz_id', vakanzId)
    .select('id, status, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
  }

  return NextResponse.json({
    matchId:   updated.id,
    status:    parsed.data.status,
    updatedAt: updated.updated_at,
  })
}
