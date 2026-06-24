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
  Junior: 'JUNIOR', Mid: 'MID', Senior: 'SENIOR', Expert: 'EXPERT',
}

const WORKMODEL_MAP: Record<string, string> = {
  Remote: 'REMOTE', Hybrid: 'HYBRID', Onsite: 'ONSITE',
  Onshore: 'ONSHORE', Nearshore: 'NEARSHORE', Offshore: 'OFFSHORE',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:positions:read')
  if (auth.error) return auth.error

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('vakanzen')
    .select(`
      id, rolle, branche, beschreibung, skills, skills_nice_have,
      erfahrungslevel, startdatum, enddatum, auslastung,
      arbeitsmodell, standort, status, published_at, published
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  if (!data.published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Position nicht gefunden' } }, { status: 404 })
  }

  return NextResponse.json({
    position: {
      id: data.id,
      role: data.rolle,
      industry: data.branche,
      description: data.beschreibung,
      skills: data.skills ?? [],
      skillsNiceToHave: data.skills_nice_have ?? [],
      seniority: SENIORITY_MAP[data.erfahrungslevel ?? ''] ?? data.erfahrungslevel,
      startDate: data.startdatum,
      endDate: data.enddatum,
      utilizationPct: data.auslastung,
      workModel: WORKMODEL_MAP[data.arbeitsmodell ?? ''] ?? data.arbeitsmodell,
      location: data.standort ?? null,
      status: VAKANZ_STATUS_MAP[data.status ?? ''] ?? 'OPEN',
      publishedAt: data.published_at ?? null,
    },
  })
}
