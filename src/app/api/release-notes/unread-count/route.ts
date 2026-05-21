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

// ── GET /api/release-notes/unread-count ───────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { user, profile } = await getProfile(supabase)
  if (!profile?.aktiv || !user) {
    return NextResponse.json({ count: 0 })
  }

  const rolle = profile.rolle as string
  const isInternal = ['Admin', 'Staffhub Manager', 'Controller'].includes(rolle)

  let query = supabase
    .from('release_notes')
    .select('id')

  if (!isInternal) {
    query = query.contains('roles', [rolle])
  }

  const { data: notes } = await query
  if (!notes || notes.length === 0) return NextResponse.json({ count: 0 })

  const noteIds = notes.map((n) => n.id)
  const { data: reads } = await supabase
    .from('release_note_reads')
    .select('note_id')
    .eq('user_id', user.id)
    .in('note_id', noteIds)

  const readCount = reads?.length ?? 0
  const count = noteIds.length - readCount

  return NextResponse.json({ count: Math.max(0, count) })
}
