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
    aktivitaetRes,
    pipelineRes,
    agenturPerfRes,
    vakanzOhneProfileRes,
    baldAuslaufendRes,
  ] = await Promise.allSettled([
    supabase.from('vakanzen').select('id', { count: 'exact', head: true }).eq('status', 'Offen'),
    supabase.from('beauftragungen').select('margenaufschlag, stunden_woche').eq('aktiv', true),
    supabase
      .from('kandidaten_profile')
      .select('id, kandidatenname, status, ki_score, created_at, vakanzen!inner(titel), agenturen!inner(name)')
      .order('updated_at', { ascending: false })
      .limit(10),
    // Pipeline: alle Profile nach Status
    supabase.from('kandidaten_profile').select('status'),
    // Agentur-Performance: alle Profile mit Agentur + KI-Score
    supabase.from('kandidaten_profile').select('agentur_id, ki_score, agenturen!inner(name)').not('agentur_id', 'is', null),
    // Vakanzen ohne Profile: offene Vakanzen mit 0 Einreichungen
    supabase.from('vakanzen').select('id, rolle, created_at, kandidaten_profile(id)').eq('status', 'Offen').order('created_at', { ascending: true }),
    // Bald auslaufende Vakanzen (enddatum ≤ 30 Tage)
    supabase.from('vakanzen').select('id, rolle, enddatum').eq('status', 'Offen').not('enddatum', 'is', null).lte('enddatum', in30Days).gte('enddatum', today).order('enddatum', { ascending: true }).limit(5),
  ])

  const vakanzenCount = vakanzenRes.status === 'fulfilled' && !vakanzenRes.value.error ? (vakanzenRes.value.count ?? 0) : 0
  const beauftragungen = beauftragungRes.status === 'fulfilled' && !beauftragungRes.value.error ? (beauftragungRes.value.data ?? []) : []
  const aktivitaetData = aktivitaetRes.status === 'fulfilled' && !aktivitaetRes.value.error ? (aktivitaetRes.value.data ?? []) : []

  const monatsMarge = beauftragungen.reduce((sum, b) => sum + Number(b.margenaufschlag) * b.stunden_woche * 4, 0)

  // Pipeline
  const pipelineRaw = pipelineRes.status === 'fulfilled' && !pipelineRes.value.error ? (pipelineRes.value.data ?? []) : []
  const pipeline: Record<string, number> = {}
  for (const p of pipelineRaw) {
    pipeline[p.status] = (pipeline[p.status] ?? 0) + 1
  }
  const inPruefung = pipeline['In Prüfung'] ?? 0

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

  const aktivitaet = aktivitaetData.map((p) => {
    const { vakanzen, agenturen, ...rest } = p as typeof p & {
      vakanzen: { titel: string } | null
      agenturen: { name: string } | null
    }
    return { ...rest, vakanz_titel: vakanzen?.titel ?? '–', agentur_name: agenturen?.name ?? '–' }
  })

  return NextResponse.json({
    rolle: 'Manager',
    kpis: {
      aktive_vakanzen: vakanzenCount,
      in_pruefung: inPruefung,
      aktive_beauftragungen: beauftragungen.length,
      monats_marge: Math.round(monatsMarge),
    },
    pipeline,
    agentur_performance: agenturPerformance,
    vakanzen_ohne_profile: vakanzenOhneProfile,
    bald_auslaufend: baldAuslaufend,
    aktivitaet,
  })
}