import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:read')
  if (authError) return authError

  const { id: vakanzId } = await params
  const supabase = createServiceRoleClient()

  const [linksResult, scoresResult] = await Promise.all([
    supabase
      .from('ressource_vakanz_links')
      .select('id, status, ressourcen!inner(id, name, ek_tagesrate, agenturen(name))')
      .eq('vakanz_id', vakanzId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ressource_ki_scores')
      .select('ressource_id, vakanz_id, score')
      .eq('vakanz_id', vakanzId),
  ])

  if (linksResult.error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Vorschläge' }, { status: 500 })
  }

  const scoreMap = new Map<string, number>(
    (scoresResult.data ?? []).map((s) => [s.ressource_id, s.score])
  )

  const vorschlaege = (linksResult.data ?? []).map((link) => {
    const ressource = link.ressourcen as unknown as {
      id: string; name: string; ek_tagesrate: number | null
      agenturen: { name: string } | { name: string }[] | null
    }
    const agenturRaw = ressource?.agenturen
    const agentur = Array.isArray(agenturRaw) ? agenturRaw[0]?.name : agenturRaw?.name

    return {
      match_id: link.id,
      status: link.status,
      name: ressource.name,
      agentur: agentur ?? null,
      ek_tagesrate: ressource.ek_tagesrate,
      matching_score: scoreMap.get(ressource.id) ?? null,
    }
  })

  return NextResponse.json({ vorschlaege })
}
