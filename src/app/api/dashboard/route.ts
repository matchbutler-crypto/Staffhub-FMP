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
  const [vakanzenRes, profileRes, beauftragungRes, aktivitaetRes] = await Promise.allSettled([
    supabase.from('vakanzen').select('id', { count: 'exact', head: true }).eq('status', 'Offen'),
    supabase.from('kandidaten_profile').select('id', { count: 'exact', head: true }),
    supabase.from('beauftragungen').select('margenaufschlag, stunden_woche').eq('aktiv', true),
    supabase
      .from('kandidaten_profile')
      .select('id, kandidatenname, status, ki_score, created_at, vakanzen!inner(titel), agenturen!inner(name)')
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const vakanzenCount = vakanzenRes.status === 'fulfilled' && !vakanzenRes.value.error ? (vakanzenRes.value.count ?? 0) : 0
  const profileCount = profileRes.status === 'fulfilled' && !profileRes.value.error ? (profileRes.value.count ?? 0) : 0
  const beauftragungen = beauftragungRes.status === 'fulfilled' && !beauftragungRes.value.error ? (beauftragungRes.value.data ?? []) : []
  const aktivitaetData = aktivitaetRes.status === 'fulfilled' && !aktivitaetRes.value.error ? (aktivitaetRes.value.data ?? []) : []

  const monatsMarge = beauftragungen.reduce((sum, b) => sum + Number(b.margenaufschlag) * b.stunden_woche * 4, 0)

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
      eingereichte_profile: profileCount,
      aktive_beauftragungen: beauftragungen.length,
      monats_marge: Math.round(monatsMarge),
    },
    aktivitaet,
  })
}
