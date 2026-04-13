import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── PATCH /api/beauftragungen/[id]/beenden ────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv').eq('id', user.id).single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({ aktiv: false })
    .eq('id', id)
    .select('id, aktiv, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Beenden der Beauftragung' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}
