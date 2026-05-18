import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computePreise } from '@/lib/beauftragungen-pricing'

const updateSchema = z.object({
  agentur_rohpreis: z.number().positive(),
  marge_inkludiert: z.boolean().default(false),
  margenaufschlag: z.number().min(0).default(75),
  startdatum: z.string().date('Ungültiges Datum (erwartet YYYY-MM-DD)'),
  stunden_woche: z.number().int().min(1).max(168),
})

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'auth' as const }
  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv').eq('id', user.id).single()
  if (!profile?.aktiv) return { error: 'inactive' as const }
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') return { error: 'forbidden' as const }
  return { error: null }
}

// ── PUT /api/beauftragungen/[id] ───────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { error: authErr } = await requireManager(supabase)
  if (authErr === 'auth') return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (authErr) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { agentur_rohpreis, margenaufschlag, marge_inkludiert } = parsed.data
  const { einkaufspreis, verkaufspreis } = computePreise(agentur_rohpreis, margenaufschlag, marge_inkludiert)

  if (einkaufspreis <= 0) {
    return NextResponse.json(
      { error: 'EK-Preis muss > 0 sein (Rohpreis muss größer als Marge sein wenn "Marge enthalten")' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({
      agentur_rohpreis,
      marge_inkludiert,
      einkaufspreis,
      margenaufschlag,
      verkaufspreis,
      startdatum: parsed.data.startdatum,
      stunden_woche: parsed.data.stunden_woche,
    })
    .eq('id', id)
    .select('id, agentur_rohpreis, marge_inkludiert, einkaufspreis, margenaufschlag, verkaufspreis, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}

// ── PATCH /api/beauftragungen/[id] ────────────────────────────────────────────
// Nur margenaufschlag ändern — recomputes EK/VK basierend auf gespeichertem Rohpreis

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (!['Controller', 'Staffhub Manager', 'Admin'].includes(profile.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = z.object({ margenaufschlag: z.number().min(0) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { data: current, error: fetchErr } = await supabase
    .from('beauftragungen')
    .select('agentur_rohpreis, marge_inkludiert')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
  }

  const { einkaufspreis, verkaufspreis } = computePreise(
    Number(current.agentur_rohpreis),
    parsed.data.margenaufschlag,
    current.marge_inkludiert
  )

  const { data, error } = await supabase
    .from('beauftragungen')
    .update({ margenaufschlag: parsed.data.margenaufschlag, einkaufspreis, verkaufspreis })
    .eq('id', id)
    .select('id, margenaufschlag, einkaufspreis, verkaufspreis, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Beauftragung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ beauftragung: data })
}
