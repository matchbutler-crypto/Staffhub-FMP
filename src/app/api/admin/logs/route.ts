import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const admin = createAdminClient()

  // ── 1. ressource_historie ──────────────────────────────────────────────────

  let ressourceQuery = admin
    .from('ressource_historie')
    .select(`
      id, text, typ, created_at, link_id, ressource_id, erstellt_von,
      ressourcen!ressource_id(id, name, ressource_code)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    ressourceQuery = ressourceQuery.eq('erstellt_von', userId)
  }

  const { data: ressourceLogs, error: ressourceError } = await ressourceQuery

  if (ressourceError) {
    console.error('GET admin/logs ressource_historie error:', ressourceError)
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 })
  }

  // ── 2. vakanz_historie ─────────────────────────────────────────────────────

  let vakanzQuery = admin
    .from('vakanz_historie')
    .select(`
      id, text, typ, created_at, vakanz_id, erstellt_von,
      vakanzen_data!vakanz_id(id, titel, vakanz_nr)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    vakanzQuery = vakanzQuery.eq('erstellt_von', userId)
  }

  const { data: vakanzLogs, error: vakanzError } = await vakanzQuery

  if (vakanzError) {
    // vakanz_historie table may not exist yet (migration 019 not applied)
    console.error('GET admin/logs vakanz_historie error:', JSON.stringify(vakanzError))
  }

  // ── 3. Alle User-IDs sammeln + Profiles laden ──────────────────────────────

  const allLogs = [
    ...(ressourceLogs ?? []).map((e) => ({ ...e, source: 'ressource' as const })),
    ...(vakanzLogs ?? []).map((e) => ({ ...e, source: 'vakanz' as const })),
  ]

  const userIds = [...new Set(allLogs.map((e) => e.erstellt_von).filter(Boolean))] as string[]

  const profilesMap: Record<string, { id: string; name: string; rolle: string }> = {}
  if (userIds.length > 0) {
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, name, rolle')
      .in('id', userIds)
    for (const p of profilesData ?? []) {
      profilesMap[p.id] = p
    }
  }

  // ── 4. Mergen, Profiles anhängen, nach Datum sortieren, Rollen-Filter ──────

  let logs = allLogs
    .map((entry) => ({
      ...entry,
      profiles: entry.erstellt_von ? (profilesMap[entry.erstellt_von] ?? null) : null,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  if (rolle && rolle !== 'alle') {
    logs = logs.filter((entry) => {
      const p = entry.profiles as { rolle?: string } | null
      return p?.rolle === rolle
    })
  }

  return NextResponse.json({ logs })
}
