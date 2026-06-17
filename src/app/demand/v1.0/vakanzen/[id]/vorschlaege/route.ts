import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const STATUS_MAP: Record<string, string> = {
  Gespielt:      'NEW',
  Vorgeschlagen: 'NEW',
  Shortlist:     'SHORTLISTED',
  Zugesagt:      'ACCEPTED',
  Abgelehnt:     'REJECTED',
  Abgesagt:      'REJECTED',
  Zurückgezogen: 'WITHDRAWN',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vorschlaege:read')
  if (authError) return authError

  const { id: vakanzId } = await params
  const since = request.nextUrl.searchParams.get('since')

  const supabase = createServiceRoleClient()

  let linksQuery = supabase
    .from('ressource_vakanz_links')
    .select(`
      id, status, created_at, updated_at,
      ressourcen!inner(
        id, name, erfahrungslevel, verfuegbar_ab, verfuegbarkeit,
        arbeitsmodell, wohnort, ek_tagesrate,
        email_geschaeftlich, telefon_geschaeftlich,
        agenturen(id, name)
      )
    `)
    .eq('vakanz_id', vakanzId)
    .order('created_at', { ascending: false })

  if (since) {
    linksQuery = linksQuery.gte('updated_at', since)
  }

  const [linksResult, scoresResult] = await Promise.all([
    linksQuery,
    supabase
      .from('ressource_ki_scores')
      .select('ressource_id, score')
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
      id: string
      name: string
      erfahrungslevel: string | null
      verfuegbar_ab: string | null
      verfuegbarkeit: string | null
      arbeitsmodell: string | null
      wohnort: string | null
      ek_tagesrate: number | null
      email_geschaeftlich: string | null
      telefon_geschaeftlich: string | null
      agenturen: { id: string; name: string } | { id: string; name: string }[] | null
    }

    const agenturRaw = ressource?.agenturen
    const agentur = Array.isArray(agenturRaw) ? agenturRaw[0] : agenturRaw

    const isAccepted = link.status === 'Zugesagt'

    const profile = {
      profileId:      ressource.id,
      displayName:    ressource.name,
      seniority:      ressource.erfahrungslevel ?? null,
      availableFrom:  ressource.verfuegbar_ab ?? null,
      utilizationPct: ressource.verfuegbarkeit ?? null,
      location: {
        mode: ressource.arbeitsmodell ?? null,
        city: ressource.wohnort ?? null,
      },
      rate: ressource.ek_tagesrate != null
        ? { amount: ressource.ek_tagesrate, currency: 'EUR', per: 'DAY' }
        : null,
      contact: isAccepted
        ? { email: ressource.email_geschaeftlich ?? null, phone: ressource.telefon_geschaeftlich ?? null }
        : null,
    }

    return {
      matchId:     link.id,
      status:      STATUS_MAP[link.status] ?? link.status,
      matchScore:  scoreMap.get(ressource.id) ?? null,
      submittedAt: link.created_at,
      updatedAt:   link.updated_at,
      partner:     agentur ? { id: agentur.id, name: agentur.name } : null,
      profile,
    }
  })

  return NextResponse.json({ data: vorschlaege })
}
