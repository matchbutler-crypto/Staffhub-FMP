import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, verfuegbarkeit, arbeitsmodell, wohnort, ek_tagesrate')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const profile = {
    profileId:     data.id,
    displayName:   data.name,
    seniority:     data.erfahrungslevel ?? null,
    skills:        data.skills ?? [],
    availableFrom: data.verfuegbar_ab ?? null,
    location: {
      mode: data.arbeitsmodell ?? null,
      city: data.wohnort ?? null,
    },
    rate: data.ek_tagesrate != null
      ? { amount: data.ek_tagesrate, currency: 'EUR', per: 'DAY' }
      : null,
  }

  return NextResponse.json({ profile })
}
