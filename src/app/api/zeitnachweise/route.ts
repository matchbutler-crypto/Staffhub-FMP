import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractStundenFromPDF } from '@/lib/openai'
import { z } from 'zod'

export const maxDuration = 30

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/zeitnachweise?beauftragung_ids=id1,id2&monat=2026-05-01 ──────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('beauftragung_ids') ?? ''
  const monat = searchParams.get('monat')

  if (!monat || !idsParam) return NextResponse.json({ zeitnachweise: [] })

  let query = supabase
    .from('zeitnachweise')
    .select('id, beauftragung_id, monat, stunden_ist, tage_ist_override, abrechnung_status, uploaded_at, pdf_path')
    .eq('monat', monat)

  if (idsParam !== 'all') {
    const ids = idsParam.split(',').filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ zeitnachweise: [] })
    query = query.in('beauftragung_id', ids)
  } else if (profile.rolle === 'Agentur') {
    // Agentur darf nur Zeitnachweise ihrer eigenen Beauftragungen sehen
    if (!profile.agentur_id) return NextResponse.json({ zeitnachweise: [] })
    const { data: baufIds } = await supabase
      .from('beauftragungen')
      .select('id')
      .eq('agentur_id', profile.agentur_id)
      .eq('aktiv', true)
    if (!baufIds || baufIds.length === 0) return NextResponse.json({ zeitnachweise: [] })
    query = query.in('beauftragung_id', baufIds.map((b) => b.id))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ zeitnachweise: data ?? [] })
}

const manualTageSchema = z.object({
  beauftragung_id: z.string().uuid(),
  monat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tage_ist_override: z.number().min(0).optional(),
  abrechnung_status: z.enum(['Offen', 'Rechnung gestellt', 'Bezahlt']).optional(),
})

// ── POST /api/zeitnachweise ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user, profile } = await getProfile(supabase)
  if (!profile?.aktiv || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  const isAgentur = profile.rolle === 'Agentur'
  if (!isManager && !isAgentur) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  // JSON-Pfad: manuelle Tage ohne PDF (nur Manager)
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    if (!isManager) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const parsed = manualTageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    if (parsed.data.tage_ist_override === undefined && parsed.data.abrechnung_status === undefined) {
      return NextResponse.json({ error: 'Mindestens tage_ist_override oder abrechnung_status muss angegeben werden' }, { status: 400 })
    }

    const upsertData: Record<string, unknown> = {
      beauftragung_id: parsed.data.beauftragung_id,
      monat: parsed.data.monat,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
    }
    if (parsed.data.tage_ist_override !== undefined) upsertData.tage_ist_override = parsed.data.tage_ist_override
    if (parsed.data.abrechnung_status !== undefined) upsertData.abrechnung_status = parsed.data.abrechnung_status

    const { data: record, error: dbError } = await supabase
      .from('zeitnachweise')
      .upsert(upsertData, { onConflict: 'beauftragung_id,monat' })
      .select('id, beauftragung_id, monat, stunden_ist, tage_ist_override, abrechnung_status, uploaded_at, pdf_path')
      .single()

    if (dbError) {
      console.error('POST /api/zeitnachweise (JSON) error:', dbError)
      return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
    }
    return NextResponse.json({ zeitnachweis: record })
  }

  // FormData-Pfad: PDF-Upload
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const beauftragungId = formData.get('beauftragung_id') as string | null
  const monat = formData.get('monat') as string | null

  if (!file || !beauftragungId || !monat) {
    return NextResponse.json({ error: 'file, beauftragung_id und monat sind erforderlich' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei darf maximal 10 MB groß sein' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monat)) {
    return NextResponse.json({ error: 'Ungültiges Monat-Format (erwartet YYYY-MM-DD)' }, { status: 400 })
  }

  // Agentur ownership check
  if (isAgentur) {
    const { data: bauf } = await supabase
      .from('beauftragungen')
      .select('agentur_id')
      .eq('id', beauftragungId)
      .single()
    if (!bauf || bauf.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Beauftragung' }, { status: 403 })
    }
  }

  const monthLabel = monat.slice(0, 7)
  const storagePath = `${beauftragungId}/${monthLabel}.pdf`
  const pdfBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('zeitnachweise')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei' }, { status: 500 })
  }

  let stundenIst: number | null = null
  let parsedRaw: unknown = null
  try {
    stundenIst = await extractStundenFromPDF(pdfBuffer)
  } catch (err) {
    parsedRaw = { error: err instanceof Error ? err.message : String(err) }
  }

  const { data: record, error: dbError } = await supabase
    .from('zeitnachweise')
    .upsert(
      {
        beauftragung_id: beauftragungId,
        monat,
        stunden_ist: stundenIst,
        pdf_path: storagePath,
        parsed_raw: parsedRaw,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'beauftragung_id,monat' }
    )
    .select('id, beauftragung_id, monat, stunden_ist, tage_ist_override, abrechnung_status, uploaded_at, pdf_path')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ zeitnachweis: record })
}
