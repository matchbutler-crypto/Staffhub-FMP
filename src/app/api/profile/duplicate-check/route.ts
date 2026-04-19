import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/profile/duplicate-check ──────────────────────────────────────────
// Query params: vakanz_id, kandidatenname
// Returns: { exists: boolean }

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv || profile.rolle !== 'Agentur' || !profile.agentur_id) {
    return NextResponse.json({ exists: false })
  }

  const { searchParams } = new URL(request.url)
  const vakanzId = searchParams.get('vakanz_id')
  const kandidatenname = searchParams.get('kandidatenname')

  if (!vakanzId || !kandidatenname) {
    return NextResponse.json({ exists: false })
  }

  const { count, error } = await supabase
    .from('kandidaten_profile')
    .select('id', { count: 'exact', head: true })
    .eq('vakanz_id', vakanzId)
    .eq('agentur_id', profile.agentur_id)
    .ilike('kandidatenname', kandidatenname.trim())

  if (error) {
    console.error('duplicate-check error:', error.code, error.message)
    return NextResponse.json({ error: 'Fehler beim Duplikat-Check' }, { status: 500 })
  }

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
