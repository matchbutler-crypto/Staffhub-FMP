import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

// ── GET /api/admin/logs ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rolle = searchParams.get('rolle')
  const userId = searchParams.get('user_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000)

  let query = supabase
    .from('ressource_historie')
    .select(`
      id, text, typ, created_at, link_id, ressource_id,
      profiles!erstellt_von(id, name, rolle),
      ressourcen!ressource_id(id, name, code)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    query = query.eq('erstellt_von', userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('GET admin/logs error:', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 })
  }

  let logs = data ?? []

  // Filter by rolle on application level (join makes it tricky in supabase)
  if (rolle && rolle !== 'alle') {
    logs = logs.filter((entry) => {
      const p = entry.profiles as { rolle?: string } | null
      return p?.rolle === rolle
    })
  }

  return NextResponse.json({ logs })
}
