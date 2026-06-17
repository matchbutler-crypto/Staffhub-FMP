import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()

  // Spalten gegen Supabase Table Editor prüfen falls Fehler auftreten
  const { data, error } = await supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, arbeitsmodell, aktiv')
    .eq('aktiv', true)
    .order('name', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Profile' }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}
