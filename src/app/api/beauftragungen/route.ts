import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const beauftragungSchema = z.object({
  profil_id: z.string().uuid(),
  agentur_id: z.string().uuid(),
  einkaufspreis: z.number().min(0),
  margenaufschlag: z.number().min(0).default(0),
  startdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

// ── GET /api/beauftragungen ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { error: authErr } = await requireManager(supabase)

  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr === 'inactive') return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (authErr === 'forbidden') return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const nurAktive = searchParams.get('aktiv') !== 'false'

  const query = supabase
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
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (nurAktive) query.eq('aktiv', true)

  const { data, error } = await query

  if (error) {
    console.error('GET /api/beauftragungen error:', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Beauftragungen' }, { status: 500 })
  }

  const result = (data ?? []).map((b) => {
    const { kandidaten_profile, agenturen, ...rest } = b as typeof b & {
      kandidaten_profile: { kandidatenname: string; erfahrungslevel: string; vakanz_id: string; vakanzen: { titel: string } | null } | null
      agenturen: { name: string } | null
    }
    const marge_euro = Number(rest.margenaufschlag)
    const vk = Number(rest.verkaufspreis)
    return {
      ...rest,
      kandidatenname: kandidaten_profile?.kandidatenname ?? '–',
      erfahrungslevel: kandidaten_profile?.erfahrungslevel ?? '–',
      vakanz_titel: kandidaten_profile?.vakanzen?.titel ?? '–',
      agentur_name: agenturen?.name ?? '–',
      marge_prozent: vk > 0 ? Math.round((marge_euro / vk) * 100) : 0,
    }
  })

  return NextResponse.json(result)
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
