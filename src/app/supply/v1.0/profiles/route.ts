import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior',
  MID:    'Mid',
  SENIOR: 'Senior',
  LEAD:   'Expert',
  EXPERT: 'Expert',
}

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'profile:read')
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const skillsParam    = searchParams.get('skills')
  const seniorityParam = searchParams.get('seniority')
  const availableFrom  = searchParams.get('availableFrom')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const cursor = searchParams.get('cursor') // ISO-Timestamp des letzten Eintrags

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('ressourcen')
    .select('id, name, skills, erfahrungslevel, verfuegbar_ab, verfuegbarkeit, arbeitsmodell, wohnort, ek_tagesrate')
    .neq('verfuegbarkeit', 'Deaktiviert')
    .order('name', { ascending: true })
    .limit(limit + 1) // +1 um nextCursor zu ermitteln

  if (skillsParam) {
    const skills = skillsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (skills.length > 0) {
      query = query.overlaps('skills', skills)
    }
  }

  if (seniorityParam) {
    const dbSeniority = SENIORITY_MAP[seniorityParam.toUpperCase()] ?? seniorityParam
    query = query.eq('erfahrungslevel', dbSeniority)
  }

  if (availableFrom) {
    query = query.lte('verfuegbar_ab', availableFrom)
  }

  if (cursor) {
    query = query.gte('name', cursor)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden der Profile' } }, { status: 500 })

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageData = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? pageData[pageData.length - 1].name : null

  const profiles = pageData.map((r) => ({
    profileId:     r.id,
    displayName:   r.name,
    seniority:     r.erfahrungslevel ?? null,
    skills:        r.skills ?? [],
    availableFrom: r.verfuegbar_ab ?? null,
    location: {
      mode: r.arbeitsmodell ?? null,
      city: r.wohnort ?? null,
    },
    rate: r.ek_tagesrate != null
      ? { amount: r.ek_tagesrate, currency: 'EUR', per: 'DAY' }
      : null,
  }))

  return NextResponse.json({ data: profiles, nextCursor })
}
