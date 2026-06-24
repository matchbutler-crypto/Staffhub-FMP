import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const VAKANZ_STATUS_MAP: Record<string, string> = {
  Offen: 'OPEN',
  Besetzt: 'FILLED',
  Geschlossen: 'CLOSED',
  'Ausreichend Profile': 'OPEN',
}

const SENIORITY_MAP: Record<string, string> = {
  Junior: 'JUNIOR',
  Mid: 'MID',
  Senior: 'SENIOR',
  Expert: 'EXPERT',
}

const WORKMODEL_MAP: Record<string, string> = {
  Remote: 'REMOTE',
  Hybrid: 'HYBRID',
  Onsite: 'ONSITE',
  Onshore: 'ONSHORE',
  Nearshore: 'NEARSHORE',
  Offshore: 'OFFSHORE',
}

export async function GET(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:positions:read')
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor')

  const supabase = createServiceRoleClient()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('vakanzen')
    .select(`
      id, rolle, branche, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, auslastung,
      arbeitsmodell, standort, status, published_at, created_at
    `)
    .eq('published', true)
    .or(`status.neq.Besetzt,besetzt_seit.gt.${threeDaysAgo},besetzt_seit.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const rows = hasMore ? data!.slice(0, limit) : (data ?? [])

  const positions = rows.map((v) => ({
    id: v.id,
    role: v.rolle,
    industry: v.branche,
    description: v.beschreibung,
    skills: v.skills ?? [],
    skillsNiceToHave: v.skills_nice_have ?? [],
    seniority: SENIORITY_MAP[v.erfahrungslevel ?? ''] ?? v.erfahrungslevel,
    startDate: v.startdatum,
    endDate: v.enddatum,
    utilizationPct: v.auslastung,
    workModel: WORKMODEL_MAP[v.arbeitsmodell ?? ''] ?? v.arbeitsmodell,
    location: v.standort ?? null,
    status: VAKANZ_STATUS_MAP[v.status ?? ''] ?? 'OPEN',
    publishedAt: v.published_at ?? null,
  }))

  const nextCursor = hasMore ? rows[rows.length - 1]?.created_at ?? null : null

  return NextResponse.json({ data: positions, nextCursor })
}
