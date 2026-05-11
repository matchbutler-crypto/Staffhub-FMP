import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/ideen/[id]/upvote — toggle upvote
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('ideen_upvotes')
    .select('id')
    .eq('idee_id', id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    await supabase.from('ideen_upvotes').delete().eq('id', existing.id)
  } else {
    await supabase.from('ideen_upvotes').insert({ idee_id: id, user_id: user.id })
  }

  const { count } = await supabase
    .from('ideen_upvotes')
    .select('*', { count: 'exact', head: true })
    .eq('idee_id', id)

  return NextResponse.json({ upvoted: !existing, count: count ?? 0 })
}
