import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'
import { mapSubmissionStatus } from '@/lib/agency-webhook'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:read')
  if (auth.error) return auth.error

  const { id: positionId } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id, status, updated_at,
      ressourcen!inner(id, external_ref, vorname, nachname, agentur_id)
    `)
    .eq('vakanz_id', positionId)
    .eq('ressourcen.agentur_id', auth.agencyId)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const submissions = (data ?? []).map((link) => {
    const r = link.ressourcen as unknown as {
      id: string; external_ref: string | null; vorname: string | null; nachname: string | null
    }
    return {
      submissionId: link.id,
      profileId: r.id,
      externalRef: r.external_ref ?? null,
      firstName: r.vorname ?? null,
      lastName: r.nachname ?? null,
      status: mapSubmissionStatus(link.status),
      updatedAt: link.updated_at,
    }
  })

  return NextResponse.json({ data: submissions })
}
