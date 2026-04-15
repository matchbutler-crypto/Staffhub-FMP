import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/slack/logs ───────────────────────────────────────────────────────
// Returns all Slack post log entries (newest first, max 200).
// Only accessible by Admin and Staffhub Manager.

export async function GET() {
  const supabase = await createClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!userProfile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (userProfile.rolle !== 'Staffhub Manager' && userProfile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // ── Logs laden ──────────────────────────────────────────────────────────────
  const { data: logs, error } = await supabase
    .from('slack_post_log')
    .select(`
      id,
      vakanz_id,
      post_type,
      workspace,
      channel,
      status,
      error_msg,
      posted_by,
      posted_at,
      vakanzen ( titel ),
      profiles ( name )
    `)
    .order('posted_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 })
  }

  // ── Normalize joined data ───────────────────────────────────────────────────
  const result = (logs ?? []).map((log) => {
    const vakanz = log.vakanzen as unknown as { titel: string } | null
    const poster = log.profiles as unknown as { name: string } | null
    return {
      id: log.id,
      vakanz_id: log.vakanz_id,
      vakanz_titel: vakanz?.titel ?? null,
      post_type: log.post_type,
      workspace: log.workspace,
      channel: log.channel,
      status: log.status,
      error_msg: log.error_msg,
      posted_by: log.posted_by,
      posted_by_name: poster?.name ?? null,
      posted_at: log.posted_at,
    }
  })

  return NextResponse.json({ logs: result })
}
