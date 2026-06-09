import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ count: 0 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv || profile.rolle !== 'Admin') {
    return NextResponse.json({ count: 0 })
  }

  const adminClient = createAdminClient()
  const { count, error } = await adminClient
    .from('feedbacks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'backlog')
    .in('kategorie', ['Bug', 'Idee'])

  if (error) return NextResponse.json({ count: 0 })

  return NextResponse.json({ count: count ?? 0 })
}
