import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const beauftragungSchema = z.object({
  profil_id: z.string().uuid(),
  agentur_id: z.string().uuid(),
  einkaufspreis: z.number().min(0),
  margenaufschlag: z.number().min(0).default(0),
  startdatum: z.string().date('Ungültiges Datum (erwartet YYYY-MM-DD)'),
  stunden_woche: z.number().int().min(1).max(168),
})

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null, error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return { user, profile, error: 'inactive' as const }
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') {
    return { user, profile, error: 'forbidden' as const }
  }
  return { user, profile, error: null }
}

async function requireAny(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null, error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return { user, profile, error: 'inactive' as const }
  return { user, profile, error: null }
}

// ── GET /api/beauftragungen ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile, error: authErr } = await requireAny(supabase)

  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr === 'inactive') return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  const isAgentur = profile?.rolle === 'Agentur'
  const isManager = profile?.rolle === 'Staffhub Manager' || profile?.rolle === 'Admin' || profile?.rolle === 'Controller'

  if (!isAgentur && !isManager) {
    return NextResponse.json({ error: 'Keine Berechtigung', debug_rolle: profile?.rolle }, { status: 403 })
  }

  if (isAgentur && !profile?.agentur_id) {
    return NextResponse.json({ error: 'Kein Agentur-Profil gefunden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const nurAktive = searchParams.get('aktiv') !== 'false'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '100', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('beauftragungen')
    .select(`
      id,
      profil_id,
      agentur_id,
      einkaufspreis,
      margenaufschlag,
      verkaufspreis,
      startdatum,
      stunden_woche,
      aktiv,
      created_at,
      updated_at,
      kandidaten_profile!inner(kandidatenname, erfahrungslevel, vakanz_id, vakanzen!inner(titel)),
      agenturen!inner(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (nurAktive) query = query.eq('aktiv', true)

  // Agentur sieht nur eigene Beauftragungen
  if (isAgentur) {
    query = query.eq('agentur_id', profile.agentur_id!)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('GET /api/beauftragungen error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Laden der Beauftragungen' }, { status: 500 })
  }

  const result = (data ?? []).map((b) => {
    const { kandidaten_profile, agenturen, einkaufspreis, margenaufschlag, verkaufspreis, ...rest } = b as typeof b & {
      kandidaten_profile: { kandidatenname: string; erfahrungslevel: string; vakanz_id: string; vakanzen: { titel: string } | null } | null
      agenturen: { name: string } | null
    }
    const marge_euro = Number(margenaufschlag)
    const vk = Number(verkaufspreis)

    const base = {
      ...rest,
      kandidatenname: kandidaten_profile?.kandidatenname ?? '–',
      erfahrungslevel: kandidaten_profile?.erfahrungslevel ?? '–',
      vakanz_titel: kandidaten_profile?.vakanzen?.titel ?? '–',
      agentur_name: agenturen?.name ?? '–',
    }

    if (isManager) {
      return {
        ...base,
        einkaufspreis: Number(einkaufspreis),
        margenaufschlag: Number(margenaufschlag),
        verkaufspreis: vk,
        marge_prozent: vk > 0 ? Math.round((marge_euro / vk) * 100) : 0,
      }
    }

    return base
  })

  if (isManager) {
    const [pipelineRes, agenturPerfRes] = await Promise.allSettled([
      supabase.from('kandidaten_profile').select('status'),
      supabase.from('kandidaten_profile')
        .select('agentur_id, ki_score, agenturen!inner(name)')
        .not('agentur_id', 'is', null),
    ])

    const pipelineRaw = pipelineRes.status === 'fulfilled' && !pipelineRes.value.error
      ? (pipelineRes.value.data ?? [])
      : []
    const pipeline: Record<string, number> = {}
    for (const p of pipelineRaw) pipeline[p.status] = (pipeline[p.status] ?? 0) + 1

    type AgenturPerfRaw = { agentur_id: string | null; ki_score: number | null; agenturen: { name: string }[] | { name: string } | null }
    const agenturRaw = agenturPerfRes.status === 'fulfilled' && !agenturPerfRes.value.error
      ? (agenturPerfRes.value.data as AgenturPerfRaw[] ?? [])
      : []
    const agenturMap: Record<string, { name: string; count: number; scoreSum: number; scoreCount: number }> = {}
    for (const p of agenturRaw) {
      if (!p.agentur_id) continue
      const agenturen = p.agenturen
      const name = Array.isArray(agenturen) ? agenturen[0]?.name : agenturen?.name
      if (!name) continue
      if (!agenturMap[p.agentur_id]) agenturMap[p.agentur_id] = { name, count: 0, scoreSum: 0, scoreCount: 0 }
      agenturMap[p.agentur_id].count++
      if (p.ki_score !== null) { agenturMap[p.agentur_id].scoreSum += p.ki_score; agenturMap[p.agentur_id].scoreCount++ }
    }
    const agentur_performance = Object.values(agenturMap)
      .map(({ name, count, scoreSum, scoreCount }) => ({
        name,
        count,
        avg_score: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
      }))
      .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))

    return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, pipeline, agentur_performance, rolle: profile?.rolle })
  }

  return NextResponse.json({ data: result, total: count ?? 0, page, pageSize, rolle: profile?.rolle })
}

// ── POST /api/beauftragungen ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { error: authErr } = await requireManager(supabase)

  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr === 'inactive') return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (authErr === 'forbidden') return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = beauftragungSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Prüfen ob Profil Status = Beauftragt
  const { data: profil } = await supabase
    .from('kandidaten_profile')
    .select('id, status')
    .eq('id', parsed.data.profil_id)
    .single()

  if (!profil) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (profil.status !== 'Beauftragt') {
    return NextResponse.json(
      { error: 'Beauftragung nur bei Status „Beauftragt" möglich' },
      { status: 409 }
    )
  }

  const { data: neu, error } = await supabase
    .from('beauftragungen')
    .insert({
      profil_id: parsed.data.profil_id,
      agentur_id: parsed.data.agentur_id,
      einkaufspreis: parsed.data.einkaufspreis,
      margenaufschlag: parsed.data.margenaufschlag,
      startdatum: parsed.data.startdatum,
      stunden_woche: parsed.data.stunden_woche,
    })
    .select('id, verkaufspreis, aktiv, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Anlegen der Beauftragung' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: neu }, { status: 201 })
}
