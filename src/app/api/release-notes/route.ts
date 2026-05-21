import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/release-notes ────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { user, profile } = await getProfile(supabase)
  if (!profile?.aktiv || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const rolle = profile.rolle as string
  const isInternal = ['Admin', 'Staffhub Manager', 'Controller'].includes(rolle)

  let query = supabase
    .from('release_notes')
    .select('id, datum, title, body, roles, created_at')
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isInternal) {
    query = query.contains('roles', [rolle])
  }

  const { data: notes, error } = await query
  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })

  if (!notes || notes.length === 0) return NextResponse.json({ notes: [] })

  const noteIds = notes.map((n) => n.id)
  const { data: reads } = await supabase
    .from('release_note_reads')
    .select('note_id')
    .eq('user_id', user.id)
    .in('note_id', noteIds)

  const readSet = new Set((reads ?? []).map((r) => r.note_id))

  return NextResponse.json({
    notes: notes.map((n) => ({ ...n, is_read: readSet.has(n.id) })),
  })
}
