import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/ressource-links?vakanz_id=X ─────────────────────────────────────
// Gibt alle gespielten Ressourcen für eine Vakanz zurück.
// Agentur sieht nur eigene (via RLS auf ressource_vakanz_links).

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv, agentur_id').eq('id', user.id).single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  const vakanzId = new URL(request.url).searchParams.get('vakanz_id')
  if (!vakanzId) return NextResponse.json({ error: 'vakanz_id fehlt' }, { status: 400 })

  const isManager = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'

  const { data, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id,
      status,
      ressourcen!inner(
        id,
        name,
        agentur_id,
        agenturen(name)
      )
    `)
    .eq('vakanz_id', vakanzId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/ressource-links error:', error.message)
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  const result = (data ?? []).map((link) => {
    const ressource = link.ressourcen as unknown as {
      id: string
      name: string
      agentur_id: string
      agenturen: { name: string } | { name: string }[] | null
    }
    const agenturen = ressource?.agenturen
    const agenturName = Array.isArray(agenturen) ? agenturen[0]?.name : agenturen?.name

    return {
      id: link.id,
      ressource_id: ressource?.id ?? null,
      kandidatenname: ressource?.name ?? '–',
      status: link.status,
      ki_score: null,
      agentur_name: isManager ? (agenturName ?? null) : null,
      quelle: 'pool' as const,
    }
  })

  return NextResponse.json(result)
}