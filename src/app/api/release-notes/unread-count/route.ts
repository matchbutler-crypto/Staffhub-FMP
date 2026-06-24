import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ count: 0 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) return NextResponse.json({ count: 0 })

  const rolle = profile.rolle as string
  const isInternal = ['Admin', 'Staffhub Manager', 'Controller'].includes(rolle)

  let features: Record<string, boolean> = {}
  if (!isInternal && profile.agentur_id) {
    const { data: agentur } = await supabase
      .from('agenturen')
      .select('features')
      .eq('id', profile.agentur_id)
      .single()
    features = (agentur?.features as Record<string, boolean>) ?? {}
  }

  let query = supabase
    .from('release_notes')
    .select('id, feature_key')

  if (!isInternal) {
    query = query.contains('roles', [rolle])
  }

  const { data: notes } = await query
  if (!notes || notes.length === 0) return NextResponse.json({ count: 0 })

  const visibleNotes = isInternal
    ? notes
    : notes.filter((n) => !n.feature_key || features[n.feature_key] === true)

  if (visibleNotes.length === 0) return NextResponse.json({ count: 0 })

  const noteIds = visibleNotes.map((n) => n.id)
  const { data: reads } = await supabase
    .from('release_note_reads')
    .select('note_id')
    .eq('user_id', user.id)
    .in('note_id', noteIds)

  const readCount = reads?.length ?? 0
  return NextResponse.json({ count: Math.max(0, noteIds.length - readCount) })
}
