import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/rechnungen?beauftragung_ids=id1,id2&monat=2026-05-01 ───────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('beauftragung_ids') ?? ''
  const monat = searchParams.get('monat')

  if (!monat || !idsParam) return NextResponse.json({ rechnungen: [] })

  const ids = idsParam.split(',').filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ rechnungen: [] })

  const { data, error } = await supabase
    .from('rechnungen')
    .select('id, beauftragung_id, monat, gesamtbetrag, status, betrag_bezahlt, created_at, sent_at, paid_at')
    .in('beauftragung_id', ids)
    .eq('monat', monat)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ rechnungen: data ?? [] })
}
