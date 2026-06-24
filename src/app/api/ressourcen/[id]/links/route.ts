import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ressourcen/[id]/links ────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const { data: links, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id, ressource_id, vakanz_id, status, interview_datum, created_by, created_at, updated_at,
      vakanzen!vakanz_id(id, rolle, status, erfahrungslevel, arbeitsmodell, standort, branche, startdatum, enddatum)
    `)
    .eq('ressource_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('GET links error:', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Verknüpfungen' }, { status: 500 })
  }

  // Normalize join alias: frontend expects vakanzen_data field name
  const normalized = (links ?? []).map((l) => {
    const { vakanzen, ...rest } = l as typeof l & { vakanzen: Record<string, unknown> | null }
    return { ...rest, vakanzen_data: vakanzen ?? null }
  })

  return NextResponse.json({ links: normalized })
}
