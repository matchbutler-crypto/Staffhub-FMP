import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager')) return null
  return user
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from('agenturen')
    .select('name, agency_webhook_url, agency_webhook_secret')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Agentur nicht gefunden' }, { status: 404 })
  }
  if (!data.agency_webhook_url || !data.agency_webhook_secret) {
    return NextResponse.json({ error: 'Webhook-URL und Secret müssen zuerst gespeichert werden' }, { status: 400 })
  }

  const payload = {
    event: 'ping',
    agentur: data.name,
    timestamp: new Date().toISOString(),
  }
  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', data.agency_webhook_secret as string).update(body).digest('hex')

  try {
    const res = await fetch(data.agency_webhook_url as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staffhub-signature': sig },
      body,
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
