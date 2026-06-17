import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const statusSchema = z.object({
  status: z.enum(['Zugesagt', 'Abgelehnt']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:update')
  if (authError) return authError

  const { matchId } = await params
  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültiger Status. Erlaubt: "Zugesagt" oder "Abgelehnt"' },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  const { data: link, error: fetchError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, status')
    .eq('id', matchId)
    .single()

  if (fetchError || !link) {
    return NextResponse.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({ status: parsed.data.status })
    .eq('id', matchId)
    .select('id, status, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vorschlag: updated })
}
