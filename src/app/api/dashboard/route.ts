import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/dashboard ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv, agentur_id').eq('id', user.id).single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  const isAgentur = profile.rolle === 'Agentur'

  if (!isManager && !isAgentur) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (isAgentur) {
    // ── Agentur-Dashboard ────────────────────────────────────────────────────
    const agenturId = profile.agentur_id
    if (!agenturId) return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })

    const [vakanzenRes, profileRes, poolRes, aktivitaetRes] = await Promise.allSettled([
      supabase.from('vakanzen').select('id', { count: 'exact', head: true }).eq('status', 'Offen'),
      supabase.from('kandidaten_profile').select('id', { count: 'exact', head: true }).eq('agentur_id', agenturId),
      supabase.from('ressourcen').select('id', { count: 'exact', head: true }).eq('agentur_id', agenturId).neq('verfuegbarkeit', 'Deaktiviert'),
      supabase
        .from('kandidaten_profile')
        .select('id, kandidatenname, status, ki_score, created_at, vakanzen!inner(titel)')
        .eq('agentur_id', agenturId)
        .order('updated_at', { ascending: false })
        .limit(10),
    ])

    const vakanzenCount = vakanzenRes.status === 'fulfilled' && !vakanzenRes.value.error ? (vakanzenRes.value.count ?? 0) : 0
    const profileCount = profileRes.status === 'fulfilled' && !profileRes.value.error ? (profileRes.value.count ?? 0) : 0
    const poolCount = poolRes.status === 'fulfilled' && !poolRes.value.error ? (poolRes.value.count ?? 0) : 0
    const aktivitaetData = aktivitaetRes.status === 'fulfilled' && !aktivitaetRes.value.error ? (aktivitaetRes.value.data ?? []) : []

    const aktivitaet = aktivitaetData.map((p) => {
      const { vakanzen, ...rest } = p as typeof p & { vakanzen: { titel: string } | null }
      return { ...rest, vakanz_titel: vakanzen?.titel ?? '–', agentur_name: '' }
    })

    return NextResponse.json({
      rolle: 'Agentur',
      kpis: {
        aktive_vakanzen: vakanzenCount,
        eingereichte_profile: profileCount,
        pool_groesse: poolCount,
        monats_marge: null,
      },
      aktivitaet,
    })
  }

  // ── Manager-Dashboard ────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    vakanzenRes,
    beauftragungRes,
    pipelineRes,
    agenturPerfRes,
    vakanzOhneProfileRes,
    baldAuslaufendRes,
    // New queries
    neuesteVakanzenRes,
    poolTotalRes,
    poolLinkStatusRes,
    baldVerfuegbarRes,
    ressourcenPipelineRes,
  ] = await Promise.allSettled([
    supabase.from('vakanzen').select('id', { count: 'exact', head: true }).eq('status', 'Offen'),
    supabase.from('beauftragungen').select('margenaufschlag, stunden_woche').eq('aktiv', true),
    supabase.from('kandidaten_profile').select('status'),
    supabase.from('kandidaten_profile').select('agentur_id, ki_score, agenturen!inner(name)').not('agentur_id', 'is', null),
    supabase.from('vakanzen').select('id, rolle, created_at, kandidaten_profile(id)').eq('status', 'Offen').order('created_at', { ascending: true }),
    supabase.from('vakanzen').select('id, rolle, enddatum').eq('status', 'Offen').not('enddatum', 'is', null).lte('enddatum', in30Days).gte('enddatum', today).order('enddatum', { ascending: true }).limit(5),
    // 3 newest open vakanzen for Tile 1
    supabase.from('vakanzen').select('id, rolle, created_at').eq('status', 'Offen').order('created_at', { ascending: false }).limit(3),
    // Pool total count (non-deactivated)
    supabase.from('ressourcen').select('id', { count: 'exact', head: true }).neq('verfuegbarkeit', 'Deaktiviert'),
    // All link statuses for distribution
    supabase.from('ressource_vakanz_links').select('status'),
    // Resources becoming available in next 30 days (Tile 3)
    supabase.from('ressourcen').select('id, name, rolle, verfuegbar_ab').eq('verfuegbarkeit', 'Verfügbar ab').not('verfuegbar_ab', 'is', null).lte('verfuegbar_ab', in30Days).gte('verfuegbar_ab', today).order('verfuegbar_ab', { ascending: true }).limit(8),
    // Full resource pipeline (replaces aktivitaet for manager)
    supabase.from('ressource_vakanz_links').select(`
      id, status, updated_at,
      ressourcen(id, name, rolle, ek_tagesrate)
    `).order('updated_at', { ascending: false }).limit(200),
  ])

  const vakanzenCount = vakanzenRes.status === 'fulfilled' && !vakanzenRes.value.error ? (vakanzenRes.value.count ?? 0) : 0
  const beauftragungen = beauftragungRes.status === 'fulfilled' && !beauftragungRes.value.error ? (beauftragungRes.value.data ?? []) : []
  const monatsMarge = beauftragungen.reduce((sum, b) => sum + Number(b.margenaufschlag) * b.stunden_woche * 4, 0)

  // Pipeline (kandidaten_profile — kept for existing chart)
  const pipelineRaw = pipelineRes.status === 'fulfilled' && !pipelineRes.value.error ? (pipelineRes.value.data ?? []) : []
  const pipeline: Record<string, number> = {}
  for (const p of pipelineRaw) pipeline[p.status] = (pipeline[p.status] ?? 0) + 1

  // Agentur-Performance
  const agenturRaw = agenturPerfRes.status === 'fulfilled' && !agenturPerfRes.value.error ? (agenturPerfRes.value.data ?? []) : []
  const agenturMap: Record<string, { name: string; count: number; scoreSum: number; scoreCount: number }> = {}
  for (const p of agenturRaw as { agentur_id: string | null; ki_score: number | null; agenturen: unknown }[]) {
    if (!p.agentur_id) continue
    const agenturen = p.agenturen as { name: string }[] | { name: string } | null
    const name = Array.isArray(agenturen) ? agenturen[0]?.name : agenturen?.name
    if (!name) continue
    if (!agenturMap[p.agentur_id]) agenturMap[p.agentur_id] = { name, count: 0, scoreSum: 0, scoreCount: 0 }
    agenturMap[p.agentur_id].count++
    if (p.ki_score !== null) { agenturMap[p.agentur_id].scoreSum += p.ki_score; agenturMap[p.agentur_id].scoreCount++ }
  }
  const agenturPerformance = Object.values(agenturMap)
    .map(({ name, count, scoreSum, scoreCount }) => ({ name, count, avg_score: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null }))
    .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))

  // Vakanzen ohne Profile
  type VakanzWithProfiles = { id: string; rolle: string; created_at: string; kandidaten_profile: { id: string }[] }
  const vakanzRaw = vakanzOhneProfileRes.status === 'fulfilled' && !vakanzOhneProfileRes.value.error ? (vakanzOhneProfileRes.value.data as VakanzWithProfiles[] ?? []) : []
  const vakanzenOhneProfile = vakanzRaw
    .filter(v => !v.kandidaten_profile || v.kandidaten_profile.length === 0)
    .slice(0, 5)
    .map(v => ({
      id: v.id,
      rolle: v.rolle,
      alter_tage: Math.floor((Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))

  // Bald auslaufende Vakanzen
  const baldAuslaufend = baldAuslaufendRes.status === 'fulfilled' && !baldAuslaufendRes.value.error ? (baldAuslaufendRes.value.data ?? []) : []

  // Neueste Vakanzen (Tile 1)
  const neuesteVakanzen = neuesteVakanzenRes.status === 'fulfilled' && !neuesteVakanzenRes.value.error
    ? (neuesteVakanzenRes.value.data ?? []).map(v => ({ id: v.id, rolle: v.rolle, created_at: v.created_at }))
    : []

  // Pool total (Tile 2)
  const poolTotal = poolTotalRes.status === 'fulfilled' && !poolTotalRes.value.error ? (poolTotalRes.value.count ?? 0) : 0

  // Pool link status distribution (Tile 2)
  const poolLinkRaw = poolLinkStatusRes.status === 'fulfilled' && !poolLinkStatusRes.value.error ? (poolLinkStatusRes.value.data ?? []) : []
  const byLinkStatus: Record<string, number> = {}
  for (const l of poolLinkRaw as { status: string }[]) {
    byLinkStatus[l.status] = (byLinkStatus[l.status] ?? 0) + 1
  }

  // Bald verfügbar (Tile 3)
  const baldVerfuegbar = baldVerfuegbarRes.status === 'fulfilled' && !baldVerfuegbarRes.value.error
    ? (baldVerfuegbarRes.value.data ?? []).map(r => ({ id: r.id, name: r.name, rolle: r.rolle ?? null, verfuegbar_ab: r.verfuegbar_ab as string }))
    : []

  // Ressourcen-Pipeline (replaces aktivitaet for manager)
  const pipelineRawLinks = ressourcenPipelineRes.status === 'fulfilled' && !ressourcenPipelineRes.value.error
    ? (ressourcenPipelineRes.value.data ?? [])
    : []
  const ressourcenPipeline = (pipelineRawLinks as unknown as {
    id: string
    status: string
    updated_at: string
    ressourcen: { id: string; name: string; rolle: string | null; ek_tagesrate: number | null } | { id: string; name: string; rolle: string | null; ek_tagesrate: number | null }[] | null
  }[]).map(l => {
    const res = Array.isArray(l.ressourcen) ? l.ressourcen[0] ?? null : l.ressourcen
    return {
      id: l.id,
      status: l.status,
      updated_at: l.updated_at,
      ressource_id: res?.id ?? '',
      ressource_name: res?.name ?? '–',
      ressource_rolle: res?.rolle ?? null,
      ressource_ek_tagesrate: res?.ek_tagesrate ?? null,
    }
  })

  return NextResponse.json({
    rolle: 'Manager',
    kpis: {
      aktive_vakanzen: vakanzenCount,
      in_pruefung: pipeline['In Prüfung'] ?? 0,
      aktive_beauftragungen: beauftragungen.length,
      monats_marge: Math.round(monatsMarge),
    },
    neueste_vakanzen: neuesteVakanzen,
    pool_stats: { total: poolTotal, by_link_status: byLinkStatus },
    bald_verfuegbar: baldVerfuegbar,
    pipeline,
    agentur_performance: agenturPerformance,
    vakanzen_ohne_profile: vakanzenOhneProfile,
    bald_auslaufend: baldAuslaufend,
    ressourcen_pipeline: ressourcenPipeline,
  })
}
